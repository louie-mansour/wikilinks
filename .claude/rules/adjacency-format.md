# Adjacency binary format (Rust consumer)

Applies to: `**/*.rs`

The Python pipeline writes CSR binaries under `datapipeline/data/`. The Rust search service **reads only these files** at runtime — never `edges_int.tsv` or raw CSV. Full spec: `datapipeline/decisions/datasource.md` § Adjacency binary format. Cursor rule: `.cursor/rules/adjacency-format.mdc`.

## Files

| File | Role |
|------|------|
| `adj_fwd.offsets.bin` | Forward CSR offsets (out-neighbors) |
| `adj_fwd.neighbors.bin` | Forward neighbor node IDs |
| `adj_rev.offsets.bin` | Reverse CSR offsets (in-neighbors) |
| `adj_rev.neighbors.bin` | Reverse neighbor node IDs |
| `entities.tsv` | Line `N` → title for node ID `N` (no header) |

## Binary encoding

- Raw **little-endian `u32`** arrays — no header, no padding, no versioning.
- File size must be a multiple of 4.
- `offsets.len() == entity_count + 1` where `entity_count` = line count of `entities.tsv`.
- `offsets[entity_count] == neighbors.len()` (total edge count).
- Neighbors for node `id`: `neighbors[offsets[id]..offsets[id+1]]`.
- **Duplicate neighbors are preserved** (parallel edges in `edges_int.tsv`).

## BFS semantics

- **Forward (`adj_fwd`):** expand from start — `src → targets`.
- **Reverse (`adj_rev`):** expand backward from goal — `dst → sources`.
- BFS uses **integer node IDs** throughout; resolve `id → title` only when returning paths via `entities.tsv`.

## Loading

- **mmap** all four `.bin` files — do not `read_to_end` into `Vec<u8>` at ~29M edges.
- Validate lengths on startup: offsets divisible by 4, `offsets.len() == entity_count + 1`.

## Reference implementation

- Python writer: `datapipeline/lib/csr.py`, `datapipeline/stages/build_adjacency.py`
- Golden test values: `datapipeline/tests/test_build_adjacency.py`

## Avoid

- Parsing `edges_int.tsv` or rebuilding adjacency at runtime
- String-keyed adjacency or title-based BFS frontiers
- Big-endian or native-endian reads without explicit LE
- Assuming unique or sorted neighbors
