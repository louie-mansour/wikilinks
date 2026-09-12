# 02: Reveal-mode guess endpoint

**What to build:** A new guess endpoint for Reveal mode that, per guess, returns both the neighbor reveal (01) and the shortest-path reveal (reusing Classic's BFS), with the hidden article represented via the existing placeholder-id scheme.

**Blocked by:** 01 (neighbor-reveal lookup)

**Status:** design agreed, not yet implemented

## Behavior

- Distinct route from Classic's `/api/guess` (response shape differs) — e.g. `/api/reveal-guess`.
- Reads today's answer from the **same** `daily_schedule.json` / `DailySchedule` Classic uses — no new schedule file.
- Request: guess title + 1-indexed `guessNumber`, same pattern as Classic.
- Per request, computes:
  1. **Neighbor reveal** — `RevealNeighbors(guessID, hiddenID)` from `01`.
  2. **Path reveal** — `graph.BidirectionalBFS(g, guessID, answerID)` (`service/internal/graph/bfs.go`), same engine/depth caps as Classic (`MaxDepth=10`, `MaxPaths=10000`).
- The hidden article is substituted with the same stable per-day placeholder id (`config.PlaceholderID`) in path-reveal data, exactly as Classic does — never the real id/title, until correct.
- Enforces `MaxDailyGuesses` (5) via `guessNumber`, same as Classic.
- On a correct guess: response includes `correct: true` plus the real hidden article id/title **and** resolved real titles for every path-node id seen across the player's guesses so far this request (or the client tracks path-node ids and this endpoint accepts a batch "resolve titles" call — pick whichever keeps the endpoint stateless; server holds no per-player session).
- On `guessNumber == MaxDailyGuesses` without a correct guess: response includes `lost: true` plus the same full title-resolution payload as a win.

## Checklist

- [ ] New endpoint accepts guess + `guessNumber`, resolves guess title to id (reuse existing resolution/error handling from Classic's guess service)
- [ ] Response includes neighbor-reveal list (01) and path-reveal subgraph (placeholder-masked)
- [ ] `correct: true` path includes real hidden id/title + resolvable titles for all prior placeholder/blank path nodes
- [ ] `lost: true` path (guessNumber hits cap) includes the same full-reveal payload as a win
- [ ] Contract test: guess with no direct link to hidden article → path-only reveal, neighbor list has no hidden id
- [ ] Contract test: guess that directly links to hidden article → hidden id absent from neighbor list (masking holds)
- [ ] Contract test: winning guess → real titles resolvable for all accumulated nodes
- [ ] Contract test: guess at `guessNumber == MaxDailyGuesses` without solving → `lost: true` + full reveal
- [ ] Confirm real hidden-article identity never appears in any response body prior to a correct/losing guess
