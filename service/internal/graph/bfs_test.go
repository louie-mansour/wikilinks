package graph

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

func loadGoldenGraph(t *testing.T) *WikipediaGraph {
	t.Helper()
	dir := t.TempDir()
	writeTextFile(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\nArticle_C\nArticle_D\nArticle_E\n")
	writeUint32File(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 2, 2, 3, 4, 4})
	writeUint32File(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1, 1, 3, 4})
	writeUint32File(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 2, 2, 3, 4})
	writeUint32File(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0, 0, 2, 3})

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return g
}

func loadDiamondGraph(t *testing.T) *WikipediaGraph {
	t.Helper()
	// A -> B, A -> C, B -> D, C -> D (two shortest paths A to D)
	dir := t.TempDir()
	writeTextFile(t, filepath.Join(dir, "entities.tsv"),
		"Article_A\nArticle_B\nArticle_C\nArticle_D\n")
	writeUint32File(t, filepath.Join(dir, "adj_fwd.offsets.bin"), []uint32{0, 2, 3, 4, 4})
	writeUint32File(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), []uint32{1, 2, 3, 3})
	writeUint32File(t, filepath.Join(dir, "adj_rev.offsets.bin"), []uint32{0, 0, 1, 2, 4})
	writeUint32File(t, filepath.Join(dir, "adj_rev.neighbors.bin"), []uint32{0, 0, 1, 2})

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return g
}

func TestBidirectionalBFS_goldenFixture(t *testing.T) {
	g := loadGoldenGraph(t)

	tests := []struct {
		name    string
		start   uint32
		goal    uint32
		wantOK  bool
		wantLen int
		wantHop int
	}{
		{"direct edge", 0, 1, true, 1, 1},
		{"two hop path", 2, 4, true, 1, 2},
		{"one hop to neighbor", 3, 4, true, 1, 1},
		{"disconnected", 0, 4, false, 0, 0},
		{"same node", 2, 2, true, 1, 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, ok := BidirectionalBFS(g, tc.start, tc.goal)
			if ok != tc.wantOK {
				t.Fatalf("ok = %v, want %v (result=%+v)", ok, tc.wantOK, result)
			}
			if !tc.wantOK {
				return
			}
			if len(result.Paths) != tc.wantLen {
				t.Fatalf("paths = %d, want %d: %v", len(result.Paths), tc.wantLen, result.Paths)
			}
			if got := len(result.Paths[0]) - 1; got != tc.wantHop {
				t.Fatalf("hops = %d, want %d: %v", got, tc.wantHop, result.Paths[0])
			}
			if result.Paths[0][0] != tc.start {
				t.Fatalf("path start = %d, want %d", result.Paths[0][0], tc.start)
			}
			if result.Paths[0][len(result.Paths[0])-1] != tc.goal {
				t.Fatalf("path end = %d, want %d", result.Paths[0][len(result.Paths[0])-1], tc.goal)
			}
		})
	}
}

func TestBidirectionalBFS_multipleShortestPaths(t *testing.T) {
	g := loadDiamondGraph(t)
	result, ok := BidirectionalBFS(g, 0, 3)
	if !ok {
		t.Fatal("expected path A to D")
	}
	if len(result.Paths) != 2 {
		t.Fatalf("paths = %d, want 2: %v", len(result.Paths), result.Paths)
	}

	want := map[string]struct{}{
		"0,1,3": {},
		"0,2,3": {},
	}
	for _, path := range result.Paths {
		delete(want, pathKey(path))
	}
	if len(want) != 0 {
		t.Fatalf("missing paths: %v", want)
	}
}

func TestBidirectionalBFS_exceededMaxDepth(t *testing.T) {
	g := loadChainGraph(t, MaxDepth+2)
	result, ok := BidirectionalBFS(g, 0, uint32(MaxDepth+1))
	if ok {
		t.Fatal("expected no path within maxDepth")
	}
	if !result.ExceededMaxDepth {
		t.Fatal("expected ExceededMaxDepth")
	}
}

func loadChainGraph(t *testing.T, nodes int) *WikipediaGraph {
	t.Helper()
	dir := t.TempDir()

	offsets := make([]uint32, nodes+1)
	neighbors := make([]uint32, 0, nodes-1)
	for i := 0; i < nodes-1; i++ {
		offsets[i+1] = uint32(i + 1)
		neighbors = append(neighbors, uint32(i+1))
	}
	offsets[nodes] = uint32(len(neighbors))

	revOffsets := make([]uint32, nodes+1)
	revNeighbors := make([]uint32, 0, nodes-1)
	for i := 1; i < nodes; i++ {
		revOffsets[i+1] = uint32(i)
		revNeighbors = append(revNeighbors, uint32(i-1))
	}

	var entityLines string
	for i := 0; i < nodes; i++ {
		if i > 0 {
			entityLines += "\n"
		}
		entityLines += "Node_" + string(rune('A'+i))
	}

	writeTextFile(t, filepath.Join(dir, "entities.tsv"), entityLines+"\n")
	writeUint32File(t, filepath.Join(dir, "adj_fwd.offsets.bin"), offsets)
	writeUint32File(t, filepath.Join(dir, "adj_fwd.neighbors.bin"), neighbors)
	writeUint32File(t, filepath.Join(dir, "adj_rev.offsets.bin"), revOffsets)
	writeUint32File(t, filepath.Join(dir, "adj_rev.neighbors.bin"), revNeighbors)

	g, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return g
}

func writeTextFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeUint32File(t *testing.T, path string, values []uint32) {
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
