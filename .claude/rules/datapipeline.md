# Datapipeline — stages, formats, and large-file safety

Applies to: `datapipeline/**`

Read `datapipeline/decisions/datasource.md` before choosing formats, sources, or stage boundaries. Operational checklist mirrors `.cursor/rules/datapipeline.mdc`.

## Keys: ints internally, titles for display

- **BFS and on-disk graph structures** use integer node IDs (frontier queues, parent maps, adjacency).
- **Final paths** resolve `id → title` via an entities table — O(path length), not during search expansion.
- After `extract_edges`, never build string-keyed adjacency; it does not scale at ~29M edges.

## Planned stage order

```
fetch           raw/links_export.csv          (done)
extract_edges   data/edges.tsv                source_title, target_title only
build_vocab     data/entities.tsv + data/edges_int.tsv
build_adjacency data/adj_fwd.* + data/adj_rev.*   CSR graph bundle (see adjacency-csr.md)
search          in-memory bidirectional BFS
```

Do not skip `extract_edges`. Downstream stages must not re-read the ~4.8 GB raw CSV.

## Kaggle vs KONECT inputs

- **Kaggle:** stream `raw/links_export.csv` only — ignore `raw/graph.json`.
- **KONECT (future):** join `ent.wikipedia_link_en` + `out.wikipedia_link_en` into the same `entities.tsv` / `edges_int.tsv` formats.

## Large raw files

Files in `raw/` are multi-GB. When exploring or debugging:

- Never load full raw files into memory.
- Stream line-by-line; sample first N rows only.
- Check sizes with `ls -lh` before reading.

## Stage contract

Each stage under `stages/` must: accept explicit `--in`/`--out` paths, write atomically, be idempotent (skip when output is fresh), run independently via `python -m datapipeline.stages.<name>`, and do one transformation per module.

Log stage name, input paths, output path, and row/edge counts on success.
