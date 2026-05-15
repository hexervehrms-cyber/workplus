import { useEffect, useCallback, useRef } from 'react';
import realTimeSocket from '../utils/realTimeSocket';

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

  const handleDashboardUpdate = useCallback((data: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: data.type || 'stats',
        component: data.component || 'unknown',
        data: data.data,
        timestamp: new Date(data.timestamp || Date.now())
      };

      onUpdate?.(updateData);
    } catch (error) {
      console.error('Error handling dashboard update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  const handleActivityUpdate = useCallback((activity: any) => {
    try {
      onActivity?.(activity);
    } catch (error) {
      console.error('Error handling activity update:', error);
      onError?.(error);
    }
  }, [onActivity, onError]);

  const handleEmployeeUpdate = useCallback((type: string, employee: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: 'table',
        component: 'employees',
        data: { type, employee },
        timestamp: new Date()
      };

      onUpdate?.(updateData);
    } catch (error) {
      console.error('Error handling employee update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  const handleLeaveUpdate = useCallback((type: string, leave: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: 'table',
        component: 'leave_requests',
        data: { type, leave },
        timestamp: new Date()
      };

      onUpdate?.(updateData);
    } catch (error) {
      console.error('Error handling leave update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  const handleAttendanceUpdate = useCallback((attendance: any) => {
    try {
      const updateData: DashboardUpdateData = {
        type: 'stats',
        component: 'attendance',
        data: attendance,
        timestamp: new Date()
      };

      onUpdate?.(updateData);
    } catch (error) {
      console.error('Error handling attendance update:', error);
      onError?.(error);
    }
  }, [onUpdate, onError]);

  const requestRefresh = useCallback(() => {
    realTimeSocket.emitDashboardRefresh(dashboardType);
  }, [dashboardType]);

  const isConnected = useCallback(() => {
    return realTimeSocket.isConnected();
  }, []);

  useEffect(() => {
    const unsubscribeDashboard = realTimeSocket.onDashboardUpdate(handleDashboardUpdate);
    const unsubscribeActivity = realTimeSocket.onActivityUpdate(handleActivityUpdate);
    const unsubscribeEmployee = realTimeSocket.onEmployeeUpdate(handleEmployeeUpdate);
    const unsubscribeLeave = realTimeSocket.onLeaveUpdate(handleLeaveUpdate);
    const unsubscribeAttendance = realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);

    unsubscribeCallbacks.current = [
      unsubscribeDashboard,
      unsubscribeActivity,
      unsubscribeEmployee,
      unsubscribeLeave,
      unsubscribeAttendance
    ];

    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        requestRefresh();
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

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
