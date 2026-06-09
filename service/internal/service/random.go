package service

import (
	"errors"
	"fmt"

	"github.com/louiemansour/wikilinks/service/internal/graph"
)

const (
	DefaultRandomCount = 20
	MaxRandomCount     = 50
)

var ErrInvalidRandomRole = errors.New("role must be start or end")

type RandomResult struct {
	Nodes []string `json:"nodes"`
}

type Random struct {
	g *graph.WikipediaGraph
}

func NewRandom(g *graph.WikipediaGraph) *Random {
	return &Random{g: g}
}

func (s *Random) Pick(role string, count int) (*RandomResult, error) {
	if count <= 0 {
		count = DefaultRandomCount
	}
	if count > MaxRandomCount {
		count = MaxRandomCount
	}

	var nodes []string
	switch role {
	case "start":
		nodes = s.g.RandomStartNodes(count)
	case "end":
		nodes = s.g.RandomEndNodes(count)
	default:
		return nil, fmt.Errorf("%w: %q", ErrInvalidRandomRole, role)
	}

	if nodes == nil {
		nodes = []string{}
	}
	return &RandomResult{Nodes: nodes}, nil
}
