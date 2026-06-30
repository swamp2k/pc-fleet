import { getToken, clearToken } from './auth';

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// Auth
export const login = (email: string, password: string) =>
  request<{ token: string }>('POST', '/api/auth/login', { email, password });

export const requestMagicLink = (email: string) =>
  request<{ ok: boolean }>('POST', '/api/auth/magic-link', { email });

export const verifyMagicLink = (token: string) =>
  request<{ token: string }>('POST', '/api/auth/magic-link/verify', { token });

// Devices
export interface Device {
  id: string;
  name: string;
  owner: string | null;
  status: string;
  last_seen_at: string | null;
  notes: string | null;
}

export const listDevices = () =>
  request<{ devices: Device[] }>('GET', '/api/devices');

// Profile
export interface UserProfile {
  device_id: string;
  primary_use_cases: string[];
  performance_expectation: string | null;
  usage_notes: string | null;
  updated_at: string;
}

export const getProfile = (deviceId: string) =>
  request<{ device: Device; profile: UserProfile | null }>('GET', `/api/devices/${deviceId}/profile`);

export const upsertProfile = (deviceId: string, data: {
  primary_use_cases?: string[];
  performance_expectation?: string;
  usage_notes?: string;
}) => request<{ ok: boolean }>('PUT', `/api/devices/${deviceId}/profile`, data);

// Hardware
export interface Hardware {
  device_id: string;
  collected_at: string;
  cpu_model: string | null;
  cpu_cores: number | null;
  cpu_threads: number | null;
  ram_total_gb: number | null;
  gpu_json: string | null;
  motherboard_model: string | null;
  storage_devices_json: string | null;
}

export const getHardware = (deviceId: string) =>
  request<{ hardware: Hardware | null }>('GET', `/api/devices/${deviceId}/hardware`);

// Spare parts
export interface SparePart {
  id: string;
  part_type: string;
  model: string | null;
  spec_json: string | null;
  condition: string | null;
  location: string | null;
  acquired_at: string | null;
  notes: string | null;
  created_at: string;
  // auto-sync fields
  device_id: string | null;
  device_name: string | null;
  source: string;       // 'manual' | 'auto'
  last_seen_at: string | null;
}

export const listSpares = () =>
  request<{ parts: SparePart[] }>('GET', '/api/spares');

export const createSpare = (data: Omit<SparePart, 'id' | 'created_at' | 'device_id' | 'device_name' | 'source' | 'last_seen_at'>) =>
  request<{ ok: boolean }>('POST', '/api/spares', data);

export const updateSpare = (id: string, data: Partial<Omit<SparePart, 'id' | 'created_at' | 'device_id' | 'device_name' | 'source' | 'last_seen_at'>>) =>
  request<{ ok: boolean }>('PUT', `/api/spares/${id}`, data);

export const deleteSpare = (id: string) =>
  request<{ ok: boolean }>('DELETE', `/api/spares/${id}`);

export const triggerSpareSync = () =>
  request<{ synced: number; inStocked: number }>('POST', '/api/spares/sync');

// Recommendations
export interface Recommendation {
  id: string;
  device_id: string;
  generated_at: string;
  recommendation_text: string | null;
  model_used: string | null;
}

export const listRecommendations = (deviceId: string) =>
  request<{ recommendations: Recommendation[] }>('GET', `/api/devices/${deviceId}/recommendations`);

export const generateRecommendation = (deviceId: string) =>
  request<{ id: string; recommendation_text: string; model_used: string }>(
    'POST', `/api/devices/${deviceId}/recommendations/generate`
  );
