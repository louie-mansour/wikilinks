package service

import (
	"fmt"
	"sort"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/config"
	"github.com/louiemansour/wikilinks/service/internal/graph"
)

// revealPathNodeCap is the maximum number of non-guess, non-target nodes
// revealed on a Reveal-mode guess's graph: shortest-path interior nodes
// first, radiating outward from the guess in hop-distance layers, then, if
// the cap isn't reached by real path nodes, additional direct backlinks of
// the target to fill out the rest — nodes around the target rather than the
// guess.
const revealPathNodeCap = 50

// RevealGuessResult is the response payload for a single Reveal-mode guess.
//
// Like GuessResult, the hidden end article's real id/title never appears
// anywhere in this struct prior to a correct guess (or the final, losing
// guess) — it is replaced everywhere by the stable per-day placeholder id
// (config.PlaceholderID). Neighbors is restricted to the guess's outbound
// neighbor(s) that lie on a shortest path to the hidden article (see
// graph.RevealNeighbors), not its full outbound-link list, and always
// excludes the hidden article itself so a direct link to the answer never
// leaks its identity either.
type RevealGuessResult struct {
	Guess       string               `json:"guess"`
	Correct     bool                 `json:"correct"`
	Lost        bool                 `json:"lost,omitempty"`
	Answer      string               `json:"answer,omitempty"`
	Neighbors   []graph.NeighborInfo `json:"neighbors"`
	NoPathFound bool                 `json:"noPathFound,omitempty"`
	PathsFound  int                  `json:"pathsFound"`
	MinHops     int                  `json:"minHops"`
	Paths       [][]string           `json:"paths"`
	GraphData   GraphData            `json:"graphData"`
	MaxHops     int                  `json:"maxHops"`
	MaxPaths    int                  `json:"maxPaths"`
}

// SubmitReveal resolves guessTitle against today's hidden puzzle article and
// returns the Reveal-mode payload: the same shortest-path reveal Classic's
// Submit computes via BidirectionalBFS, masked behind the stable per-day
// placeholder id unless the guess is correct or is the puzzle-losing guess,
// plus the guess's shortest-path-only neighbor reveal (see
// graph.RevealNeighbors) — never the guess's full outbound-link list.
//
// guessNumber is the 1-indexed attempt number for this guess, exactly as
// Classic's Submit expects it. Once guessNumber reaches MaxDailyGuesses
// without a correct guess, the real answer is revealed and the result is
// marked Lost — same cap, same constant, as Classic.
func (s *Guess) SubmitReveal(guessTitle string, guessNumber int) (*RevealGuessResult, error) {
	now := time.Now()

	answerTitle, err := s.sched.ArticleForDate(now)
	if err != nil {
		return nil, ErrNoPuzzleToday{err}
	}

	guessID, ok := s.g.ResolveTitle(guessTitle)
	if !ok {
		return nil, ErrTitleNotFound{guessTitle}
	}
	answerID, ok := s.g.ResolveTitle(answerTitle)
	if !ok {
		return nil, fmt.Errorf("scheduled answer %q not found in graph", answerTitle)
	}
	guess := s.g.Title(guessID)

	if guessID == answerID {
		return &RevealGuessResult{
			Guess:      guess,
			Correct:    true,
			Answer:     answerTitle,
			Neighbors:  []graph.NeighborInfo{},
			PathsFound: 1,
			Paths:      [][]string{{guess}},
			GraphData: GraphData{
				Nodes: []WikiNode{{ID: guess, Variant: "end", Label: guess}},
				Links: []WikiLink{},
			},
			MaxHops:  graph.MaxDepth,
			MaxPaths: graph.MaxPaths,
		}, nil
	}

	lost := guessNumber >= MaxDailyGuesses
	placeholderID := config.PlaceholderID(now)

	result, found := graph.BidirectionalBFS(s.g, guessID, answerID)
	if !found {
		graphData := GraphData{
			Nodes: []WikiNode{{ID: guess, Variant: "guess", Label: guess}},
			Links: []WikiLink{},
		}
		if lost {
			graphData.Nodes = append(graphData.Nodes, WikiNode{ID: answerTitle, Variant: "end", Label: answerTitle})
		}
		graphData = annotateDirectConnections(s.g, graphData, answerID)
		return &RevealGuessResult{
			Guess:       guess,
			Lost:        lost,
			Answer:      lostAnswer(lost, answerTitle),
			Neighbors:   []graph.NeighborInfo{},
			NoPathFound: true,
			Paths:       [][]string{},
			GraphData:   graphData,
			MaxHops:     graph.MaxDepth,
			MaxPaths:    graph.MaxPaths,
		}, nil
	}

	neighbors := s.g.RevealNeighbors(answerID, result.Paths)

	allPaths := make([][]string, len(result.Paths))
	for i, ids := range result.Paths {
		path := make([]string, len(ids))
		for j, id := range ids {
			if id == answerID {
				if lost {
					path[j] = answerTitle
				} else {
					path[j] = placeholderID
				}
			} else {
				path[j] = s.g.Title(id)
			}
		}
		allPaths[i] = path
	}

	graphData := annotateDirectConnections(s.g, buildRevealGraphData(s.g, allPaths, lost, answerID), answerID)

	return &RevealGuessResult{
		Guess:      guess,
		Lost:       lost,
		Answer:     lostAnswer(lost, answerTitle),
		Neighbors:  neighbors,
		PathsFound: len(allPaths),
		MinHops:    len(allPaths[0]) - 1,
		Paths:      allPaths,
		GraphData:  graphData,
		MaxHops:    graph.MaxDepth,
		MaxPaths:   graph.MaxPaths,
	}, nil
}

