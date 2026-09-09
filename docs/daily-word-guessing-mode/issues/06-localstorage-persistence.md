# 06: localStorage persistence across reload and day rollover

**What to build:** Client-only persistence (via `localStorage`, keyed by puzzle date) of the current day's guesses, accumulated graph state, and win state, so a page reload doesn't lose progress, and a date change doesn't leak the previous day's state into the new puzzle. No backend session/account is introduced.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Guesses made, accumulated graph state, and win/share state are persisted to `localStorage` keyed by the current puzzle date (UTC)
- [ ] On page load, existing state for today's date is restored (guesses, graph, win state) if present
- [ ] On a date change (crossing daily rollover), the previous day's persisted state is not loaded into the new day's puzzle
- [ ] Test: reloading mid-puzzle restores guesses and graph state for the current date
- [ ] Test: simulated date change does not leak the previous day's state into the new puzzle
