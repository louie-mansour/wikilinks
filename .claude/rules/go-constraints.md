# Go BFS engine

Applies to: `**/*.go`

**Contract (normative):** `datapipeline/decisions/adjacency-csr.md` — read this first. Operational checklist mirrors `.cursor/rules/go-constraints.mdc`.

## Go-specific guidance

- Load the graph bundle from CSR `.bin` files; do not re-parse `edges_int.tsv` at runtime.
- Use a flat, array-backed adjacency list with contiguous primitive slices (`[]uint32`) only — no maps, pointers, or nested references in graph storage.
- BFS on **integer IDs** only; resolve `id → title` via `entities.tsv` when formatting output paths.
- Keep hot-path memory GC-friendly: the graph and frontier structures should contain no pointers for the collector to scan.

## Graph representation template

```go
type WikipediaGraph struct {
    Offsets []uint32 // article ID → start index in Edges
    Edges   []uint32 // contiguous destination IDs
}
```

## Reference

- Writer: `datapipeline/lib/csr.py`, `datapipeline/stages/build_adjacency.py`
- Golden test: `datapipeline/tests/test_build_adjacency.py`

## Avoid

- Maps or pointer-heavy structs for nodes, edges, or adjacency
- String-keyed adjacency or title-based BFS frontiers
- Rebuilding adjacency from TSV at runtime