// buildRevealGraphData builds Reveal-mode's guess graph: the guess node, the
// masked/target node, plus up to revealPathNodeCap other nodes.
//
// allPaths[0]'s interior nodes are always kept as a guaranteed backbone.
// Every other path is only ever added as a whole unit: either every one of
// its not-yet-kept interior nodes fits in the remaining budget and all of
// them are kept together, or none of them are. Paths are tried in ascending
// lexicographic order of their interior node titles (a path's own hop
// position is constant across every equal-length shortest path, so title is
// the only meaningful tiebreaker) and a path that doesn't fit is skipped —
// not a hard stop — so a later, cheaper path still gets a chance at the
// leftover budget.
//
// This all-or-nothing rule is deliberate: pooling and keeping individual
// interior nodes one at a time (regardless of which path they came from)
// used to let the budget run out mid-path — e.g. every node one hop from the
// guess claims a share of the cap before any node two hops out does — which
// stranded the kept one-hop nodes as dead ends with no kept route onward to
// the target. Only ever committing a path in full (on top of the guaranteed
// backbone) guarantees every kept "path" node sits on an unbroken, visibly
// connected chain from the guess to the target.
//
// If every path fits under the cap with budget to spare, the leftover is
// backfilled with the target's other direct backlinks (nodes with an edge
// straight into the target, alphabetically), revealed as "backlink" nodes —
// additional nodes around the target rather than the guess. allPaths must be
// non-empty; every path's final element is the masked placeholder id, or,
// when lost, the real answer title.
func buildRevealGraphData(g *graph.WikipediaGraph, allPaths [][]string, lost bool, targetID uint32) GraphData {
	guessTitle := allPaths[0][0]
	targetTitle := allPaths[0][len(allPaths[0])-1]

	kept := make(map[string]struct{})
	for i := 1; i < len(allPaths[0])-1; i++ {
		kept[allPaths[0][i]] = struct{}{}
	}

	type candidatePath struct {
		interior []string
	}
	candidates := make([]candidatePath, 0, len(allPaths)-1)
	for _, path := range allPaths[1:] {
		if interior := path[1 : len(path)-1]; len(interior) > 0 {
			candidates = append(candidates, candidatePath{interior})
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		a, b := candidates[i].interior, candidates[j].interior
		for k := 0; k < len(a) && k < len(b); k++ {
			if a[k] != b[k] {
				return a[k] < b[k]
			}
		}
		return len(a) < len(b)
	})

	budget := revealPathNodeCap - len(kept)
	for _, c := range candidates {
		if budget <= 0 {
			break
		}
		newTitles := make([]string, 0, len(c.interior))
		for _, title := range c.interior {
			if _, ok := kept[title]; !ok {
				newTitles = append(newTitles, title)
			}
		}
		if len(newTitles) == 0 || len(newTitles) > budget {
			continue
		}
		for _, title := range newTitles {
			kept[title] = struct{}{}
		}
		budget -= len(newTitles)
	}

	backlinkTitles, backlinkEdges := backfillAroundTarget(g, targetID, targetTitle, guessTitle, kept, budget)

	endVariant, endLabel := "hidden-end", ""
	if lost {
		endVariant, endLabel = "end", targetTitle
	}
	nodes := []WikiNode{
		{ID: guessTitle, Variant: "guess", Label: guessTitle},
		{ID: targetTitle, Variant: endVariant, Label: endLabel},
	}
	for title := range kept {
		nodes = append(nodes, WikiNode{ID: title, Variant: "path", Label: title})
	}
	for title := range backlinkTitles {
		nodes = append(nodes, WikiNode{ID: title, Variant: "backlink", Label: title})
	}

	isKept := func(title string) bool {
		if title == guessTitle || title == targetTitle {
			return true
		}
		_, ok := kept[title]
		return ok
	}

	linkSet := make(map[graphEdge]struct{})
	for _, path := range allPaths {
		for i := 0; i < len(path)-1; i++ {
			src, dst := path[i], path[i+1]
			if !isKept(src) || !isKept(dst) {
				continue
			}
			linkSet[graphEdge{src, dst}] = struct{}{}
		}
	}
	for _, e := range backlinkEdges {
		linkSet[e] = struct{}{}
	}

	links := make([]WikiLink, 0, len(linkSet))
	for e := range linkSet {
		links = append(links, WikiLink{Source: e.src, Target: e.dst})
	}

	return GraphData{Nodes: nodes, Links: links}
}

