import { io, Socket } from 'socket.io-client';
import { TokenManager } from './api';
import { socketService } from './socket';

class RealTimeSocket {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private connectionAttempted = false;
  private usesSharedSocket = false;
  private dashboardListenersReady = false;

  constructor() {
    // Don't connect immediately - wait for user to be available
    // Connection will be triggered when needed
  }

  private authUser: { id: string; role: string; orgId?: string; tenantId?: string } | null = null;

  /**
   * Connect using authenticated user from AuthContext (TokenManager.getUser is not populated).
   */
  connectFromAuth(user: { id: string; role: string; orgId?: string; tenantId?: string }) {
    if (!user?.id) return;
    this.authUser = user;

    const shared = socketService.getSocket();
    if (socketService.isConnected() && shared) {
      this.attachSharedSocket(shared, user);
      return;
    }

    this.connectionAttempted = false;
    if (this.socket?.connected && !this.usesSharedSocket) {
      return;
    }
    const token = TokenManager.get() || '';
    this.connect(
      {
        id: user.id,
        role: user.role,
        orgId: user.orgId || user.tenantId,
        tenantId: user.tenantId || user.orgId,
      },
      token
    );
  }

  private attachSharedSocket(socket: Socket, user: { id: string; role: string; orgId?: string; tenantId?: string }) {
    this.usesSharedSocket = true;
    this.socket = socket;
    this.isConnecting = false;
    this.connectionAttempted = true;
    this.authUser = user;
    if (!this.dashboardListenersReady) {
      this.setupDashboardListeners();
      this.dashboardListenersReady = true;
    }
  }

  /**
   * Lazy connect - only connect when user data is available
   */
  private ensureConnected() {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    const user = this.authUser || TokenManager.getUser();
    if (!user?.id) {
      return;
    }

    const shared = socketService.getSocket();
    if (socketService.isConnected() && shared) {
      this.attachSharedSocket(shared, user as { id: string; role: string; orgId?: string; tenantId?: string });
      return;
    }

    const token = TokenManager.get() || '';
    if (this.connectionAttempted && !this.socket) {
      return;
    }

    this.connectionAttempted = true;
    this.connect(user, token);
  }

