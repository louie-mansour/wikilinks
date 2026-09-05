# Datapipeline — stages, formats, and large-file safety

Applies to: `datapipeline/**`

Read `datapipeline/decisions/datasource.md` before choosing formats or stage boundaries. Operational checklist mirrors `.cursor/rules/datapipeline.mdc`.

## Keys: ints internally, titles for display

- **BFS and on-disk graph structures** use integer node IDs (frontier queues, parent maps, adjacency).
- **Final paths** resolve `id → title` via an entities table — O(path length), not during search expansion.
- Never build string-keyed adjacency; it does not scale at ~1B edges.

## Stage order (Wikipedia SQL dumps path)

```
fetch           raw/enwiki-latest-page.sql.gz (~2.4GB)
                raw/enwiki-latest-linktarget.sql.gz (~1.4GB)
                raw/enwiki-latest-pagelinks.sql.gz (~7.0GB)
build_title_index  data/entities.tsv + data/wiki_page_ids.tsv
extract_wiki_edges data/edges_int.tsv
build_adjacency    data/adj_fwd.* + data/adj_rev.*   CSR graph bundle (see adjacency-csr.md)
search             in-memory bidirectional BFS
```

These three raw files are multi-GB `.sql.gz` dumps — stream via `lib/page_sql.py`,
never load fully into memory. **Redirects are not resolved** in this path; see
`datapipeline/decisions/datasource.md` "Known limitations / follow-ups".

Join `page` + `linktarget` + `pagelinks` SQL dumps into `entities.tsv` / `edges_int.tsv` via `build_title_index` + `extract_wiki_edges`.

## Large raw files

Files in `raw/` are multi-GB. When exploring or debugging:

- Never load full raw files into memory.
- Stream line-by-line; sample first N rows only.
- Check sizes with `ls -lh` before reading.

## Stage contract

Each stage under `stages/` must: accept explicit `--in`/`--out` paths, write atomically, be idempotent (skip when output is fresh), run independently via `python -m datapipeline.stages.<name>`, and do one transformation per module.

Log stage name, input paths, output path, and row/edge counts on success.
