import type { GraphData } from '../components/GraphWiki/GraphWiki';

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

export interface GuessResult {
  guess: string;
  correct: boolean;
  lost?: boolean;
  answer?: string;
  noPathFound?: boolean;
  pathsFound: number;
  minHops: number;
  paths: string[][];
  graphData: GraphData;
  maxHops: number;
  maxPaths: number;
}

export async function submitGuess(guess: string, guessNumber: number): Promise<GuessResult> {
  const params = new URLSearchParams({ guess, guessNumber: String(guessNumber) });
  const res = await fetch(`${API_BASE}/api/guess?${params}`);
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Guess failed: ${res.status}`);
  }
  return res.json() as Promise<GuessResult>;
}
