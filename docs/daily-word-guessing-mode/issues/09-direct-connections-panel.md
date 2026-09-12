# 09: Direct connections panel

**What to build:** A new dedicated panel in `DailyGame` that lists articles directly linking to the mystery article, ranked by relevance, filled in as they appear in the player's revealed graph.

**Blocked by:** 04 (graph accumulation), 05 (win detection/reveal)

**Status:** design agreed, not yet implemented

## Data & scope

- List membership = intersection of:
  - **Direct backlinks of the mystery article** — `RevNeighbors(mystery_id)` from the CSR adjacency (`service/internal/graph/graph.go`).
  - **Nodes already present in the player's accumulated merged graph** (`web/src/data/dailyGraph.ts`'s `mergeGraphData` output), built from the shortest paths returned across the player's guesses so far.
- Not one entry per guess — a single guess can reveal many path nodes, and any of those that are also direct backlinks of the mystery article populate this list.

## Relevance & sort

- Per row, show an **N/D fraction** and derived percent:
  - `D` = that connecting article's total outbound-link count (out-degree, via `FwdNeighbors` length).
  - `N` = how many of those `D` edges point specifically at the mystery article (duplicate edges are preserved in the graph data, so this can be >1).
- Sort **descending by N/D** — the most specific/telling connections (few outbound links, one of which is the answer) rank above generic hub pages with thousands of outbound links.

## Reveal mechanic

- Panel is present from the start of the game.
- Starts empty; entries are appended only as matching nodes are revealed (no skeleton/placeholder count of undiscovered entries — nothing hints at the eventual total).

## UI

- New dedicated panel, positioned next to the `GraphWiki` canvas (not folded into the existing small guess feed in `DailyGame.tsx`).
- Row content: article title + N/D fraction/percent indicator.
- Label plainly, e.g. "Direct connections to the answer" — no spoiler-softened wording (consistent with how much the game already reveals via hop counts and path structure).
- Empty state: simple placeholder message, e.g. "No direct connections discovered yet."
- Row click: highlights/centers that node on the `GraphWiki` canvas.
- Pagination: reuse the existing "Load N more of M" button pattern from `ShortestPaths.tsx` / `SortSelect.tsx` rather than building a virtualized list — sort is fixed to relevance only, no manual sort control needed.

## Backend

- Extend the `/api/guess` response (`service/internal/controller/guess.go` / `service/internal/service/guess.go`) with per-node fields computed from the existing CSR adjacency, no new endpoint:
  - `outDegree` (D)
  - `edgeCountToEnd` (N)
- Both are O(1)/O(D) lookups against the already-loaded `FwdNeighbors` offsets — no runtime adjacency rebuild.

## Persistence

- Follows the existing `dailyGraph` / localStorage merge pattern (`06-localstorage-persistence.md`) already used for daily game state — no separate storage mechanism.

- [ ] `/api/guess` response includes `outDegree` and `edgeCountToEnd` per relevant node
- [ ] Frontend derives the direct-connections list client-side from the merged graph + these fields, no new API round trip
- [ ] New panel component renders next to `GraphWiki`, sorted descending by N/D, using the "Load N more of M" pagination pattern
- [ ] Row click highlights/centers the corresponding node on the canvas
- [ ] Empty state and plain "direct connections to the answer" labeling implemented
- [ ] List state persists across reload via existing localStorage mechanism
- [ ] Component/integration test: guessing an article whose revealed paths include known direct backlinks of the mystery article populates and correctly sorts the panel
- [ ] Manually verifiable: play the daily game, confirm the panel fills in as guesses reveal direct backlinks, sorted by N/D descending
