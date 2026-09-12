package controller_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/config"
	"github.com/louiemansour/wikilinks/service/internal/controller"
	"github.com/louiemansour/wikilinks/service/internal/graph"
	"github.com/louiemansour/wikilinks/service/internal/service"
)

// Reuses the golden fixture from guess_test.go: Article_A -> Article_B
// (disconnected component) and Article_C -> Article_D -> Article_E, with
// Article_E as today's hidden answer. Article_D has a single outbound edge
// straight to the answer, so guessing Article_D exercises the "direct link
// to the hidden article" neighbor-masking case; guessing Article_C exercises
// "no direct link" (its only neighbor is Article_D); guessing Article_A
// exercises the disconnected/no-path-found case.
func newRevealGuessTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	writeGoldenFixture(t, dir)

	g, err := graph.Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	schedulePath := filepath.Join(dir, "daily_schedule.json")
	today := time.Now().UTC().Format("2006-01-02")
	scheduleJSON := `{"` + today + `": {"article": "Article_E", "category": "Thing"}}`
	if err := os.WriteFile(schedulePath, []byte(scheduleJSON), 0o644); err != nil {
		t.Fatalf("write schedule: %v", err)
	}
	sched, err := config.LoadDailySchedule(schedulePath)
	if err != nil {
		t.Fatalf("LoadDailySchedule: %v", err)
	}

	mux := http.NewServeMux()
	controller.NewRevealGuess(service.NewGuess(g, sched)).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

type revealGuessResponseBody struct {
	Guess     string `json:"guess"`
	Correct   bool   `json:"correct"`
	Lost      bool   `json:"lost"`
	Answer    string `json:"answer"`
	Neighbors []struct {
		ID    uint32 `json:"id"`
		Title string `json:"title"`
	} `json:"neighbors"`
	NoPathFound bool       `json:"noPathFound"`
	PathsFound  int        `json:"pathsFound"`
	MinHops     int        `json:"minHops"`
	Paths       [][]string `json:"paths"`
	GraphData   struct {
		Nodes []struct {
			ID      string `json:"id"`
			Variant string `json:"variant"`
			Label   string `json:"label"`
		} `json:"nodes"`
		Links []struct {
			Source string `json:"source"`
			Target string `json:"target"`
		} `json:"links"`
	} `json:"graphData"`
}

func decodeRevealGuessBody(t *testing.T, resp *http.Response) (revealGuessResponseBody, string) {
	t.Helper()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	var body revealGuessResponseBody
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode body: %v (raw=%s)", err, raw)
	}
	return body, string(raw)
}

func assertNoRealAnswerLeakReveal(t *testing.T, raw string) {
	t.Helper()
	if strings.Contains(raw, "Article_E") {
		t.Fatalf("response body leaks the real answer identity: %s", raw)
	}
}

