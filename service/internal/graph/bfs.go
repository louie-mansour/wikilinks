package graph

const noParent = ^uint32(0) // sentinel for BFS roots

// BFSResult holds the output of a bidirectional BFS run.
type BFSResult struct {
	Path          []uint32 // node IDs from start to goal, inclusive
	NodesExplored int      // total nodes dequeued across both frontiers
}

// BidirectionalBFS finds a shortest path from start to goal in g.
// It returns (result, true) on success, or (zero, false) if no path exists.
// Safe to call concurrently; allocates per-call state only.
func BidirectionalBFS(g *WikipediaGraph, start, goal uint32) (BFSResult, bool) {
	if start == goal {
		return BFSResult{Path: []uint32{start}}, true
	}

	fwdParent := map[uint32]uint32{start: noParent}
	revParent := map[uint32]uint32{goal: noParent}
	fwdFrontier := []uint32{start}
	revFrontier := []uint32{goal}
	explored := 0

	for len(fwdFrontier) > 0 && len(revFrontier) > 0 {
		if len(fwdFrontier) <= len(revFrontier) {
			explored += len(fwdFrontier)
			next, meeting, found := expandFwd(g, fwdFrontier, fwdParent, revParent)
			if found {
				return BFSResult{
					Path:          buildPath(meeting, fwdParent, revParent),
					NodesExplored: explored,
				}, true
			}
			fwdFrontier = next
		} else {
			explored += len(revFrontier)
			next, meeting, found := expandRev(g, revFrontier, revParent, fwdParent)
			if found {
				return BFSResult{
					Path:          buildPath(meeting, fwdParent, revParent),
					NodesExplored: explored,
				}, true
			}
			revFrontier = next
		}
	}

	return BFSResult{}, false
}

func expandFwd(g *WikipediaGraph, frontier []uint32, fwdParent, revParent map[uint32]uint32) ([]uint32, uint32, bool) {
	var next []uint32
	for _, node := range frontier {
		for _, nb := range g.FwdNeighbors(node) {
			if _, seen := fwdParent[nb]; seen {
				continue
			}
			fwdParent[nb] = node
			next = append(next, nb)
			if _, inRev := revParent[nb]; inRev {
				return next, nb, true
			}
		}
	}
	return next, 0, false
}

func expandRev(g *WikipediaGraph, frontier []uint32, revParent, fwdParent map[uint32]uint32) ([]uint32, uint32, bool) {
	var next []uint32
	for _, node := range frontier {
		for _, nb := range g.RevNeighbors(node) {
			if _, seen := revParent[nb]; seen {
				continue
			}
			revParent[nb] = node
			next = append(next, nb)
			if _, inFwd := fwdParent[nb]; inFwd {
				return next, nb, true
			}
		}
	}
	return next, 0, false
}

// buildPath reconstructs start → meeting → goal using the two parent maps.
func buildPath(meeting uint32, fwdParent, revParent map[uint32]uint32) []uint32 {
	// Collect forward half: meeting → ... → start (will be reversed)
	var fwd []uint32
	for cur := meeting; ; {
		fwd = append(fwd, cur)
		p := fwdParent[cur]
		if p == noParent {
			break
		}
		cur = p
	}
	// Reverse to get start → ... → meeting
	for i, j := 0, len(fwd)-1; i < j; i, j = i+1, j-1 {
		fwd[i], fwd[j] = fwd[j], fwd[i]
	}

	// Collect reverse half: meeting+1 → ... → goal
	cur := meeting
	for {
		p, ok := revParent[cur]
		if !ok || p == noParent {
			break
		}
		fwd = append(fwd, p)
		cur = p
	}

	return fwd
}
