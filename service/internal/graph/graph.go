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
	// Word-boundary and fuzzy tiers only apply to multi-word queries (queries
	// containing a space). Single-token queries use prefix search only to
	// avoid spurious matches from short tokens like "a" matching every title.
	if !strings.ContainsRune(prefix, ' ') {
		return exact
	}
	wordPrefix := idx.wordPrefixSearch(prefix, limit-len(exact), exact)
	combined := append(exact, wordPrefix...)
	if len(combined) >= limit {
		return combined
	}
	fuzzy := idx.levenshteinSearch(prefix, limit-len(combined), combined)
	return append(combined, fuzzy...)
}

// RandomStartNodes returns count distinct random start-eligible article titles.
func (g *WikipediaGraph) RandomStartNodes(count int) []string {
	return randomSample(g.startingNodes, count)
}

// RandomEndNodes returns count distinct random end-eligible article titles.
func (g *WikipediaGraph) RandomEndNodes(count int) []string {
	return randomSample(g.endingNodes, count)
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
