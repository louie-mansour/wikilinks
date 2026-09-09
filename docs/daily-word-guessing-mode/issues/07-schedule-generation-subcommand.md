# 07: Schedule generation subcommand

**What to build:** A one-off Go subcommand/flag on the existing server binary (e.g. `server -gen-schedule -days=14`) that samples candidate articles above a minimum-degree connectivity threshold and writes/extends `daily_schedule.json`. Run manually; output is committed, not part of the automated datapipeline or a runtime code path.

**Blocked by:** 01 (independent of 02–06; can run in parallel with them)

**Status:** ready-for-agent

- [ ] `-gen-schedule -days=N` flag on the server binary samples N candidate articles
- [ ] Candidate filtering reuses the in-degree/out-degree data already loaded at startup for `/internal/ending-nodes` / `/internal/starting-nodes` (`service/internal/service/ending_nodes.go`, `starting_nodes.go`), with a higher minimum-degree threshold than the existing `>0` check
- [ ] No new datapipeline stage and no new persisted degree-stats artifact
- [ ] Writes/extends `service/internal/config/daily_schedule.json` in the date-keyed shape from ticket 01, without clobbering existing dated entries
- [ ] Test: only candidates above the configured degree threshold are selected
- [ ] Test: output is valid, parseable JSON in the expected date-keyed shape (deterministic given fixed inputs)