// graphEdge is a directed source→target pair keyed by title, used to dedupe
// links while building Reveal-mode's graph.
type graphEdge struct{ src, dst string }

// backfillAroundTarget expands outward from the target via reverse edges
// (BFS, layer by layer — one hop out, then two, and so on) to fill any cap
// budget left over once every real shortest-path node has already been
// kept: "additional nodes around the target" rather than the guess,
// mirroring the guess-side layered reveal so a short shortest path still
// fills the cap out with real, connected nodes instead of stopping after
// just the target's immediate backlinks. Nodes already revealed (kept) or
// equal to the guess are never re-added, but a kept node is still walked
// through (at no budget cost) so a later layer can be reached past it — a
// node the cap or the guess exclusion rejects, though, is skipped and never
// walked through, since it never becomes part of the final graph and can't
// anchor a link there. targetTitle is the target's possibly-masked display
// title (so its edges are correctly keyed to the placeholder id / real
// answer title, whichever the caller substituted into allPaths).
func backfillAroundTarget(
	g *graph.WikipediaGraph,
	targetID uint32,
	targetTitle string,
	guessTitle string,
	kept map[string]struct{},
	budget int,
) (map[string]struct{}, []graphEdge) {
	backlinks := make(map[string]struct{})
	var edges []graphEdge
	if budget <= 0 {
		return backlinks, edges
	}

	type frontierNode struct {
		id    uint32
		title string
	}
	visited := map[uint32]struct{}{targetID: {}}
	frontier := []frontierNode{{targetID, targetTitle}}

	for len(frontier) > 0 && budget > 0 {
		type candidate struct {
			id          uint32
			title       string
			parentTitle string
		}
		var next []candidate
		for _, parent := range frontier {
			for _, id := range g.RevNeighbors(parent.id) {
				if _, ok := visited[id]; ok {
					continue
				}
				visited[id] = struct{}{}
				next = append(next, candidate{id, g.Title(id), parent.title})
			}
		}
		sort.Slice(next, func(i, j int) bool { return next[i].title < next[j].title })

		var nextFrontier []frontierNode
		for _, c := range next {
			if c.title == guessTitle {
				continue
			}
			if _, ok := kept[c.title]; ok {
				nextFrontier = append(nextFrontier, frontierNode{c.id, c.title})
				continue
			}
			if budget <= 0 {
				continue
			}
			backlinks[c.title] = struct{}{}
			edges = append(edges, graphEdge{c.title, c.parentTitle})
			budget--
			nextFrontier = append(nextFrontier, frontierNode{c.id, c.title})
		}
		frontier = nextFrontier
	}

	return backlinks, edges
}
