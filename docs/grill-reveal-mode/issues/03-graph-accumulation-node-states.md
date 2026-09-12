# 03: Graph accumulation & node states (frontend)

**What to build:** A client-side module (sibling to `web/src/data/dailyGraph.ts`) that merges each guess response from `02` into one running graph, tracking per-node state: `named`, `blank`, or `unknown`.

**Blocked by:** 02 (reveal-guess endpoint)

**Status:** design agreed, not yet implemented

## Node states

- **`unknown`** — the hidden article's node specifically. Present on the canvas from the very first render (before any guess), always labeled "Unknown" until solved.
- **`named`** — any node revealed via a guess's neighbor-reveal list (01/02). Has a real title, hoverable on canvas (see `04`), listed in the side panel (see `05`).
- **`blank`** — any node that appears only via a path reveal (02) and has not (yet) been independently named. No title, not hoverable, not listed in the side panel.

## Transition rule (hard constraint)

- `blank → named` is **one-way**. The moment any guess's neighbor reveal names a node (this guess or an earlier one, current or future), it becomes `named` permanently — it must never regress to `blank` even if a later merge "re-sees" it only via a path.
- `unknown → named` only happens once, on win/loss full reveal (see `07`), and applies specifically to the hidden node.

## Accumulation

- Dedup by node id across all guesses so far — merging must not create duplicate nodes/edges.
- Both neighbor-reveal and path-reveal contributions from every guess accumulate; nothing is ever removed.
- Node/edge identity stable across requests via the placeholder-id scheme from `02` — required for correct merging, same constraint as Classic's `dailyGraph.ts`.

## Checklist

- [ ] New module (e.g. `web/src/data/revealGraph.ts`) implementing merge + state-transition logic
- [ ] `unknown` node present in initial graph state prior to any guess
- [ ] Unit test: a node revealed as `blank` by guess 1's path, then `named` by guess 2's neighbor reveal, ends up `named` (never reverts)
- [ ] Unit test: repeated guesses don't duplicate nodes/edges already in the accumulated graph
- [ ] Unit test: merging two guesses' responses produces one coherent graph object suitable for `04`'s canvas
