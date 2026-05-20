/**
 * API Helper - Centralized API call utility with caching
 * Ensures all API calls use the correct base URL for production and development
 */

import { TokenManager } from './api';
import { ensureAccessToken, refreshAccessToken } from './sessionAuth';

// Simple request cache for GET requests
const requestCache = new Map<string, { data: any; timestamp: number }>();
const inFlightGet = new Map<string, Promise<unknown>>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes default
const ATTENDANCE_CACHE_MS = 20 * 1000; // short TTL for live attendance
const REQUEST_TIMEOUT_MS = 30_000;

function cacheTtlForEndpoint(endpoint: string): number {
  const e = endpoint.toLowerCase();
  if (e.includes('/attendance/')) return ATTENDANCE_CACHE_MS;
  if (e.includes('/dashboard/')) return 60 * 1000;
  return CACHE_DURATION;
}

function cacheKeyForEndpoint(endpoint: string): string {
  const ep = endpoint.trim();
  const token = TokenManager.get();
  let sessionKey = 'anon';
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as {
        userId?: string;
        sub?: string;
        id?: string;
        orgId?: string;
        tenantId?: string;
        role?: string;
        exp?: number;
      };
      const uid = payload.userId || payload.sub || payload.id;
      const org = payload.orgId || payload.tenantId;
      const role = payload.role;
      if (uid) {
        sessionKey = `u:${String(uid)}:o:${org || '_'}:r:${role || '_'}`;
      } else {
        sessionKey = `t:${token.length}:${token.slice(-16)}`;
      }
    } catch {
      sessionKey = `t:${token.length}:${token.slice(-16)}`;
    }
  }
  return `${sessionKey}::${ep}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get the API base URL
 * In production: uses VITE_API_URL environment variable
 * In development: uses /api (Vite proxy)
 */
export const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (!apiUrl) {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('hexerve.online') || window.location.hostname.includes('vercel.app'))) {
      return 'https://workplus-backend-sg3a.onrender.com/api';
    }
    return '/api';
  }
  
  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  
  if (baseUrl === '/api' || baseUrl.endsWith('/api')) {
    return baseUrl;
  }
  
  return `${baseUrl}/api`;
};

/**
 * Build full API URL
 * @param endpoint - API endpoint (e.g., '/expenses', 'expenses/user/123')
 * @returns Full API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/${cleanEndpoint}`;
};

/** Access token from session mirror (IndexedDB + memory) — prefer over localStorage.authToken */
export function getBearerToken(): string | null {
  return TokenManager.get();
}

