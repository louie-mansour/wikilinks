import type { RevealGraphData, RevealGuessResponse } from './revealGraph';

/**
 * === Grill: Reveal — client-side persistence (issue 08) ===
 *
 * Reveal mode's `localStorage` layer. Classic (`DailyGame.tsx`) does not
 * currently persist any state across reloads — there is no existing
 * `dailyGraph.ts` key scheme to mirror. This module gives Reveal its own,
 * so a page reload mid-puzzle restores guesses and graph state, without ever
 * touching or being affected by whatever Classic does or doesn't store for
 * the same calendar date.
 *
 * Key scheme: `grill-reveal:{date}`, where `{date}` is the puzzle's UTC
 * calendar date (`YYYY-MM-DD`, matching `config.PlaceholderID`'s date
 * format server-side — see `dateKeyUTC`/`revealHiddenId` below). This is a
 * different prefix from any Classic key (`grill-classic:{date}` per the
 * issue's suggested scheme, should one land later), so the two families of
 * keys never collide for the same date even though they share a date
 * segment.
 */

const REVEAL_KEY_PREFIX = 'grill-reveal:';

/** UTC calendar-date key, `YYYY-MM-DD` — matches Go's `dateLayout` constant
 *  (`service/internal/config/daily_schedule.go`) so the client and server
 *  agree on "today" regardless of the viewer's local timezone. */
export function dateKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The stable per-day placeholder id for the hidden node, mirroring
 *  `config.PlaceholderID` (`"hidden-" + date`) server-side. `dateKey` must
 *  already be in `YYYY-MM-DD` form (see `dateKeyUTC`). */
export function revealHiddenId(dateKey: string): string {
  return `hidden-${dateKey}`;
}

function revealStorageKey(dateKey: string): string {
  return `${REVEAL_KEY_PREFIX}${dateKey}`;
}

export interface RevealPersistedState {
  /** The `YYYY-MM-DD` date this state was saved under — a belt-and-braces
   *  sanity check against reading a value back under the wrong key. */
  date: string;
  guesses: RevealGuessResponse[];
  graphData: RevealGraphData;
  won: boolean;
  lost: boolean;
}

function defaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Load today's persisted Reveal state, if any. Returns `null` on a cold
 *  start, a corrupt/foreign value, or a `date` mismatch (defensive only —
 *  the key itself is already date-scoped). Never throws. */
export function loadRevealState(
  dateKey: string,
  storage: Storage | null = defaultStorage(),
): RevealPersistedState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(revealStorageKey(dateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RevealPersistedState;
    if (!parsed || parsed.date !== dateKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist today's Reveal state. Best-effort — a quota error or disabled
 *  storage shouldn't interrupt play. */
export function saveRevealState(
  dateKey: string,
  state: RevealPersistedState,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(revealStorageKey(dateKey), JSON.stringify(state));
  } catch {
    // Persistence is a convenience, not a play requirement.
  }
}

/**
 * Remove any Reveal-mode state left over from a previous calendar day, on
 * date rollover. Only ever touches `grill-reveal:*` keys — Classic's keys
 * (whatever its scheme turns out to be) are never enumerated or removed
 * here; each mode is responsible for garbage-collecting only its own stale
 * state (see issue 08's "independently for each mode" requirement).
 */
export function clearStaleRevealState(
  currentDateKey: string,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const currentKey = revealStorageKey(currentDateKey);
    const staleKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(REVEAL_KEY_PREFIX) && key !== currentKey) {
        staleKeys.push(key);
      }
    }
    for (const key of staleKeys) {
      storage.removeItem(key);
    }
  } catch {
    // ignore — best-effort cleanup only
  }
}