  private connect(user: any, token: string) {
    if (this.isConnecting || (this.socket?.connected && !this.usesSharedSocket)) {
      return;
    }

    this.usesSharedSocket = false;
    this.isConnecting = true;

    if (!token) {
      console.log('🔐 [SOCKET] No Bearer token in storage — relying on httpOnly session cookie (withCredentials)');
    }

    console.log('🔐 [SOCKET] User data from TokenManager:', user);

    // In production, VITE_SOCKET_URL should be the full backend URL
    // In development, use window.location.origin or env variable
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 
                       import.meta.env.VITE_API_URL ||
                       (import.meta.env.PROD ? 'https://workplus-backend-sg3a.onrender.com' : window.location.origin);

    // Connect to the server with JWT token
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        token
      },
      withCredentials: true
    });

    // Handle connection
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // Get orgId from user or localStorage
      let orgId = user.orgId || user.tenantId || 'system';
      
      // If still not found, try to get from localStorage
      if (!orgId || orgId === 'undefined') {
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            orgId = parsedUser.orgId || parsedUser.tenantId || 'system';
          }
        } catch (e) {
          console.warn('Could not parse stored user');
        }
      }
      
      // Ensure orgId is always a valid string
      if (!orgId || orgId === 'undefined' || orgId === 'null') {
        orgId = 'system';
      }
      
      console.log('🔐 Authenticating with:', { userId: user.id, role: user.role, orgId });
      
      // Authenticate with user details
      this.socket?.emit('authenticate', {
        userId: user.id,
        role: user.role,
        tenantId: orgId
      });
    });

    // Handle authentication response
    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated:', data);
      
      // Join organization room for real-time updates
      if (data.orgId) {
        this.socket?.emit('join_org_room', { orgId: data.orgId });
        console.log('📍 Joined org room:', `tenant_${data.orgId}`);
      }
    });

    this.socket.on('auth_error', (error) => {
      console.error('❌ Socket authentication failed:', error);
      this.isConnecting = false;
    });

    // Handle disconnection
    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      this.isConnecting = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    // Handle connection errors
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.isConnecting = false;
      this.handleReconnect();
    });

    if (!this.dashboardListenersReady) {
      this.setupDashboardListeners();
      this.dashboardListenersReady = true;
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) + Math.random() * 500,
        30_000
      );
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${Math.round(delay)}ms...`);
      
      setTimeout(() => {
        this.socket?.connect();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  private setupDashboardListeners() {
    if (!this.socket) return;

    // Dashboard data updates
    this.socket.on('dashboard_update', (data) => {
      console.log('📊 Dashboard update received:', data);
      this.notifyDashboardUpdate(data);
    });

    // Activity feed updates
    this.socket.on('activity_update', (activity) => {
      console.log('📝 Activity update received:', activity);
      this.notifyActivityUpdate(activity);
    });

    // Employee updates
    this.socket.on('employee_created', (employee) => {
      console.log('👤 Employee created:', employee);
      this.notifyEmployeeUpdate('created', employee);
    });

    this.socket.on('employee_updated', (employee) => {
      console.log('👤 Employee updated:', employee);
      this.notifyEmployeeUpdate('updated', employee);
    });

    // Leave request updates
    this.socket.on('leave_created', (leave) => {
      console.log('📅 Leave request created:', leave);
      this.notifyLeaveUpdate('created', leave);
    });

    this.socket.on('leave_updated', (leave) => {
      console.log('📅 Leave request updated:', leave);
      this.notifyLeaveUpdate('updated', leave);
    });

    this.socket.on('leave:update', (data) => {
      console.log('📅 Leave update event:', data);
      this.notifyLeaveUpdate(data.action, data.leaveRequest);
    });

    this.socket.on('leave_allocation_created', (data) => {
      console.log('📅 Leave allocation created:', data);
      this.notifyLeaveUpdate('allocation_created', data?.leave || data);
    });

    // Expense updates
    this.socket.on('expense:created', (expense) => {
      console.log('💰 Expense created:', expense);
      this.notifyExpenseUpdate('created', expense);
    });

    this.socket.on('expense:updated', (expense) => {
      console.log('💰 Expense updated:', expense);
      this.notifyExpenseUpdate('updated', expense);
    });

    this.socket.on('expense:deleted', (expense) => {
      console.log('💰 Expense deleted:', expense);
      this.notifyExpenseUpdate('deleted', expense);
    });

    // Attendance updates
    this.socket.on('attendance:update', (data) => {
      console.log('⏰ Attendance update received:', data);
      this.notifyAttendanceUpdate(data.attendance || data);
    });

    // Check-in updates
    this.socket.on('attendance:checked_in', (data) => {
      console.log('🔓 [SOCKET] Employee checked in:', data);
      this.notifyAttendanceUpdate({ type: 'checked_in', ...data });
      // Trigger dashboard refresh
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'checked_in', data });
    });

    // System notifications
    this.socket.on('notification', (notification) => {
      console.log('🔔 Notification received:', notification);
      this.notifySystemNotification(notification);
    });

    // Break updates
    this.socket.on('break:started', (data) => {
      console.log('☕ [SOCKET] Break started:', data);
      this.notifyBreakStarted(data);
      this.notifyAttendanceUpdate({ type: 'break_started', ...data });
      // Trigger dashboard refresh
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'break_started', data });
    });

    this.socket.on('break:ended', (data) => {
      console.log('☕ [SOCKET] Break ended:', data);
      this.notifyBreakEnded(data);
      this.notifyAttendanceUpdate({ type: 'break_ended', ...data });
      // Trigger dashboard refresh
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'break_ended', data });
    });

    // Meeting updates
    this.socket.on('meeting:started', (data) => {
      console.log('📞 [SOCKET] Meeting started:', data);
      this.notifyMeetingStarted(data);
      this.notifyAttendanceUpdate({ type: 'meeting_started', ...data });
      // Trigger dashboard refresh
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'meeting_started', data });
    });

    this.socket.on('meeting:ended', (data) => {
      console.log('📞 [SOCKET] Meeting ended:', data);
      this.notifyMeetingEnded(data);
      this.notifyAttendanceUpdate({ type: 'meeting_ended', ...data });
      // Trigger dashboard refresh
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'meeting_ended', data });
    });

    // Check-out updates
    this.socket.on('attendance:checked_out', (data) => {
      console.log('🚪 [SOCKET] Employee checked out:', data);
      this.notifyAttendanceUpdate({ type: 'checked_out', ...data });
      // Trigger dashboard refresh
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'checked_out', data });
    });

    // KPI updates
    this.socket.on('kpi:update', (data) => {
      console.log('📊 [SOCKET] KPI update event received from server:', data);
      console.log('📊 [SOCKET] Full data structure:', JSON.stringify(data, null, 2));
      console.log('📊 [SOCKET] KPI onBreak value:', data?.kpis?.onBreak);
      console.log('📊 [SOCKET] KPI activeUsers value:', data?.kpis?.activeUsers);
      
      // Notify dashboard with the KPI data
      this.notifyKPIUpdate(data);
      this.notifyDashboardUpdate({ type: 'kpi_update', data });
      
      console.log('📊 [SOCKET] Dashboard update callbacks count:', this.dashboardUpdateCallbacks.length);
    });
  }

  // Dashboard update callbacks
  private dashboardUpdateCallbacks: ((data: any) => void)[] = [];
  private activityUpdateCallbacks: ((activity: any) => void)[] = [];
  private employeeUpdateCallbacks: ((type: string, employee: any) => void)[] = [];
  private leaveUpdateCallbacks: ((type: string, leave: any) => void)[] = [];
  private attendanceUpdateCallbacks: ((attendance: any) => void)[] = [];
  private expenseUpdateCallbacks: ((type: string, expense: any) => void)[] = [];
  private notificationCallbacks: ((notification: any) => void)[] = [];
  private breakStartedCallbacks: ((data: any) => void)[] = [];
  private breakEndedCallbacks: ((data: any) => void)[] = [];
  private meetingStartedCallbacks: ((data: any) => void)[] = [];
  private meetingEndedCallbacks: ((data: any) => void)[] = [];
  private kpiUpdateCallbacks: ((data: any) => void)[] = [];

  // Public methods to subscribe to updates
  onDashboardUpdate(callback: (data: any) => void) {
    this.ensureConnected();
    this.dashboardUpdateCallbacks.push(callback);
    return () => {
      const index = this.dashboardUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.dashboardUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onActivityUpdate(callback: (activity: any) => void) {
    this.ensureConnected();
    this.activityUpdateCallbacks.push(callback);
    return () => {
      const index = this.activityUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.activityUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onEmployeeUpdate(callback: (type: string, employee: any) => void) {
    this.ensureConnected();
    this.employeeUpdateCallbacks.push(callback);
    return () => {
      const index = this.employeeUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.employeeUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onLeaveUpdate(callback: (type: string, leave: any) => void) {
    this.ensureConnected();
    this.leaveUpdateCallbacks.push(callback);
    return () => {
      const index = this.leaveUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.leaveUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onAttendanceUpdate(callback: (attendance: any) => void) {
    this.ensureConnected();
    this.attendanceUpdateCallbacks.push(callback);
    return () => {
      const index = this.attendanceUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.attendanceUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onExpenseUpdate(callback: (type: string, expense: any) => void) {
    this.ensureConnected();
    this.expenseUpdateCallbacks.push(callback);
    return () => {
      const index = this.expenseUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.expenseUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onNotification(callback: (notification: any) => void) {
    this.ensureConnected();
    this.notificationCallbacks.push(callback);
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  onBreakStarted(callback: (data: any) => void) {
    this.ensureConnected();
    this.breakStartedCallbacks.push(callback);
    return () => {
      const index = this.breakStartedCallbacks.indexOf(callback);
      if (index > -1) {
        this.breakStartedCallbacks.splice(index, 1);
      }
    };
  }

  onBreakEnded(callback: (data: any) => void) {
    this.ensureConnected();
    this.breakEndedCallbacks.push(callback);
    return () => {
      const index = this.breakEndedCallbacks.indexOf(callback);
      if (index > -1) {
        this.breakEndedCallbacks.splice(index, 1);
      }
    };
  }

  onMeetingStarted(callback: (data: any) => void) {
    this.ensureConnected();
    this.meetingStartedCallbacks.push(callback);
    return () => {
      const index = this.meetingStartedCallbacks.indexOf(callback);
      if (index > -1) {
        this.meetingStartedCallbacks.splice(index, 1);
      }
    };
  }

  onMeetingEnded(callback: (data: any) => void) {
    this.ensureConnected();
    this.meetingEndedCallbacks.push(callback);
    return () => {
      const index = this.meetingEndedCallbacks.indexOf(callback);
      if (index > -1) {
        this.meetingEndedCallbacks.splice(index, 1);
      }
    };
  }

  onKPIUpdate(callback: (data: any) => void) {
    this.ensureConnected();
    this.kpiUpdateCallbacks.push(callback);
    return () => {
      const index = this.kpiUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.kpiUpdateCallbacks.splice(index, 1);
      }
    };
  }

  // Notification methods
  private notifyDashboardUpdate(data: any) {
    if (data == null || typeof data !== 'object') return;
    this.dashboardUpdateCallbacks.forEach(callback => callback(data));
  }

  private notifyActivityUpdate(activity: any) {
    if (activity == null || typeof activity !== 'object') return;
    this.activityUpdateCallbacks.forEach(callback => callback(activity));
  }

  private notifyEmployeeUpdate(type: string, employee: any) {
    if (typeof type !== 'string') return;
    this.employeeUpdateCallbacks.forEach(callback => callback(type, employee));
  }

  private notifyLeaveUpdate(type: string, leave: any) {
    if (typeof type !== 'string') return;
    this.leaveUpdateCallbacks.forEach(callback => callback(type, leave));
  }

  private notifyAttendanceUpdate(attendance: any) {
    if (attendance == null || typeof attendance !== 'object') return;
    this.attendanceUpdateCallbacks.forEach(callback => callback(attendance));
  }

  private notifyExpenseUpdate(type: string, expense: any) {
    if (typeof type !== 'string') return;
    this.expenseUpdateCallbacks.forEach(callback => callback(type, expense));
  }

  private notifySystemNotification(notification: any) {
    if (notification == null || typeof notification !== 'object') return;
    this.notificationCallbacks.forEach(callback => callback(notification));
  }

  private notifyBreakStarted(data: any) {
    if (data == null || typeof data !== 'object') return;
    this.breakStartedCallbacks.forEach(callback => callback(data));
  }

  private notifyBreakEnded(data: any) {
    if (data == null || typeof data !== 'object') return;
    this.breakEndedCallbacks.forEach(callback => callback(data));
  }

  private notifyMeetingStarted(data: any) {
    if (data == null || typeof data !== 'object') return;
    this.meetingStartedCallbacks.forEach(callback => callback(data));
  }

  private notifyMeetingEnded(data: any) {
    if (data == null || typeof data !== 'object') return;
    this.meetingEndedCallbacks.forEach(callback => callback(data));
  }

  private notifyKPIUpdate(data: any) {
    if (data == null || typeof data !== 'object') return;
    this.kpiUpdateCallbacks.forEach(callback => callback(data));
  }

  // Emit events to server
  emitDashboardRefresh(dashboardType: string) {
    this.ensureConnected();
    this.socket?.emit('dashboard_refresh_request', { dashboardType });
  }

  emitActivityLogRequest(filters: any) {
    this.ensureConnected();
    this.socket?.emit('activity_log_request', filters);
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Disconnect
  disconnect() {
    if (this.usesSharedSocket) {
      this.usesSharedSocket = false;
      this.socket = null;
      this.dashboardListenersReady = false;
      return;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.dashboardListenersReady = false;
  }

  // Get socket instance for custom events
  getSocket(): Socket | null {
    this.ensureConnected();
    return this.socket;
  }

  // Add .on() and .off() methods for compatibility (returns unsubscribe for useEffect cleanup)
  on(event: string, callback: (...args: any[]) => void): () => void {
    this.ensureConnected();
    if (this.socket) {
      this.socket.on(event, callback);
    }
    return () => {
      if (this.socket) {
        this.socket.off(event, callback);
      }
    };
  }

  off(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// Create singleton instance
const realTimeSocket = new RealTimeSocket();

export default realTimeSocket;