package graph

// WikipediaGraph holds the CSR adjacency graph in memory.
// After Load returns, this struct is read-only and safe for concurrent access.
type WikipediaGraph struct {
	titles        []string          // id → article title
	titleToID     map[string]uint32 // article title → id
	fwdOffsets    []uint32          // CSR row pointers for forward edges
	fwdNeighbors  []uint32          // CSR neighbor IDs for forward edges
	revOffsets    []uint32          // CSR row pointers for reverse edges
	revNeighbors  []uint32          // CSR neighbor IDs for reverse edges
	startingNodes []string          // titles with out-degree > 0 (adj_fwd keys)
	endingNodes   []string          // titles with in-degree > 0 (adj_rev keys)
	startingIndex TitleIndex        // sorted startingNodes for prefix search
	endingIndex   TitleIndex        // sorted endingNodes for prefix search
	mmapRegions   [][]byte          // keep mmap'd slices alive for process lifetime
}

func (g *WikipediaGraph) EntityCount() int { return len(g.titles) }

func (g *WikipediaGraph) Title(id uint32) string { return g.titles[id] }

func (g *WikipediaGraph) ResolveTitle(title string) (uint32, bool) {
	id, ok := g.titleToID[title]
	return id, ok
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

// SuggestStart returns up to limit start-article titles matching the prefix.
func (g *WikipediaGraph) SuggestStart(prefix string, limit int) []string {
	return g.startingIndex.PrefixSearch(prefix, limit)
}

// SuggestEnd returns up to limit end-article titles matching the prefix.
func (g *WikipediaGraph) SuggestEnd(prefix string, limit int) []string {
	return g.endingIndex.PrefixSearch(prefix, limit)
}
