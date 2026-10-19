import * as SecureStore from 'expo-secure-store';

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE?.replace(/\/+$/, '') || 'https://nex.autos/api/v1';
const ACCESS = 'autonex_access_token';
const REFRESH = 'autonex_refresh_token';

type Session = { accessToken: string; refreshToken: string; user: { email: string; name: string; role: string } };
export type Profile = { brandName: string | null; expired: boolean; accessMessage: string | null; used: number; remaining: number | null; monthlyLimit: number | null };
export type Quote = { auction: string; yard?: string; state: string; priceUsd: number; auctionFeeUsd: number; invoiceUsd?: number; oceanUsd: number | null; tirUsd: number; freightUsd: number | null; totalUsd: number | null; missing: boolean; brandName?: string | null; usage?: { used: number; remaining: number | null; monthlyLimit: number | null } };

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message || `Server xətası: ${response.status}`);
  return body;
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
  const session = await parse(response) as Session;
  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'FREIGHT_USER'].includes(session.user.role)) throw new Error('Bu hesabda kalkulyator icazəsi yoxdur.');
  await Promise.all([SecureStore.setItemAsync(ACCESS, session.accessToken), SecureStore.setItemAsync(REFRESH, session.refreshToken)]);
  return session;
}

async function accessToken() {
  const current = await SecureStore.getItemAsync(ACCESS);
  if (current) return current;
  return refreshAccess();
}

async function refreshAccess() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH);
  if (!refreshToken) return null;
  const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  if (!response.ok) { await logout(); return null; }
  const session = await parse(response) as Session;
  await Promise.all([SecureStore.setItemAsync(ACCESS, session.accessToken), SecureStore.setItemAsync(REFRESH, session.refreshToken)]);
  return session.accessToken;
}

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error('Giriş edilməyib.');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
  if (response.status === 401 && retry) { await SecureStore.deleteItemAsync(ACCESS); await refreshAccess(); return request<T>(path, init, false); }
  return parse(response) as Promise<T>;
}

export async function hasSession() { return Boolean(await SecureStore.getItemAsync(ACCESS) || await SecureStore.getItemAsync(REFRESH)); }
export async function logout() { await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]); }
export const profile = () => request<Profile>('/calculator/me');
export const quote = (body: Record<string, unknown>) => request<Quote>('/shipping/quote', { method: 'POST', body: JSON.stringify(body) });
