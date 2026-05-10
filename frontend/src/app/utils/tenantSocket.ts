import { io, Socket } from 'socket.io-client';

// Tenant-aware Socket.IO service
export class TenantSocketService {
  private socket: Socket | null = null;
  private tenantId: string | null = null;
  private listeners: Map<string, ((...args: any[]) => void)[]> = new Map();

  // Connect to Socket.IO server with tenant support
  connect(userId: string, role: string, tenantId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // In production, VITE_SOCKET_URL should be the full backend URL
        // In development, use window.location.origin or env variable
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 
                           import.meta.env.VITE_API_URL ||
                           (import.meta.env.PROD ? 'https://workplus-backend-sg3a.onrender.com' : window.location.origin);
        
        this.socket = io(socketUrl, {
          query: {
            userId,
            role,
            tenantId
          },
          transports: ['websocket', 'polling'],
          withCredentials: true
        });

        this.tenantId = tenantId;

        this.socket.on('connect', () => {
          console.log(`Connected to Socket.IO server for tenant ${tenantId}`);
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

  // Emit events to server (tenant-scoped)
  emit(event: string, data: any): void {
    if (this.socket) {
      this.socket.emit(event, { ...data, tenantId: this.tenantId });
    }
  }

  // Listen to events from server (tenant-scoped)
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

  // Join tenant-specific room
  joinTenantRoom(): void {
    if (this.socket && this.tenantId) {
      this.socket.emit('joinRoom', `tenant_${this.tenantId}`);
    }
  }

  // Leave tenant-specific room
  leaveTenantRoom(): void {
    if (this.socket && this.tenantId) {
      this.socket.emit('leaveRoom', `tenant_${this.tenantId}`);
    }
  }
}

// Export singleton instance
export const tenantSocketService = new TenantSocketService();
