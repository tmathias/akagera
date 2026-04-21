// Typed API client — all requests go through the backend proxy.
// API keys are NEVER exposed to the browser.

import { useAuthStore } from '@/store/authStore';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Weather ──────────────────────────────────────────────────────────────
export const weatherApi = {
  forecast: (lat: number, lon: number) =>
    request(`/weather/forecast?lat=${lat}&lon=${lon}`),
  windsAloft: (lat: number, lon: number, alt = 5000) =>
    request(`/weather/winds-aloft?lat=${lat}&lon=${lon}&alt=${alt}`),
  routeWeather: (waypoints: Array<{ lat: number; lon: number }>, alt = 5000) =>
    request(`/weather/route?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}&alt=${alt}`),
  windyTileUrl: (layer: string, z: number, x: number, y: number) =>
    `${BASE}/api/v1/weather/windy/${layer}/{z}/{x}/{y}`.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)),
};

// ── Traffic ──────────────────────────────────────────────────────────────
export const trafficApi = {
  getStates: (lamin: number, lamax: number, lomin: number, lomax: number) =>
    request(`/traffic/states?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`),
  getAircraft: (icao24: string) =>
    request(`/traffic/aircraft/${icao24}`),
};

// ── Aircraft fleet ───────────────────────────────────────────────────────
export const aircraftApi = {
  list: () => request('/aircraft'),
  stats: () => request('/aircraft/stats'),
  get: (id: string) => request(`/aircraft/${id}`),
  create: (data: unknown) => request('/aircraft', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request(`/aircraft/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/aircraft/${id}`, { method: 'DELETE' }),
};

// ── Flights ──────────────────────────────────────────────────────────────
export const flightsApi = {
  list: (params?: { aircraftId?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request(`/flights${q ? `?${q}` : ''}`);
  },
  summary: (userId?: string) => request(`/flights/summary${userId ? `?userId=${userId}` : ''}`),
  get: (id: string) => request(`/flights/${id}`),
  create: (data: unknown) => request('/flights', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request(`/flights/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ── Documents ────────────────────────────────────────────────────────────
export const documentsApi = {
  list: (aircraftId?: string) => request(`/documents${aircraftId ? `?aircraftId=${aircraftId}` : ''}`),
  getDownloadUrl: (id: string) => request<{ url: string }>(`/documents/${id}/download`),
  upload: (formData: FormData) => {
    const token = useAuthStore.getState().token;
    return fetch(`${BASE}/api/v1/documents/upload`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((r) => r.json());
  },
  delete: (id: string) => request(`/documents/${id}`, { method: 'DELETE' }),
};

// ── Weight & Balance ──────────────────────────────────────────────────────
export const wbApi = {
  listTemplates: (aircraftId?: string) =>
    request(`/wb/templates${aircraftId ? `?aircraftId=${aircraftId}` : ''}`),
  getTemplate: (id: string) => request(`/wb/templates/${id}`),
  createTemplate: (data: unknown) =>
    request('/wb/templates', { method: 'POST', body: JSON.stringify(data) }),
  calculate: (templateId: string, loadItems: unknown[]) =>
    request('/wb/calculate', { method: 'POST', body: JSON.stringify({ templateId, loadItems }) }),
  saveRecord: (data: unknown) =>
    request('/wb/records', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Routes ────────────────────────────────────────────────────────────────
export const routesApi = {
  list: () => request('/routes'),
  get: (id: string) => request(`/routes/${id}`),
  create: (data: unknown) => request('/routes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request(`/routes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/routes/${id}`, { method: 'DELETE' }),
};

// ── Tenant ────────────────────────────────────────────────────────────────
export const tenantApi = {
  me: () => request('/tenants/me'),
  users: () => request('/tenants/me/users'),
  expiringCredentials: (days = 60) => request(`/tenants/me/expiring-credentials?days=${days}`),
};
