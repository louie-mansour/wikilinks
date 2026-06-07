# Graph bundle loader (Rust)

Applies to: `**/*.rs`

**Contract (normative):** `datapipeline/decisions/adjacency-csr.md` — read this first.

## Rust-specific guidance

- **mmap** the four `.bin` files; do not `read_to_end` at ~29M edges.
- Parse as **little-endian `u32`**.
- Validate all contract §5 checks at startup.
- Build `title_to_id` while loading `entities.tsv` if the API accepts titles.
- BFS on integer IDs; resolve to titles only for output paths.

## Reference

- Writer: `datapipeline/lib/csr.py`, `datapipeline/stages/build_adjacency.py`
- Golden test: `datapipeline/tests/test_build_adjacency.py`

## Avoid

- Re-parsing `edges_int.tsv` or rebuilding adjacency at runtime
- String-keyed adjacency or title-based BFS frontiers
- Native-endian reads without explicit LE conversion
- Assuming unique or sorted neighbors
