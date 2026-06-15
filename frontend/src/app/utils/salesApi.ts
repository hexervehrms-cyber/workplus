/**
 * Sales portal API — uses shared auth + cache helpers (no raw axios/fetch).
 */
import { apiDelete, apiGet, apiPatch, apiPost, normalizeApiEndpoint } from './apiHelper';

const ep = normalizeApiEndpoint;

export const salesApi = {
  get: <T = unknown>(path: string) => apiGet<T>(ep(path), false),
  post: <T = unknown>(path: string, body?: unknown) => apiPost<T>(ep(path), body),
  patch: <T = unknown>(path: string, body?: unknown) => apiPatch<T>(ep(path), body),
  delete: <T = unknown>(path: string) => apiDelete<T>(ep(path)),
};
