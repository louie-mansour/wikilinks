# WikiLinks Graph Bundle — API Contract

**Status:** normative · **Version:** 1 (no on-disk version field)

This document is the single source of truth for reading, parsing, validating, and hydrating the WikiLinks graph at runtime. Any producer, consumer, service, or tool that loads search data must implement against this contract.

**Producer:** `datapipeline/stages/build_adjacency.py` (after `build_vocab`)  
**Reference tests:** `datapipeline/tests/test_build_adjacency.py`  
**Reference I/O:** `datapipeline/lib/csr.py`

---

## 1. Bundle layout

The **graph bundle** is a directory of five files written together by the pipeline. Default path: `datapipeline/data/`.

| File | Required | Role |
|------|----------|------|
| `entities.tsv` | yes | Node ID → article title |
| `adj_fwd.offsets.bin` | yes | Forward CSR row offsets |
| `adj_fwd.neighbors.bin` | yes | Forward neighbor node IDs |
| `adj_rev.offsets.bin` | yes | Reverse CSR row offsets |
| `adj_rev.neighbors.bin` | yes | Reverse neighbor node IDs |

Consumers load **only this bundle** at runtime. Do not read `edges_int.tsv`, `edges.tsv`, or raw upstream files for search.

A `.build-adjacency-manifest.json` may exist alongside these files (pipeline cache metadata). It is **not** part of the wire format and must not be required for hydration.

---

## 2. Node IDs

- Node IDs are **0-based integers**: `0 .. entity_count - 1`.
- IDs are assigned by `build_vocab` on **first sighting** of each title while streaming `edges.tsv` (pass 1). Order in `entities.tsv` is the canonical ID order.
- Every `u32` in neighbor arrays must be `< entity_count`.
- The graph is **directed**. An edge `src → dst` appears once in forward adjacency for `src` and once in reverse adjacency for `dst`.

---

## 3. `entities.tsv`

Text file, UTF-8, one article title per line, **no header**.

| Line (0-based) | Node ID | Content |
|----------------|---------|---------|
| 0 | 0 | First interned title |
| 1 | 1 | Second interned title |
| *n* | *n* | Title for node *n* |

Rules:

- Line index **is** the node ID.
- Titles are stored exactly as interned (trimmed whitespace from `edges.tsv`; no further normalization).
- `entity_count` = number of lines (non-empty file). An empty file is invalid for search.

**ID → title:** line *n* (or array index *n*).

**Title → ID:** not stored on disk. Consumers that accept titles as input must build a reverse index while loading, e.g. `HashMap<String, u32>`, keyed by exact title string. Missing title ⇒ node not in graph.

---

## 4. CSR binary files

Four files form two CSR tables (forward and reverse). Each table is a pair:

- `*.offsets.bin` — prefix-sum row pointers
- `*.neighbors.bin` — concatenated neighbor lists

### 4.1 Encoding

| Property | Value |
|----------|-------|
| Element type | unsigned 32-bit integer (`u32`) |
| Byte order | **little-endian** |
| Header | none |
| Padding | none |
| Version field | none |
| File size | must be divisible by 4 |

Read each file as a flat array of `u32` values. On big-endian hosts, byte-swap after read.

### 4.2 Dimensions

Let `N = entity_count` and `E = edge_count` (total directed edges, equal to `edges_int.tsv` row count).

| Array | Length | Notes |
|-------|--------|-------|
| `fwd_offsets` | `N + 1` | |
| `fwd_neighbors` | `E` | |
| `rev_offsets` | `N + 1` | |
| `rev_neighbors` | `E` | |

Invariants:

```
fwd_offsets[0] == 0
fwd_offsets[N] == E == len(fwd_neighbors)
rev_offsets[0] == 0
rev_offsets[N] == E == len(rev_neighbors)
fwd_offsets[i] <= fwd_offsets[i+1]   for all i in 0..N
rev_offsets[i] <= rev_offsets[i+1]   for all i in 0..N
```

### 4.3 Neighbor lookup

For node `id` where `0 <= id < N`:

```
start = offsets[id]
end   = offsets[id + 1]
neighbors(id) = neighbors[start .. end]   // half-open slice
```

- **Duplicate neighbors are preserved.** Parallel rows in `edges_int.tsv` produce repeated values in the neighbor slice. Do not deduplicate unless you intentionally change semantics.
- Neighbor order is **insertion order** from `edges_int.tsv` (not sorted, not unique).

### 4.4 Forward vs reverse semantics

