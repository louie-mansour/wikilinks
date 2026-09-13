package service

import (
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/louiemansour/wikilinks/service/internal/graph"
)

// buildTestGraph writes a synthetic CSR fixture (titles + forward/reverse
// adjacency, both derived from the same edge list) to a temp dir and loads
// it, so buildRevealGraphData can be exercised against a real
// *graph.WikipediaGraph without needing the multi-GB production dataset.
func buildTestGraph(t *testing.T, titles []string, edges [][2]uint32) *graph.WikipediaGraph {
	t.Helper()
	dir := t.TempDir()

	entities := ""
	for _, title := range titles {
		entities += title + "\n"
	}
	if err := os.WriteFile(filepath.Join(dir, "entities.tsv"), []byte(entities), 0o644); err != nil {
		t.Fatal(err)
	}

	fwdOffsets, fwdNeighbors := buildCSR(len(titles), edges, func(e [2]uint32) (uint32, uint32) { return e[0], e[1] })
	revOffsets, revNeighbors := buildCSR(len(titles), edges, func(e [2]uint32) (uint32, uint32) { return e[1], e[0] })

	writeU32File(t, filepath.Join(dir, "adj_fwd.offsets.bin"), fwdOffsets)
	writeU32File(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), fwdNeighbors)
	writeU32File(t, filepath.Join(dir, "adj_rev.offsets.bin"), revOffsets)
	writeU32File(t, filepath.Join(dir, "adj_rev.neighbors.bin"), revNeighbors)

	g, err := graph.Load(dir)
	if err != nil {
		t.Fatalf("graph.Load: %v", err)
	}
	return g
}

// buildCSR groups edges by key(e) and returns CSR offsets/neighbors sized to
// numNodes, with each node's neighbor slice sorted for determinism.
func buildCSR(numNodes int, edges [][2]uint32, key func([2]uint32) (uint32, uint32)) ([]uint32, []uint32) {
	byNode := make(map[uint32][]uint32, numNodes)
	for _, e := range edges {
		src, dst := key(e)
		byNode[src] = append(byNode[src], dst)
	}
	for _, nbrs := range byNode {
		sort.Slice(nbrs, func(i, j int) bool { return nbrs[i] < nbrs[j] })
	}

	offsets := make([]uint32, numNodes+1)
	var neighbors []uint32
	for id := 0; id < numNodes; id++ {
		offsets[id] = uint32(len(neighbors))
		neighbors = append(neighbors, byNode[uint32(id)]...)
	}
	offsets[numNodes] = uint32(len(neighbors))
	return offsets, neighbors
}

func writeU32File(t *testing.T, path string, values []uint32) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := binary.Write(f, binary.LittleEndian, values); err != nil {
		t.Fatal(err)
	}
}

