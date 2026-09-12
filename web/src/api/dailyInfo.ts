const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:8080');

export interface DailyInfo {
  category: string;
}

export async function fetchDailyInfo(): Promise<DailyInfo> {
  const res = await fetch(`${API_BASE}/api/daily-info`);
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Daily info failed: ${res.status}`);
  }
  return res.json() as Promise<DailyInfo>;
}
