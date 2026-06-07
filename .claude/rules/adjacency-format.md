# Graph bundle loader (Go)

Applies to: `**/*.go`

**Contract (normative):** `datapipeline/decisions/adjacency-csr.md` — read this first.

## Go-specific guidance

- **mmap** the four `.bin` files via `golang.org/x/sys/unix` or `syscall`; do not `io.ReadAll` at ~29M edges.
- Parse as **little-endian `uint32`** using `encoding/binary` with `binary.LittleEndian`.
- Validate all contract §5 checks at startup.
- Build `titleToID map[string]uint32` while streaming `entities.tsv` if the API accepts titles.
- BFS on integer IDs; resolve to titles only for output paths.

## Reference

- Writer: `datapipeline/lib/csr.py`, `datapipeline/stages/build_adjacency.py`
- Golden test: `datapipeline/tests/test_build_adjacency.py`

## Avoid

- Re-parsing `edges_int.tsv` or rebuilding adjacency at runtime
- String-keyed adjacency or title-based BFS frontiers
- Native-endian reads without explicit LE conversion
- Assuming unique or sorted neighbors
