export type SuggestRole = 'start' | 'end';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

export async function fetchSuggest(
  role: SuggestRole,
  q: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const params = new URLSearchParams({ role, q, limit: '7' });
  const res = await fetch(`${API_BASE}/api/suggest?${params}`, { signal });
  if (!res.ok) throw new Error(`suggest failed: ${res.status}`);
  const body: { nodes: string[] } = await res.json();
  return body.nodes;
}
