/**
 * IndexedDB persistence for attendance snapshots (larger quota, structured store).
 * Falls back silently when unavailable (SSR, private mode, disabled storage).
 */

const DB_NAME = 'workplus_hrms';
const DB_VERSION = 1;
const STORE = 'attendance_snapshots';

let dbPromise: Promise<IDBDatabase | null> | null = null;
let openFailed = false;

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable() || openFailed) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[attendanceIndexedDb] open error', req.error);
        openFailed = true;
        dbPromise = null;
        resolve(null);
      };
      req.onblocked = () => {
        console.warn('[attendanceIndexedDb] open blocked');
      };
    });
  }
  return dbPromise;
}

export async function attendanceIdbGet(key: string): Promise<unknown | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result as unknown;
        resolve(v ?? null);
      };
      req.onerror = () => {
        console.warn('[attendanceIndexedDb] get request error', req.error);
        resolve(null);
      };
    } catch (e) {
      console.warn('[attendanceIndexedDb] get failed', e);
      resolve(null);
    }
  });
}

export async function attendanceIdbPut(key: string, payload: object): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn('[attendanceIndexedDb] put tx error', tx.error);
        resolve();
      };
      tx.onabort = () => resolve();
    } catch (e) {
      console.warn('[attendanceIndexedDb] put failed', e);
      resolve();
    }
  });
}

export async function attendanceIdbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn('[attendanceIndexedDb] delete tx error', tx.error);
        resolve();
      };
      tx.onabort = () => resolve();
    } catch (e) {
      console.warn('[attendanceIndexedDb] delete failed', e);
      resolve();
    }
  });
}
