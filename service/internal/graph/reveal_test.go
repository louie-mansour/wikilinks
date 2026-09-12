package graph

import (
	"path/filepath"
	"testing"
)

// TestRevealNeighborsShortestPathOnly verifies that only the first-hop nodes
// of the given shortest paths are returned, not every outbound neighbor of
// the guess.
func TestRevealNeighborsShortestPathOnly(t *testing.T) {
	dir := t.TempDir()

	// Node 0 has 3 outbound neighbors: 1, 2, 3. Hidden id is 4, reached only
	// via node 1 (the shortest path). Nodes 2 and 3 are outbound neighbors
	// but not on any shortest path to the hidden id.
	writeText(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\nArticle_C\nArticle_D\nArticle_E\n")
	writeUint32s(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 3, 3, 3, 3, 3})
	writeUint32s(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1, 2, 3})
	writeUint32s(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 1, 2, 3, 3})
	writeUint32s(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0, 0, 0})

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	paths := [][]uint32{{0, 1, 4}}
	got := g.RevealNeighbors(4, paths)
	want := []NeighborInfo{{ID: 1, Title: "Article_B"}}
	if len(got) != len(want) {
		t.Fatalf("RevealNeighbors(4, paths) = %v (len %d), want %v (len %d)", got, len(got), want, len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("RevealNeighbors(4, paths)[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}
}

// TestRevealNeighborsDedupesAndSorts verifies that the first-hop nodes across
// multiple shortest paths are deduplicated and returned in ascending id order.
func TestRevealNeighborsDedupesAndSorts(t *testing.T) {
	paths := [][]uint32{
		{0, 3, 9},
		{0, 1, 9},
		{0, 3, 5, 9},
	}
	g := &WikipediaGraph{titles: []string{"A", "B", "C", "D"}}
	got := g.RevealNeighbors(9, paths)
	want := []NeighborInfo{
		{ID: 1, Title: "B"},
		{ID: 3, Title: "D"},
	}
	if len(got) != len(want) {
		t.Fatalf("RevealNeighbors(9, paths) = %v (len %d), want %v (len %d)", got, len(got), want, len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("RevealNeighbors(9, paths)[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}
}

// TestRevealNeighborsExcludesHiddenDirectLink verifies that when the hidden
// id is itself the first hop (a direct link, a 1-hop shortest path), it is
// excluded from the result rather than leaking the hidden article's identity.
func TestRevealNeighborsExcludesHiddenDirectLink(t *testing.T) {
	dir := t.TempDir()

	writeText(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\n")
	writeUint32s(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 1, 1})
	writeUint32s(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1})
	writeUint32s(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 1})
	writeUint32s(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0})

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	got := g.RevealNeighbors(1, [][]uint32{{0, 1}})
	if len(got) != 0 {
		t.Errorf("RevealNeighbors(1, [{0,1}]) = %v, want empty", got)
	}
}

// TestRevealNeighborsEmptyPaths verifies that no paths yields an empty list,
// not an error.
func TestRevealNeighborsEmptyPaths(t *testing.T) {
	g := &WikipediaGraph{titles: []string{"A"}}
	got := g.RevealNeighbors(99, [][]uint32{})
	if got == nil {
		t.Fatal("RevealNeighbors(99, {}) = nil, want empty non-nil slice")
	}
	if len(got) != 0 {
		t.Errorf("RevealNeighbors(99, {}) = %v, want empty", got)
	}
}
