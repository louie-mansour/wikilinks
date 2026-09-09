# Spec: Daily Word Guessing Mode

## Problem Statement

The existing WikiLinks/WikiSpan game requires the player to already know both a start and an end article. There's no mode that creates daily, shared engagement the way Wordle-style games do — a single puzzle everyone plays once a day, with no prior knowledge of the answer required. Players who enjoy the core "explore article connections" mechanic have no reason to return to the site on a given day if they don't already have two articles in mind.

## Solution

A new daily mode, "Grill," where the end article is hidden from the player. The player repeatedly guesses articles; each guess reveals all the shortest-path connections between that guess and the hidden end article, rendered onto a shared, accumulating graph. Guesses build on each other — previously revealed nodes and edges stay visible, and new guesses merge into the same graph rather than replacing it. The player wins by eventually guessing the hidden article itself. One puzzle per calendar day, shared by all players, unlimited guesses, with a shareable result summary once solved.

## User Stories

1. As a player, I want to navigate to a dedicated daily-game URL, so that I can play today's puzzle without needing to already know a start or end article.
2. As a player, I want to search for and submit a guess article using the same autocomplete search I already know from the main game, so that the input mechanic feels familiar.
3. As a player, I want each guess to reveal the connections (shortest paths) between my guess and the hidden end article, so that I get real information to reason about where the hidden article sits in the graph.
4. As a player, I want to see the hop count for each guess immediately, so that I have a quick, Wordle-style progress signal even before or without parsing the full revealed path.
5. As a player, I want previously revealed nodes and paths to remain visible as I make new guesses, so that I can build a mental map of the graph over the course of the puzzle.
6. As a player, I want new guesses' revealed subgraphs to merge with existing ones (shared nodes deduplicated, not duplicated), so that the graph reads as one coherent, growing picture rather than a stack of separate diagrams.
7. As a player, I want to be told clearly when a guess has no path to the hidden article within the search depth, so that I understand that guess didn't yield useful new information, rather than assuming something broke.
8. As a player, I want to be blocked from re-submitting a guess I've already made, so that I don't waste an action or clutter the graph with a duplicate reveal.
9. As a player, I want unlimited guesses, so that the challenge is about deduction and exploration rather than a scarce-resource guessing budget.
10. As a player, I want the hidden article's identity to never appear anywhere in the network response or UI before I guess it correctly, so that the game can't be trivially spoiled via devtools.
11. As a player, I want the game to clearly tell me when I've won, and reveal the true identity of the previously-hidden node, so that I get a satisfying resolution and can review the final full graph.
12. As a player, I want my guesses and revealed graph state to persist across a page reload on the same day, so that refreshing the page doesn't lose my progress.
13. As a player, I want the puzzle to be the same for everyone on a given calendar day, so that I can compare notes/compete informally with others who played the same puzzle.
14. As a player, I want the daily article to be reasonably well-connected (not a near-orphan page), so that the puzzle is solvable and interesting rather than a dead end.
15. As a player, once I've solved the puzzle, I want a compact, shareable summary (guess count and hop-count sequence) I can copy/share, so that I can share my result the way Wordle players share their grid.
16. As a returning player on a later day, I want a fresh puzzle each day, so that there's a reason to come back.
17. As a player, I understand that once a day's puzzle has passed, I cannot go back and play it retroactively in v1 — there is no archive of past puzzles.
18. As a developer/operator, I want to generate a batch of upcoming daily puzzles (e.g. 14 days) via a single command, so that populating the schedule doesn't require manual research per day.
19. As a developer/operator, I want the daily schedule to be a plain, hand-editable, committed file, so that I can swap out or correct a specific day's article without touching game logic or redeploying algorithmic changes.
20. As a developer/operator, I want the candidate-article filtering (connectivity threshold) to reuse degree data the Go service already computes at startup, so that there's no duplicated or out-of-sync connectivity logic between the schedule generator and the live graph.

## Implementation Decisions

