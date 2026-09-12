import { describe, expect, it } from 'vitest';
import {
  clearStaleRevealState,
  dateKeyUTC,
  loadRevealState,
  revealHiddenId,
  saveRevealState,
  type RevealPersistedState,
} from './revealPersistence';
import { createInitialRevealGraph, type RevealGuessResponse } from './revealGraph';

/** Minimal in-memory `Storage` so these tests don't depend on a DOM/jsdom
 *  environment (this project's vitest setup runs data-layer tests in plain
 *  node) — mirrors the real `localStorage` API surface these functions use. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function guess(overrides: Partial<RevealGuessResponse> = {}): RevealGuessResponse {
  return {
    guess: 'Guess',
    correct: false,
    neighbors: [],
    pathsFound: 0,
    minHops: 0,
    paths: [],
    graphData: { nodes: [], links: [] },
    maxHops: 10,
    maxPaths: 10000,
    ...overrides,
  };
}

describe('dateKeyUTC / revealHiddenId', () => {
  it('formats a UTC calendar date as YYYY-MM-DD and derives the matching hidden id', () => {
    const date = new Date(Date.UTC(2026, 8, 11, 23, 59));
    expect(dateKeyUTC(date)).toBe('2026-09-11');
    expect(revealHiddenId(dateKeyUTC(date))).toBe('hidden-2026-09-11');
  });
});

describe('save/loadRevealState', () => {
  it('round-trips guesses and graph state for a given date', () => {
    const storage = new MemoryStorage();
    const dateKey = '2026-09-11';
    const hiddenId = revealHiddenId(dateKey);
    const state: RevealPersistedState = {
      date: dateKey,
      guesses: [guess({ guess: 'Cat' })],
      graphData: createInitialRevealGraph(hiddenId),
      won: false,
      lost: false,
    };

    saveRevealState(dateKey, state, storage);
    const loaded = loadRevealState(dateKey, storage);

    expect(loaded).toEqual(state);
  });

  it('returns null on a cold start (nothing saved yet)', () => {
    const storage = new MemoryStorage();
    expect(loadRevealState('2026-09-11', storage)).toBeNull();
  });

  it('returns null for corrupt JSON rather than throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem('grill-reveal:2026-09-11', '{not json');
    expect(loadRevealState('2026-09-11', storage)).toBeNull();
  });

  it('never collides with a same-date key under a different (e.g. Classic) prefix', () => {
    const storage = new MemoryStorage();
    const dateKey = '2026-09-11';
    const classicKey = `grill-classic:${dateKey}`;
    const classicPayload = JSON.stringify({ marker: 'classic-untouched' });
    storage.setItem(classicKey, classicPayload);

    const revealState: RevealPersistedState = {
      date: dateKey,
      guesses: [guess({ guess: 'Dog', correct: true, answer: 'Dog' })],
      graphData: createInitialRevealGraph(revealHiddenId(dateKey)),
      won: true,
      lost: false,
    };
    saveRevealState(dateKey, revealState, storage);

    // Reveal's own state is readable independently of Classic's key.
    expect(loadRevealState(dateKey, storage)).toEqual(revealState);
    // Classic's same-date key is completely unaffected.
    expect(storage.getItem(classicKey)).toBe(classicPayload);
  });
});

describe('clearStaleRevealState', () => {
  it('removes only stale grill-reveal keys, leaving the current date and other prefixes untouched', () => {
    const storage = new MemoryStorage();
    const today = '2026-09-12';
    const yesterday = '2026-09-11';

    const todayState: RevealPersistedState = {
      date: today,
      guesses: [],
      graphData: createInitialRevealGraph(revealHiddenId(today)),
      won: false,
      lost: false,
    };
    const staleState: RevealPersistedState = {
      date: yesterday,
      guesses: [guess()],
      graphData: createInitialRevealGraph(revealHiddenId(yesterday)),
      won: false,
      lost: true,
    };

    saveRevealState(today, todayState, storage);
    saveRevealState(yesterday, staleState, storage);
    // Classic-shaped keys (old and current date) must survive a Reveal cleanup
    // untouched — each mode only garbage-collects its own stale state.
    storage.setItem(`grill-classic:${yesterday}`, JSON.stringify({ marker: 'classic-yesterday' }));
    storage.setItem(`grill-classic:${today}`, JSON.stringify({ marker: 'classic-today' }));

    clearStaleRevealState(today, storage);

    expect(loadRevealState(yesterday, storage)).toBeNull();
    expect(loadRevealState(today, storage)).toEqual(todayState);
    expect(storage.getItem(`grill-classic:${yesterday}`)).not.toBeNull();
    expect(storage.getItem(`grill-classic:${today}`)).not.toBeNull();
  });

  it('is a no-op when there is no stale state', () => {
    const storage = new MemoryStorage();
    const today = '2026-09-12';
    const state: RevealPersistedState = {
      date: today,
      guesses: [],
      graphData: createInitialRevealGraph(revealHiddenId(today)),
      won: false,
      lost: false,
    };
    saveRevealState(today, state, storage);

    clearStaleRevealState(today, storage);

    expect(loadRevealState(today, storage)).toEqual(state);
  });
});
