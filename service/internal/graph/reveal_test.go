package graph

import (
	"path/filepath"
	"testing"
)

// TestRevealNeighborsFiltersHidden verifies that a guess with N outbound
// neighbors including the hidden id returns exactly N-1 named neighbors.
func TestRevealNeighborsFiltersHidden(t *testing.T) {
	dir := t.TempDir()

	// Node 0 has 3 outbound neighbors: 1, 2, 3. Hidden id is 2.
	writeText(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\nArticle_C\nArticle_D\n")
	writeUint32s(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 3, 3, 3, 3})
	writeUint32s(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1, 2, 3})
	writeUint32s(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 1, 2, 3})
	writeUint32s(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0, 0, 0})

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	got := g.RevealNeighbors(0, 2)
	want := []NeighborInfo{
		{ID: 1, Title: "Article_B"},
		{ID: 3, Title: "Article_D"},
	}
	if len(got) != len(want) {
		t.Fatalf("RevealNeighbors(0, 2) = %v (len %d), want %v (len %d)", got, len(got), want, len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("RevealNeighbors(0, 2)[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}
}

// TestRevealNeighborsZeroOutDegree verifies that a guess with zero outbound
// neighbors returns an empty list, not an error.
func TestRevealNeighborsZeroOutDegree(t *testing.T) {
	dir := t.TempDir()

	// Node 1 has zero outbound neighbors.
	writeText(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\nArticle_C\n")
	writeUint32s(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 1, 1, 1})
	writeUint32s(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1})
	writeUint32s(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 1, 1})
	writeUint32s(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0})

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	got := g.RevealNeighbors(1, 99)
	if got == nil {
		t.Fatal("RevealNeighbors(1, 99) = nil, want empty non-nil slice")
	}
	if len(got) != 0 {
		t.Errorf("RevealNeighbors(1, 99) = %v, want empty", got)
	}
}
