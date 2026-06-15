import type { Socket } from 'socket.io-client';
import { TokenManager } from './api';
import { socketService } from './socket';
import { authUserKey } from './safeUi';

class RealTimeSocket {
  private socket: Socket | null = null;
  private usesSharedSocket = false;
  private dashboardListenersReady = false;
  private sharedAttachTimer: ReturnType<typeof setInterval> | null = null;
  /** Handlers registered on the shared socket — removed individually on teardown */
  private dashboardSocketHandlers = new Map<string, (...args: unknown[]) => void>();

  constructor() {
    // Don't connect immediately - wait for user to be available
    // Connection will be triggered when needed
  }

  private authUser: { id: string; role: string; orgId?: string; tenantId?: string } | null = null;

  /**
   * Connect using authenticated user from AuthContext (TokenManager.getUser is not populated).
   */
  connectFromAuth(user: {
    id?: string;
    userId?: string;
    role: string;
    orgId?: string;
    tenantId?: string;
  }) {
    const id = authUserKey(user);
    if (!id) return;
    const normalized = {
      id,
      role: user.role,
      orgId: user.orgId,
      tenantId: user.tenantId,
    };
    this.authUser = normalized;

    const tryAttachShared = (): boolean => {
      const shared = socketService.getSocket();
      if (socketService.isConnected() && shared) {
        this.attachSharedSocket(shared, normalized);
        return true;
      }
      return false;
    };

    if (tryAttachShared()) return;

    if (this.sharedAttachTimer) {
      clearInterval(this.sharedAttachTimer);
    }
    let attempts = 0;
    this.sharedAttachTimer = setInterval(() => {
      attempts += 1;
      if (tryAttachShared() || attempts >= 75) {
        if (this.sharedAttachTimer) {
          clearInterval(this.sharedAttachTimer);
          this.sharedAttachTimer = null;
        }
      }
    }, 200);
  }

