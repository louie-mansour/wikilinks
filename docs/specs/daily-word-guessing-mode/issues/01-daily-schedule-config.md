# 01: Daily schedule file + config loading

**What to build:** A committed, hand-editable schedule of daily puzzle articles, and Go service startup logic that resolves "today's puzzle" (UTC calendar date → article) from it. This is the single source of truth for which article is hidden on a given day — no per-request randomization or algorithmic date-seeded pick.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `service/internal/config/daily_schedule.json` exists, committed, mapping calendar date (UTC) → article title/id, seeded with at least a couple of entries
- [ ] Go service loads and parses this file at startup
- [ ] A function/lookup resolves "today's" (UTC) puzzle article from the loaded schedule
- [ ] Missing-date-in-schedule case is handled explicitly (not a panic)
- [ ] Unit test covers: successful lookup for a seeded date, and the missing-date case
