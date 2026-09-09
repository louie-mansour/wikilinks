# 04: Multi-guess accumulation + repeat-guess prevention

**What to build:** Client-side state that merges each new guess's revealed subgraph into one running, deduplicated graph (rather than replacing the previous guess's graph), and blocks resubmission of a guess already made.

**Blocked by:** 03

**Status:** in-review — behavior implemented, one test gap open (see unchecked item)

- [x] Each guess response's nodes/edges are merged into a single accumulated graph object, deduping by node id (relying on the stable placeholder id scheme from ticket 02 for identity across requests)
- [x] Previously revealed nodes/edges remain visible after a new guess
- [x] The accumulated graph (not a per-guess graph) is what's handed to `GraphWiki`
- [x] Submitting a guess already made for the day is blocked client-side, with no network round-trip, against the locally tracked list of guesses for the day
- [x] Component/integration test: merging two sequential guess responses produces one deduped graph
- [ ] Component/integration test: resubmitting an existing guess is blocked
- [ ] Manually verifiable: make two distinct guesses, see one merged graph; attempt a repeat guess and see it rejected
