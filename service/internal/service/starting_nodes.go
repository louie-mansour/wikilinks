package service

import "github.com/louiemansour/wikilinks/service/internal/graph"

// StartingNodesResult is the response payload for valid BFS start articles.
type StartingNodesResult struct {
	Nodes []string `json:"nodes"`
}

// StartingNodes exposes the list of articles that can be used as search start points.
type StartingNodes struct {
	g *graph.WikipediaGraph
}

func NewStartingNodes(g *graph.WikipediaGraph) *StartingNodes {
	return &StartingNodes{g: g}
}

// List returns all article titles with at least one outgoing link in adj_fwd.
func (s *StartingNodes) List() *StartingNodesResult {
	return &StartingNodesResult{Nodes: s.g.StartingNodes()}
}
