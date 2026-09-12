package graph

import (
	"math/rand/v2"
	"sort"
	"strings"
)

// WikipediaGraph holds the CSR adjacency graph in memory.
// After Load returns, this struct is read-only and safe for concurrent access.
type WikipediaGraph struct {
	titles        []string // id → article title
	sortedPerm    []uint32 // sortedPerm[i] = node ID of the i-th title in sorted order; used for binary-search title→ID lookup
	fwdOffsets    []uint32 // CSR row pointers for forward edges
	fwdNeighbors  []uint32 // CSR neighbor IDs for forward edges
	revOffsets    []uint32 // CSR row pointers for reverse edges
	revNeighbors  []uint32 // CSR neighbor IDs for reverse edges
	startingNodes []string // titles with out-degree > 0 (adj_fwd keys)
	endingNodes   []string // titles with in-degree > 0 (adj_rev keys)
	startingIndex TitleIndex // sorted startingNodes for prefix search
	endingIndex   TitleIndex // sorted endingNodes for prefix search
	mmapRegions   [][]byte   // keep mmap'd slices alive for process lifetime
}

func (g *WikipediaGraph) EntityCount() int { return len(g.titles) }

func (g *WikipediaGraph) Title(id uint32) string { return g.titles[id] }

func (g *WikipediaGraph) ResolveTitle(title string) (uint32, bool) {
	i := sort.Search(len(g.sortedPerm), func(j int) bool {
		return g.titles[g.sortedPerm[j]] >= title
	})
	if i < len(g.sortedPerm) && g.titles[g.sortedPerm[i]] == title {
		return g.sortedPerm[i], true
	}
	return 0, false
}

// FwdNeighbors returns the out-neighbors of id (nodes reachable via forward edges).
// The returned slice aliases mmap'd memory — do not modify.
func (g *WikipediaGraph) FwdNeighbors(id uint32) []uint32 {
	start := g.fwdOffsets[id]
	end := g.fwdOffsets[id+1]
	return g.fwdNeighbors[start:end]
}

// RevNeighbors returns the in-neighbors of id (nodes from which id is reachable).
// The returned slice aliases mmap'd memory — do not modify.
func (g *WikipediaGraph) RevNeighbors(id uint32) []uint32 {
	start := g.revOffsets[id]
	end := g.revOffsets[id+1]
	return g.revNeighbors[start:end]
}

// NeighborInfo pairs a node ID with its resolved title for display.
type NeighborInfo struct {
	ID    uint32 `json:"id"`
	Title string `json:"title"`
}

