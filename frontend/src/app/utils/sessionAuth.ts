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

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const PROACTIVE_REFRESH_INTERVAL_MS = 4 * 60 * 1000;
/** After 404/missing endpoint, do not call refresh again for 30 minutes */
const REFRESH_UNAVAILABLE_MS = 30 * 60 * 1000;

let lastProactiveRefreshAt = 0;
let refreshUnavailableUntil = 0;
let refreshInFlight: Promise<string | null> | null = null;

function refreshEndpointUrl(): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/auth/refresh`;
}

function markRefreshUnavailable(): void {
  refreshUnavailableUntil = Date.now() + REFRESH_UNAVAILABLE_MS;
  lastProactiveRefreshAt = Date.now();
}

export function isRefreshEndpointUnavailable(): boolean {
  return Date.now() < refreshUnavailableUntil;
}

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

async function performRefreshRequest(): Promise<string | null> {
  if (Date.now() < refreshUnavailableUntil) {
    return getAccessTokenMirror();
  }

  const refreshToken = getRefreshTokenMirror();
  if (!refreshToken) {
    // Cross-origin (Vercel → Render): httpOnly cookies are not sent reliably; skip empty-body spam
    return null;
  }

  const url = refreshEndpointUrl();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json().catch(() => ({}));

    const accessToken =
      data?.data?.accessToken || data?.data?.token || data?.accessToken || data?.token;

    if (response.status === 404) {
      markRefreshUnavailable();
      if (import.meta.env.DEV) {
        console.warn(
          '[sessionAuth] POST /api/auth/refresh returned 404 — deploy latest backend to Render.'
        );
      }
      return null;
    }

    if (!response.ok || !accessToken) {
      if (response.status === 401 || response.status === 403) {
        clearAccessTokenMirror();
      }
      lastProactiveRefreshAt = Date.now();
      return null;
    }

    setAccessTokenMirror(accessToken);
    if (data?.data?.refreshToken) {
      setRefreshTokenMirror(data.data.refreshToken);
    }
    lastProactiveRefreshAt = Date.now();
    return accessToken as string;
  } catch {
    lastProactiveRefreshAt = Date.now();
    return null;
  }
}

/** Refresh via POST /api/auth/refresh — deduped, no console spam on 404 */
export async function refreshAccessToken(): Promise<string | null> {
  if (Date.now() < refreshUnavailableUntil) {
    return getAccessTokenMirror();
  }

  if (!getRefreshTokenMirror()) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = performRefreshRequest().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function ensureAccessToken(): Promise<string | null> {
  await hydrateAccessToken();
  let token = getAccessToken();

  if (isRefreshEndpointUnavailable()) {
    if (token && !isTokenExpired(token)) return token;
    return token || null;
  }

  const hasRefresh = !!getRefreshTokenMirror();
  const shouldRefresh =
    hasRefresh &&
    (!token ||
      isTokenExpired(token) ||
      isTokenExpiringSoon(token) ||
      Date.now() - lastProactiveRefreshAt > PROACTIVE_REFRESH_INTERVAL_MS);

  if (shouldRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return refreshed;
  }

  if (token && !isTokenExpired(token)) return token;
  return token || null;
}
