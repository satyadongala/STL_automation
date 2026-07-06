/** API base URL — `/api` in Docker/production, `:5001` in local dev */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? `http://${window.location.hostname}:5001/api`
    : '/api');

export function reportUrl(path: string): string {
  if (import.meta.env.DEV) {
    return `http://${window.location.hostname}:5001${path}`;
  }
  if (API_BASE_URL.startsWith('http')) {
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${path}`;
  }
  return path;
}

export function wsUrl(runId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) {
    return `${proto}//${window.location.hostname}:5001?runId=${runId}`;
  }
  return `${proto}//${window.location.host}?runId=${runId}`;
}
