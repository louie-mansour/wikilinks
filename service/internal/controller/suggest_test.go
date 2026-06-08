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

func TestSuggestEndpoint(t *testing.T) {
	dir := t.TempDir()
	writeGoldenFixture(t, dir)

	g, err := graph.Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	mux := http.NewServeMux()
	controller.NewSuggest(service.NewSuggest(g)).Register(mux)

	srv := httptest.NewServer(mux)
	defer srv.Close()

	tests := []struct {
		url        string
		wantStatus int
		wantNodes  []string
	}{
		{
			url:        "/api/suggest?role=start&q=article_a",
			wantStatus: http.StatusOK,
			wantNodes:  []string{"Article_A"},
		},
		{
			url:        "/api/suggest?role=end&q=article&limit=2",
			wantStatus: http.StatusOK,
			wantNodes:  []string{"Article_B", "Article_D"},
		},
		{
			url:        "/api/suggest?role=start&q=article&limit=10",
			wantStatus: http.StatusOK,
			wantNodes:  []string{"Article_A", "Article_C", "Article_D"},
		},
		{
			url:        "/api/suggest?role=bad&q=x",
			wantStatus: http.StatusBadRequest,
		},
		{
			url:        "/api/suggest?q=x",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		resp, err := http.Get(srv.URL + tc.url)
		if err != nil {
			t.Fatalf("GET %s: %v", tc.url, err)
		}

		if resp.StatusCode != tc.wantStatus {
			t.Errorf("GET %s status = %d, want %d", tc.url, resp.StatusCode, tc.wantStatus)
		}

		if tc.wantStatus != http.StatusOK {
			resp.Body.Close()
			continue
		}

		var body struct {
			Nodes []string `json:"nodes"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("decode %s: %v", tc.url, err)
		}
		resp.Body.Close()

		if len(body.Nodes) != len(tc.wantNodes) {
			t.Fatalf("GET %s len(nodes) = %d, want %d (%v)", tc.url, len(body.Nodes), len(tc.wantNodes), body.Nodes)
		}
		for i := range tc.wantNodes {
			if body.Nodes[i] != tc.wantNodes[i] {
				t.Errorf("GET %s nodes[%d] = %q, want %q", tc.url, i, body.Nodes[i], tc.wantNodes[i])
			}
		}
	}
}
