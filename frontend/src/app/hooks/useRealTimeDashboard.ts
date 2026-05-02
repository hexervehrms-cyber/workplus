import { useEffect, useCallback, useRef } from 'react';
import realTimeSocket from '../utils/realTimeSocket';
import { toast } from 'sonner';

interface DashboardUpdateData {
  type: 'stats' | 'chart' | 'table' | 'activity';
  component: string;
  data: any;
  timestamp: Date;
}

interface UseRealTimeDashboardOptions {
  dashboardType: 'superadmin' | 'admin' | 'employee';
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  onUpdate?: (data: DashboardUpdateData) => void;
  onActivity?: (activity: any) => void;
  onError?: (error: any) => void;
}

export const useRealTimeDashboard = (options: UseRealTimeDashboardOptions) => {
  const {
    dashboardType,
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes default
    onUpdate,
    onActivity,
    onError
  } = options;

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeCallbacks = useRef<(() => void)[]>([]);

  // Handle dashboard updates
  const handleDashboardUpdate = useCallback((data: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: data.type || 'stats',
        component: data.component || 'unknown',
        data: data.data,
        timestamp: new Date(data.timestamp || Date.now())
      };

      onUpdate?.(updateData);
      
      // Show toast notification for important updates
      if (data.type === 'stats' && data.component === 'kpi') {
        toast.success('Dashboard data updated', {
          description: 'Latest metrics have been refreshed',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Error handling dashboard update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  // Handle activity updates
  const handleActivityUpdate = useCallback((activity: any) => {
    try {
      onActivity?.(activity);
      
      // Show toast for high-priority activities
      if (activity.severity === 'high' || activity.severity === 'critical') {
        toast.info('New activity', {
          description: activity.description || 'New system activity recorded',
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Error handling activity update:', error);
      onError?.(error);
    }
  }, [onActivity, onError]);

  // Handle employee updates
  const handleEmployeeUpdate = useCallback((type: string, employee: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: 'table',
        component: 'employees',
        data: { type, employee },
        timestamp: new Date()
      };

      onUpdate?.(updateData);

      // Show notification for employee changes
      if (type === 'created') {
        toast.success('New employee added', {
          description: `${employee.name} has been added to the system`,
          duration: 4000
        });
      } else if (type === 'updated') {
        toast.info('Employee updated', {
          description: `${employee.name}'s information has been updated`,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Error handling employee update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  // Handle leave request updates
  const handleLeaveUpdate = useCallback((type: string, leave: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: 'table',
        component: 'leave_requests',
        data: { type, leave },
        timestamp: new Date()
      };

      onUpdate?.(updateData);

      // Show notification for leave request changes
      if (type === 'created') {
        toast.info('New leave request', {
          description: `${leave.employeeName} has applied for leave`,
          duration: 4000
        });
      } else if (type === 'updated') {
        toast.success('Leave request updated', {
          description: `Leave request status changed to ${leave.status}`,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Error handling leave update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  // Handle attendance updates
  const handleAttendanceUpdate = useCallback((attendance: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: 'stats',
        component: 'attendance',
        data: attendance,
        timestamp: new Date()
      };

      onUpdate?.(updateData);

      // Only show notifications for admin/superadmin dashboards
      if (dashboardType !== 'employee') {
        toast.info('Attendance updated', {
          description: `${attendance.employeeName} ${attendance.type === 'checkin' ? 'checked in' : 'checked out'}`,
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error handling attendance update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError, dashboardType]);

  // Request dashboard refresh
  const requestRefresh = useCallback(() => {
    realTimeSocket.emitDashboardRefresh(dashboardType);
  }, [dashboardType]);

  // Check connection status
  const isConnected = useCallback(() => {
    return realTimeSocket.isConnected();
  }, []);

  // Setup real-time subscriptions
  useEffect(() => {
    // Subscribe to real-time updates
    const unsubscribeDashboard = realTimeSocket.onDashboardUpdate(handleDashboardUpdate);
    const unsubscribeActivity = realTimeSocket.onActivityUpdate(handleActivityUpdate);
    const unsubscribeEmployee = realTimeSocket.onEmployeeUpdate(handleEmployeeUpdate);
    const unsubscribeLeave = realTimeSocket.onLeaveUpdate(handleLeaveUpdate);
    const unsubscribeAttendance = realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);

    // Store unsubscribe callbacks
    unsubscribeCallbacks.current = [
      unsubscribeDashboard,
      unsubscribeActivity,
      unsubscribeEmployee,
      unsubscribeLeave,
      unsubscribeAttendance
    ];

    // Setup auto-refresh if enabled
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        requestRefresh();
      }, refreshInterval);
    }

    // Cleanup function
    return () => {
      // Clear interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      // Unsubscribe from all events
      unsubscribeCallbacks.current.forEach(unsubscribe => unsubscribe());
      unsubscribeCallbacks.current = [];
    };
  }, [
    handleDashboardUpdate,
    handleActivityUpdate,
    handleEmployeeUpdate,
    handleLeaveUpdate,
    handleAttendanceUpdate,
    autoRefresh,
    refreshInterval,
    requestRefresh
  ]);

  return {
    requestRefresh,
    isConnected,
    socket: realTimeSocket.getSocket()
  };
};

export default useRealTimeDashboard;