import type { Activity, Collection, RecordMap } from './types';

export const API_URL = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000')).replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_URL + '/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || ('Request failed with status ' + response.status));
  }
  return payload as T;
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

export async function getActivityStream(onActivity: (activity: Activity) => void): Promise<() => void> {
  const url = API_URL + '/api/activities/stream';
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