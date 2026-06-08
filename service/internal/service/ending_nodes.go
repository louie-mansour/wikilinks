package service

import "github.com/louiemansour/wikilinks/service/internal/graph"

// EndingNodesResult is the response payload for valid BFS goal articles.
type EndingNodesResult struct {
	Nodes []string `json:"nodes"`
}

// EndingNodes exposes the list of articles that can be used as search end points.
type EndingNodes struct {
	g *graph.WikipediaGraph
}

func NewEndingNodes(g *graph.WikipediaGraph) *EndingNodes {
	return &EndingNodes{g: g}
}

// List returns all article titles with at least one incoming link in adj_rev.
func (s *EndingNodes) List() *EndingNodesResult {
	return &EndingNodesResult{Nodes: s.g.EndingNodes()}
}
