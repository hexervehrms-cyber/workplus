/**
 * Mirrors access JWT from login in IndexedDB + memory so fetch() can send Authorization
 * when httpOnly cookies are missing (proxy quirks). httpOnly cookie remains primary on server.
 */

const DB_NAME = 'workplus-session';
const DB_VERSION = 1;
const STORE = 'auth';
const KEY_ACCESS = 'accessToken';

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
      const g = tx.objectStore(STORE).get(KEY_ACCESS);
      g.onsuccess = () => {
        memoryAccessToken = typeof g.result === 'string' && g.result.length > 0 ? g.result : null;
        resolve();
      };
      g.onerror = () => reject(g.error);
    });
    db.close();
  } catch {
    memoryAccessToken = null;
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

export function clearAccessTokenMirror(): void {
  memoryAccessToken = null;
  void persistAccessToken(null);
  void import('./clientSessionSync').then(({ broadcastUserSessionCleared }) => {
    broadcastUserSessionCleared();
  });
}
