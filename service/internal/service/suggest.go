package service

import (
	"errors"
	"fmt"

	"github.com/louiemansour/wikilinks/service/internal/graph"
)

const (
	DefaultSuggestLimit = 10
	MaxSuggestLimit     = 50
)

var ErrInvalidSuggestRole = errors.New("role must be start or end")

// SuggestResult is the response payload for prefix autocomplete.
type SuggestResult struct {
	Nodes []string `json:"nodes"`
}

// Suggest provides prefix search over valid start and end article titles.
type Suggest struct {
	g *graph.WikipediaGraph
}

func NewSuggest(g *graph.WikipediaGraph) *Suggest {
	return &Suggest{g: g}
}

// Search returns titles matching prefix for the given role (start or end).
func (s *Suggest) Search(role, prefix string, limit int) (*SuggestResult, error) {
	if limit <= 0 {
		limit = DefaultSuggestLimit
	}
	if limit > MaxSuggestLimit {
		limit = MaxSuggestLimit
	}

	var nodes []string
	switch role {
	case "start":
		nodes = s.g.SuggestStart(prefix, limit)
	case "end":
		nodes = s.g.SuggestEnd(prefix, limit)
	default:
		return nil, fmt.Errorf("%w: %q", ErrInvalidSuggestRole, role)
	}

	if nodes == nil {
		nodes = []string{}
	}
	return &SuggestResult{Nodes: nodes}, nil
}