// Guess --(1 edge)--> D1 --(60 edges)--> D2_00..D2_59 --(1 edge each)--> Target
//
// The only shortest paths guess->target are length 3 (via D1, then one of
// the 60 D2 nodes), so the interior "path" node set is D1 (distance 1 from
// Guess) plus all 60 D2 nodes (distance 2 from Guess) — 61 nodes, one over
// the 50-node cap. Nodes closest to the guess are kept first, so D1 is kept,
// leaving budget for only 49 of the 60 D2 nodes: expect D1 kept plus the 49
// alphabetically-first D2 nodes, with no room left for backfill. Keeping
// closest-to-guess-first (rather than closest-to-target-first) guarantees D1
// survives whenever any D2 node does, since D1 is every D2 node's only link
// back to Guess — otherwise those D2 nodes would be stranded, disconnected
// from Guess.
func TestBuildRevealGraphData_capsAndOrdersByHopDistance(t *testing.T) {
	const fanOut = 60
	titles := []string{"Guess", "D1"}
	for i := 0; i < fanOut; i++ {
		titles = append(titles, fmt.Sprintf("D2_%02d", i))
	}
	titles = append(titles, "Target")
	targetID := uint32(len(titles) - 1)

	var edges [][2]uint32
	edges = append(edges, [2]uint32{0, 1}) // Guess -> D1
	for i := 0; i < fanOut; i++ {
		d2ID := uint32(2 + i)
		edges = append(edges, [2]uint32{1, d2ID})        // D1 -> D2_i
		edges = append(edges, [2]uint32{d2ID, targetID}) // D2_i -> Target
	}

	g := buildTestGraph(t, titles, edges)

	var allPaths [][]string
	for i := 0; i < fanOut; i++ {
		allPaths = append(allPaths, []string{"Guess", "D1", fmt.Sprintf("D2_%02d", i), "hidden-placeholder"})
	}

	graphData := buildRevealGraphData(g, allPaths, false, targetID)

	pathNodes := 0
	byTitle := make(map[string]string)
	for _, n := range graphData.Nodes {
		byTitle[n.ID] = n.Variant
		if n.Variant == "path" {
			pathNodes++
		}
	}
	if pathNodes != revealPathNodeCap { // D1 + 49 D2 nodes = 50 total interior nodes
		t.Fatalf("path-variant node count = %d, want %d", pathNodes, revealPathNodeCap)
	}
	if v, ok := byTitle["D1"]; !ok || v != "path" {
		t.Fatalf("expected D1 (closest to guess, and every D2 node's only link back to Guess) to be kept, got %q", v)
	}
	if v, ok := byTitle["Guess"]; !ok || v != "guess" {
		t.Fatalf("Guess node missing or wrong variant: %q", v)
	}
	if v, ok := byTitle["hidden-placeholder"]; !ok || v != "hidden-end" {
		t.Fatalf("target must stay masked as hidden-end, got %q", v)
	}
	for i := 0; i < 49; i++ {
		title := fmt.Sprintf("D2_%02d", i)
		if byTitle[title] != "path" {
			t.Fatalf("expected %s (alphabetically among the first 49) to be kept, got %q", title, byTitle[title])
		}
	}
	for i := 49; i < fanOut; i++ {
		title := fmt.Sprintf("D2_%02d", i)
		if _, present := byTitle[title]; present {
			t.Fatalf("expected %s to be dropped by the cap, but it was revealed", title)
		}
	}
	totalNodes := len(graphData.Nodes)
	if totalNodes != 1+1+pathNodes { // guess + hidden-end + interior path nodes
		t.Fatalf("total nodes = %d, want %d", totalNodes, 1+1+pathNodes)
	}

	hasGuessToD1Link := false
	for _, l := range graphData.Links {
		if l.Source == "Guess" && l.Target == "D1" {
			hasGuessToD1Link = true
		}
	}
	if !hasGuessToD1Link {
		t.Fatal("expected Guess->D1 link so every kept D2 node stays connected back to Guess")
	}
}

