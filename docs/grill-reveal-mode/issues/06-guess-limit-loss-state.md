# 06: Guess limit & loss state (Reveal mode)

**What to build:** Enforce the 5-guess daily cap for Reveal mode and trigger full reveal on loss, mirroring Classic's behavior.

**Blocked by:** 02 (reveal-guess endpoint)

**Status:** design agreed, not yet implemented

## Behavior

- Reuses `MaxDailyGuesses` (5) — same constant/config as Classic, not a separate limit.
- Client sends 1-indexed `guessNumber` with each request to `/api/reveal-guess`, same pattern as Classic.
- Server marks `lost: true` once `guessNumber` reaches the cap without a correct guess.
- Loss triggers the **same full-reveal payload** as a win (per `02`): real hidden article title + resolved titles for all accumulated `blank`/`unknown` nodes.
- Client-side: repeat-guess prevention against the locally tracked guess list for the day (no network round-trip), same as Classic.

## Checklist

- [ ] `guessNumber` cap enforced server-side against `MaxDailyGuesses`
- [ ] `lost: true` response includes full-reveal payload (same shape as a win)
- [ ] Client blocks resubmitting an already-made guess without a network call
- [ ] Client renders a clear loss state (hidden article revealed, all blank nodes flip to `named`) distinct from the win state's messaging
- [ ] Test: 5th incorrect guess triggers `lost: true` and full reveal
