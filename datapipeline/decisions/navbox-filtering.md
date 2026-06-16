# Navbox / Accordion Link Filtering (Future Improvement)

Wikipedia articles contain two broad categories of internal links:

- **Body links** — links embedded in article prose, infoboxes, "See also", and "Further reading" sections. These feel like intentional, meaningful connections.
- **Navbox links** — links inside collapsible navigation boxes (accordions) at the bottom of articles, e.g. "Template:Countries of Europe". These create dense clusters of related articles and can produce paths that feel cheap or accidental.

The Kaggle `links_export.csv` source exposes a `depth` column that distinguishes these: depth ≤ 2 is body/section text, depth ≥ 3 is navbox/template content. The `--max-depth 2` flag on `extract_edges` exploits this.

**The Wikipedia SQL dump path has no equivalent.** The `pagelinks` table records only `(pl_from, pl_target_id)` — no section, position, or nesting depth. All link types are flattened together.

## How to add navbox filtering to the Wikipedia path

### Option A — `templatelinks` + name heuristic (simpler, imperfect)

1. Download `enwiki-latest-templatelinks.sql.gz` (~1.5 GB).
2. Filter to template pages whose title contains "navbox", "sidebar", "navigation", etc.
3. Look up those template pages' own `pagelinks` entries to get the set of links each navbox injects.
4. In `extract_wiki_edges`, subtract any `(article, target)` pair where target appears in a navbox the article transcludestransclu.

**Limitation:** name heuristics miss navboxes with neutral names (e.g. `Template:Countries_of_Europe`). Covers the majority but not all.

### Option B — `categorylinks` + `templatelinks` (accurate)

Same as Option A, but identify navbox templates by membership in `Category:Navigational_boxes` (and its sub-categories) via `enwiki-latest-categorylinks.sql.gz` (~500 MB) instead of name matching.

More accurate; adds one extra dump.

### Option C — XML wikitext parsing (most accurate, most expensive)

Parse `enwiki-latest-pages-articles.xml.bz2` (~22 GB compressed). Navbox links appear as `{{Navbox|...}}` template calls in wikitext. A wikitext parser can distinguish body links from template-injected links at the source.

Most accurate but complex to implement and the file is large.

## Recommended starting point

Option B. The `categorylinks` dump is small, the join logic mirrors what `extract_wiki_edges` already does with `linktarget`, and it gives accurate navbox identification without heuristics.

New stages would slot in between `build_title_index` and `extract_wiki_edges`:

```
fetch --source wikipedia
build_title_index       data/entities.tsv + data/wiki_page_ids.tsv
build_navbox_blocklist  data/navbox_blocklist.tsv   ← new
extract_wiki_edges      data/edges_int.tsv           (reads blocklist)
build_adjacency         data/adj_fwd.* + data/adj_rev.*
```