// Guess --(1 edge)--> D1 --(1 edge)--> Target, with 60 unrelated nodes
// (X_00..X_59) that also link straight into Target but aren't reachable from
// Guess at all. The shortest path only reveals 1 interior node (D1), leaving
// 49 nodes of budget — expect those to be backfilled from Target's other
// backlinks (the X nodes), alphabetically, still never naming Target itself.
func TestBuildRevealGraphData_backfillsFromTargetBacklinksWhenBudgetLeftover(t *testing.T) {
	const extraBacklinks = 60
	titles := []string{"Guess", "D1"}
	for i := 0; i < extraBacklinks; i++ {
		titles = append(titles, fmt.Sprintf("X_%02d", i))
	}
	titles = append(titles, "Target")
	targetID := uint32(len(titles) - 1)

	var edges [][2]uint32
	edges = append(edges, [2]uint32{0, 1})        // Guess -> D1
	edges = append(edges, [2]uint32{1, targetID}) // D1 -> Target
	for i := 0; i < extraBacklinks; i++ {
		xID := uint32(2 + i)
		edges = append(edges, [2]uint32{xID, targetID}) // X_i -> Target (not reachable from Guess)
	}

	g := buildTestGraph(t, titles, edges)

	allPaths := [][]string{{"Guess", "D1", "hidden-placeholder"}}
	graphData := buildRevealGraphData(g, allPaths, false, targetID)

	byTitle := make(map[string]string)
	revealedNodes := 0
	for _, n := range graphData.Nodes {
		byTitle[n.ID] = n.Variant
		if n.Variant == "path" || n.Variant == "backlink" {
			revealedNodes++
		}
	}
	// D1 (the real interior node) + 49 backfilled X nodes = 50.
	if revealedNodes != revealPathNodeCap {
		t.Fatalf("path+backlink node count = %d, want %d", revealedNodes, revealPathNodeCap)
	}
	if byTitle["D1"] != "path" {
		t.Fatalf("D1 must be revealed as a real path node, got %q", byTitle["D1"])
	}
	if _, present := byTitle["hidden-placeholder"]; !present || byTitle["hidden-placeholder"] != "hidden-end" {
		t.Fatalf("target must never be named via backfill, got %q", byTitle["hidden-placeholder"])
	}
	backfilled := 0
	for i := 0; i < extraBacklinks; i++ {
		title := fmt.Sprintf("X_%02d", i)
		if byTitle[title] == "backlink" {
			backfilled++
			if i >= 49 {
				t.Fatalf("expected only the 49 alphabetically-first X nodes backfilled, but %s was too", title)
			}
		}
	}
	if backfilled != 49 {
		t.Fatalf("backfilled X-node count = %d, want 49", backfilled)
	}

	hasBackfillLink := false
	for _, l := range graphData.Links {
		if l.Source == "X_00" && l.Target == "hidden-placeholder" {
			hasBackfillLink = true
		}
	}
	if !hasBackfillLink {
		t.Fatal("expected a link from a backfilled node to the masked target so the connection is visible")
	}
}

// Guess --(1 edge each)--> D1_00..D1_59 --(1 edge each)--> D2 --(1 edge)--> Target
//
// 60 distinct first-hop nodes (distFromGuess=1) all funnel through a single
// second-hop node D2 (distFromGuess=2) before reaching Target. Pooling every
// path's interior nodes and keeping strictly by ascending distance-from-guess
// would spend the entire 50-node cap on D1 nodes alone (60 > 50) and never
// reach D2 — severing every kept node from Target even though each one is
// still connected back to Guess. buildRevealGraphData must reserve one full
// path (allPaths[0]) as a guaranteed backbone so D2 (and therefore the link
// to Target) always survives the cap regardless of how wide the fan-out is
// nearer the guess.
func TestBuildRevealGraphData_capNeverSeversTargetConnection(t *testing.T) {
	const fanOut = 60
	titles := []string{"Guess"}
	for i := 0; i < fanOut; i++ {
		titles = append(titles, fmt.Sprintf("D1_%02d", i))
	}
	titles = append(titles, "D2", "Target")
	d2ID := uint32(len(titles) - 2)
	targetID := uint32(len(titles) - 1)

	var edges [][2]uint32
	for i := 0; i < fanOut; i++ {
		d1ID := uint32(1 + i)
		edges = append(edges, [2]uint32{0, d1ID})    // Guess -> D1_i
		edges = append(edges, [2]uint32{d1ID, d2ID}) // D1_i -> D2
	}
	edges = append(edges, [2]uint32{d2ID, targetID}) // D2 -> Target

	g := buildTestGraph(t, titles, edges)

	var allPaths [][]string
	for i := 0; i < fanOut; i++ {
		allPaths = append(allPaths, []string{"Guess", fmt.Sprintf("D1_%02d", i), "D2", "hidden-placeholder"})
	}

	graphData := buildRevealGraphData(g, allPaths, false, targetID)

	byTitle := make(map[string]string)
	for _, n := range graphData.Nodes {
		byTitle[n.ID] = n.Variant
	}
	if byTitle["D2"] != "path" {
		t.Fatalf("expected D2 (Target's only interior neighbor) to survive the cap as the guaranteed backbone, got %q", byTitle["D2"])
	}

	linked := make(map[string]struct{})
	for _, l := range graphData.Links {
		if l.Target == "hidden-placeholder" {
			linked[l.Source] = struct{}{}
		}
	}
	if _, ok := linked["D2"]; !ok {
		t.Fatal("expected a D2 -> hidden-placeholder link so the revealed subgraph stays connected to Target")
	}
}

