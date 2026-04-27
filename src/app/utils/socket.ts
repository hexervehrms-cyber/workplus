import { io, Socket } from 'socket.io-client';

// Socket.IO client configuration
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000') as string;

// Create singleton socket instance
let socket: Socket | null = null;

// Socket service class
export class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, ((...args: any[]) => void)[]> = new Map();

  constructor() {
    this.socket = null;
  }

  // Connect to Socket.IO server
  connect(userId: string, role: string = 'employee'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(SOCKET_URL, {
          query: {
            userId,
            role
          }
        });

        this.socket.on('connect', () => {
          console.log('Connected to Socket.IO server');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket.IO connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from Socket.IO server');
          this.socket = null;
        });

      } catch (error) {
        console.error('Failed to connect to Socket.IO server:', error);
        reject(error);
      }
    });
  }

  // Disconnect from Socket.IO server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Emit events to server
  emit(event: string, data: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  // Listen to events from server
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      // Remove existing listener if any
      this.listeners.delete(event);
      
      // Add new listener
      const callbacks = [callback];
      this.listeners.set(event, callbacks);
      
      // Register socket event listener
      this.socket.on(event, callback);
    }
  }

  // Remove event listener
  off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
      this.listeners.delete(event);
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
}

// Export singleton instance
export const socketService = new SocketService();
