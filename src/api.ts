import type { Activity, Collection, RecordMap } from './types';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'gfc_admin_token';

export function getToken(): string { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
export function isLoggedIn(): boolean { return Boolean(getToken()); }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(API_URL + '/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...((options.headers as Record<string, string>) || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      clearToken();
      window.dispatchEvent(new Event('gfc-admin-logout'));
    }
    throw new Error(payload.message || ('Request failed with status ' + response.status));
  }
  return payload as T;
}

export async function login(username: string, password: string): Promise<void> {
  const result = await request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  setToken(result.token);
}

export function getContent(): Promise<{ initialized: boolean } & Partial<RecordMap>> {
  return request('/content');
}

export interface GFCConfig {
  appUrl: string;
  cloudinaryCloudName: string;
}

export function getConfig(): Promise<GFCConfig> {
  return request('/config');
}

export function listCollection<K extends Collection>(collection: K): Promise<{ [P in K]: RecordMap[P] }> {
  return request('/' + collection);
}

export function createRecord(collection: Collection, record: unknown): Promise<{ id: string }> {
  return request('/' + collection, { method: 'POST', body: JSON.stringify(record) });
}

export function updateRecord(collection: Collection, id: string, patch: unknown): Promise<unknown> {
  return request('/' + collection + '/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteRecord(collection: Collection, id: string): Promise<void> {
  return request('/' + collection + '/' + encodeURIComponent(id), { method: 'DELETE' });
}

export function resetRemoteData(): Promise<void> {
  return request('/content', { method: 'DELETE' });
}

export function getActivities(): Promise<{ activities: Activity[] }> {
  return request('/activities');
}

export function clearActivities(): Promise<void> {
  return request('/activities', { method: 'DELETE' });
}

export function getActivityStream(onActivity: (activity: Activity) => void): () => void {
  const token = getToken();
  if (!token) return () => {};
  const url = API_URL + '/api/activities/stream?token=' + encodeURIComponent(token);
  const es = new EventSource(url);
  es.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'activity' && payload.data) onActivity(payload.data);
    } catch { /* ignore malformed messages */ }
  };
  es.onerror = () => { /* EventSource auto-reconnects */ };
  return () => es.close();
}