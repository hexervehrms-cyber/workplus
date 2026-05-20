/**
 * Mirrors access JWT from login in IndexedDB + memory so fetch() can send Authorization
 * when httpOnly cookies are missing (proxy quirks). httpOnly cookie remains primary on server.
 */

const DB_NAME = 'workplus-session';
const DB_VERSION = 1;
const STORE = 'auth';
const KEY_ACCESS = 'accessToken';
const KEY_REFRESH = 'refreshToken';

let memoryRefreshToken: string | null = null;

let memoryAccessToken: string | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function loadAccessTokenFromIndexedDB(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const accessReq = tx.objectStore(STORE).get(KEY_ACCESS);
      const refreshReq = tx.objectStore(STORE).get(KEY_REFRESH);
      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending <= 0) resolve();
      };
      accessReq.onsuccess = () => {
        memoryAccessToken =
          typeof accessReq.result === 'string' && accessReq.result.length > 0
            ? accessReq.result
            : null;
        done();
      };
      refreshReq.onsuccess = () => {
        memoryRefreshToken =
          typeof refreshReq.result === 'string' && refreshReq.result.length > 0
            ? refreshReq.result
            : null;
        done();
      };
      accessReq.onerror = () => reject(accessReq.error);
      refreshReq.onerror = () => reject(refreshReq.error);
    });
    db.close();
  } catch {
    memoryAccessToken = null;
    memoryRefreshToken = null;
  }
}

export function getAccessTokenMirror(): string | null {
  return memoryAccessToken;
}

async function persistAccessToken(token: string | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      if (token) store.put(token, KEY_ACCESS);
      else store.delete(KEY_ACCESS);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export function setAccessTokenMirror(token: string | null): void {
  memoryAccessToken = token && token.length > 0 ? token : null;
  void persistAccessToken(memoryAccessToken);
  if (memoryAccessToken) {
    void import('./clientSessionSync').then(({ broadcastTokenUpdated }) => {
      broadcastTokenUpdated();
    });
  }
}

export function getRefreshTokenMirror(): string | null {
  return memoryRefreshToken;
}

async function persistRefreshToken(token: string | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      if (token) store.put(token, KEY_REFRESH);
      else store.delete(KEY_REFRESH);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export function setRefreshTokenMirror(token: string | null): void {
  memoryRefreshToken = token && token.length > 0 ? token : null;
  void persistRefreshToken(memoryRefreshToken);
}

export function clearAccessTokenMirror(): void {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  void persistAccessToken(null);
  void persistRefreshToken(null);
  void import('./clientSessionSync').then(({ broadcastUserSessionCleared }) => {
    broadcastUserSessionCleared();
  });
}
