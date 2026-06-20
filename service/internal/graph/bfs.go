package graph

import "sync"

const (
	MaxPaths = 1000 // cap to avoid exponential blowup on dense graphs
	MaxDepth = 10  // stop searching beyond 10 hops to keep queries bounded
)

// BFSResult holds the output of a BFS search.
type BFSResult struct {
	Paths            [][]uint32 // all shortest paths from start to goal, capped at MaxPaths
	NodesExplored    int
	ExceededMaxDepth bool // true when the search was cut off before finding a path
}

// bfsWork holds reusable, pointer-free visit state indexed by node ID.
type bfsWork struct {
	gen    uint32
	stampF []uint32
	stampB []uint32
	depthF []int8
	depthB []int8
}

var bfsPool = sync.Pool{
	New: func() any { return &bfsWork{} },
}

func borrowWork(n int) *bfsWork {
	w := bfsPool.Get().(*bfsWork)
	w.gen++
	if w.gen == 0 {
		w.gen = 1
	}
	if cap(w.stampF) < n {
		w.stampF = make([]uint32, n)
		w.stampB = make([]uint32, n)
		w.depthF = make([]int8, n)
		w.depthB = make([]int8, n)
	} else if w.gen == 1 {
		clear(w.stampF[:n])
		clear(w.stampB[:n])
	}
	w.stampF = w.stampF[:n]
	w.stampB = w.stampB[:n]
	w.depthF = w.depthF[:n]
	w.depthB = w.depthB[:n]
	return w
}

func releaseWork(w *bfsWork) {
	bfsPool.Put(w)
}

// BidirectionalBFS finds all shortest paths from start to goal in g.
// It expands forward from start via FwdNeighbors and backward from goal via
// RevNeighbors, meeting in the middle. It returns (result, true) on success,
// or (zero, false) if no path exists.
// Safe to call concurrently; allocates per-call parent maps and path slices only.
func BidirectionalBFS(g *WikipediaGraph, start, goal uint32) (BFSResult, bool) {
	if start == goal {
		return BFSResult{Paths: [][]uint32{{start}}}, true
	}

	n := g.EntityCount()
	w := borrowWork(n)
	defer releaseWork(w)

	parentF := map[uint32][]uint32{start: nil}
	parentB := map[uint32][]uint32{goal: nil}

	w.stampF[start] = w.gen
	w.depthF[start] = 0
	w.stampB[goal] = w.gen
	w.depthB[goal] = 0

	frontierF := []uint32{start}
	frontierB := []uint32{goal}
	explored := 0
	mu := int16(-1)
	var meetings []uint32

	for len(frontierF) > 0 || len(frontierB) > 0 {
		if mu >= 0 && shouldStop(mu, frontierF, frontierB, w) {
			break
		}

		if len(frontierB) == 0 || (len(frontierF) > 0 && len(frontierF) <= len(frontierB)) {
			if frontierDepthF(w, frontierF) >= MaxDepth {
				if mu < 0 {
					return BFSResult{NodesExplored: explored, ExceededMaxDepth: true}, false
				}
				break
			}
			explored += len(frontierF)
			frontierF = expandForward(g, w, frontierF, parentF, &mu, &meetings)
			continue
		}

		if frontierDepthB(w, frontierB) >= MaxDepth {
			if mu < 0 {
				return BFSResult{NodesExplored: explored, ExceededMaxDepth: true}, false
			}
			break
		}
		explored += len(frontierB)
		frontierB = expandBackward(g, w, frontierB, parentB, &mu, &meetings)
	}

	if mu < 0 {
		return BFSResult{NodesExplored: explored}, false
	}
	if mu > MaxDepth {
		return BFSResult{NodesExplored: explored, ExceededMaxDepth: true}, false
	}

	paths := splicePaths(start, goal, meetings, parentF, parentB, MaxPaths)
	return BFSResult{Paths: paths, NodesExplored: explored}, true
}

func frontierDepthF(w *bfsWork, frontier []uint32) int8 {
	if len(frontier) == 0 {
		return 0
	}
	return w.depthF[frontier[0]]
}

func frontierDepthB(w *bfsWork, frontier []uint32) int8 {
	if len(frontier) == 0 {
		return 0
	}
	return w.depthB[frontier[0]]
}

func shouldStop(mu int16, frontierF, frontierB []uint32, w *bfsWork) bool {
	var df, db int16
	if len(frontierF) == 0 {
		df = 0
	} else {
		df = int16(w.depthF[frontierF[0]])
	}
	if len(frontierB) == 0 {
		db = 0
	} else {
		db = int16(w.depthB[frontierB[0]])
	}
	return df+db >= mu
}