// RevealNeighbors returns, with titles resolved, the single outbound
// neighbor of the guess that lies on each shortest path to hiddenID — i.e.
// the second node (index 1) of every path in paths, deduplicated. paths is
// the shortest-path set already computed by BidirectionalBFS(guessID,
// hiddenID); each path is expected to start at the guess. hiddenID itself is
// always excluded from the result, even when a path reaches it in a single
// hop, so a direct link to the answer never leaks its identity via the
// neighbor list. Returns an empty slice (never nil-with-error) when paths is
// empty or every path is a single node.
func (g *WikipediaGraph) RevealNeighbors(hiddenID uint32, paths [][]uint32) []NeighborInfo {
	seen := make(map[uint32]struct{})
	ids := make([]uint32, 0, len(paths))
	for _, path := range paths {
		if len(path) < 2 {
			continue
		}
		next := path[1]
		if next == hiddenID {
			continue
		}
		if _, ok := seen[next]; ok {
			continue
		}
		seen[next] = struct{}{}
		ids = append(ids, next)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

	result := make([]NeighborInfo, 0, len(ids))
	for _, id := range ids {
		result = append(result, NeighborInfo{ID: id, Title: g.Title(id)})
	}
	return result
}

// StartingNodes returns article titles that can be used as BFS start points:
// nodes with at least one outgoing link in adj_fwd.
func (g *WikipediaGraph) StartingNodes() []string {
	return g.startingNodes
}

// EndingNodes returns article titles that can be used as BFS goal points:
// nodes with at least one incoming link in adj_rev.
func (g *WikipediaGraph) EndingNodes() []string {
	return g.endingNodes
}

// SuggestStart returns up to limit start-article titles matching prefix.
// Results are ranked: exact prefix matches, then word-boundary prefix matches,
// then fuzzy (edit-distance ≤ 1) word matches.
func (g *WikipediaGraph) SuggestStart(prefix string, limit int) []string {
	return suggest(g.startingIndex, prefix, limit)
}

// SuggestEnd returns up to limit end-article titles matching prefix.
// Results are ranked: exact prefix matches, then word-boundary prefix matches,
// then fuzzy (edit-distance ≤ 1) word matches.
func (g *WikipediaGraph) SuggestEnd(prefix string, limit int) []string {
	return suggest(g.endingIndex, prefix, limit)
}

func suggest(idx TitleIndex, prefix string, limit int) []string {
	exact := idx.PrefixSearch(prefix, limit)
	if len(exact) >= limit {
		return exact
	}
	// Word-boundary and fuzzy tiers apply to multi-word queries OR to single
	// tokens ≥4 chars (e.g. "Hitler" → "Adolf Hitler"). Short single tokens
	// like "a" are excluded to avoid flooding results.
	isMultiWord := strings.ContainsRune(prefix, ' ')
	tokens := titleTokens(prefix)
	isSingleLongToken := !isMultiWord && len(tokens) == 1 && len(tokens[0]) >= 4
	if !isMultiWord && !isSingleLongToken {
		return exact
	}
	wordPrefix := idx.wordPrefixSearch(prefix, limit-len(exact), exact)
	combined := append(exact, wordPrefix...)
	if len(combined) >= limit {
		return combined
	}
	fuzzy := idx.levenshteinSearch(prefix, limit-len(combined), combined)
	combined = append(combined, fuzzy...)
	if len(combined) >= limit {
		return combined
	}
	// Stop-word tier: strip common function words and retry with meaningful
	// tokens only. Catches sentence-like queries such as
	// "Conference in San Francisco over the weekend".
	if isMultiWord {
		filtered := idx.stopWordSearch(prefix, limit-len(combined), combined)
		combined = append(combined, filtered...)
	}
	return combined
}

// RandomStartNodes returns count distinct random start-eligible article titles.
func (g *WikipediaGraph) RandomStartNodes(count int) []string {
	return randomSample(g.startingNodes, count)
}

// RandomEndNodes returns count distinct random end-eligible article titles.
func (g *WikipediaGraph) RandomEndNodes(count int) []string {
	return randomSample(g.endingNodes, count)
}

// RandomEndNodesMinDegree returns count distinct random end-eligible article
// titles with in-degree at least minDegree. Plain end-eligibility (in-degree
// > 0, see RandomEndNodes) admits obscure articles with only a single
// incoming link, which makes for an unguessable puzzle answer. Callers that
// need a recognizable answer (dev-mode random answers, daily schedule
// generation) should use this instead.
func (g *WikipediaGraph) RandomEndNodesMinDegree(count, minDegree int) []string {
	candidates := make([]string, 0, len(g.endingNodes))
	for _, title := range g.endingNodes {
		id, ok := g.ResolveTitle(title)
		if !ok {
			continue
		}
		if int(g.revOffsets[id+1]-g.revOffsets[id]) >= minDegree {
			candidates = append(candidates, title)
		}
	}
	return randomSample(candidates, count)
}

// randomSample picks count distinct items from src using a partial Fisher-Yates shuffle.
func randomSample(src []string, count int) []string {
	if len(src) == 0 {
		return []string{}
	}
	if count > len(src) {
		count = len(src)
	}
	tmp := make([]string, len(src))
	copy(tmp, src)
	for i := 0; i < count; i++ {
		j := i + rand.IntN(len(tmp)-i)
		tmp[i], tmp[j] = tmp[j], tmp[i]
	}
	return tmp[:count]
}
