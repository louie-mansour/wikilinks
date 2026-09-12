import type { RevealGuessResponse } from '../data/revealGraph';

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

/** Reveal mode's sibling of `submitGuess` (`api/guess.ts`) — hits
 *  `GET /api/reveal-guess` instead of `/api/guess`; same query params. */
export async function submitRevealGuess(guess: string, guessNumber: number): Promise<RevealGuessResponse> {
  const params = new URLSearchParams({ guess, guessNumber: String(guessNumber) });
  const res = await fetch(`${API_BASE}/api/reveal-guess?${params}`);
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Guess failed: ${res.status}`);
  }
  return res.json() as Promise<RevealGuessResponse>;
}
