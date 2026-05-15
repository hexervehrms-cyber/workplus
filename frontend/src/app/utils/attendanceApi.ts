import { buildApiUrl } from './apiHelper';
import { TokenManager } from './api';

export function attendanceAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = TokenManager.get();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/** POST attendance action; treats 409 idempotency-in-flight as recoverable. */
export async function postAttendanceAction(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string
): Promise<{ ok: true; data: unknown; status: number } | { ok: false; status: number; message: string }> {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: attendanceAuthHeaders({ 'Idempotency-Key': idempotencyKey }),
    body: JSON.stringify(body),
  });

  let parsed: { message?: string; data?: unknown; success?: boolean } = {};
  try {
    parsed = await response.json();
  } catch {
    /* non-JSON body */
  }

  if (response.ok) {
    return { ok: true, data: parsed.data ?? parsed, status: response.status };
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
    message: parsed.message || `Request failed (${response.status})`,
  };
}
