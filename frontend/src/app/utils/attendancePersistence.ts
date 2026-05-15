/**
 * Durable client-side attendance cache.
 * - IndexedDB (primary durable store, larger quota)
 * - localStorage canonical + legacy mirrors + sessionStorage (fast path / compat)
 * - Server remains source of truth; this is offline / reload resilience only.
 */

import { attendanceIdbDelete, attendanceIdbGet, attendanceIdbPut } from './attendanceIndexedDb';

export const ATTENDANCE_CACHE_VERSION = 2;

export type PersistedAttendancePayload = {
  v: number;
  userId: string | null;
  dayKey: string;
  checkedIn: boolean;
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  currentHours: number;
  hoursWorked: number;
  status: string;
  isOnBreak: boolean;
  currentBreakDuration: number;
  breakType: string;
  breakStartTime?: string;
  timestamp: number;
};

/** Local calendar YYYY-MM-DD (matches HR "today" in the user's timezone). */
export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Legacy key suffix used by older builds. */
export function legacyTodayLabel(d = new Date()): string {
  return d.toDateString();
}

function canonicalStorageKey(userId: string | null, dayKey: string): string {
  return `workplus:attendance:v${ATTENDANCE_CACHE_VERSION}:${userId || 'unknown'}:${dayKey}`;
}

/** Public key for IndexedDB + canonical localStorage (same string). */
export function attendanceSnapshotKey(userId: string | null, dayKey?: string): string {
  return canonicalStorageKey(userId, dayKey ?? localDayKey());
}

function legacyCheckedInKey(d = new Date()): string {
  return `checkedIn_${legacyTodayLabel(d)}`;
}

function legacyEmployeeStateKey(userId: string | null): string | null {
  if (!userId) return null;
  return `employee_attendance_state_${userId}`;
}

function sessionMirrorKey(userId: string | null, dayKey: string): string {
  return `workplus:attendance:session:${userId || 'unknown'}:${dayKey}`;
}

function normalizeParsed(
  parsed: Record<string, unknown>,
  userId: string | null,
  dayKey: string
): PersistedAttendancePayload | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const ts = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0;
  const checkedIn = Boolean(parsed.checkedIn ?? parsed.isCheckedIn);
  return {
    v: typeof parsed.v === 'number' ? parsed.v : 1,
    userId: (parsed.userId as string) ?? userId,
    dayKey: typeof parsed.dayKey === 'string' ? parsed.dayKey : dayKey,
    checkedIn,
    isCheckedIn: Boolean(parsed.isCheckedIn ?? checkedIn),
    checkInTime: (parsed.checkInTime as string) || null,
    checkOutTime: (parsed.checkOutTime as string) || null,
    currentHours: Number(parsed.currentHours ?? parsed.hoursWorked ?? 0),
    hoursWorked: Number(parsed.hoursWorked ?? parsed.currentHours ?? 0),
    status: (parsed.status as string) || 'absent',
    isOnBreak: Boolean(parsed.isOnBreak),
    currentBreakDuration: Number(parsed.currentBreakDuration ?? 0),
    breakType: (parsed.breakType as string) || 'regular',
    breakStartTime: typeof parsed.breakStartTime === 'string' ? parsed.breakStartTime : undefined,
    timestamp: ts
  };
}

export function isPayloadFresh(payload: PersistedAttendancePayload, maxAgeMs = 36 * 60 * 60 * 1000): boolean {
  if (!payload.timestamp) return false;
  return Date.now() - payload.timestamp <= maxAgeMs;
}

function tryParse(raw: string | null, userId: string | null, dayKey: string): PersistedAttendancePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeParsed(parsed, userId, dayKey);
  } catch {
    return null;
  }
}

/** Write payload to localStorage + sessionStorage (+ legacy mirrors). Does not touch IndexedDB. */
function writeLocalMirrors(
  userId: string | null,
  payload: PersistedAttendancePayload,
  mirrorLegacy: boolean
): void {
  const dayKey = payload.dayKey;
  const json = JSON.stringify(payload);
  try {
    localStorage.setItem(canonicalStorageKey(userId, dayKey), json);
  } catch (e) {
    console.warn('[attendancePersistence] localStorage canonical write failed', e);
  }
  if (mirrorLegacy) {
    try {
      localStorage.setItem(legacyCheckedInKey(), json);
      const uk = legacyEmployeeStateKey(userId);
      if (uk) localStorage.setItem(uk, json);
    } catch (e) {
      console.warn('[attendancePersistence] legacy mirror write failed', e);
    }
  }
  try {
    sessionStorage.setItem(sessionMirrorKey(userId, dayKey), json);
  } catch {
    /* ignore */
  }
}

function queueIdbPut(key: string, payload: PersistedAttendancePayload): void {
  void attendanceIdbPut(key, payload).catch(() => {
    /* non-fatal */
  });
}

/**
 * Read attendance snapshot: IndexedDB first, then localStorage / legacy / session.
 */
