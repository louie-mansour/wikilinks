# 08: Guess limit + loss state

**What to build:** A 5-guess limit on the daily puzzle. On the 5th incorrect guess, the server reveals the real hidden article and the response is marked `lost: true`; the client shows a loss banner, reveals the true answer in the accumulated graph (reusing the win-reveal path), blocks further guessing, and generates an `X/5` share summary.

**Blocked by:** 05

**Status:** done

- [x] `MaxDailyGuesses` (5) constant added in `service/internal/service/guess.go`
- [x] `/api/guess` accepts a `guessNumber` query param (1-indexed attempt count, client-tracked — same trust model as repeat-guess prevention); invalid/non-positive values return 400
- [x] Once `guessNumber >= MaxDailyGuesses` and the guess is incorrect, the response reveals the real answer (`answer` field populated, `lost: true`) instead of masking it behind the per-day placeholder — for both the path-found and no-path-found cases
- [x] Below the limit, the real answer stays masked exactly as before (existing masking contract/tests untouched)
- [x] Client sends `guesses.length + 1` as `guessNumber` on each submission
- [x] Client relabels the placeholder node with the real answer on `lost: true` (via `revealHiddenEnd`), merges in any newly-revealed subgraph from the losing guess, blocks further submission, and shows a distinct loss banner
- [x] Share summary distinguishes a loss (`Grill #N: X/5 (hop→hop→…)`) from a win (`Grill #N: k guesses (hop→…→0)`)
- [x] Go contract tests: losing guess with a path found reveals the answer as a normal `end` node (no `hidden-end` left); losing guess with no path found also reveals the answer; below the limit the answer stays masked; invalid `guessNumber` is rejected
- [x] Frontend unit tests: `buildShareSummary` lost-state formatting, no-path hop-sequence entries
- [ ] Manually verifiable: make 5 incorrect guesses, see the loss banner, the real article revealed on the graph, guessing disabled, and a copyable `X/5` share summary