// Contract: guess with no direct link to the hidden article gets a
// path-only reveal; its neighbor list never contains the hidden id/title
// (it doesn't have it as a neighbor at all here, but this also pins down
// that we don't accidentally inject it).
func TestRevealGuessEndpoint_noDirectLink_pathOnlyReveal(t *testing.T) {
	srv := newRevealGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/reveal-guess?guess=Article_C")
	if err != nil {
		t.Fatalf("GET /api/reveal-guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, raw := decodeRevealGuessBody(t, resp)

	if body.Correct || body.Lost {
		t.Fatalf("correct=%v lost=%v, want both false", body.Correct, body.Lost)
	}
	if body.PathsFound != 1 || body.MinHops != 2 {
		t.Fatalf("pathsFound=%d minHops=%d, want 1 and 2", body.PathsFound, body.MinHops)
	}
	for _, n := range body.Neighbors {
		if n.Title == "Article_E" {
			t.Fatalf("neighbor list leaks hidden article: %+v", body.Neighbors)
		}
	}
	// Article_C's only outbound neighbor is Article_D — not the hidden article.
	if len(body.Neighbors) != 1 || body.Neighbors[0].Title != "Article_D" {
		t.Fatalf("neighbors = %+v, want just Article_D", body.Neighbors)
	}
	assertNoRealAnswerLeakReveal(t, raw)
}

// Contract: guess that directly links to the hidden article has that id
// filtered out of its neighbor list entirely (masking holds even on a
// direct link).
func TestRevealGuessEndpoint_directLink_hiddenFilteredFromNeighbors(t *testing.T) {
	srv := newRevealGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/reveal-guess?guess=Article_D")
	if err != nil {
		t.Fatalf("GET /api/reveal-guess: %v", err)
	}
	defer resp.Body.Close()

	body, raw := decodeRevealGuessBody(t, resp)

	if body.Correct {
		t.Fatal("correct = true, want false")
	}
	// Article_D's only outbound edge is straight to the hidden answer
	// (Article_E) — RevealNeighbors must filter it out entirely.
	if len(body.Neighbors) != 0 {
		t.Fatalf("neighbors = %+v, want empty (hidden article filtered)", body.Neighbors)
	}
	assertNoRealAnswerLeakReveal(t, raw)
}

// Contract: a winning guess reveals the real hidden id/title, and any prior
// placeholder/path-node titles resolve to real titles in the same response.
func TestRevealGuessEndpoint_winningGuess_realTitlesResolvable(t *testing.T) {
	srv := newRevealGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/reveal-guess?guess=Article_E")
	if err != nil {
		t.Fatalf("GET /api/reveal-guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, _ := decodeRevealGuessBody(t, resp)

	if !body.Correct {
		t.Fatal("correct = false, want true")
	}
	if body.Answer != "Article_E" {
		t.Fatalf("answer = %q, want Article_E", body.Answer)
	}
	if len(body.Paths) != 1 || len(body.Paths[0]) != 1 || body.Paths[0][0] != "Article_E" {
		t.Fatalf("paths = %+v, want [[Article_E]]", body.Paths)
	}
}

// Contract: hitting the guess cap (guessNumber == MaxDailyGuesses) without
// solving returns lost:true with the same full-reveal payload as a win —
// the real answer title, and path nodes resolved (not placeholder-masked).
func TestRevealGuessEndpoint_guessCapHit_lostWithFullReveal(t *testing.T) {
	srv := newRevealGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/reveal-guess?guess=Article_C&guessNumber=5")
	if err != nil {
		t.Fatalf("GET /api/reveal-guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, _ := decodeRevealGuessBody(t, resp)

	if !body.Lost {
		t.Fatal("lost = false, want true")
	}
	if body.Correct {
		t.Fatal("correct = true, want false")
	}
	if body.Answer != "Article_E" {
		t.Fatalf("answer = %q, want Article_E", body.Answer)
	}

	foundAnswer := false
	for _, n := range body.GraphData.Nodes {
		if n.ID == "Article_E" {
			foundAnswer = true
			if n.Variant != "end" {
				t.Fatalf("answer node variant = %q, want end", n.Variant)
			}
			if n.Label != "Article_E" {
				t.Fatalf("answer node label = %q, want Article_E", n.Label)
			}
		}
	}
	if !foundAnswer {
		t.Fatalf("expected Article_E in graphData.nodes, got %+v", body.GraphData.Nodes)
	}
	for _, path := range body.Paths {
		for _, node := range path {
			if strings.HasPrefix(node, "hidden-") {
				t.Fatalf("path node %q still placeholder-masked after loss: %+v", node, body.Paths)
			}
		}
	}
}

// Contract: the hidden article's real identity never appears in any reveal
// response body prior to a correct or losing guess, across guessNumbers
// below the cap.
func TestRevealGuessEndpoint_hiddenIdentityNeverLeaksBeforeCorrectOrLoss(t *testing.T) {
	srv := newRevealGuessTestServer(t)

	for _, guessNumber := range []int{1, 2, 3, 4} {
		for _, guessArticle := range []string{"Article_A", "Article_C", "Article_D"} {
			resp, err := http.Get(srv.URL + "/api/reveal-guess?guess=" + guessArticle + "&guessNumber=" + strconv.Itoa(guessNumber))
			if err != nil {
				t.Fatalf("GET /api/reveal-guess: %v", err)
			}
			raw, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				t.Fatalf("read body: %v", err)
			}
			assertNoRealAnswerLeakReveal(t, string(raw))
		}
	}
}
