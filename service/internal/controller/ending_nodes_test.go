package controller_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/louiemansour/wikilinks/service/internal/controller"
	"github.com/louiemansour/wikilinks/service/internal/graph"
	"github.com/louiemansour/wikilinks/service/internal/service"
)

func TestEndingNodesEndpoint(t *testing.T) {
	dir := t.TempDir()
	writeGoldenFixture(t, dir)

	g, err := graph.Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	mux := http.NewServeMux()
	controller.NewEndingNodes(service.NewEndingNodes(g)).Register(mux)

	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/internal/ending-nodes")
	if err != nil {
		t.Fatalf("GET /internal/ending-nodes: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var body struct {
		Nodes []string `json:"nodes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	want := []string{"Article_B", "Article_D", "Article_E"}
	if len(body.Nodes) != len(want) {
		t.Fatalf("len(nodes) = %d, want %d (%v)", len(body.Nodes), len(want), body.Nodes)
	}
	for i := range want {
		if body.Nodes[i] != want[i] {
			t.Errorf("nodes[%d] = %q, want %q", i, body.Nodes[i], want[i])
		}
	}
}
