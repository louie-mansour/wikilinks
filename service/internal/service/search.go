package service

import (
	"errors"
	"fmt"

	"github.com/louiemansour/wikilinks/service/internal/graph"
)

var (
	ErrNoPath = errors.New("no path found between the two articles")
)

// ErrTitleNotFound is returned when a title is not in the graph.
type ErrTitleNotFound struct{ Title string }

func (e ErrTitleNotFound) Error() string {
	return fmt.Sprintf("article not found: %q", e.Title)
}

// SearchResult is the response payload for a successful BFS search.
type SearchResult struct {
	Path          []string `json:"path"`
	Degrees       int      `json:"degrees"`
	NodesExplored int      `json:"nodesExplored"`
}

// Search is the service used by the search controller.
type Search struct {
	g *graph.WikipediaGraph
}

// NewSearch creates a Search service backed by the given graph.
// The graph must already be loaded; Search holds a read-only reference.
func NewSearch(g *graph.WikipediaGraph) *Search {
	return &Search{g: g}
}

// Find performs bidirectional BFS from the article titled `from` to `to`.
func (s *Search) Find(from, to string) (*SearchResult, error) {
	startID, ok := s.g.ResolveTitle(from)
	if !ok {
		return nil, ErrTitleNotFound{from}
	}
	goalID, ok := s.g.ResolveTitle(to)
	if !ok {
		return nil, ErrTitleNotFound{to}
	}

	result, found := graph.BidirectionalBFS(s.g, startID, goalID)
	if !found {
		return nil, ErrNoPath
	}

	path := make([]string, len(result.Path))
	for i, id := range result.Path {
		path[i] = s.g.Title(id)
	}
	return &SearchResult{
		Path:          path,
		Degrees:       len(path) - 1,
		NodesExplored: result.NodesExplored,
	}, nil
}
