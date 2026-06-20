package service

import (
	"fmt"
	"hash/fnv"
	"strings"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/graph"
	"github.com/louiemansour/wikilinks/service/internal/store"
)


// ErrTitleNotFound is returned when a title is not in the graph.
type ErrTitleNotFound struct{ Title string }

func (e ErrTitleNotFound) Error() string {
	return fmt.Sprintf("article not found: %q", e.Title)
}

// SearchResult is the response payload for a BFS search (found or not found).
type SearchResult struct {
	Start          string         `json:"start"`
	End            string         `json:"end"`
	NoPathFound    bool           `json:"noPathFound,omitempty"`
	PathsFound     int            `json:"pathsFound"`
	MinHops        int            `json:"minHops"`
	NodesExplored  int            `json:"nodesExplored"`
	SearchTimeMs   int64          `json:"searchTimeMs"`
	UniqueArticles int            `json:"uniqueArticles"`
	NewArticles    int            `json:"newArticles"`
	Paths          []PathData     `json:"paths"`
	GraphData      GraphData      `json:"graphData"`
	Records        []RecordPeriod `json:"records"`
	ShareCode      string         `json:"shareCode"`
}

type PathData struct {
	ID     int     `json:"id"`
	Crumbs []Crumb `json:"crumbs"`
}

type Crumb struct {
	Href        string `json:"href"`
	Label       string `json:"label"`
	Highlighted bool   `json:"highlighted,omitempty"`
	Tag         string `json:"tag,omitempty"`
}

type GraphData struct {
	Nodes []WikiNode `json:"nodes"`
	Links []WikiLink `json:"links"`
}

type WikiNode struct {
	ID      string `json:"id"`
	Variant string `json:"variant,omitempty"`
	Label   string `json:"label,omitempty"`
	IsNew   bool   `json:"isNew,omitempty"`
}

type WikiLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type RecordPeriod = store.RecordPeriod
type RecordRow = store.RecordRow

// Search is the service used by the search controller.
type Search struct {
	g  *graph.WikipediaGraph
	st *store.Store
}

// NewSearch creates a Search service backed by the given graph and store.
func NewSearch(g *graph.WikipediaGraph, st *store.Store) *Search {
	return &Search{g: g, st: st}
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

	t0 := time.Now()
	result, found := graph.BidirectionalBFS(s.g, startID, goalID)
	elapsed := time.Since(t0)

	if !found {
		return &SearchResult{
			Start:         from,
			End:           to,
			NoPathFound:   true,
			NodesExplored: result.NodesExplored,
			SearchTimeMs:  elapsed.Milliseconds(),
			Paths:         []PathData{},
			GraphData:     buildNoPathGraphData(from, to),
			Records:       []RecordPeriod{},
			ShareCode:     buildShareCode(from, to),
		}, nil
	}

	allPaths := make([][]string, len(result.Paths))
	for i, ids := range result.Paths {
		path := make([]string, len(ids))
		for j, id := range ids {
			path[j] = s.g.Title(id)
		}
		allPaths[i] = path
	}

	graphData := buildGraphData(allPaths)

	// Collect all unique titles from the graph nodes for hit tracking.
	titles := make([]string, 0, len(graphData.Nodes))
	for _, n := range graphData.Nodes {
		titles = append(titles, n.ID)
	}

	meta := store.SearchMeta{
		From:          from,
		To:            to,
		NodesExplored: result.NodesExplored,
		MinHops:       len(allPaths[0]) - 1,
		PathsFound:    len(allPaths),
	}

	prevRecords, err := s.st.QueryRecords()
	if err != nil {
		prevRecords = []RecordPeriod{}
	}

	newTitles, err := s.st.RecordSearch(titles, meta)
	if err != nil {
		return nil, fmt.Errorf("record search: %w", err)
	}

	newSet := make(map[string]struct{}, len(newTitles))
	for _, t := range newTitles {
		newSet[t] = struct{}{}
	}

	// Mark newly-seen graph nodes.
	for i := range graphData.Nodes {
		if _, ok := newSet[graphData.Nodes[i].ID]; ok {
			graphData.Nodes[i].IsNew = true
		}
	}

	pathDatas := make([]PathData, len(allPaths))
	for i, path := range allPaths {
		pathDatas[i] = PathData{ID: i + 1, Crumbs: buildCrumbs(path, newSet)}
	}

	uniqueSet := make(map[string]struct{})
	for _, path := range allPaths {
		for _, title := range path {
			uniqueSet[title] = struct{}{}
		}
	}

	records, err := s.st.QueryRecords()
	if err != nil {
		records = []RecordPeriod{}
	} else {
		records = store.AnnotateRecordBadges(records, prevRecords, meta)
	}

	return &SearchResult{
		Start:          from,
		End:            to,
		PathsFound:     len(allPaths),
		MinHops:        len(allPaths[0]) - 1,
		NodesExplored:  result.NodesExplored,
		SearchTimeMs:   elapsed.Milliseconds(),
		UniqueArticles: len(uniqueSet),
		NewArticles:    len(newTitles),
		Paths:          pathDatas,
		GraphData:      graphData,
		Records:        records,
		ShareCode:      buildShareCode(from, to),
	}, nil
}

func buildNoPathGraphData(from, to string) GraphData {
	return GraphData{
		Nodes: []WikiNode{
			{ID: from, Variant: "start", Label: from},
			{ID: to, Variant: "end", Label: to},
		},
		Links: []WikiLink{},
	}
}

func buildGraphData(allPaths [][]string) GraphData {
	nodeVariant := make(map[string]string)
	type edge struct{ src, dst string }
	linkSet := make(map[edge]struct{})

	for _, path := range allPaths {
		for i, title := range path {
			variant := "path"
			if i == 0 {
				variant = "start"
			} else if i == len(path)-1 {
				variant = "end"
			}
			// Don't downgrade start/end to path if already set.
			if existing, ok := nodeVariant[title]; !ok || existing == "path" {
				nodeVariant[title] = variant
			}
		}
		for i := 0; i < len(path)-1; i++ {
			linkSet[edge{path[i], path[i+1]}] = struct{}{}
		}
	}

	nodes := make([]WikiNode, 0, len(nodeVariant))
	for title, variant := range nodeVariant {
		nodes = append(nodes, WikiNode{ID: title, Variant: variant, Label: title})
	}
	links := make([]WikiLink, 0, len(linkSet))
	for e := range linkSet {
		links = append(links, WikiLink{Source: e.src, Target: e.dst})
	}
	return GraphData{Nodes: nodes, Links: links}
}

func buildCrumbs(path []string, newSet map[string]struct{}) []Crumb {
	crumbs := make([]Crumb, len(path))
	for i, title := range path {
		var tag string
		if _, ok := newSet[title]; ok {
			tag = "new"
		}
		crumbs[i] = Crumb{
			Href:        "https://en.wikipedia.org/wiki/" + strings.ReplaceAll(title, " ", "_"),
			Label:       title,
			Highlighted: i == 0 || i == len(path)-1,
			Tag:         tag,
		}
	}
	return crumbs
}

// buildShareCode generates a deterministic 6-char alphanumeric code from two titles.
func buildShareCode(start, end string) string {
	h := fnv.New32a()
	h.Write([]byte(start))
	h.Write([]byte("|"))
	h.Write([]byte(end))
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	n := h.Sum32()
	code := make([]byte, 6)
	for i := range code {
		code[i] = chars[n%uint32(len(chars))]
		n = n*1664525 + 1013904223
	}
	return string(code)
}
