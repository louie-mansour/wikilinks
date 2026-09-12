# 07: Win detection, full reveal & share string

**What to build:** Client-side handling of a correct guess: relabel the "Unknown" node and flip every remaining `blank` node to its real title in one pass, plus a Reveal-specific shareable result string.

**Blocked by:** 02 (reveal-guess endpoint), 03 (graph accumulation & node states)

**Status:** design agreed, not yet implemented

## Full reveal

- On `correct: true` (or `lost: true`, per `06`) from `/api/reveal-guess`, the response carries real titles for the hidden node and every accumulated `blank` node.
- Client applies these in a single state update: `unknown → named` for the hidden node, `blank → named` for every remaining blank node (per `03`'s one-way transition rule — this is the one place `unknown`/`blank` are allowed to resolve).
- `GraphWikiReveal` (04) re-renders all affected nodes with their real titles, matching `named` styling.

## Share string

- New format, distinct from Classic's hop-chain string (`Grill #12: 4 guesses (7→4→2→0)`):
  - Win: `Grill: Reveal #N: solved in {guessCount} guesses ({totalRevealed} nodes revealed)`
  - Loss: `Grill: Reveal #N: X/5 ({totalRevealed} nodes revealed)`
- `totalRevealed` = count of all nodes in `named` state at game end, including the just-resolved hidden node and formerly-blank nodes.
- May reuse the existing `ShareBar` UI component for copy/share interaction, just with this new string format.

## Checklist

- [ ] Correct-guess handling flips hidden node + all blank nodes to `named` with real titles in one update
- [ ] Loss handling does the same full reveal
- [ ] Win/loss banner messaging distinct from Classic's
- [ ] Reveal-specific share string implemented per format above
- [ ] Test: winning with N previously-blank nodes results in all N showing real titles post-win
- [ ] Test: share string reflects correct guess count and total-revealed count for both win and loss
