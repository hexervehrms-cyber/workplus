/**
 * Cross-tab sync for API cache invalidation and access-token mirror updates.
 */
import { loadAccessTokenFromIndexedDB } from './sessionAccessMirror';

const CHANNEL_NAME = 'workplus-tab-sync';

export type TabSyncMessage =
  | { type: 'CLEAR_API_CACHE'; endpoint?: string }
  | { type: 'TOKEN_UPDATED' }
  | { type: 'USER_SESSION_CLEARED' };

let channel: BroadcastChannel | null = null;
let initialized = false;

function postMessage(msg: TabSyncMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(msg);
  } catch {
    /* ignore */
  }
}

export function broadcastClearApiCache(endpoint?: string): void {
  postMessage({ type: 'CLEAR_API_CACHE', endpoint });
}

export function broadcastTokenUpdated(): void {
  postMessage({ type: 'TOKEN_UPDATED' });
}

export function broadcastUserSessionCleared(): void {
  postMessage({ type: 'USER_SESSION_CLEARED' });
}

export function initClientSessionSync(): void {
  if (initialized || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return;
  }
  initialized = true;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
    const msg = event.data;
    if (!msg?.type) return;
    switch (msg.type) {
      case 'CLEAR_API_CACHE':
        void import('./apiHelper').then(({ clearApiCache }) => {
          clearApiCache(msg.endpoint, { broadcast: false });
        });
        break;
      case 'TOKEN_UPDATED':
        void loadAccessTokenFromIndexedDB();
        break;
      case 'USER_SESSION_CLEARED':
        void import('./apiHelper').then(({ clearApiCache }) => {
          clearApiCache(undefined, { broadcast: false });
        });
        void loadAccessTokenFromIndexedDB();
        break;
      default:
        break;
    }
  };
}
