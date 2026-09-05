# Wikipedia Graph Data Source for Bidirectional BFS

This document outlines the architectural trade-offs, file structures, and algorithmic impacts of the Wikipedia data source used to build the in-memory bidirectional Breadth-First Search (BFS) pathfinder.

---

## Decision

**Wikipedia's own SQL dumps are the data source.** It is current, self-consistent (titles and edges come from the same snapshot), and produces the full English Wikipedia link graph (~6.8–7M articles, likely >1B edges).

Pipeline stage 1 (`fetch`) downloads the Wikipedia `page`/`linktarget`/`pagelinks`/`redirect` SQL dumps to `raw/`.

### Superseded sources (removed)

Two earlier sources were used during pipeline bootstrap and have since been removed along with their stages (`extract_edges`, `build_vocab`, `map_entities`, `edges_to_int`) and `--source` switch:

- **Kaggle 100K subset** (`links_export.csv`) — used as the bootstrap/dev path for initial pipeline development (title-native format, small download, fast iteration). Superseded once the Wikipedia SQL dumps path was built out to full scale.
- **KONECT** (`out.wikipedia_link_en` + `ent.wikipedia_link_en`) — its node IDs are Wikipedia `page_id`s from a ~13-year-old snapshot; joining them against a *current* `enwiki-latest-page.sql.gz` left **9.7M of 13.6M entities (71%)** as `Page_{id}` placeholders — IDs that are now deleted, non-article-namespace, or otherwise unresolvable. Kept for a time for BFS stress-testing frontier expansion against natural hubs (e.g. *United States*), then removed once it was no longer exercised.

Both converged on the same `data/entities.tsv` / `data/edges_int.tsv` formats as the Wikipedia path before `build_adjacency`, so removing them did not change the CSR graph bundle contract.

---

## Pipeline stage plan

### Wikipedia SQL dumps path (~6.8–7M articles, likely >1B edges)

Builds the full, current English Wikipedia link graph directly from Wikipedia's own
SQL dumps.

| Stage | Input | Output | Purpose |
|-------|-------|--------|---------|
| `fetch` | Wikimedia SQL dumps | `raw/enwiki-latest-page.sql.gz` (~2.4GB), `raw/enwiki-latest-linktarget.sql.gz` (~1.4GB), `raw/enwiki-latest-pagelinks.sql.gz` (~7.0GB) | Download page metadata, link-target dictionary, and link edges |
| `build_title_index` | `enwiki-latest-page.sql.gz` | `data/entities.tsv`, `data/wiki_page_ids.tsv` | Dense id ↔ title for namespace-0, non-redirect pages; `wiki_page_ids.tsv` is a parallel array of Wikipedia `page_id`s (intermediate, wikipedia-source-specific) |
| `extract_wiki_edges` | `enwiki-latest-linktarget.sql.gz` + `enwiki-latest-pagelinks.sql.gz` + `entities.tsv` + `wiki_page_ids.tsv` | `data/edges_int.tsv` | Resolve `pagelinks` (`pl_from` → `pl_target_id` via `linktarget`) to dense ids; drop unresolved (red link or redirect target) and self-loop edges |
| `build_adjacency` | `edges_int.tsv` | `data/adj_fwd.*`, `data/adj_rev.*` | Forward + reverse CSR adjacency |
| `search` | adjacency + entities | (in-memory) | Bidirectional BFS; resolve IDs to titles only for final path |

MediaWiki dump schemas (current 1.43+ schema):

- **`page`**: `(page_id, page_namespace, page_title, page_is_redirect, ...)`.
- **`linktarget`**: `(lt_id, lt_namespace, lt_title)` — dedup table of all link targets.
- **`pagelinks`**: `(pl_from, pl_from_namespace, pl_target_id)` — `pl_from` is the source `page_id`; `pl_target_id` is a FK into `linktarget`.

Raw files are very large (multi-GB `.sql.gz` dumps). Stages must stream line-by-line and never load full raw files into memory.

---

## Internal keys vs display keys

Use integer node IDs internally; titles are for humans only.

| Layer | Key type | Rationale |
|-------|----------|-----------|
| `linktarget` / `pagelinks` SQL dumps | Ints (`page_id`, `lt_id`) | Upstream format |
| `edges_int.tsv` | Ints | Smaller disk, faster adjacency build |
| BFS (queues, parent maps, adjacency) | Ints | Lower memory and faster hashing than Python string objects at ~1B edges |
| Final path output | Strings | `entities[id]` lookup once when splicing — O(path length), negligible |

String-keyed adjacency (`dict[str, list[str]]`) is not viable at this scale in Python.

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

## Bidirectional BFS graph shape

Search requires two directed views of the same edge set:

- **Forward adjacency:** `src → [targets]` — expand from start
- **Reverse adjacency:** `dst → [sources]` — expand backward from goal

At ~7M nodes and ~1B edges, use **adjacency lists or CSR**, not dense matrices. Store entities as an indexed list: `entities[node_id] → title`.

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
