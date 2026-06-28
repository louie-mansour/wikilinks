import type { SearchResult } from '../data/mockSearch';

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

export async function searchPaths(start: string, end: string): Promise<SearchResult> {
  const params = new URLSearchParams({ from: start, to: end });
  const res = await fetch(`${API_BASE}/api/search?${params}`);
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Search failed: ${res.status}`);
  }
  return res.json() as Promise<SearchResult>;
}
