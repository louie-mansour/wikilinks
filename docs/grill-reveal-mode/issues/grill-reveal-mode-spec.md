# Spec: Grill: Reveal (alternate daily mode)

## Problem Statement

The existing daily mode ("Grill") only ever reveals nodes that lie on the shortest path between a guess and the hidden article. A guess that misses the path entirely yields little or no new information, so the reward for a "close but not exactly on-path" guess is weak. There's no mode that rewards a player for guessing a well-connected article in its own right, independent of whether that article happens to sit on the shortest path to the answer.

## Solution

A second, independent daily mode, **"Grill: Reveal"**, played on the same `/daily`-style surface via a mode picker alongside the existing "Grill" (Classic). Each guess now does two things instead of one:

1. **Neighbor reveal** — every outbound link of the guessed article is revealed and named (article title), regardless of whether it leads toward the hidden article.
2. **Path reveal** — the shortest path from the guess to the hidden article is still computed and rendered, exactly as in Classic, but path nodes that were *not* independently revealed via (1) render as blank, unlabeled circles rather than being omitted or estimated by hop-count alone.

The hidden article itself is always present on the canvas as a persistent node labeled **"Unknown"** until solved. Both reveals accumulate across guesses. The player wins by guessing the hidden article; losing (5 guesses used) reveals the answer and all remaining blank nodes, same as a win.

Reveal mode uses the **same daily article** as Classic Grill (shared `daily_schedule.json` entry) — a player who plays both modes the same day may spoil one with the other; this is an accepted tradeoff, not a bug.

## User Stories

1. As a player, I want to pick "Grill: Reveal" from a mode picker alongside the existing "Grill" mode, so that I can choose which mechanic I want to play without it replacing the game I already know.
2. As a player, I want to submit a guess using the same autocomplete search as the rest of the site, so the input mechanic feels familiar.
3. As a player, when I guess an article, I want to see every article it links to (outbound only), named, so that a "good" guess (a well-connected hub) rewards me with a lot of new information regardless of whether it's on the path to the answer.
4. As a player, I want the hidden article itself to never appear in this neighbor list even when my guess links directly to it, so the game isn't trivially spoiled by an incidental direct link.
5. As a player, I don't want any special "you're one link away" hint when the hidden article is a direct neighbor of my guess — I want the reward to come purely from reasoning about the graph shape myself.
6. As a player, I want each guess to also reveal the shortest path from my guess to the hidden article, same as I'd expect from the existing daily game, so the two reveal types work together rather than as disconnected mechanics.
7. As a player, I want path nodes that haven't otherwise been revealed by name to show as blank, unlabeled circles, so I can see the *shape*/length of my proximity to the answer without it being spoiled.
8. As a player, if a path node happens to also be one of the named neighbors from a guess (mine or an earlier one), I want to see its real name, not a blank circle — once something's revealed, it should stay revealed.
9. As a player, I want the hidden article to always show as a node labeled "Unknown" on the canvas from the start, so I always know which node is the actual goal, even before I've made any progress toward it.
10. As a player, I want to hover a revealed (named) node on the canvas to see its title, so the canvas itself can stay visually minimal (plain circles) while still letting me inspect what I've revealed.
11. As a player, I want a side panel listing the articles revealed so far (with titles), so I have a persistent, scannable record that doesn't depend on hovering every node.
12. As a player, I want previously revealed nodes (both named neighbors and path nodes) to stay visible as I make new guesses, accumulating into one growing graph.
13. As a player, I want a limited number of guesses (5, same as Classic), so the challenge has real stakes.
14. As a player, when I run out of guesses without solving it, I want the hidden article and all remaining blank nodes revealed, so I get resolution instead of being stuck.
15. As a player, when I solve it, I want the same full reveal (hidden article + all blank path nodes get real titles), so I can review the complete picture of how everything connected.
16. As a player, I want a shareable result summary specific to this mode (e.g., guess count and total nodes revealed), distinct from Classic's hop-chain share string, so it reflects what this mode actually measures.
17. As a player, I want my Reveal-mode progress to persist across a page reload, tracked independently from my Classic-mode progress for the same day, so playing/finishing one doesn't affect or gate the other.
18. As a player, I want the same category hint the existing daily game shows, so the two modes feel consistent.
19. As a player, I understand that Reveal mode uses the same hidden article as Classic mode that day, so I might spoil one mode by playing the other first.

## Implementation Decisions

