# 05: Win detection, reveal, and share summary

**What to build:** Handling for a correct guess — relabeling the placeholder node in the already-accumulated graph with the real end-node identity, a clear win state in the UI, and a copyable share summary of the result (guess count + hop-count sequence), following the existing `ShareBar` pattern.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] On a `correct: true` response, the placeholder/hidden-end node in the accumulated graph is relabeled with the real end-node id/title (no full graph re-fetch)
- [ ] UI clearly indicates the puzzle is won and shows the final full graph
- [ ] A share summary is generated client-side once solved, containing guess count and a compact hop-count sequence (e.g. `Grill #12: 4 guesses (7→4→2→0)`), copyable as text, following the existing `ShareBar` component pattern
- [ ] Component/integration test: a winning guess correctly relabels the placeholder node in an already-accumulated graph
- [ ] Manually verifiable: guess the correct article, see the win state, real article revealed, and a copyable share summary
