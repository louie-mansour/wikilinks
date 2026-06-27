package graph

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"syscall"
	"unsafe"
)

// Load reads the graph bundle from dataDir and returns a ready-to-use graph.
// It validates all invariants from adjacency-csr.md §5 before returning.
// The returned graph is immutable and safe for concurrent use.
func Load(dataDir string) (*WikipediaGraph, error) {
	if err := checkLittleEndian(); err != nil {
		return nil, err
	}

	titles, sortedPerm, err := loadEntities(filepath.Join(dataDir, "entities.tsv"))
	if err != nil {
		return nil, fmt.Errorf("load entities: %w", err)
	}
	if len(titles) == 0 {
		return nil, fmt.Errorf("entities.tsv is empty")
	}

	type binResult struct {
		raw  []byte
		u32s []uint32
	}
	load := func(name string) (binResult, error) {
		raw, u32s, err := mmapBin(filepath.Join(dataDir, name))
		return binResult{raw, u32s}, err
	}

	fwdOff, err := load("adj_fwd.offsets.bin")
	if err != nil {
		return nil, fmt.Errorf("adj_fwd.offsets.bin: %w", err)
	}
	fwdNbr, err := load("adj_fwd.neighbors.bin")
	if err != nil {
		return nil, fmt.Errorf("adj_fwd.neighbors.bin: %w", err)
	}
	revOff, err := load("adj_rev.offsets.bin")
	if err != nil {
		return nil, fmt.Errorf("adj_rev.offsets.bin: %w", err)
	}
	revNbr, err := load("adj_rev.neighbors.bin")
	if err != nil {
		return nil, fmt.Errorf("adj_rev.neighbors.bin: %w", err)
	}

	g := &WikipediaGraph{
		titles:       titles,
		sortedPerm:   sortedPerm,
		fwdOffsets:   fwdOff.u32s,
		fwdNeighbors: fwdNbr.u32s,
		revOffsets:   revOff.u32s,
		revNeighbors: revNbr.u32s,
		mmapRegions:  [][]byte{fwdOff.raw, fwdNbr.raw, revOff.raw, revNbr.raw},
	}

	if err := validate(g); err != nil {
		return nil, fmt.Errorf("validation: %w", err)
	}
	g.startingNodes = buildNodeTitles(g, g.fwdOffsets, len(g.titles)/30) // ~100K of ~3M
	g.endingNodes = buildNodeTitles(g, g.revOffsets, len(g.titles))      // ~3M on Kaggle
	g.startingIndex = NewTitleIndex(g.startingNodes)
	g.endingIndex = NewTitleIndex(g.endingNodes)
	return g, nil
}

// buildNodeTitles collects titles for nodes with non-empty CSR rows in offsets.
func buildNodeTitles(g *WikipediaGraph, offsets []uint32, capHint int) []string {
	n := uint32(len(g.titles))
	nodes := make([]string, 0, capHint)
	for id := uint32(0); id < n; id++ {
		if offsets[id] != offsets[id+1] {
			nodes = append(nodes, g.titles[id])
		}
	}
	return nodes
}

func loadEntities(path string) ([]string, []uint32, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	var titles []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		titles = append(titles, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, nil, err
	}

	sortedPerm := make([]uint32, len(titles))
	for i := range sortedPerm {
		sortedPerm[i] = uint32(i)
	}
	sort.Slice(sortedPerm, func(i, j int) bool {
		return titles[sortedPerm[i]] < titles[sortedPerm[j]]
	})
	return titles, sortedPerm, nil
}

// mmapBin maps a .bin file into memory and returns the raw bytes alongside a
// []uint32 view of the same memory. Both must be kept alive together.
func mmapBin(path string) ([]byte, []uint32, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return nil, nil, err
	}
	size := info.Size()
	if size == 0 {
		return nil, nil, nil
	}
	if size%4 != 0 {
		return nil, nil, fmt.Errorf("size %d not divisible by 4", size)
	}

	data, err := syscall.Mmap(int(f.Fd()), 0, int(size), syscall.PROT_READ, syscall.MAP_SHARED)
	if err != nil {
		return nil, nil, fmt.Errorf("mmap: %w", err)
	}

	u32s := unsafe.Slice((*uint32)(unsafe.Pointer(&data[0])), int(size)/4)
	return data, u32s, nil
}

// validate runs all §5 invariant checks.
func validate(g *WikipediaGraph) error {
	n := uint32(len(g.titles))
	e := uint32(len(g.fwdNeighbors))

	if uint32(len(g.fwdOffsets)) != n+1 {
		return fmt.Errorf("fwd offsets length %d != entity_count+1 %d", len(g.fwdOffsets), n+1)
	}
	if uint32(len(g.revOffsets)) != n+1 {
		return fmt.Errorf("rev offsets length %d != entity_count+1 %d", len(g.revOffsets), n+1)
	}
	if g.fwdOffsets[n] != e {
		return fmt.Errorf("fwd_offsets[N]=%d != edge_count=%d", g.fwdOffsets[n], e)
	}
	if g.revOffsets[n] != uint32(len(g.revNeighbors)) {
		return fmt.Errorf("rev_offsets[N]=%d != rev neighbor count=%d", g.revOffsets[n], len(g.revNeighbors))
	}
	if g.fwdOffsets[0] != 0 {
		return fmt.Errorf("fwd_offsets[0]=%d != 0", g.fwdOffsets[0])
	}
	if g.revOffsets[0] != 0 {
		return fmt.Errorf("rev_offsets[0]=%d != 0", g.revOffsets[0])
	}
	for i := uint32(0); i < n; i++ {
		if g.fwdOffsets[i] > g.fwdOffsets[i+1] {
			return fmt.Errorf("fwd offsets not monotonic at %d", i)
		}
		if g.revOffsets[i] > g.revOffsets[i+1] {
			return fmt.Errorf("rev offsets not monotonic at %d", i)
		}
	}
	for i, nb := range g.fwdNeighbors {
		if nb >= n {
			return fmt.Errorf("fwd neighbor[%d]=%d >= entity_count=%d", i, nb, n)
		}
	}
	for i, nb := range g.revNeighbors {
		if nb >= n {
			return fmt.Errorf("rev neighbor[%d]=%d >= entity_count=%d", i, nb, n)
		}
	}
	return nil
}

// checkLittleEndian ensures the CSR binary files can be reinterpreted directly.
// The .bin files are written little-endian; we read them zero-copy via unsafe.
func checkLittleEndian() error {
	var x uint16 = 1
	if *(*byte)(unsafe.Pointer(&x)) != 1 {
		return fmt.Errorf("big-endian host not supported; CSR files are little-endian")
	}
	return nil
}

