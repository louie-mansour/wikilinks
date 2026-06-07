package graph

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

// TestLoadGoldenFixture verifies the loader against the §7 golden fixture from
// datapipeline/decisions/adjacency-csr.md: 5 entities, 4 edges.
func TestLoadGoldenFixture(t *testing.T) {
	dir := t.TempDir()

	writeText(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\nArticle_C\nArticle_D\nArticle_E\n")
	writeUint32s(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 2, 2, 3, 4, 4})
	writeUint32s(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1, 1, 3, 4})
	writeUint32s(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 2, 2, 3, 4})
	writeUint32s(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0, 0, 2, 3})

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if got := g.EntityCount(); got != 5 {
		t.Errorf("EntityCount = %d, want 5", got)
	}
	if got := g.Title(0); got != "Article_A" {
		t.Errorf("Title(0) = %q, want Article_A", got)
	}

	checkSlice(t, "FwdNeighbors(0)", g.FwdNeighbors(0), []uint32{1, 1})
	checkSlice(t, "FwdNeighbors(1)", g.FwdNeighbors(1), []uint32{})
	checkSlice(t, "FwdNeighbors(2)", g.FwdNeighbors(2), []uint32{3})
	checkSlice(t, "RevNeighbors(1)", g.RevNeighbors(1), []uint32{0, 0})
	checkSlice(t, "RevNeighbors(4)", g.RevNeighbors(4), []uint32{3})

	if id, ok := g.ResolveTitle("Article_A"); !ok || id != 0 {
		t.Errorf("ResolveTitle(Article_A) = %d %v, want 0 true", id, ok)
	}
	if _, ok := g.ResolveTitle("Nonexistent"); ok {
		t.Errorf("ResolveTitle(Nonexistent) should return false")
	}
}

func TestLoadMissingFile(t *testing.T) {
	dir := t.TempDir()
	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for missing files, got nil")
	}
}

func checkSlice(t *testing.T, name string, got, want []uint32) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s = %v (len %d), want %v (len %d)", name, got, len(got), want, len(want))
		return
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("%s[%d] = %d, want %d", name, i, got[i], want[i])
		}
	}
}

func writeText(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeUint32s(t *testing.T, path string, values []uint32) {
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
