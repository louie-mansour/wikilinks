function resolveAppUrl(): string {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  return import.meta.env.PROD
    ? 'https://wikilinks.app'
    : 'http://localhost:5173';
}

export const APP_URL = resolveAppUrl();
export const SHARE_BASE_URL = `${APP_URL}/s/`;
