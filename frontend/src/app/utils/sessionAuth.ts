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
  hasSessionHint,
} from './sessionAccessMirror';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before access token expires
const PROACTIVE_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

let lastProactiveRefreshAt = 0;

function decodeJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  return Date.now() >= exp;
}

function isTokenExpiringSoon(token: string, bufferMs = REFRESH_BUFFER_MS): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  return Date.now() >= exp - bufferMs;
}

export async function hydrateAccessToken(): Promise<void> {
  await loadAccessTokenFromIndexedDB();
}

export function getAccessToken(): string | null {
  return getAccessTokenMirror();
}

export function getRefreshToken(): string | null {
  return getRefreshTokenMirror();
}

export function hasPersistedSessionHint(): boolean {
  return hasSessionHint() || !!getRefreshTokenMirror();
}

export function setAccessToken(token: string | null): void {
  if (token) setAccessTokenMirror(token);
  else clearAccessTokenMirror();
}

export function setRefreshToken(token: string | null): void {
  setRefreshTokenMirror(token);
}

/** Refresh via POST /auth/refresh — body refresh token for cross-origin (Vercel → Render). */
export async function refreshAccessToken(): Promise<string | null> {
  const base = getApiBaseUrl();
  const refreshToken = getRefreshTokenMirror();

  if (!refreshToken) {
    // Cookie-only refresh (same-site or credentialed cross-origin)
    try {
      const response = await fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      const accessToken =
        data?.data?.accessToken || data?.data?.token || data?.accessToken || data?.token;
      if (response.ok && accessToken) {
        setAccessTokenMirror(accessToken);
        if (data?.data?.refreshToken) setRefreshTokenMirror(data.data.refreshToken);
        lastProactiveRefreshAt = Date.now();
        return accessToken as string;
      }
    } catch {
      /* fall through */
    }
    return null;
  }

  try {
    const response = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json().catch(() => ({}));

    const accessToken =
      data?.data?.accessToken || data?.data?.token || data?.accessToken || data?.token;

    if (!response.ok || !accessToken) {
      // Only wipe stored session when refresh token is definitively rejected
      if (response.status === 401 || response.status === 403) {
        clearAccessTokenMirror();
      }
      return null;
    }

    setAccessTokenMirror(accessToken);
    if (data?.data?.refreshToken) {
      setRefreshTokenMirror(data.data.refreshToken);
    }
    lastProactiveRefreshAt = Date.now();
    return accessToken as string;
  } catch {
    return null;
  }
}

export async function ensureAccessToken(): Promise<string | null> {
  await hydrateAccessToken();
  let token = getAccessToken();

  const shouldRefresh =
    !token ||
    isTokenExpired(token) ||
    isTokenExpiringSoon(token) ||
    Date.now() - lastProactiveRefreshAt > PROACTIVE_REFRESH_INTERVAL_MS;

  if (shouldRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return refreshed;
  }

  if (token && !isTokenExpired(token)) return token;
  return token || null;
}
