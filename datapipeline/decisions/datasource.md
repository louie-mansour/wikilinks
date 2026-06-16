# Wikipedia Graph Data Source Comparison for Bidirectional BFS

This document outlines the architectural trade-offs, file structures, and algorithmic impacts of using different Wikipedia data sources for implementing an in-memory bidirectional Breadth-First Search (BFS) pathfinder.

---

## Decision

**Kaggle 100K subset (Option 3a) remains the bootstrap/dev path** for initial pipeline development and algorithm verification.

Rationale:

- **Title-native upstream format** — edges arrive as article titles in `links_export.csv`, so no entity join at fetch time.
- **Faster iteration** — smaller download (~29M edges), pre-cleaned data, and lower memory footprint make it practical to build and debug fetch → parse → search stages end-to-end.
- **Sufficient for validation** — large enough to exercise real bidirectional BFS and path splicing before scaling up.

**Wikipedia's own SQL dumps (Option 3c) are the preferred full-scale "real data" path.** It is current, self-consistent (titles and edges come from the same snapshot), and produces the full English Wikipedia link graph (~6.8–7M articles, likely >1B edges).

**KONECT (Option 3b) is superseded for the full-scale role.** Its node IDs are Wikipedia `page_id`s from a ~13-year-old snapshot; joining them against a *current* `enwiki-latest-page.sql.gz` leaves **9.7M of 13.6M entities (71%)** as `Page_{id}` placeholders — IDs that are now deleted, non-article-namespace, or otherwise unresolvable. KONECT remains in the codebase (`--source konect`) for stress-testing frontier expansion against natural hubs (e.g. *United States*), but new full-scale runs should use `--source wikipedia`.

Pipeline stage 1 (`fetch`) downloads Kaggle files to `raw/` by default, KONECT + Netzschleuder titles with `--source konect`, or the Wikipedia `page`/`linktarget`/`pagelinks` SQL dumps with `--source wikipedia`.

---

## Pipeline stage plan

After `fetch`, build stages in this order. Both Kaggle and KONECT converge on `data/entities.tsv`, `data/edges_int.tsv`, and CSR adjacency before search.

### Kaggle path (~29M edges)

| Stage | Input | Output | Purpose |
|-------|-------|--------|---------|
| `fetch --source kaggle` | Kaggle API | `raw/links_export.csv` | Download upstream data |
| `extract_edges` | `links_export.csv` | `data/edges.tsv` | Strip to `source_title`, `target_title` only; stream, dedupe |
| `build_vocab` | `edges.tsv` | `data/entities.tsv`, `data/edges_int.tsv` | Intern titles → int IDs |
| `build_adjacency` | `edges_int.tsv` | `data/adj_fwd.*`, `data/adj_rev.*` | Forward + reverse CSR adjacency |

### KONECT path (~437M edges) — int-native, skips string round-trip

| Stage | Input | Output | Purpose |
|-------|-------|--------|---------|
| `fetch --source konect` | KONECT + Wikimedia page.sql | `raw/out.wikipedia_link_en`, `raw/ent.wikipedia_link_en` | Download edges; build titles from page IDs via page.sql |
| `map_entities` | `ent.wikipedia_link_en` | `data/entities.tsv` | Copy titles (line *i* = title for node id *i*, 0-indexed) |
| `edges_to_int` | `out.wikipedia_link_en` + `entities.tsv` | `data/edges_int.tsv` | Single-pass int edge conversion (KONECT 1-indexed → 0-indexed) |
| `build_adjacency` | `edges_int.tsv` | `data/adj_fwd.*`, `data/adj_rev.*` | Same CSR bundle as Kaggle |

KONECT skips `extract_edges` and `build_vocab` because upstream edges are already dense integer IDs — converting to title pairs and re-interning would add a ~15–30 GB intermediate file and multiple extra passes.

**KONECT public tar contains only `out.wikipedia_link_en`** (no entity file). Node IDs are Wikipedia page IDs. Fetch builds `ent.wikipedia_link_en` from [enwiki-latest-page.sql.gz](https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-page.sql.gz) (namespace 0 titles only; missing IDs get `Page_{id}` placeholders).

### Wikipedia SQL dumps path (Option 3c, ~6.8–7M articles, likely >1B edges) — preferred full-scale path

Builds the full, current English Wikipedia link graph directly from Wikipedia's own
SQL dumps — the source KONECT was originally built from, but current and
self-consistent (titles and edges come from the same snapshot, so the `Page_{id}`
placeholder problem disappears by construction).

