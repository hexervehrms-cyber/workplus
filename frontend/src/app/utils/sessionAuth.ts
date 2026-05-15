/**
 * Access-token helpers (IndexedDB mirror + refresh) without importing api.ts (avoids circular deps).
 */
import {
  loadAccessTokenFromIndexedDB,
  getAccessTokenMirror,
  setAccessTokenMirror,
  clearAccessTokenMirror,
} from './sessionAccessMirror';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export async function hydrateAccessToken(): Promise<void> {
  await loadAccessTokenFromIndexedDB();
}

export function getAccessToken(): string | null {
  return getAccessTokenMirror();
}

export function setAccessToken(token: string | null): void {
  if (token) setAccessTokenMirror(token);
  else clearAccessTokenMirror();
}

/** Refresh via cookie POST /auth/refresh — no import from api.ts */
export async function refreshAccessToken(): Promise<string | null> {
  const apiUrl = import.meta.env.VITE_API_URL;
  let base =
    apiUrl && typeof apiUrl === 'string'
      ? apiUrl.replace(/\/$/, '')
      : typeof window !== 'undefined' &&
          (window.location.hostname.includes('hexerve.online') ||
            window.location.hostname.includes('vercel.app'))
        ? 'https://workplus-backend-sg3a.onrender.com/api'
        : '/api';
  if (base !== '/api' && !base.endsWith('/api')) base = `${base}/api`;

  try {
    const response = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.data?.accessToken) {
      clearAccessTokenMirror();
      return null;
    }
    setAccessTokenMirror(data.data.accessToken);
    return data.data.accessToken as string;
  } catch {
    clearAccessTokenMirror();
    return null;
  }
}

export async function ensureAccessToken(): Promise<string | null> {
  await hydrateAccessToken();
  let token = getAccessToken();
  if (!token) return null;
  if (!isTokenExpired(token)) return token;
  return refreshAccessToken();
}
