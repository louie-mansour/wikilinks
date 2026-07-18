import type { SearchResult } from '../data/mockSearch';

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

function nodeId(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'id' in val) return String((val as { id: unknown }).id);
  return '';
}

// ForceGraph2D mutates graphData in place (nodes gain x/y/vx/vy, links get
// source/target replaced with node object refs). Strip those back to plain
// serializable form before sending to the backend.
function sanitizeResult(result: SearchResult): SearchResult {
  return {
    ...result,
    graphData: {
      nodes: result.graphData.nodes.map(({ id, variant, label, hitCount }) => ({ id, variant, label, hitCount })),
      links: result.graphData.links.map((link) => ({
        source: nodeId(link.source),
        target: nodeId(link.target),
      })),
    },
  };
}

export async function getShare(code: string): Promise<SearchResult> {
  const res = await fetch(`${API_BASE}/api/share/${encodeURIComponent(code)}`);
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Share not found: ${res.status}`);
  }
  return res.json() as Promise<SearchResult>;
}

export async function createShare(result: SearchResult): Promise<string> {
  const res = await fetch(`${API_BASE}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitizeResult(result)),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Share failed: ${res.status}`);
  }
  const data = await res.json() as { code: string };
  return data.code;
}
