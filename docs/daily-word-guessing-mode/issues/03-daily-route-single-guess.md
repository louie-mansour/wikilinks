# 03: `/daily` route + single-guess rendering

**What to build:** A dedicated `/daily` client route where a player can submit one guess (via the existing article search/autocomplete component) and see that guess's revealed subgraph rendered on `GraphWiki`, using two new node variants for the guessed article and the hidden/placeholder end node.

**Blocked by:** 02

**Status:** done

- [x] `/daily` route added using the same lightweight path-matching approach `App.tsx` already uses for `/s/:code` (no new router library)
- [x] Existing single-page search game route/behavior is unchanged
- [x] Guess input reuses the existing article search/autocomplete component and `/api/suggest`-backed flow
- [x] Submitting a guess calls the new endpoint from ticket 02 and renders the returned graph via `GraphWiki`
- [x] `WikiNodeVariant` union extended with `'guess'` and `'hidden-end'`, styled per `.claude/rules/graphwiki-node-connections.md` (plain circles, no labels, no glow/tags — color/size variation only via the existing `C` token mapping)
- [x] A guess with no revealed path renders in a distinct muted/dim state (not an error state)
- [x] Hop count for the guess is shown immediately in the UI
- [ ] Manually verifiable: navigate to `/daily`, submit a guess, see its graph rendered
