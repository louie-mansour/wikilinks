package graph

const (
	maxPaths = 20 // cap to avoid exponential blowup on dense graphs
	maxDepth = 6  // stop searching beyond 6 hops to keep queries bounded
)

// BFSResult holds the output of a BFS search.
type BFSResult struct {
	Paths            [][]uint32 // all shortest paths from start to goal, capped at maxPaths
	NodesExplored    int
	ExceededMaxDepth bool // true when the search was cut off before finding a path
}

// BidirectionalBFS finds all shortest paths from start to goal in g.
// It returns (result, true) on success, or (zero, false) if no path exists.
// Safe to call concurrently; allocates per-call state only.
func BidirectionalBFS(g *WikipediaGraph, start, goal uint32) (BFSResult, bool) {
	if start == goal {
		return BFSResult{Paths: [][]uint32{{start}}}, true
	}

	// parents[n] = all BFS predecessors of n at the shortest depth (nil = BFS root)
	parents := map[uint32][]uint32{start: nil}
	depth := map[uint32]int{start: 0}
	frontier := []uint32{start}
	explored := 0
	goalDepth := -1

	for len(frontier) > 0 {
		curDepth := depth[frontier[0]]
		// Stop once we've fully processed the level just before the goal's level.
		// All parents of goal-depth nodes were captured in the previous iteration.
		if goalDepth >= 0 && curDepth >= goalDepth {
			break
		}
		if curDepth >= maxDepth {
			return BFSResult{ExceededMaxDepth: true}, false
		}
		nextDepth := curDepth + 1
		explored += len(frontier)
		var next []uint32

		for _, node := range frontier {
			for _, nb := range g.FwdNeighbors(node) {
				existingDepth, seen := depth[nb]
				if seen {
					// Another shortest-path edge arriving at the same depth.
					if existingDepth == nextDepth {
						parents[nb] = append(parents[nb], node)
					}
					continue
				}
				depth[nb] = nextDepth
				parents[nb] = []uint32{node}
				next = append(next, nb)
				if nb == goal {
					goalDepth = nextDepth
				}
			}
		}
		frontier = next
	}

	if goalDepth < 0 {
		return BFSResult{}, false
	}

	paths := reconstructAllPaths(goal, parents, start, maxPaths)
	return BFSResult{Paths: paths, NodesExplored: explored}, true
}

// reconstructAllPaths returns up to cap shortest paths ending at node by
// backtracking through the parents map down to start.
func reconstructAllPaths(node uint32, parents map[uint32][]uint32, start uint32, cap int) [][]uint32 {
	if node == start {
		return [][]uint32{{start}}
	}
	ps := parents[node]
	if len(ps) == 0 {
		return nil
	}
	var result [][]uint32
	for _, parent := range ps {
		if len(result) >= cap {
			break
		}
		subPaths := reconstructAllPaths(parent, parents, start, cap-len(result))
		for _, sp := range subPaths {
			if len(result) >= cap {
				break
			}
			path := make([]uint32, len(sp)+1)
			copy(path, sp)
			path[len(sp)] = node
			result = append(result, path)
		}
	}
	return result
}
