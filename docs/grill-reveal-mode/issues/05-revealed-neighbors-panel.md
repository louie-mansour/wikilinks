# 05: Revealed-neighbors side panel

**What to build:** A side panel listing every `named` node revealed so far (across all guesses), in reveal order, as a persistent alternative to hovering nodes on the canvas.

**Blocked by:** 03 (graph accumulation & node states)

**Status:** design agreed, not yet implemented

## Scope

- Distinct from Classic's existing "Direct Connections" panel (which lists backlinks of the mystery article specifically) — this panel lists **any** node in the `named` state, i.e. every outbound neighbor revealed by every guess so far, regardless of relevance to the hidden article.
- Row content: article title only (no N/D relevance scoring — that concept doesn't apply here since these aren't filtered to backlinks-of-the-answer).
- Grouping: reveal order overall, or grouped per guess ("Guess 3 (Article X) revealed: ...") — either is acceptable; group per guess if it's low additional effort, since it gives useful per-guess context.

## UI

- Positioned next to `GraphWikiReveal` (04), same general placement convention as Classic's Direct Connections panel.
- Empty state: simple placeholder, e.g. "No articles revealed yet."
- Row click: highlights/centers that node on the canvas (same interaction as Classic's Direct Connections panel).
- Pagination: reuse the existing "Load N more of M" pattern if the list grows long (outbound reveals are uncapped, so this list can get large).

## Checklist

- [ ] New panel component renders next to `GraphWikiReveal`
- [ ] Populated from `named`-state nodes in the accumulated graph (03), no separate API call
- [ ] Row click highlights/centers the node on canvas
- [ ] Empty state implemented
- [ ] Pagination via existing "Load N more of M" pattern
- [ ] List state persists across reload via `08` (localStorage)
