import type { SuggestRole } from './suggest';

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

export async function fetchRandom(
  role: SuggestRole,
  count: number = 20,
  signal?: AbortSignal,
): Promise<string[]> {
  const params = new URLSearchParams({ role, count: String(count) });
  const res = await fetch(`${API_BASE}/api/random?${params}`, { signal });
  if (!res.ok) throw new Error(`random failed: ${res.status}`);
  const body: { nodes: string[] } = await res.json();
  return body.nodes;
}