| Stage | Input | Output | Purpose |
|-------|-------|--------|---------|
| `fetch --source wikipedia` | Wikimedia SQL dumps | `raw/enwiki-latest-page.sql.gz` (~2.4GB), `raw/enwiki-latest-linktarget.sql.gz` (~1.4GB), `raw/enwiki-latest-pagelinks.sql.gz` (~7.0GB) | Download page metadata, link-target dictionary, and link edges |
| `build_title_index` | `enwiki-latest-page.sql.gz` | `data/entities.tsv`, `data/wiki_page_ids.tsv` | Dense id ↔ title for namespace-0, non-redirect pages; `wiki_page_ids.tsv` is a parallel array of Wikipedia `page_id`s (intermediate, wikipedia-source-specific) |
| `extract_wiki_edges` | `enwiki-latest-linktarget.sql.gz` + `enwiki-latest-pagelinks.sql.gz` + `entities.tsv` + `wiki_page_ids.tsv` | `data/edges_int.tsv` | Resolve `pagelinks` (`pl_from` → `pl_target_id` via `linktarget`) to dense ids; drop unresolved (red link or redirect target) and self-loop edges |
| `build_adjacency` (unchanged) | `edges_int.tsv` | `data/adj_fwd.*`, `data/adj_rev.*` | Same CSR bundle as Kaggle/KONECT |

MediaWiki dump schemas (current 1.43+ schema):

- **`page`**: `(page_id, page_namespace, page_title, page_is_redirect, ...)`.
- **`linktarget`**: `(lt_id, lt_namespace, lt_title)` — dedup table of all link targets.
- **`pagelinks`**: `(pl_from, pl_from_namespace, pl_target_id)` — `pl_from` is the source `page_id`; `pl_target_id` is a FK into `linktarget`.

| Stage | Input | Output | Purpose |
|-------|-------|--------|---------|
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
| **Upstream edge format** | **Strings** in `links_export.csv` (`source_title`, `target_title`) | **Integers** in `out.wikipedia_link_en`; titles in `ent.wikipedia_link_en` (built at fetch from Wikimedia page.sql) |
| **Internal traversal key (post-ETL)** | **Integers** (after `build_vocab`) | **Integers** (native) |
| **Total Links / Edges** | ~28.9 Million | ~437.2 Million |
| **File Structure** | `links_export.csv` (streamable). `graph.json` exists but is not used by the pipeline. | `out.wikipedia_link_en` (space-separated edge list) and `ent.wikipedia_link_en` (line-by-line entity titles). |
| **Data Hygiene** | **Pre-cleaned:** All user talk pages, background code templates, and dead-end "red links" are completely scrubbed. | **Pre-filtered:** Isolated strictly to the encyclopedic namespace (Namespace 0). No junk, but preserves full graph volatility. |
| **Memory Strategy** | Int adjacency + entities table (~100K titles). String adjacency is avoided. | Same internal representation after ETL; scale requires CSR/binary adjacency, not Python dicts. |
| **Path Splicing Logic** | **O(path) title lookup:** BFS on ints; map IDs to titles once when building the result path. | **Same as 3a** after `map_entities` / `edges_to_int`. |
| **Computational Tax** | **Moderate ingestion, low search cost:** Stream CSV → int edges → CSR. One-time vocab build. | **Heavy ingestion, low search cost:** Single-pass int edge conversion (~437M edges) → CSR. No title-pair intermediate. |
| **Network Dynamics** | An artificial sandbox representing a localized subset of pages. Great for verifying algorithm mechanics. | The true, organic web of global knowledge. Features massive natural hubs (e.g., *United States*) that will aggressively stress-test frontier queue expansion. |

---

## Bidirectional BFS graph shape

Search requires two directed views of the same edge set:

- **Forward adjacency:** `src → [targets]` — expand from start
- **Reverse adjacency:** `dst → [sources]` — expand backward from goal

At ~100K nodes and ~29M edges, use **adjacency lists or CSR**, not dense matrices. Store entities as an indexed list: `entities[node_id] → title`.

**On-disk graph bundle (normative spec):** `datapipeline/decisions/adjacency-csr.md` — file layout, CSR encoding, validation, and hydration procedure for any producer or consumer (Python pipeline, Go search service, tests, or tools).

---

## Known limitations / follow-ups

**Redirects are not resolved in the Wikipedia SQL dumps path (v1).** A `pagelinks`
row whose target resolves (via `linktarget`) to the title of a redirect page is
dropped in `extract_wiki_edges` — same bucket as a red link (target not in
`entities.tsv`), because redirect pages are excluded from `entities.tsv` by
`build_title_index`. This understates connectivity: a link to "USA" should really
count as a link to "United States".

Follow-up: fetch `enwiki-latest-redirect.sql.gz` (`rd_from, rd_namespace, rd_title`).
In `extract_wiki_edges`, when a `linktarget` (ns0, title) resolves to a page_id that
is itself a redirect, follow `rd_from -> (rd_namespace, rd_title)` (1–2 hops, bail on
cycles) to the real article before the final `title_to_dense` lookup.

---

Operational rules for agents and contributors: `.cursor/rules/datapipeline.mdc` and `.claude/rules/datapipeline.md`. Go loader hints: `.cursor/rules/adjacency-format.mdc`.
