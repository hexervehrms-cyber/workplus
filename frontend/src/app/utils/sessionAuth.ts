/**
 * Access-token helpers (IndexedDB mirror + refresh) without importing api.ts (avoids circular deps).
 */
import { getApiBaseUrl } from './apiBaseUrl';
import {
  loadAccessTokenFromIndexedDB,
  getAccessTokenMirror,
  getRefreshTokenMirror,
  setAccessTokenMirror,
  setRefreshTokenMirror,
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

export function setRefreshToken(token: string | null): void {
  setRefreshTokenMirror(token);
}

/** Refresh via POST /auth/refresh — sends body refresh token for cross-origin (hexerve → Render). */
export async function refreshAccessToken(): Promise<string | null> {
  const base = getApiBaseUrl();
  const refreshToken = getRefreshTokenMirror();

  try {
    const response = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    const data = await response.json().catch(() => ({}));

    const accessToken =
      data?.data?.accessToken || data?.data?.token || data?.accessToken || data?.token;

    if (!response.ok || !accessToken) {
      // Do not wipe session on 404/network — caller may still have a valid short-lived token
      if (response.status === 401 || response.status === 403) {
        clearAccessTokenMirror();
      }
      return null;
    }

    setAccessTokenMirror(accessToken);
    if (data?.data?.refreshToken) {
      setRefreshTokenMirror(data.data.refreshToken);
    }
    return accessToken as string;
  } catch {
    return null;
  }
}

export async function ensureAccessToken(): Promise<string | null> {
  await hydrateAccessToken();
  let token = getAccessToken();
  if (!token) {
    return refreshAccessToken();
  }
  if (!isTokenExpired(token)) return token;
  const refreshed = await refreshAccessToken();
  return refreshed || token;
}
