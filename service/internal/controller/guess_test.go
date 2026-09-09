package controller_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/config"
	"github.com/louiemansour/wikilinks/service/internal/controller"
	"github.com/louiemansour/wikilinks/service/internal/graph"
	"github.com/louiemansour/wikilinks/service/internal/service"
)

// The golden fixture (writeGoldenFixture, shared with starting/ending-nodes
// tests) wires two disconnected components: Article_A -> Article_B, and
// Article_C -> Article_D -> Article_E. Article_E is used as today's hidden
// answer, giving us a connected guess (Article_C), a disconnected guess
// (Article_A), and the answer itself (Article_E) for a winning guess.
func newGuessTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	writeGoldenFixture(t, dir)

	g, err := graph.Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	schedulePath := filepath.Join(dir, "daily_schedule.json")
	today := time.Now().UTC().Format("2006-01-02")
	scheduleJSON := `{"` + today + `": "Article_E"}`
	if err := os.WriteFile(schedulePath, []byte(scheduleJSON), 0o644); err != nil {
		t.Fatalf("write schedule: %v", err)
	}
	sched, err := config.LoadDailySchedule(schedulePath)
	if err != nil {
		t.Fatalf("LoadDailySchedule: %v", err)
	}

	mux := http.NewServeMux()
	controller.NewGuess(service.NewGuess(g, sched)).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestGuessEndpoint_pathFound(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess?guess=Article_C")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, raw := decodeGuessBody(t, resp)

	if body.Correct {
		t.Fatal("correct = true, want false")
	}
	if body.NoPathFound {
		t.Fatal("noPathFound = true, want false")
	}
	if body.PathsFound != 1 || body.MinHops != 2 {
		t.Fatalf("pathsFound=%d minHops=%d, want 1 and 2", body.PathsFound, body.MinHops)
	}
	assertNoRealAnswerLeak(t, raw)

	// Article_D (the intermediate node) must be visible; the answer must be masked.
	foundD := false
	for _, n := range body.GraphData.Nodes {
		if n.ID == "Article_D" {
			foundD = true
		}
		if n.Variant == "hidden-end" && n.Label != "" {
			t.Fatalf("hidden-end node has a label: %q", n.Label)
		}
	}
	if !foundD {
		t.Fatalf("expected Article_D in graphData.nodes, got %+v", body.GraphData.Nodes)
	}
}

func TestGuessEndpoint_noPathFound(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess?guess=Article_A")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, raw := decodeGuessBody(t, resp)

	if !body.NoPathFound {
		t.Fatal("noPathFound = false, want true")
	}
	if body.Correct {
		t.Fatal("correct = true, want false")
	}
	if len(body.GraphData.Links) != 0 {
		t.Fatalf("links = %v, want none", body.GraphData.Links)
	}
	if len(body.GraphData.Nodes) != 1 || body.GraphData.Nodes[0].ID != "Article_A" {
		t.Fatalf("nodes = %+v, want just the guess node", body.GraphData.Nodes)
	}
	assertNoRealAnswerLeak(t, raw)
}

func TestGuessEndpoint_correctGuess(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess?guess=Article_E")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, _ := decodeGuessBody(t, resp)

	if !body.Correct {
		t.Fatal("correct = false, want true")
	}
	if body.Answer != "Article_E" {
		t.Fatalf("answer = %q, want Article_E", body.Answer)
	}
}

func TestGuessEndpoint_lostRevealsAnswer_pathFound(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess?guess=Article_C&guessNumber=5")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	body, _ := decodeGuessBody(t, resp)

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
		if n.Variant == "hidden-end" {
			t.Fatalf("expected no hidden-end node once lost, got %+v", n)
		}
	}
	if !foundAnswer {
		t.Fatalf("expected Article_E in graphData.nodes, got %+v", body.GraphData.Nodes)
	}
}

func TestGuessEndpoint_lostRevealsAnswer_noPathFound(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess?guess=Article_A&guessNumber=5")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	body, _ := decodeGuessBody(t, resp)

	if !body.Lost {
		t.Fatal("lost = false, want true")
	}
	if !body.NoPathFound {
		t.Fatal("noPathFound = false, want true")
	}
	if body.Answer != "Article_E" {
		t.Fatalf("answer = %q, want Article_E", body.Answer)
	}

	foundAnswer := false
	for _, n := range body.GraphData.Nodes {
		if n.ID == "Article_E" && n.Variant == "end" {
			foundAnswer = true
		}
	}
	if !foundAnswer {
		t.Fatalf("expected revealed Article_E end node, got %+v", body.GraphData.Nodes)
	}
}

func TestGuessEndpoint_belowGuessLimit_answerStaysMasked(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess?guess=Article_C&guessNumber=4")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	body, raw := decodeGuessBody(t, resp)

	if body.Lost {
		t.Fatal("lost = true, want false at guessNumber=4")
	}
	assertNoRealAnswerLeak(t, raw)
}

func TestGuessEndpoint_invalidGuessNumber(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess?guess=Article_C&guessNumber=0")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestGuessEndpoint_missingGuess(t *testing.T) {
	srv := newGuessTestServer(t)

	resp, err := http.Get(srv.URL + "/api/guess")
	if err != nil {
		t.Fatalf("GET /api/guess: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

type guessResponseBody struct {
	Guess       string     `json:"guess"`
	Correct     bool       `json:"correct"`
	Lost        bool       `json:"lost"`
	Answer      string     `json:"answer"`
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

func decodeGuessBody(t *testing.T, resp *http.Response) (guessResponseBody, string) {
	t.Helper()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}

	var body guessResponseBody
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode body: %v (raw=%s)", err, raw)
	}
	return body, string(raw)
}

// assertNoRealAnswerLeak asserts the real hidden-end article's title never
// appears anywhere in the raw JSON response body prior to a correct guess.
func assertNoRealAnswerLeak(t *testing.T, raw string) {
	t.Helper()
	if strings.Contains(raw, "Article_E") {
		t.Fatalf("response body leaks the real answer identity: %s", raw)
	}
}
