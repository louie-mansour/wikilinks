# 08: Persistence, mode picker & routing

**What to build:** A dedicated route for Reveal mode, a mode picker linking it with Classic Grill, and independent per-mode localStorage persistence.

**Blocked by:** 03 (graph accumulation & node states) for the persisted shape; otherwise independently startable alongside other issues.

**Status:** design agreed, not yet implemented

## Routing

- New client route (e.g. `/daily/reveal`), using the same lightweight path-matching `App.tsx` already uses for `/daily` and `/s/:code` — no router library introduced.
- Mode picker: simple linked UI (e.g. a toggle/tab pair) between `/daily` (Classic) and `/daily/reveal`, visible from both.
- Both modes read the same day's answer from the existing `DailySchedule` — no new schedule file (per the spec's explicit decision).
- Reuses the existing `/api/daily-info` category hint, unchanged.

## Persistence

- `localStorage`, keyed by puzzle date **and mode** — e.g. a distinct key prefix from Classic's (`grill-classic:{date}` vs `grill-reveal:{date}`), so the two never collide or overwrite each other for the same calendar day.
- Stores: guesses made so far, accumulated graph/node-state (03), and finished/win/loss status — independently for Reveal mode.
- A player can have Classic finished and Reveal in-progress (or vice versa) simultaneously for the same date, each restoring correctly on reload.

## Checklist

- [ ] `/daily/reveal` route added, `/daily` (Classic) untouched
- [ ] Mode picker UI linking the two, visible from both routes
- [ ] Reveal mode reads today's answer from the existing shared `DailySchedule`
- [ ] Category hint reused unchanged
- [ ] localStorage key scheme keeps Classic and Reveal state fully independent for the same date
- [ ] Test: reloading mid-Reveal-puzzle restores guesses + graph state without touching or being affected by Classic's stored state for the same date
- [ ] Test: date rollover clears only the current mode's stale state, independently for each mode
