const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

export async function submitFeedbackRating(rating: number): Promise<string> {
  const res = await fetch(`${API_BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Feedback failed: ${res.status}`);
  }
  const data = await res.json() as { id: string };
  return data.id;
}

export async function submitFeedbackComment(id: string, comment: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/feedback/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Feedback comment failed: ${res.status}`);
  }
}
