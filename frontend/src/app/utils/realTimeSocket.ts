import { io, Socket } from 'socket.io-client';
import { TokenManager } from './api';

class RealTimeSocket {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  private connect() {
    const user = TokenManager.getUser();
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    if (!user?.id) {
      console.warn('No user data found for socket connection');
      return;
    }

    if (!token) {
      console.warn('No JWT token found for socket connection');
      return;
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
        token: token
      },
      withCredentials: true
    });

    // Handle connection
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
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
    });

    // Handle disconnection
    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    // Handle connection errors
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.handleReconnect();
    });

    // Set up dashboard update listeners
    this.setupDashboardListeners();
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.socket?.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
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

    // KPI updates
    this.socket.on('kpi:update', (data) => {
      console.log('📊 [SOCKET] KPI update event received from server:', data);
      console.log('📊 [SOCKET] Full data structure:', JSON.stringify(data, null, 2));
      console.log('📊 [SOCKET] KPI onBreak value:', data?.kpis?.onBreak);
      console.log('📊 [SOCKET] KPI activeUsers value:', data?.kpis?.activeUsers);
      
      // Notify dashboard with the KPI data
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

  // Public methods to subscribe to updates
  onDashboardUpdate(callback: (data: any) => void) {
    this.dashboardUpdateCallbacks.push(callback);
    return () => {
      const index = this.dashboardUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.dashboardUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onActivityUpdate(callback: (activity: any) => void) {
    this.activityUpdateCallbacks.push(callback);
    return () => {
      const index = this.activityUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.activityUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onEmployeeUpdate(callback: (type: string, employee: any) => void) {
    this.employeeUpdateCallbacks.push(callback);
    return () => {
      const index = this.employeeUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.employeeUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onLeaveUpdate(callback: (type: string, leave: any) => void) {
    this.leaveUpdateCallbacks.push(callback);
    return () => {
      const index = this.leaveUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.leaveUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onAttendanceUpdate(callback: (attendance: any) => void) {
    this.attendanceUpdateCallbacks.push(callback);
    return () => {
      const index = this.attendanceUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.attendanceUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onExpenseUpdate(callback: (type: string, expense: any) => void) {
    this.expenseUpdateCallbacks.push(callback);
    return () => {
      const index = this.expenseUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.expenseUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onNotification(callback: (notification: any) => void) {
    this.notificationCallbacks.push(callback);
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  onBreakStarted(callback: (data: any) => void) {
    this.breakStartedCallbacks.push(callback);
    return () => {
      const index = this.breakStartedCallbacks.indexOf(callback);
      if (index > -1) {
        this.breakStartedCallbacks.splice(index, 1);
      }
    };
  }

  onBreakEnded(callback: (data: any) => void) {
    this.breakEndedCallbacks.push(callback);
    return () => {
      const index = this.breakEndedCallbacks.indexOf(callback);
      if (index > -1) {
        this.breakEndedCallbacks.splice(index, 1);
      }
    };
  }

  onMeetingStarted(callback: (data: any) => void) {
    this.meetingStartedCallbacks.push(callback);
    return () => {
      const index = this.meetingStartedCallbacks.indexOf(callback);
      if (index > -1) {
        this.meetingStartedCallbacks.splice(index, 1);
      }
    };
  }

  onMeetingEnded(callback: (data: any) => void) {
    this.meetingEndedCallbacks.push(callback);
    return () => {
      const index = this.meetingEndedCallbacks.indexOf(callback);
      if (index > -1) {
        this.meetingEndedCallbacks.splice(index, 1);
      }
    };
  }

  // Notification methods
  private notifyDashboardUpdate(data: any) {
    this.dashboardUpdateCallbacks.forEach(callback => callback(data));
  }

  private notifyActivityUpdate(activity: any) {
    this.activityUpdateCallbacks.forEach(callback => callback(activity));
  }

  private notifyEmployeeUpdate(type: string, employee: any) {
    this.employeeUpdateCallbacks.forEach(callback => callback(type, employee));
  }

  private notifyLeaveUpdate(type: string, leave: any) {
    this.leaveUpdateCallbacks.forEach(callback => callback(type, leave));
  }

  private notifyAttendanceUpdate(attendance: any) {
    this.attendanceUpdateCallbacks.forEach(callback => callback(attendance));
  }

  private notifyExpenseUpdate(type: string, expense: any) {
    this.expenseUpdateCallbacks.forEach(callback => callback(type, expense));
  }

  private notifySystemNotification(notification: any) {
    this.notificationCallbacks.forEach(callback => callback(notification));
  }

  private notifyBreakStarted(data: any) {
    this.breakStartedCallbacks.forEach(callback => callback(data));
  }

  private notifyBreakEnded(data: any) {
    this.breakEndedCallbacks.forEach(callback => callback(data));
  }

  private notifyMeetingStarted(data: any) {
    this.meetingStartedCallbacks.forEach(callback => callback(data));
  }

  private notifyMeetingEnded(data: any) {
    this.meetingEndedCallbacks.forEach(callback => callback(data));
  }

  // Emit events to server
  emitDashboardRefresh(dashboardType: string) {
    this.socket?.emit('dashboard_refresh_request', { dashboardType });
  }

  emitActivityLogRequest(filters: any) {
    this.socket?.emit('activity_log_request', filters);
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Get socket instance for custom events
  getSocket(): Socket | null {
    return this.socket;
  }

  // Add .on() and .off() methods for compatibility
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
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