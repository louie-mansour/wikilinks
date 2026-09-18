import type { RevealGuessResponse } from '../data/revealGraph';

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

/** Calls the daily-mode "Grill" guess endpoint, `GET /api/reveal-guess`,
 *  with the article being guessed plus `known` (see below).
 *
 * `known` is every article title already present in the caller's
 * accumulated Reveal graph (every node from every prior guess this puzzle —
 * pass `graphData.nodes.map(n => n.id)`, minus the hidden placeholder id,
 * from `RevealGame`). The server uses it to skip re-revealing articles the
 * player has already seen when it fills this guess's up-to-50-node cap, so
 * each guess surfaces a genuinely new batch instead of the same one every
 * time (see `service.Guess.SubmitReveal`'s doc, `service/internal/service/reveal.go`). */
export async function submitRevealGuess(
  guess: string,
  guessNumber: number,
  known: string[],
): Promise<RevealGuessResponse> {
  const params = new URLSearchParams({ guess, guessNumber: String(guessNumber) });
  for (const title of known) {
    params.append('known', title);
  }
  const res = await fetch(`${API_BASE}/api/reveal-guess?${params}`);
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Guess failed: ${res.status}`);
  }
  return res.json() as Promise<RevealGuessResponse>;
}
