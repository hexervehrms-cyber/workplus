/**
 * Socket.IO Client Service - Production Ready
 * Features: Auto reconnect, cleanup, connection state, error handling
 * PHASE 1 & 2: Room management, duplicate listener prevention
 */

/// <reference types="vite/client" />

import { io, Socket } from 'socket.io-client';
import { TokenManager } from './api';
import { ensureAccessToken, refreshAccessToken } from './sessionAuth';

// Socket configuration
// In production, VITE_SOCKET_URL is set to the backend URL
// In development, use environment variable or window.location.origin as fallback
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
                   import.meta.env.VITE_API_URL || 
                   (import.meta.env.PROD ? 'https://workplus-backend-sg3a.onrender.com' : window.location.origin);

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Event callback type
type EventCallback = (...args: any[]) => void;

// Socket service class
export class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 12;
  private reconnectDelay = 1000;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private role: string | null = null;
  private tenantId: string | null = null;
  private onStateChange?: (state: ConnectionState) => void;
  // PHASE 1: Track current room joins to prevent duplicates
  private currentRooms: Set<string> = new Set();

  constructor() {
    this.socket = null;
  }

  // Set state change callback
  setStateChangeCallback(callback: (state: ConnectionState) => void) {
    this.onStateChange = callback;
  }

  // Update connection state
  private setState(state: ConnectionState) {
    this.connectionState = state;
    this.onStateChange?.(state);
  }

  // Get current connection state
  getState(): ConnectionState {
    return this.connectionState;
  }

  // Connect to Socket.IO server
  connect(userId: string, role: string, tenantId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const uid = String(userId);
      const tid = tenantId ? String(tenantId) : null;

      // Reuse existing connection for same user (avoids duplicate sockets on reload/navigation)
      if (
        this.socket?.connected &&
        this.userId === uid &&
        this.role === role &&
        this.tenantId === tid
      ) {
        this.setState('connected');
        resolve();
        return;
      }

      // Store user info for reconnection
      this.userId = uid;
      this.role = role;
      this.tenantId = tid;

      // Disconnect existing socket if any (different user or stale connection)
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      // Reset rooms on new connection
      this.currentRooms.clear();

      this.setState('connecting');

      void (async () => {
      try {
        const token = (await ensureAccessToken()) || TokenManager.get();
        
        this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 12,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30_000,
          randomizationFactor: 0.5,
          timeout: 20_000,
          auth: {
            token: token || '',
          },
          forceNew: false,
        });

        // Connection successful
        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connected');
          this.setState('connected');
          this.reconnectAttempts = 0;

          // Identity comes from JWT on the server; omit userId to avoid mismatch with stale client state
          this.socket?.emit('authenticate', {
            ...(tenantId ? { tenantId } : {}),
          });

          // Re-register all listeners
          this.reregisterListeners();

          resolve();
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket.IO connection error:', error.message);
          this.reconnectAttempts++;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.setState('disconnected');
            reject(new Error('Failed to connect to real-time server'));
          }
        });

        // Disconnected
        this.socket.on('disconnect', (reason) => {
          console.log('⚠️ Socket.IO disconnected:', reason);
          
          if (reason === 'io server disconnect') {
            // Server disconnected us, try to reconnect
            this.setState('reconnecting');
            this.socket?.connect();
          } else {
            this.setState('disconnected');
          }
        });

        // Reconnecting
        this.socket.io.on('reconnect', (attemptNumber) => {
          console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
          this.setState('connected');
          this.reconnectAttempts = 0;
        });

        this.socket.io.on('reconnect_attempt', async (attemptNumber) => {
          console.log('🔄 Socket.IO reconnecting, attempt', attemptNumber);
          this.setState('reconnecting');
          const fresh = await ensureAccessToken();
          if (this.socket?.auth && typeof this.socket.auth === 'object') {
            (this.socket.auth as { token?: string }).token = fresh || '';
          }
        });

        this.socket.io.on('reconnect_failed', () => {
          console.error('❌ Socket.IO reconnection failed');
          this.setState('disconnected');
        });

        // Authentication response
        this.socket.on('authenticated', () => {
          console.log('✅ Socket.IO authenticated');
        });

        this.socket.on('auth_error', async (error: { message?: string; code?: string }) => {
          const code = error?.code || '';
          if (code === 'IDENTITY_MISMATCH' || code === 'INVALID_AUTH_DATA') {
            console.warn('Socket.IO auth warning:', error?.message || error);
            return;
          }
          const refreshed = (await refreshAccessToken()) || (await ensureAccessToken());
          if (refreshed && this.socket?.auth && typeof this.socket.auth === 'object') {
            (this.socket.auth as { token?: string }).token = refreshed;
            TokenManager.set(refreshed);
            this.socket.emit('authenticate', {
              ...(this.tenantId ? { tenantId: this.tenantId } : {}),
            });
            return;
          }
          console.warn('Socket.IO auth error (non-fatal):', error?.message || error);
        });

      } catch (error: any) {
        console.error('❌ Socket.IO setup error:', error);
        this.setState('disconnected');
        reject(error);
      }
      })();
    });
  }

  // Re-register all listeners after reconnection (avoid duplicate handlers)
  private reregisterListeners() {
    if (!this.socket) return;

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.off(event, callback);
        this.socket?.on(event, callback);
      });
    });
  }

  // Disconnect from Socket.IO server
  disconnect(): void {
    if (this.socket) {
      // Remove all listeners
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          this.socket?.off(event, callback);
        });
      });

      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
      this.currentRooms.clear();
      this.setState('disconnected');
      console.log('Socket.IO disconnected');
    }
  }

  // Emit events to server
  emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit "${event}": Socket not connected`);
    }
  }

  // Listen to events from server (PHASE 2: Avoid duplicate listeners, PART C: presence listener cleanup)
  on(event: string, callback: EventCallback): void {
    // Store callback for reconnection
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const callbacks = this.listeners.get(event)!;
    // PHASE 2: Only register if not already registered
    if (callbacks.has(callback)) {
      console.warn(`Listener for event "${event}" already registered, skipping duplicate`);
      return;
    }
    
    callbacks.add(callback);

    // Register with socket
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listener (PHASE 2: Exact handler reference cleanup for PART C: presence cleanup)
  off(event: string, callback?: EventCallback): void {
    if (callback) {
      // Remove specific callback - PART C uses this for presence:update cleanup
      this.listeners.get(event)?.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      // Remove all callbacks for event
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  // Remove all listeners for an event
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    } else {
      this.listeners.clear();
      if (this.socket) {
        this.socket.removeAllListeners();
      }
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  // Get socket instance
  getSocket(): Socket | null {
    return this.socket;
  }

  // PHASE 1: Join chat room with authorization
  joinChatRoom(conversationId?: string, groupId?: string): void {
    if (this.socket && this.socket.connected) {
      const roomIdentifier = conversationId || groupId || '';
      if (!roomIdentifier) {
        console.warn('joinChatRoom: no conversationId or groupId provided');
        return;
      }
      
      const room = `${conversationId ? 'chat:' : 'group:'}${roomIdentifier}`;
      if (this.currentRooms.has(room)) {
        console.debug(`Already in room: ${room}`);
        return;
      }
      
      this.socket.emit('chat:room:join', { conversationId, groupId });
      this.currentRooms.add(room);
      console.log(`Joining room: ${room}`);
    } else {
      console.warn('Cannot join room: Socket not connected');
    }
  }

  // PHASE 1: Leave chat room safely
  leaveChatRoom(conversationId?: string, groupId?: string): void {
    if (this.socket && this.socket.connected) {
      const roomIdentifier = conversationId || groupId || '';
      if (!roomIdentifier) {
        console.warn('leaveChatRoom: no conversationId or groupId provided');
        return;
      }
      
      const room = `${conversationId ? 'chat:' : 'group:'}${roomIdentifier}`;
      if (!this.currentRooms.has(room)) {
        console.debug(`Not in room: ${room}`);
        return;
      }
      
      this.socket.emit('chat:room:leave', { conversationId, groupId });
      this.currentRooms.delete(room);
      console.log(`Leaving room: ${room}`);
    }
  }

  // Join a room (legacy compatibility)
  joinRoom(room: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join', room);
    }
  }

  // Leave a room (legacy compatibility)
  leaveRoom(room: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave', room);
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