- **Routing**: A new client route, `/daily`, added using the same lightweight path-matching approach `App.tsx` already uses to detect `/s/:code` (no full router library introduced). The existing single-page search game is untouched and remains the default route.
- **Guess input**: Reuses the existing article search/autocomplete component and `/api/suggest`-backed flow from the main game — no new input pattern.
- **New backend endpoint**: A dedicated endpoint (distinct from `/api/search`) accepts a guess (and implicitly, today's date/puzzle) and returns all shortest paths between the guess and the day's hidden end article, computed via the existing `BidirectionalBFS` engine (`service/internal/graph/bfs.go`). The existing `/api/search` endpoint is not reused for this feature, since its response includes the real end-node id/title, which would leak the answer via the network tab regardless of client-side UI masking.
- **Answer masking**: The endpoint substitutes a stable placeholder id (constant per puzzle-day, identical across all guesses for that day) for the real end node in the returned graph data, so that the client can merge multiple guesses' responses into one accumulated graph without knowing — or needing to know — the real identity until solved.
- **Win detection**: Determined server-side (guess matches the day's real answer). On a correct guess, the response includes `correct: true` plus the real end-node id/title, so the client can relabel the placeholder node in its already-accumulated graph rather than needing a full graph re-fetch.
- **Graph accumulation**: Client-side state merges each guess response's nodes/edges into a single running graph object, deduping by node id, before handing it to `GraphWiki`. Node/edge identity must be stable across requests (via the placeholder id scheme above) for merging to work correctly.
- **No-path handling**: If BFS returns no path within its existing depth cap, the endpoint returns the guess node with no connecting edges; the client renders it in a distinct muted/dim state rather than treating it as an error.
- **Repeat-guess prevention**: Enforced client-side against the locally tracked list of guesses already made for the day; no network round-trip needed to detect a duplicate.
- **`GraphWiki` variants**: Two new node variants are added to the existing `WikiNode` variant union (`'default' | 'start' | 'end' | 'path'`): `'guess'` (each article the player has guessed) and `'hidden-end'` (the placeholder/eventually-revealed target). Both follow the existing plain-circle, no-label, no-glow styling rules already established for `GraphWiki` — implemented as simple color/size variations via the same inline `C` color-token mapping, not new visual primitives.
- **Daily schedule storage**: A committed JSON file, `service/internal/config/daily_schedule.json`, mapping calendar date → article (title/id), read by the Go service at startup/request time. This is the single source of truth for "today's" hidden article; no per-request randomization or algorithmic date-seeded pick.
- **Candidate filtering**: Connectivity filtering (excluding near-orphan articles) is done in the Go service, reusing the in-degree/out-degree data it already loads at startup for `/internal/ending-nodes` / `/internal/starting-nodes` (`service/internal/service/ending_nodes.go`, `starting_nodes.go`), with a higher minimum-degree threshold than the existing `>0` check. No new datapipeline stage and no new persisted degree-stats artifact.
- **Schedule generation tooling**: A one-off Go subcommand/flag on the existing server binary (e.g. `server -gen-schedule -days=14`) samples that many candidate articles above the degree threshold and writes/extends `daily_schedule.json`. Run manually and the output committed; not part of the automated datapipeline or a runtime code path.
- **Persistence**: Client-only, via `localStorage`, keyed by the puzzle date. Stores the list of guesses made and the accumulated graph state for the current day. No backend session, account, or player identity is introduced.
- **Sharing**: A share summary is generated client-side once the puzzle is solved, following the existing `ShareBar` pattern used by the main game, containing guess count and a compact hop-count sequence (e.g. `Grill #12: 4 guesses (7→4→2→0)`), copyable as text.
- **Day rollover**: One puzzle per calendar day (UTC), identical for all players — no per-player randomization or personalized puzzles.

## Testing Decisions

- Tests should exercise external behavior (HTTP request/response contracts, rendered UI state, localStorage-persisted state across a simulated reload) rather than internal implementation details of graph-merging logic.
- **Go service**: New endpoint should have request/response contract tests analogous to existing handler tests for `/api/search` — covering a normal guess with paths found, a guess with no path (depth-exceeded/disconnected), a correct/winning guess, and confirming the real end-node identity never appears in the response body prior to a correct guess.
- **Schedule generation subcommand**: Test that it only selects candidates above the configured degree threshold and writes valid, parseable JSON in the expected date-keyed shape; prior art is the existing golden-file style test for the adjacency writer (`datapipeline/tests/test_build_adjacency.py`), applied conceptually (deterministic output, checked structure) rather than reused directly since this is Go, not Python.
- **Frontend**: Component/integration tests for the accumulation logic (merging two sequential guess responses into one deduped graph, correctly relabeling the placeholder node on a win) and for the repeat-guess block, following whatever existing test patterns cover `GraphWiki`/`buildGraphData` (per `.claude/rules/graphwiki-node-connections.md`, Storybook stories are the existing tool for visually verifying `GraphWiki` node/variant rendering — new stories should cover the `'guess'` and `'hidden-end'` variants the same way).
- **localStorage persistence**: Test that reloading mid-puzzle restores guesses and graph state for the current date, and that a date change (crossing the daily rollover) does not leak the previous day's state into the new puzzle.

## Out of Scope

- Archive of past puzzles / ability to play a missed day (explicitly deferred; schedule file structurally supports it later without change).
- Backend-persisted player sessions, accounts, or cross-device continuity.
- Leaderboards, stats tracking, or comparing results against other players beyond the copyable share summary text.
- A guess-count cap or any loss/failure state.
- Automated/algorithmic daily article selection at request time (the schedule is a static, pre-generated, hand-editable file, not computed live).
- A new datapipeline stage for connectivity/degree computation.
- Any change to the existing single-page search game's routing, state machine, or `/api/search` contract.

## Further Notes

- This spec covers the daily "Grill" guessing mode only, as scoped in discussion — it does not cover any other proposed use of the `grill-me`/interview skill output beyond this feature.
- The masked placeholder id scheme (stable per day, consistent across all guess responses) is the key correctness constraint for client-side graph merging and should be treated as a hard contract between the new endpoint and the frontend accumulation logic.
- No issue tracker/triage label vocabulary was configured for this project at spec-writing time, so this spec was written to a local file rather than published; publish manually or run `/setup-matt-pocock-skills` first if tracker publishing is wanted later.