func expandForward(
	g *WikipediaGraph,
	w *bfsWork,
	frontier []uint32,
	parentF map[uint32][]uint32,
	mu *int16,
	meetings *[]uint32,
) []uint32 {
	next := make([]uint32, 0, len(frontier))
	for _, node := range frontier {
		nextDepth := int16(w.depthF[node]) + 1
		if nextDepth > MaxDepth {
			continue
		}
		for _, nb := range g.FwdNeighbors(node) {
			if w.stampF[nb] == w.gen {
				if int16(w.depthF[nb]) == nextDepth {
					parentF[nb] = append(parentF[nb], node)
				}
				continue
			}
			w.stampF[nb] = w.gen
			w.depthF[nb] = int8(nextDepth)
			parentF[nb] = []uint32{node}
			next = append(next, nb)

			if w.stampB[nb] == w.gen {
				recordMeeting(mu, meetings, int16(w.depthF[nb])+int16(w.depthB[nb]), nb)
			}
		}
	}
	return next
}

func expandBackward(
	g *WikipediaGraph,
	w *bfsWork,
	frontier []uint32,
	parentB map[uint32][]uint32,
	mu *int16,
	meetings *[]uint32,
) []uint32 {
	next := make([]uint32, 0, len(frontier))
	for _, node := range frontier {
		nextDepth := int16(w.depthB[node]) + 1
		if nextDepth > MaxDepth {
			continue
		}
		for _, nb := range g.RevNeighbors(node) {
			if w.stampB[nb] == w.gen {
				if int16(w.depthB[nb]) == nextDepth {
					parentB[nb] = append(parentB[nb], node)
				}
				continue
			}
			w.stampB[nb] = w.gen
			w.depthB[nb] = int8(nextDepth)
			parentB[nb] = []uint32{node}
			next = append(next, nb)

			if w.stampF[nb] == w.gen {
				recordMeeting(mu, meetings, int16(w.depthF[nb])+int16(w.depthB[nb]), nb)
			}
		}
	}
	return next
}

func recordMeeting(mu *int16, meetings *[]uint32, dist int16, node uint32) {
	if dist > MaxDepth {
		return
	}
	if *mu < 0 || dist < *mu {
		*mu = dist
		*meetings = []uint32{node}
		return
	}
	if dist == *mu {
		*meetings = append(*meetings, node)
	}
}

func splicePaths(
	start, goal uint32,
	meetings []uint32,
	parentF, parentB map[uint32][]uint32,
	cap int,
) [][]uint32 {
	seen := make(map[string]struct{}, cap)
	var paths [][]uint32

	for _, meet := range meetings {
		fwdPaths := reconstructAllPaths(meet, parentF, start, cap-len(paths))
		bwdPaths := reconstructToGoal(meet, parentB, goal, cap-len(paths))
		for _, fp := range fwdPaths {
			for _, bp := range bwdPaths {
				if len(paths) >= cap {
					return paths
				}
				combined := append(append([]uint32(nil), fp...), bp[1:]...)
				key := pathKey(combined)
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				paths = append(paths, combined)
			}
		}
	}
	return paths
}

func pathKey(path []uint32) string {
	// Small paths only (≤ MaxDepth+1 nodes); fmt is fine but avoid import for hot path.
	b := make([]byte, 0, len(path)*5)
	for i, id := range path {
		if i > 0 {
			b = append(b, ',')
		}
		b = appendUint(b, id)
	}
	return string(b)
}

func appendUint(b []byte, n uint32) []byte {
	if n == 0 {
		return append(b, '0')
	}
	var tmp [10]byte
	i := len(tmp)
	for n > 0 {
		i--
		tmp[i] = byte('0' + n%10)
		n /= 10
	}
	return append(b, tmp[i:]...)
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

// reconstructToGoal returns up to cap shortest paths from node to goal using the
// backward BFS parent map (parentB[farther] lists nodes one step closer to goal).
func reconstructToGoal(node uint32, parentB map[uint32][]uint32, goal uint32, cap int) [][]uint32 {
	if node == goal {
		return [][]uint32{{goal}}
	}
	ps := parentB[node]
	if len(ps) == 0 {
		return nil
	}
	var result [][]uint32
	for _, closer := range ps {
		if len(result) >= cap {
			break
		}
		subPaths := reconstructToGoal(closer, parentB, goal, cap-len(result))
		for _, sp := range subPaths {
			if len(result) >= cap {
				break
			}
			path := make([]uint32, len(sp)+1)
			path[0] = node
			copy(path[1:], sp)
			result = append(result, path)
		}
	}
	return result
}