// Guess --(1 edge each)--> D1_00..D1_59 --(1 edge each)--> D2_00..D2_59 --(1 edge each)--> Target
//
// 60 completely independent 2-hop chains from Guess to Target (no node
// shared between any two chains, unlike the funnel in
// TestBuildRevealGraphData_capNeverSeversTargetConnection). Pooling
// individual interior nodes by ascending hop-distance — the pre-fix
// behavior — would spend the entire post-backbone budget on D1 nodes (all
// at distance 1) before any D2 node (distance 2) is considered, keeping
// dozens of D1 nodes with a real edge from Guess but no kept edge onward to
// Target: dead ends one hop from the guess that don't lead anywhere.
// buildRevealGraphData must instead keep each extra chain as a whole unit
// (both its D1 and D2 node) or not at all, so every "path" node it reveals
// stays on a complete, visibly connected route to Target.
func TestBuildRevealGraphData_neverStrandsOneHopNodesAsDeadEnds(t *testing.T) {
	const fanOut = 60
	titles := []string{"Guess"}
	for i := 0; i < fanOut; i++ {
		titles = append(titles, fmt.Sprintf("D1_%02d", i))
	}
	for i := 0; i < fanOut; i++ {
		titles = append(titles, fmt.Sprintf("D2_%02d", i))
	}
	titles = append(titles, "Target")
	targetID := uint32(len(titles) - 1)

	d1ID := func(i int) uint32 { return uint32(1 + i) }
	d2ID := func(i int) uint32 { return uint32(1 + fanOut + i) }

	var edges [][2]uint32
	for i := 0; i < fanOut; i++ {
		edges = append(edges, [2]uint32{0, d1ID(i)})        // Guess -> D1_i
		edges = append(edges, [2]uint32{d1ID(i), d2ID(i)})  // D1_i -> D2_i
		edges = append(edges, [2]uint32{d2ID(i), targetID}) // D2_i -> Target
	}

	g := buildTestGraph(t, titles, edges)

	var allPaths [][]string
	for i := 0; i < fanOut; i++ {
		allPaths = append(allPaths, []string{
			"Guess", fmt.Sprintf("D1_%02d", i), fmt.Sprintf("D2_%02d", i), "hidden-placeholder",
		})
	}

	graphData := buildRevealGraphData(g, allPaths, false, targetID)

	kept := make(map[string]struct{})
	for _, n := range graphData.Nodes {
		if n.Variant == "path" {
			kept[n.ID] = struct{}{}
		}
	}
	hasIncoming := make(map[string]bool)
	hasOutgoing := make(map[string]bool)
	for _, l := range graphData.Links {
		hasOutgoing[l.Source] = true
		hasIncoming[l.Target] = true
	}

	for title := range kept {
		if !hasIncoming[title] {
			t.Fatalf("kept path node %s has no kept incoming edge (stranded from Guess)", title)
		}
		if !hasOutgoing[title] {
			t.Fatalf("kept path node %s has no kept outgoing edge — a dead end that never reaches Target", title)
		}
	}

	// Every kept D1_i must have its matching D2_i also kept (whole-chain
	// atomicity), and vice versa.
	for i := 0; i < fanOut; i++ {
		d1, d2 := fmt.Sprintf("D1_%02d", i), fmt.Sprintf("D2_%02d", i)
		_, d1Kept := kept[d1]
		_, d2Kept := kept[d2]
		if d1Kept != d2Kept {
			t.Fatalf("chain %d partially revealed: D1 kept=%v, D2 kept=%v", i, d1Kept, d2Kept)
		}
	}
}
