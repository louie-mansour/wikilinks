# 01: Neighbor-reveal lookup (backend)

**What to build:** A server-side capability that, given an arbitrary guessed article id, returns all of its outbound neighbors (titles), with the hidden article's id filtered out.

**Blocked by:** none — this is the foundational primitive everything else in Reveal mode consumes.

**Status:** design agreed, not yet implemented

## Data & scope

- Source: `WikipediaGraph.FwdNeighbors(id)` (`service/internal/graph/graph.go`) against the already-mmap'd CSR bundle — O(1)/O(D) lookup, no runtime adjacency rebuild, no new datapipeline stage.
- Outbound only. Uncapped — return every neighbor, however many.
- Resolve each neighbor id to its title via the existing `entities.tsv`-backed title index (`ResolveTitle`/`Title`, same lookup Classic already uses).
- **Filter out the hidden article's id** from the returned list server-side, before it reaches the client — same masking discipline as Classic's `/api/guess` (never trust the client to hide it).

## Backend

- Not necessarily its own HTTP endpoint — expose as an internal function callable from the Reveal guess endpoint (see `02`). Only build a standalone `/api/...` route if `02`'s response shape ends up needing it split out.
- Signature roughly: `func (g *WikipediaGraph) RevealNeighbors(guessID, hiddenID uint32) []NeighborInfo` where `NeighborInfo` is `{ID uint32; Title string}`.

## Checklist

- [ ] `RevealNeighbors`-equivalent function implemented against `FwdNeighbors` + title resolution
- [ ] Hidden article id excluded from the returned list even when it is a direct outbound neighbor of the guess
- [ ] Unit test: guess with N outbound neighbors including the hidden id returns exactly N-1 named neighbors
- [ ] Unit test: guess with zero outbound neighbors returns an empty list, not an error
