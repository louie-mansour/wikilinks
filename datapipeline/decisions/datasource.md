# Wikipedia Graph Data Source Comparison for Bidirectional BFS

This document outlines the architectural trade-offs, file structures, and algorithmic impacts of using different Wikipedia data sources for implementing an in-memory bidirectional Breadth-First Search (BFS) pathfinder.

---

## Decision

**We are using the Kaggle 100K subset (Option 3a) for initial pipeline development and algorithm verification.**

Rationale:

- **Title-native upstream format** — edges arrive as article titles in `links_export.csv`, so no KONECT-style entity join at fetch time.
- **Faster iteration** — smaller download (~29M edges), pre-cleaned data, and lower memory footprint make it practical to build and debug fetch → parse → search stages end-to-end.
- **Sufficient for validation** — large enough to exercise real bidirectional BFS and path splicing before scaling up.

**KONECT (Option 3b) remains the planned production-scale source** for stress-testing frontier expansion against natural hubs (e.g. *United States*). It will be added as a second fetch target once the pipeline is stable on Kaggle output.

Pipeline stage 1 (`fetch`) downloads Kaggle files to `raw/` by default.

---

## Pipeline stage plan

After `fetch`, build stages in this order. Both Kaggle and KONECT converge on the same `data/` artifacts before search.

| Stage | Input | Output | Purpose |
|-------|-------|--------|---------|
| `fetch` | Kaggle API | `raw/links_export.csv` | Download upstream data |
| `extract_edges` | `links_export.csv` | `data/edges.tsv` | Strip to `source_title`, `target_title` only; stream, never reload raw |
| `build_vocab` | `edges.tsv` | `data/entities.tsv`, `data/edges_int.tsv` | Intern titles → int IDs |
| `build_adjacency` | `edges_int.tsv` | `data/adj_fwd.*`, `data/adj_rev.*` | Forward + reverse neighbor lists (CSR or sorted arrays) |
| `search` | adjacency + entities | (in-memory) | Bidirectional BFS; resolve IDs to titles only for final path |

**Use `links_export.csv` only for pipeline work.** `graph.json` is redundant, monolithic (~2.7 GB), and not streamable — do not parse it in stages.

Raw files are very large (~4.8 GB CSV). Stages must stream line-by-line and never load full raw files into memory.

---

## Internal keys vs display keys

**Revised approach (2025):** use integer node IDs internally; titles are for humans only.

| Layer | Key type | Rationale |
|-------|----------|-----------|
| Raw Kaggle CSV | Strings | Upstream format |
| `edges.tsv` → `edges_int.tsv` | Strings → ints | Smaller disk, faster adjacency build |
| BFS (queues, parent maps, adjacency) | Ints | Lower memory and faster hashing than Python string objects at ~29M edges |
| Final path output | Strings | `entities[id]` lookup once when splicing — O(path length), negligible |

This replaces the earlier plan to keep string keys in BFS frontiers. String-keyed adjacency (`dict[str, list[str]]`) is not viable at this scale in Python.

Path splicing still yields readable titles immediately:

```python
# BFS tracked int IDs; entities = ["Space", "Solar_System", "Earth", ...]
forward_ids = [n_space, n_solar_system]
backward_ids = [n_planetary_science, n_mars]  # reversed lineage
intersection_id = n_earth

final_path = [entities[i] for i in forward_ids]
final_path.append(entities[intersection_id])
final_path.extend(entities[i] for i in backward_ids)
# Space ➔ Solar_System ➔ Earth ➔ Mars ➔ Planetary_Science
```

---

## Data Source Comparison Matrix

| Architectural Vector | Option 3a (Kaggle 100K Subset) | Option 3b (KONECT Full Macro-Graph) |
| :--- | :--- | :--- |
| **Upstream edge format** | **Strings** in `links_export.csv` (`source_title`, `target_title`) | **Integers** in `out.wikipedia_link_en`; titles in `ent.wikipedia_link_en` |
| **Internal traversal key (post-ETL)** | **Integers** (after `build_vocab`) | **Integers** (native) |
| **Total Links / Edges** | ~28.9 Million | ~437.2 Million |
| **File Structure** | `links_export.csv` (streamable). `graph.json` exists but is not used by the pipeline. | `out.wikipedia_link_en` (space-separated edge list) and `ent.wikipedia_link_en` (line-by-line entity titles). |
| **Data Hygiene** | **Pre-cleaned:** All user talk pages, background code templates, and dead-end "red links" are completely scrubbed. | **Pre-filtered:** Isolated strictly to the encyclopedic namespace (Namespace 0). No junk, but preserves full graph volatility. |
| **Memory Strategy** | Int adjacency + entities table (~100K titles). String adjacency is avoided. | Same internal representation after ETL; scale requires CSR/binary adjacency, not Python dicts. |
| **Path Splicing Logic** | **O(path) title lookup:** BFS on ints; map IDs to titles once when building the result path. | **Same as 3a** after `build_vocab` / entity join stages. |
| **Computational Tax** | **Moderate ingestion, low search cost:** Stream CSV → int edges → CSR. One-time vocab build. | **Heavy ingestion, low search cost:** Entity join over ~437M edges before shared downstream stages. |
| **Network Dynamics** | An artificial sandbox representing a localized subset of pages. Great for verifying algorithm mechanics. | The true, organic web of global knowledge. Features massive natural hubs (e.g., *United States*) that will aggressively stress-test frontier queue expansion. |

---

## Bidirectional BFS graph shape

Search requires two directed views of the same edge set:

- **Forward adjacency:** `src → [targets]` — expand from start
- **Reverse adjacency:** `dst → [sources]` — expand backward from goal

At ~100K nodes and ~29M edges, use **adjacency lists or CSR**, not dense matrices. Store entities as an indexed list: `entities[node_id] → title`.

**On-disk graph bundle (normative spec):** `datapipeline/decisions/adjacency-csr.md` — file layout, CSR encoding, validation, and hydration procedure for any producer or consumer (Python pipeline, Rust search service, tests, or tools).

---

Operational rules for agents and contributors: `.cursor/rules/datapipeline.mdc` and `.claude/rules/datapipeline.md`. Rust loader hints: `.cursor/rules/adjacency-format.mdc`.
