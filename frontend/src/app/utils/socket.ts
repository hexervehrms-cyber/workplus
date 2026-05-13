/**
 * Socket.IO Client Service - Production Ready
 * Features: Auto reconnect, cleanup, connection state, error handling
 */

import { io, Socket } from 'socket.io-client';
import { TokenManager } from './api';

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
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private role: string | null = null;
  private tenantId: string | null = null;
  private onStateChange?: (state: ConnectionState) => void;

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
      // Store user info for reconnection
      this.userId = userId;
      this.role = role;
      this.tenantId = tenantId || null;

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.setState('connecting');

      try {
        const token = TokenManager.get();
        
        this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 12,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30_000,
          randomizationFactor: 0.5,
          reconnectionDelayFn: (attempt) => {
            const exp = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
            return exp + Math.random() * 750;
          },
          timeout: 20_000,
          auth: {
            token: token || ''
          }
        });

        // Connection successful
        this.socket.on('connect', () => {
          console.log('✅ Socket.IO connected');
          this.setState('connected');
          this.reconnectAttempts = 0;

          // Authenticate with server
          this.socket?.emit('authenticate', { 
            userId, 
            role, 
            tenantId 
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

        this.socket.io.on('reconnect_attempt', (attemptNumber) => {
          console.log('🔄 Socket.IO reconnecting, attempt', attemptNumber);
          this.setState('reconnecting');
        });

        this.socket.io.on('reconnect_failed', () => {
          console.error('❌ Socket.IO reconnection failed');
          this.setState('disconnected');
        });

        // Authentication response
        this.socket.on('authenticated', () => {
          console.log('✅ Socket.IO authenticated');
        });

        this.socket.on('auth_error', (error: any) => {
          console.error('❌ Socket.IO auth error:', error);
        });

      } catch (error: any) {
        console.error('❌ Socket.IO setup error:', error);
        this.setState('disconnected');
        reject(error);
      }
    });
  }

  // Re-register all listeners after reconnection
  private reregisterListeners() {
    if (!this.socket) return;

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
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

  // Listen to events from server
  on(event: string, callback: EventCallback): void {
    // Store callback for reconnection
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Register with socket
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listener
  off(event: string, callback?: EventCallback): void {
    if (callback) {
      // Remove specific callback
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

  // Join a room
  joinRoom(room: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join', room);
    }
  }

  // Leave a room
  leaveRoom(room: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave', room);
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
