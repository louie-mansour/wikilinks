package controller_test

import (
	"encoding/binary"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/louiemansour/wikilinks/service/internal/controller"
	"github.com/louiemansour/wikilinks/service/internal/graph"
	"github.com/louiemansour/wikilinks/service/internal/service"
)

func TestStartingNodesEndpoint(t *testing.T) {
	dir := t.TempDir()
	writeGoldenFixture(t, dir)

	g, err := graph.Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	mux := http.NewServeMux()
	controller.NewStartingNodes(service.NewStartingNodes(g)).Register(mux)

	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/starting-nodes")
	if err != nil {
		t.Fatalf("GET /api/starting-nodes: %v", err)
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

	want := []string{"Article_A", "Article_C", "Article_D"}
	if len(body.Nodes) != len(want) {
		t.Fatalf("len(nodes) = %d, want %d (%v)", len(body.Nodes), len(want), body.Nodes)
	}
	for i := range want {
		if body.Nodes[i] != want[i] {
			t.Errorf("nodes[%d] = %q, want %q", i, body.Nodes[i], want[i])
		}
	}
}

func writeGoldenFixture(t *testing.T, dir string) {
	t.Helper()
	writeTextFile(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\nArticle_C\nArticle_D\nArticle_E\n")
	writeU32File(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 2, 2, 3, 4, 4})
	writeU32File(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1, 1, 3, 4})
	writeU32File(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 2, 2, 3, 4})
	writeU32File(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0, 0, 2, 3})
}

func writeTextFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeU32File(t *testing.T, path string, values []uint32) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := binary.Write(f, binary.LittleEndian, values); err != nil {
		t.Fatal(err)
	}
}