| Table | Meaning | Use in bidirectional BFS |
|-------|---------|--------------------------|
| `adj_fwd` | out-neighbors: `src → [targets]` | Expand **forward** frontier from start |
| `adj_rev` | in-neighbors: `dst → [sources]` | Expand **backward** frontier from goal |

Traversal (search expansion) uses **integer IDs only**. Resolve `id → title` via `entities.tsv` only when formatting output paths.

---

## 5. Validation

Reject the bundle (fail startup / return error) if any check fails:

1. All five required files exist and are readable.
2. Each `.bin` file size is a multiple of 4.
3. `entity_count >= 1` (at least one entity line).
4. `fwd_offsets` and `rev_offsets` each have length `entity_count + 1`.
5. `fwd_offsets[entity_count] == len(fwd_neighbors)`.
6. `rev_offsets[entity_count] == len(rev_neighbors)`.
7. `fwd_offsets[0] == 0` and `rev_offsets[0] == 0`.
8. Offsets are monotonic non-decreasing.
9. Every neighbor value is `< entity_count`.

---

## 6. Hydration procedure

Steps any consumer must follow to load a usable in-memory graph:

### Step 1 — Locate bundle

Resolve the data directory path (CLI flag, env var, or default `datapipeline/data/` relative to repo root).

### Step 2 — Load entities

Stream `entities.tsv` line by line:

- Count lines → `entity_count`.
- Store titles in a random-access structure indexed by node ID (e.g. `Vec<String>`).
- Optionally build `title_to_id: HashMap<String, u32>` for API input resolution.

### Step 3 — Load CSR binaries

Load the four `.bin` files as `u32` arrays (see §4.1).

At scale (~29M edges), **memory-map** the binaries instead of copying into a heap buffer. Parsed arrays may be `&[u32]` backed by the mapping.

### Step 4 — Validate

Run all checks in §5 before serving traffic.

### Step 5 — Expose graph API

Minimum surface after hydration:

```
entity_count() -> usize
title(id: u32) -> &str                    // id → title
resolve_title(title: &str) -> Option<u32> // title → id (if index built)
fwd_neighbors(id: u32) -> &[u32]          // out-neighbors
rev_neighbors(id: u32) -> &[u32]          // in-neighbors
```

### Step 6 — Search usage

- Accept user input as titles; resolve to IDs via `resolve_title`.
- Run bidirectional BFS on integer IDs using `fwd_neighbors` (from start) and `rev_neighbors` (from goal).
- Build result path as title strings: `[title(id) for id in path_ids]`.

---

## 7. Golden fixture

Input: `datapipeline/tests/fixtures/edges_int_sample.tsv` (4 edges) + `entities_sample.tsv` (5 entities).

Expected CSR output:

```
fwd_offsets:   [0, 2, 2, 3, 4, 4]
fwd_neighbors: [1, 1, 3, 4]
rev_offsets:   [0, 0, 2, 2, 3, 4]
rev_neighbors: [0, 0, 2, 3]
```

Spot checks:

- `fwd_neighbors(0)` → `[1, 1]` (duplicate preserved)
- `fwd_neighbors(1)` → `[]`
- `fwd_neighbors(2)` → `[3]`
- `rev_neighbors(1)` → `[0, 0]`
- `rev_neighbors(4)` → `[3]`
- `title(0)` → `Article_A` (first line of `entities_sample.tsv`)

Consumers should add a test that loads this fixture bundle and asserts these values.

---

## 8. Producer obligations

`build_adjacency` must:

- Read `edges_int.tsv` (`src_id`, `dst_id` columns) and `entities.tsv` (for row count).
- Write all four `.bin` files per §4.
- Preserve duplicate edges and `edges_int.tsv` insertion order within each neighbor list.
- Write atomically (`.tmp` sibling + rename), per pipeline stage contract.

---

## 9. Explicit non-goals

This bundle does **not** include:

- HTTP/API response schemas (separate contract when the search service exists)
- Sorted or deduplicated neighbor lists
- Edge weights or metadata
- On-disk title → ID map (build at hydrate time)
- Version headers in binary files (breaking changes require a new contract version document)

---

## 10. Related docs

| Audience | Doc |
|----------|-----|
| Pipeline architecture | `datapipeline/decisions/datasource.md` |
| Python pipeline stages | `.cursor/rules/datapipeline.mdc` |
| Rust consumer agent hints | `.cursor/rules/adjacency-format.mdc` |
