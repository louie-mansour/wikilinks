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

// Reuses the golden fixture from starting_nodes_test.go: two disconnected
// components, with Article_E as today's hidden answer.
func newDailyInfoTestServer(t *testing.T) *httptest.Server {
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
	controller.NewGuess(service.NewGuess(g, sched)).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestDailyInfoEndpoint_returnsCategory(t *testing.T) {
	srv := newDailyInfoTestServer(t)

	resp, err := http.Get(srv.URL + "/api/daily-info")
	if err != nil {
		t.Fatalf("GET /api/daily-info: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if strings.Contains(string(raw), "Article_E") {
		t.Fatalf("response body leaks the real answer identity: %s", raw)
	}

	var body struct {
		Category string `json:"category"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode body: %v (raw=%s)", err, raw)
	}
	if body.Category != "Thing" {
		t.Fatalf("category = %q, want %q", body.Category, "Thing")
	}
}