  private disconnectPrivateSocket() {
    if (this.socket && !this.usesSharedSocket) {
      this.teardownDashboardListeners();
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private attachSharedSocket(socket: Socket, user: { id: string; role: string; orgId?: string; tenantId?: string }) {
    if (this.sharedAttachTimer) {
      clearInterval(this.sharedAttachTimer);
      this.sharedAttachTimer = null;
    }
    // New Socket.IO instance (reconnect / new session): drop old handlers so we do not leak on the dead socket
    if (this.socket && this.socket !== socket) {
      this.teardownDashboardListeners();
    }
    this.disconnectPrivateSocket();
    this.usesSharedSocket = true;
    this.socket = socket;
    this.authUser = user;
    if (!this.dashboardListenersReady) {
      this.setupDashboardListeners();
    }
  }

  /**
   * Lazy connect - only connect when user data is available
   */
  private ensureConnected() {
    if (this.socket?.connected) {
      return;
    }

    const user = this.authUser || TokenManager.getUser();
    const id = authUserKey(
      user as { id?: string; userId?: string } | null | undefined
    );
    if (!id) {
      return;
    }

    const shared = socketService.getSocket();
    if (socketService.isConnected() && shared) {
      this.attachSharedSocket(shared, {
        id,
        role: (user as { role: string }).role,
        orgId: (user as { orgId?: string }).orgId,
        tenantId: (user as { tenantId?: string }).tenantId,
      });
      return;
    }

    if (!this.authUser) {
      this.connectFromAuth(
        user as {
          id?: string;
          userId?: string;
          role: string;
          orgId?: string;
          tenantId?: string;
        }
      );
    }
  }

  private teardownDashboardListeners() {
    if (!this.socket) return;
    this.dashboardSocketHandlers.forEach((handler, event) => {
      this.socket?.off(event, handler);
    });
    this.dashboardSocketHandlers.clear();
    this.dashboardListenersReady = false;
  }

  private bindDashboardEvent(event: string, handler: (...args: unknown[]) => void) {
    if (!this.socket) return;
    const existing = this.dashboardSocketHandlers.get(event);
    if (existing) {
      this.socket.off(event, existing);
    }
    this.dashboardSocketHandlers.set(event, handler);
    this.socket.on(event, handler);
  }

  private setupDashboardListeners() {
    if (!this.socket || this.dashboardListenersReady) return;

    // Dashboard data updates
    this.bindDashboardEvent('dashboard_update', (data) => {
      console.log('📊 Dashboard update received:', data);
      this.notifyDashboardUpdate(data);
    });

    // Activity feed updates
    this.bindDashboardEvent('activity_update', (activity) => {
      console.log('📝 Activity update received:', activity);
      this.notifyActivityUpdate(activity);
    });

    this.bindDashboardEvent('activity:update', (payload) => {
      const activity = (payload as { activity?: unknown })?.activity ?? payload;
      this.notifyActivityUpdate(activity);
    });

    // Employee updates
    this.bindDashboardEvent('employee_created', (employee) => {
      console.log('👤 Employee created:', employee);
      this.notifyEmployeeUpdate('created', employee);
    });

    this.bindDashboardEvent('employee_updated', (employee) => {
      console.log('👤 Employee updated:', employee);
      this.notifyEmployeeUpdate('updated', employee);
    });

    // Leave request updates
    this.bindDashboardEvent('leave_created', (leave) => {
      console.log('📅 Leave request created:', leave);
      this.notifyLeaveUpdate('created', leave);
    });

    this.bindDashboardEvent('leave_updated', (leave) => {
      console.log('📅 Leave request updated:', leave);
      this.notifyLeaveUpdate('updated', leave);
    });

    this.bindDashboardEvent('leave:update', (data) => {
      console.log('📅 Leave update event:', data);
      const d = data as { action?: string; leaveRequest?: unknown };
      this.notifyLeaveUpdate(d.action || 'updated', d.leaveRequest);
    });

    this.bindDashboardEvent('leave_allocation_created', (data) => {
      console.log('📅 Leave allocation created:', data);
      const d = data as { leave?: unknown };
      this.notifyLeaveUpdate('allocation_created', d?.leave || data);
    });

    // Expense updates
    this.bindDashboardEvent('expense:created', (expense) => {
      console.log('💰 Expense created:', expense);
      this.notifyExpenseUpdate('created', expense);
    });

    this.bindDashboardEvent('expense:updated', (expense) => {
      console.log('💰 Expense updated:', expense);
      this.notifyExpenseUpdate('updated', expense);
    });

    this.bindDashboardEvent('expense:deleted', (expense) => {
      console.log('💰 Expense deleted:', expense);
      this.notifyExpenseUpdate('deleted', expense);
    });

    // Attendance updates
    this.bindDashboardEvent('attendance:update', (data) => {
      console.log('⏰ Attendance update received:', data);
      const d = data as { attendance?: unknown };
      this.notifyAttendanceUpdate(d.attendance || data);
    });

    // Check-in updates
    this.bindDashboardEvent('attendance:checked_in', (data) => {
      console.log('🔓 [SOCKET] Employee checked in:', data);
      this.notifyAttendanceUpdate({ type: 'checked_in', ...(data as object) });
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'checked_in', data });
    });

    // System notifications
    this.bindDashboardEvent('notification', (notification) => {
      console.log('🔔 Notification received:', notification);
      this.notifySystemNotification(notification);
    });

    // Break updates
    this.bindDashboardEvent('break:started', (data) => {
      console.log('☕ [SOCKET] Break started:', data);
      this.notifyBreakStarted(data);
      this.notifyAttendanceUpdate({ type: 'break_started', ...(data as object) });
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'break_started', data });
    });

    this.bindDashboardEvent('break:ended', (data) => {
      console.log('☕ [SOCKET] Break ended:', data);
      this.notifyBreakEnded(data);
      this.notifyAttendanceUpdate({ type: 'break_ended', ...(data as object) });
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'break_ended', data });
    });

    // Meeting updates
    this.bindDashboardEvent('meeting:started', (data) => {
      console.log('📞 [SOCKET] Meeting started:', data);
      this.notifyMeetingStarted(data);
      this.notifyAttendanceUpdate({ type: 'meeting_started', ...(data as object) });
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'meeting_started', data });
    });

    this.bindDashboardEvent('meeting:ended', (data) => {
      console.log('📞 [SOCKET] Meeting ended:', data);
      this.notifyMeetingEnded(data);
      this.notifyAttendanceUpdate({ type: 'meeting_ended', ...(data as object) });
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'meeting_ended', data });
    });

    // Check-out updates
    this.bindDashboardEvent('attendance:checked_out', (data) => {
      console.log('🚪 [SOCKET] Employee checked out:', data);
      this.notifyAttendanceUpdate({ type: 'checked_out', ...(data as object) });
      this.notifyDashboardUpdate({ type: 'dashboard_refresh', reason: 'checked_out', data });
    });

    // KPI updates
    this.bindDashboardEvent('kpi:update', (data) => {
      console.log('📊 [SOCKET] KPI update event received from server:', data);
      this.notifyKPIUpdate(data);
      this.notifyDashboardUpdate({ type: 'kpi_update', data });
    });

    this.bindDashboardEvent('holiday:update', () => {
      this.notifyDashboardUpdate({ type: 'holiday_refresh' });
    });

    this.dashboardListenersReady = true;
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
    if (this.sharedAttachTimer) {
      clearInterval(this.sharedAttachTimer);
      this.sharedAttachTimer = null;
    }
    this.dashboardUpdateCallbacks = [];
    this.activityUpdateCallbacks = [];
    this.employeeUpdateCallbacks = [];
    this.leaveUpdateCallbacks = [];
    this.attendanceUpdateCallbacks = [];
    this.expenseUpdateCallbacks = [];
    this.notificationCallbacks = [];
    this.breakStartedCallbacks = [];
    this.breakEndedCallbacks = [];
    this.meetingStartedCallbacks = [];
    this.meetingEndedCallbacks = [];
    this.kpiUpdateCallbacks = [];
    if (this.usesSharedSocket) {
      this.teardownDashboardListeners();
      this.usesSharedSocket = false;
      this.socket = null;
      return;
    }
    if (this.socket) {
      this.teardownDashboardListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Get socket instance for custom events
  getSocket(): Socket | null {
    this.ensureConnected();
    return this.socket;
  }

  // Add .on() and .off() methods for compatibility (returns unsubscribe for useEffect cleanup)
  on(event: string, callback: (...args: any[]) => void): () => void {
    this.ensureConnected();

    let attachedSocket: Socket | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryRegister = () => {
      if (attachedSocket) return;
      const s: Socket | null =
        (this.socket?.connected ? this.socket : null) ||
        (socketService.isConnected() ? socketService.getSocket() : null);
      if (s?.connected) {
        s.on(event, callback);
        attachedSocket = s;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };

    tryRegister();

    if (!attachedSocket) {
      intervalId = setInterval(tryRegister, 200);
      timeoutId = setTimeout(() => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (attachedSocket) {
        attachedSocket.off(event, callback);
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