/** Fetch headers with Bearer token when available */
export function bearerAuthHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getBearerToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * Make an API request with proper headers and error handling
 * @param endpoint - API endpoint
 * @param options - Fetch options
 * @returns Response data
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit & { skipContentType?: boolean } = {},
  retriedAuth = false
): Promise<T> => {
  const url = buildApiUrl(endpoint);
  const token = await ensureAccessToken();

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  // Only set Content-Type if not FormData and not skipped
  if (!options.skipContentType && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials ?? 'include'
  };

  try {
    let response = await fetchWithTimeout(url, config, REQUEST_TIMEOUT_MS);

    if (response.status === 401 && !retriedAuth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        TokenManager.set(refreshed);
        return apiRequest<T>(endpoint, options, true);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

/**
 * GET request with caching
 */
export const apiGet = async <T = any>(endpoint: string, useCache = true): Promise<T> => {
  const cacheKey = cacheKeyForEndpoint(endpoint);
  const ttl = cacheTtlForEndpoint(endpoint);

  if (useCache && requestCache.has(cacheKey)) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
  }

  if (inFlightGet.has(cacheKey)) {
    return inFlightGet.get(cacheKey) as Promise<T>;
  }

  const flight = apiRequest<T>(endpoint, { method: 'GET' })
    .then((data) => {
      if (useCache) {
        requestCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    })
    .finally(() => {
      inFlightGet.delete(cacheKey);
    });

  inFlightGet.set(cacheKey, flight);
  return flight;
};

/** GET that never throws — for dashboards and background sync. */
export async function apiGetSafe<T = unknown>(
  endpoint: string,
  useCache = true
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await apiGet<T>(endpoint, useCache);
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return { ok: false, error: message };
  }
}

/**
 * Clear cache for specific endpoint or all
 */
export const clearApiCache = (endpoint?: string) => {
  if (endpoint) {
    requestCache.delete(cacheKeyForEndpoint(endpoint));
  } else {
    requestCache.clear();
  }
};

/** Resolved tenant id from auth user (never returns literal "system"). */
export function resolveAuthOrgId(
  user: { orgId?: string; tenantId?: string } | null | undefined
): string | null {
  const id = user?.orgId || user?.tenantId;
  if (!id || id === 'system') return null;
  return String(id);
}

/** Append orgId for super_admin API calls that require tenant scope. */
export function appendOrgIdParam(
  url: string,
  user: { role?: string; orgId?: string; tenantId?: string } | null | undefined
): string {
  if (user?.role !== 'super_admin') return url;
  const oid = resolveAuthOrgId(user);
  if (!oid) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}orgId=${encodeURIComponent(oid)}`;
}

/** Scoped localStorage key for holiday lists (per user + org). */
export function holidaysStorageKey(
  userId?: string | null,
  orgId?: string | null
): string {
  return `cached_holidays:${userId || 'anon'}:${orgId || 'none'}`;
}

export function clearAllHolidayCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('cached_holidays')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * POST request
 */
export const apiPost = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  // Clear cache on POST (data mutation)
  clearApiCache();
  
  // Handle FormData separately - don't stringify it
  if (data instanceof FormData) {
    return apiRequest<T>(endpoint, {
      method: 'POST',
      body: data,
      skipContentType: true // Don't set Content-Type header for FormData
    });
  }
  
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined
  });
};

/**
 * PUT request
 */
export const apiPut = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  // Clear cache on PUT (data mutation)
  clearApiCache();
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined
  });
};

/**
 * PATCH request
 */
export const apiPatch = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  // Clear cache on PATCH (data mutation)
  clearApiCache();
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined
  });
};

/**
 * DELETE request
 */
export const apiDelete = async <T = any>(endpoint: string): Promise<T> => {
  // Clear cache on DELETE (data mutation)
  clearApiCache();
  return apiRequest<T>(endpoint, { method: 'DELETE' });
};

/**
 * File upload
 */
export const apiUpload = async <T = any>(
  endpoint: string,
  formData: FormData
): Promise<T> => {
  const url = buildApiUrl(endpoint);
  const token = TokenManager.get();

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData,
      credentials: 'include'
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Upload failed');
  }

  // Clear cache on upload
  clearApiCache();
  return response.json();
};

/**
 * Get backend URL for file downloads and external links
 * Used for receipt downloads, document links, etc.
 */
export const getBackendUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (apiUrl) {
    // Remove /api suffix if present
    return apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
  }
  
  if (typeof window !== 'undefined' && (window.location.hostname.includes('hexerve.online') || window.location.hostname.includes('vercel.app'))) {
    return 'https://workplus-backend-sg3a.onrender.com';
  }

  // Development without VITE_API_URL: API uses `/api` and uploads use `/uploads` (Vite proxies both to Express)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return typeof window !== 'undefined' ? window.location.origin : '';
};

/**
 * Build file download URL
 * @param filePath - File path from API (e.g., '/uploads/receipts/file.pdf')
 * @returns Full file URL
 */
export const buildFileUrl = (filePath: string): string => {
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  const backendUrl = getBackendUrl();
  return `${backendUrl}${filePath}`;
};

/** Extract filename from stored receipt path (/uploads/receipts/...) */
export function getReceiptFilename(receiptPath: string): string | null {
  if (!receiptPath?.trim()) return null;
  const clean = receiptPath.split('?')[0];
  const name = clean.split('/').pop();
  return name && !name.includes('..') ? name : null;
}

/**
 * Load receipt via authenticated API (fallback: public /uploads static URL).
 * Returns a blob: URL suitable for img/iframe preview.
 */
export async function fetchReceiptObjectUrl(receiptPath: string): Promise<string> {
  const filename = getReceiptFilename(receiptPath);
  const token = getBearerToken();

  if (filename && token) {
    const response = await fetchWithTimeout(
      buildApiUrl(`expenses/receipt/${encodeURIComponent(filename)}?inline=1`),
      {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      },
      REQUEST_TIMEOUT_MS
    );
    if (response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  }

  const staticUrl = buildFileUrl(receiptPath);
  const staticResponse = await fetchWithTimeout(
    staticUrl,
    { credentials: 'include' },
    REQUEST_TIMEOUT_MS
  );
  if (!staticResponse.ok) {
    throw new Error('Receipt not found');
  }
  const blob = await staticResponse.blob();
  return URL.createObjectURL(blob);
}
