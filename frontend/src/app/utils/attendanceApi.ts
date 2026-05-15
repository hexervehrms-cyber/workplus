import { buildApiUrl } from './apiHelper';
import { ensureAccessToken, refreshAccessToken } from './sessionAuth';
import { TokenManager } from './api';

function authErrorMessage(
  status: number,
  parsed: { message?: string; code?: string }
): string {
  const code = parsed.code || '';
  if (code === 'NO_TOKEN' || code === 'TOKEN_EXPIRED' || status === 401) {
    return 'Your session expired. Please sign in again.';
  }
  if (code === 'EMPLOYEE_NOT_FOUND') {
    return 'Employee profile not found. Contact HR to activate your account.';
  }
  return parsed.message || `Request failed (${status})`;
}

function mergeSuccessPayload(
  parsed: { message?: string; data?: unknown }
): unknown {
  const data = parsed.data ?? parsed;
  if (
    parsed.message &&
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    !(data instanceof Date)
  ) {
    return { ...(data as Record<string, unknown>), message: parsed.message };
  }
  return data;
}

async function doAttendancePost(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
  authToken: string | null
): Promise<Response> {
  return fetch(buildApiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

export function attendanceAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** POST attendance action; JWT (IndexedDB mirror) + httpOnly cookie + 401 refresh retry. */
export async function postAttendanceAction(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string
): Promise<{ ok: true; data: unknown; status: number } | { ok: false; status: number; message: string }> {
  let authToken = await ensureAccessToken();
  let response = await doAttendancePost(path, body, idempotencyKey, authToken);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      TokenManager.set(refreshed);
      authToken = refreshed;
      response = await doAttendancePost(path, body, idempotencyKey, authToken);
    }
  }

  let parsed: { message?: string; data?: unknown; success?: boolean; code?: string } = {};
  try {
    parsed = await response.json();
  } catch {
    /* non-JSON body */
  }

  if (response.ok) {
    return { ok: true, data: mergeSuccessPayload(parsed), status: response.status };
  }

  if (response.status === 409) {
    return {
      ok: false,
      status: 409,
      message: parsed.message || 'Request in progress — syncing…',
    };
  }

  return {
    ok: false,
    status: response.status,
    message: authErrorMessage(response.status, parsed),
  };
}
