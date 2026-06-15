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
    /* non-JSON body - treat as generic error */
    return {
      ok: false,
      status: response.status || 0,
      message: response.status === 0 ? 'Network error - unable to connect to server' : 'Request failed'
    };
  }

  if (response.ok) {
    return { ok: true, data: mergeSuccessPayload(parsed), status: response.status };
  }

  // Handle specific status codes with actionable messages
  if (response.status === 409) {
    return {
      ok: false,
      status: 409,
      message: parsed.message || 'Request in progress — syncing…',
    };
  }

  if (response.status === 400) {
    return {
      ok: false,
      status: 400,
      message: parsed.message || 'Invalid request - please check your input',
    };
  }

  if (response.status === 403) {
    return {
      ok: false,
      status: 403,
      message: parsed.message || 'You do not have permission to perform this action',
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      status: 404,
      message: parsed.message || 'Attendance record not found',
    };
  }

  if (response.status >= 500) {
    return {
      ok: false,
      status: response.status,
      message: parsed.message || 'Server error - please try again later',
    };
  }

  return {
    ok: false,
    status: response.status,
    message: authErrorMessage(response.status, parsed),
  };
}