- **Mode picker / routing**: Reveal mode gets its own client route (e.g. `/daily/reveal`, mirroring however `/daily` is currently matched in `App.tsx`), separate from `/daily` (Classic). Both link to each other via a simple mode picker; no shared game state machine between them.
- **Shared daily article**: Reveal mode reads the *same* day's answer from the existing `service/internal/config/daily_schedule.json` / `DailySchedule` lookup — no second schedule file. No anti-spoiler mechanism between modes is built; this is accepted as-is.
- **Category hint**: Reuse the existing `/api/daily-info`-style hint endpoint/response, unchanged.
- **New backend surface — neighbor reveal**: A new capability (endpoint or field on a Reveal-specific guess endpoint) exposes `FwdNeighbors(guessID)` — all outbound neighbors of an arbitrary guessed article, resolved to titles — reusing the already-loaded CSR adjacency (`service/internal/graph/graph.go`). The hidden article's ID is filtered out of this list server-side before it ever reaches the client, mirroring the existing masking discipline from Classic's `/api/guess`.
- **New/adapted guess endpoint**: A Reveal-specific endpoint (distinct from Classic's `/api/guess`, since the response shape differs) runs, per guess: (a) the neighbor-reveal lookup above, and (b) the existing `BidirectionalBFS` (`service/internal/graph/bfs.go`) between guess and answer for the path reveal — both against the same loaded graph. The hidden node is represented in path data via the same stable per-day placeholder-id scheme Classic already uses (`config.PlaceholderID`), so the client can render it as "Unknown" and later relabel it on solve, exactly like Classic's reveal-on-win path.
- **Guess limit**: Reuses `MaxDailyGuesses` (5) and the existing 1-indexed `guessNumber` request pattern from Classic's guess endpoint.
- **Node identity/state on the client**: Extend the accumulation model with the states a node can be in: `named` (revealed via neighbor reveal — shown with title, hoverable), `blank` (on a computed path, not otherwise named), and `unknown` (the hidden target specifically, always labeled "Unknown" until solved). A node transitions `blank` → `named` permanently once any guess's neighbor reveal names it; it never transitions back.
- **Graph accumulation**: Client-side merge (new module, sibling to `web/src/data/dailyGraph.ts`, e.g. `revealGraph.ts`) folds each guess response's named-neighbor set and path-node set into one running graph, deduping by node id and resolving state per the transition rule above. Node/edge identity stable across requests via the placeholder-id scheme, same correctness constraint as Classic.
- **New canvas component, not a `GraphWiki` modification**: Reveal mode's graph view is a new sibling component (e.g. `GraphWikiReveal`) that shares `GraphWiki`'s force-layout logic but adds hover-to-reveal-title on named nodes. `GraphWiki` itself and its governing rules (`.claude/rules/graphwiki-node-connections.md`) are left untouched — that minimalism contract is scoped to the existing explore/Classic experience only.
- **Revealed-neighbors side panel**: A new panel (distinct from Classic's existing "Direct Connections" panel, which is scoped to backlinks-of-the-mystery-article) lists every named node revealed so far across all guesses, article title only, in reveal order. Row click highlights/centers that node on the canvas (same pattern as the existing Direct Connections panel).
- **Win detection**: Server-side, same as Classic — a correct guess response includes `correct: true` plus the real answer id/title. Client relabels the placeholder "Unknown" node and flips every remaining `blank` node to its real title in the same pass (requires the response, or a follow-up call, to include real titles for all accumulated path node ids — see Testing Decisions for the contract this implies).
- **Loss state**: Same `lost: true` mechanic as Classic once `guessNumber` reaches `MaxDailyGuesses` without a correct guess; triggers the identical full-reveal path as a win.
- **Sharing**: New Reveal-specific share string, e.g. `Grill: Reveal #N: solved in 4 guesses (23 nodes revealed)` on a win, or `Grill: Reveal #N: X/5 (17 nodes revealed)` on a loss — total nodes revealed = count of all `named` + `unknown`/revealed-target nodes at end of game. Independent of Classic's `ShareBar` hop-chain format, though it may reuse the same `ShareBar` UI component.
- **Persistence**: `localStorage`, keyed by puzzle date **and mode** (e.g. a distinct key prefix/suffix from Classic's), storing guesses made and accumulated graph/reveal state for Reveal mode specifically. Fully independent of Classic's stored state for the same day.

## Testing Decisions

- Tests should exercise external behavior (HTTP request/response contracts, rendered UI state, localStorage-persisted state across a simulated reload), matching the existing convention from the Classic daily mode spec.
- **Go service**: Contract tests for the new neighbor-reveal + path-reveal guess endpoint covering: a guess with no direct link to the hidden article (path-only reveal), a guess that directly links to the hidden article (confirm the hidden id/title is absent from the neighbor list), a correct/winning guess (confirm real titles for all accumulated blank/placeholder nodes are resolvable), and a losing guess at `guessNumber == MaxDailyGuesses`.
- **Frontend**: Component/integration tests for the new accumulation module (`revealGraph.ts`-equivalent) covering the `blank → named` one-way state transition, dedup across repeated guesses, and full-reveal-on-win/loss. New Storybook stories for `GraphWikiReveal`'s node states (`named`, `blank`, `unknown`), following the existing Storybook-for-`GraphWiki`-variants convention.
- **localStorage persistence**: Test that Reveal-mode state and Classic-mode state for the same calendar date don't collide or overwrite each other, and that a date rollover clears only the current mode's stale state as expected.

## Out of Scope

- An independent daily schedule for Reveal mode (explicitly decided against — same-day article is shared with Classic).
- Any anti-spoiler mechanism preventing cross-contamination between Classic and Reveal for the same day.
- Any change to Classic Grill's routing, endpoint contracts, `GraphWiki` component, or share format.
- Archive of past Reveal puzzles.
- Leaderboards or stats beyond the copyable share summary text.
- Inbound-link reveals (neighbor reveal is outbound-only).
- Capping/fan-out limiting of the neighbor reveal (explicitly "show all" outbound neighbors, uncapped).

## Further Notes

- The one-way `blank → named` node-state transition is the key correctness constraint for the accumulation module — get this wrong and either previously-named nodes could regress to blank (breaking story 8) or blank nodes could leak identity early.
- The "same daily article as Classic" decision was made after an explicit tradeoff discussion (independent schedule was recommended to avoid spoilers); revisit if player feedback shows this is a bigger problem in practice than anticipated.