async function readPayloadForKey(
  key: string,
  userId: string | null,
  dayKey: string
): Promise<PersistedAttendancePayload | null> {
  try {
    const rawIdb = await attendanceIdbGet(key);
    if (rawIdb && typeof rawIdb === 'object' && !Array.isArray(rawIdb)) {
      const payload = normalizeParsed(rawIdb as Record<string, unknown>, userId, dayKey);
      if (payload && isPayloadFresh(payload)) return payload;
    }
  } catch {
    /* ignore */
  }
  return tryParse(localStorage.getItem(key), userId, dayKey);
}

export async function readPersistedAttendance(userId: string | null): Promise<PersistedAttendancePayload | null> {
  const dayKey = localDayKey();
  const key = canonicalStorageKey(userId, dayKey);

  // 0) IndexedDB
  try {
    const rawIdb = await attendanceIdbGet(key);
    if (rawIdb && typeof rawIdb === 'object' && !Array.isArray(rawIdb)) {
      const payload = normalizeParsed(rawIdb as Record<string, unknown>, userId, dayKey);
      if (payload && isPayloadFresh(payload)) {
        writeLocalMirrors(userId, payload, true);
        return payload;
      }
    }
  } catch (e) {
    console.warn('[attendancePersistence] IndexedDB read failed', e);
  }

  // 1) Canonical localStorage
  let payload = tryParse(localStorage.getItem(key), userId, dayKey);
  if (payload && isPayloadFresh(payload)) {
    queueIdbPut(key, payload);
    return payload;
  }

  // 2) Legacy per-user blob
  const userKey = legacyEmployeeStateKey(userId);
  if (userKey) {
    payload = tryParse(localStorage.getItem(userKey), userId, dayKey);
    if (payload && isPayloadFresh(payload)) {
      writeLocalMirrors(userId, payload, true);
      queueIdbPut(key, payload);
      return payload;
    }
  }

  // 3) Legacy date string key
  payload = tryParse(localStorage.getItem(legacyCheckedInKey()), userId, dayKey);
  if (payload && isPayloadFresh(payload)) {
    if (payload.userId != null && userId && String(payload.userId) !== String(userId)) {
      return null;
    }
    writeLocalMirrors(userId, payload, true);
    queueIdbPut(key, payload);
    return payload;
  }

  // 4) Session mirror
  try {
    payload = tryParse(sessionStorage.getItem(sessionMirrorKey(userId, dayKey)), userId, dayKey);
    if (payload && isPayloadFresh(payload)) {
      writeLocalMirrors(userId, payload, true);
      queueIdbPut(key, payload);
      return payload;
    }
  } catch {
    /* sessionStorage blocked */
  }

  // 5) Legacy builds stored under userId "unknown" before AuthContext wired cache keys
  if (userId && userId !== 'unknown') {
    const legacyUnknownKey = canonicalStorageKey('unknown', dayKey);
    const legacyPayload = await readPayloadForKey(legacyUnknownKey, userId, dayKey);
    if (legacyPayload && isPayloadFresh(legacyPayload)) {
      writeLocalMirrors(userId, legacyPayload, true);
      queueIdbPut(key, legacyPayload);
      return legacyPayload;
    }
  }

  return null;
}

type WriteOptions = { mirrorLegacy?: boolean };

export function writePersistedAttendance(
  userId: string | null,
  data: Partial<PersistedAttendancePayload> & Pick<
    PersistedAttendancePayload,
    | 'checkedIn'
    | 'isCheckedIn'
    | 'checkInTime'
    | 'checkOutTime'
    | 'currentHours'
    | 'hoursWorked'
    | 'status'
    | 'isOnBreak'
    | 'currentBreakDuration'
    | 'breakType'
  >,
  options: WriteOptions = {}
): void {
  const dayKey = localDayKey();
  const mirrorLegacy = options.mirrorLegacy !== false;

  const payload: PersistedAttendancePayload = {
    v: ATTENDANCE_CACHE_VERSION,
    userId: data.userId ?? userId,
    dayKey: data.dayKey ?? dayKey,
    checkedIn: data.checkedIn,
    isCheckedIn: data.isCheckedIn,
    checkInTime: data.checkInTime,
    checkOutTime: data.checkOutTime,
    currentHours: data.currentHours,
    hoursWorked: data.hoursWorked,
    status: data.status,
    isOnBreak: data.isOnBreak,
    currentBreakDuration: data.currentBreakDuration,
    breakType: data.breakType,
    breakStartTime: data.breakStartTime,
    timestamp: data.timestamp ?? Date.now()
  };

  const key = canonicalStorageKey(userId, dayKey);
  writeLocalMirrors(userId, payload, mirrorLegacy);
  queueIdbPut(key, payload);
}

export async function clearPersistedAttendance(userId: string | null): Promise<void> {
  const dayKey = localDayKey();
  const key = canonicalStorageKey(userId, dayKey);
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(legacyCheckedInKey());
    const uk = legacyEmployeeStateKey(userId);
    if (uk) localStorage.removeItem(uk);
    sessionStorage.removeItem(sessionMirrorKey(userId, dayKey));
  } catch (e) {
    console.warn('[attendancePersistence] clear local/session failed', e);
  }
  try {
    await attendanceIdbDelete(key);
  } catch (e) {
    console.warn('[attendancePersistence] IndexedDB clear failed', e);
  }
}
