import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KPICard } from '../../components/KPICard';
import InteractiveCalendar from '../../components/InteractiveCalendar';
import ChatWidget from '../../components/ChatWidget';
import LoadingProgressBar from '../../components/LoadingProgressBar';
import { useAuth } from '../../context/AuthContext';
import { apiGet, buildApiUrl } from '../../utils/apiHelper';
import realTimeSocket from '../../utils/realTimeSocket';
import { useAttendance } from '../../../context/AttendanceContext';
import {
  Calendar,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

// ============================================================================
// ATTENDANCE STATE MACHINE - Deterministic state transitions
// ============================================================================
type AttendanceUIState = 'IDLE' | 'WORKING' | 'ON_BREAK' | 'IN_MEETING' | 'SYNCING' | 'CHECKING_OUT';

// ============================================================================
// ENTERPRISE SYNC CONFIGURATION
// ============================================================================
const SYNC_CONFIG = {
  STALE_PROTECTION_MS: 5000,
  SOCKET_PROTECTION_MS: 3000,
  REFRESH_COOLDOWN_MS: 4000,
  DEBOUNCE_MS: 1000,
  SOCKET_WAIT_MS: 1500,
  DB_SYNC_WAIT_MS: 2000,
  PERIODIC_REFRESH_MS: 30000,
  ACTION_TIMEOUT_MS: 8000
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { attendance: todayAttendance, updateAttendance } = useAttendance();
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // ============================================================================
  // CRITICAL STATE VARIABLES - Enterprise sync management
  // ============================================================================
  const [lastSocketEventTime, setLastSocketEventTime] = useState(0);
  const [disableRefresh, setDisableRefresh] = useState(false);

  // Refs for realtime values (prevent stale closures)
  const employeeIdRef = useRef<string | null>(null);
  const lastActionTimeRef = useRef(0);
  const lastSocketEventTimeRef = useRef(0);
  const disableRefreshRef = useRef(false);
  const actionInProgressRef = useRef(false);

  // Update refs whenever state changes
  useEffect(() => {
    employeeIdRef.current = employeeId;
  }, [employeeId]);

  useEffect(() => {
    lastSocketEventTimeRef.current = lastSocketEventTime;
  }, [lastSocketEventTime]);

  useEffect(() => {
    disableRefreshRef.current = disableRefresh;
  }, [disableRefresh]);

  const [kpiMetrics, setKpiMetrics] = useState({
    leaveBalance: "0 days",
    hoursThisWeek: "0h",
    performance: "0%"
  });

  const [holidays, setHolidays] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [breakHistory, setBreakHistory] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const attendanceCacheKey = `employee_attendance_state_${user?.id || 'unknown'}`;

  const getTodayKey = () => new Date().toDateString();

  // ============================================================================
  // DERIVED UI STATE - Computed from attendance state
  // ============================================================================
  const attendanceUIState = useMemo((): AttendanceUIState => {
    if (!todayAttendance.isCheckedIn) return 'IDLE';
    if (todayAttendance.isInMeeting) return 'IN_MEETING';
    if (todayAttendance.isOnBreak) return 'ON_BREAK';
    return 'WORKING';
  }, [todayAttendance.isCheckedIn, todayAttendance.isOnBreak, todayAttendance.isInMeeting]);

  // Debug: Log todayAttendance changes
  useEffect(() => {
    console.group('[ATTENDANCE STATE]');
    console.log('🔍 [DASHBOARD] todayAttendance changed:', {
      isOnBreak: todayAttendance.isOnBreak,
      isInMeeting: todayAttendance.isInMeeting,
      isCheckedIn: todayAttendance.isCheckedIn,
      breakType: todayAttendance.breakType,
      uiState: attendanceUIState
    });
    console.log('⏱️ Sync timing:', {
      lastSocketEventTime,
      timeSinceSocket: Date.now() - lastSocketEventTime
    });
    console.groupEnd();
  }, [todayAttendance, attendanceUIState, lastSocketEventTime]);

  // ============================================================================
  // STALE PROTECTION LOGIC
  // ============================================================================
  const isRecentlyUpdated = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceAction = now - lastActionTimeRef.current;
    const timeSinceSocket = now - lastSocketEventTimeRef.current;

    const recentAction = timeSinceAction < SYNC_CONFIG.STALE_PROTECTION_MS;
    const recentSocket = timeSinceSocket < SYNC_CONFIG.SOCKET_PROTECTION_MS;

    if (recentAction || recentSocket) {
      console.log('🛡️ [STALE PROTECTION] Blocking refresh:', {
        recentAction,
        recentSocket,
        timeSinceAction,
        timeSinceSocket
      });
      return true;
    }
    return false;
  }, []);

  // ============================================================================
  // SAFE REFRESH SYSTEM - Centralized refresh controller
  // ============================================================================
  const safeRefresh = useCallback(async (forceRefresh = false) => {
    if (disableRefreshRef.current && !forceRefresh) {
      console.log('⏸️ [SAFE REFRESH] Refresh disabled, skipping');
      return;
    }

    if (isRecentlyUpdated() && !forceRefresh) {
      console.log('⏸️ [SAFE REFRESH] Recently updated, skipping');
      return;
    }

    // FIX #3: Don't refresh if an action is currently in progress
    if (actionInProgressRef.current) {
      console.log('⏸️ [SAFE REFRESH] Action in progress, skipping to avoid overwriting optimistic state');
      return;
    }

    console.log('🔄 [SAFE REFRESH] Starting safe refresh');
    setDisableRefresh(true);

    try {
      await fetchDashboardData(forceRefresh);
    } finally {
      setTimeout(() => {
        setDisableRefresh(false);
      }, SYNC_CONFIG.REFRESH_COOLDOWN_MS);
    }
  }, [isRecentlyUpdated]);

  // Helper function to fetch employee ID
  const ensureEmployeeId = async (): Promise<string | null> => {
    if (employeeIdRef.current) return employeeIdRef.current;

    if (!user?.id) return null;
    if (user?.employeeId) {
      setEmployeeId(user.employeeId);
      return user.employeeId;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(buildApiUrl(`/employees/user/${user.id}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data?._id) {
          setEmployeeId(result.data._id);
          return result.data._id;
        }
      }
    } catch (err) {
      console.error('Error fetching employee data:', err);
    }

    return null;
  };

  // ============================================================================
  // FETCH DASHBOARD DATA - With stale protection
  // ============================================================================
  // FIX #6: Added updateAttendance to useCallback deps
  const fetchDashboardData = useCallback(async (_forceRefresh = false) => {
    if (!user) return;

    if (!_forceRefresh && isRecentlyUpdated()) {
      console.log('⏸️ [FETCH] Skipping due to recent update');
      return;
    }

    // FIX #2: Use ref (not state) to read live actionInProgress value
    if (!_forceRefresh && actionInProgressRef.current) {
      console.log('⏸️ [FETCH] Skipping because action is in progress');
      return;
    }

    try {
      setLoading(true);

      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, SYNC_CONFIG.ACTION_TIMEOUT_MS);

      console.group('[FETCH DASHBOARD]');
      console.log('⚡ Fetching all dashboard data in parallel...');

      const [attendanceResult, holidaysResult] = await Promise.allSettled([
        apiGet('/attendance/today'),
        apiGet('/holidays')
      ]);

      clearTimeout(timeoutId);

      const cachedHolidays = localStorage.getItem('cached_holidays');
      if (cachedHolidays) {
        try {
          const parsed = JSON.parse(cachedHolidays);
          setHolidays(parsed);
        } catch (e) {
          console.warn('Failed to parse cached holidays');
        }
      }

      if (holidaysResult.status === 'fulfilled' && holidaysResult.value?.success && Array.isArray(holidaysResult.value.data)) {
        console.log('✅ Loaded', holidaysResult.value.data.length, 'holidays');
        setHolidays(holidaysResult.value.data);
        localStorage.setItem('cached_holidays', JSON.stringify(holidaysResult.value.data));
      } else if (cachedHolidays) {
        try {
          const parsed = JSON.parse(cachedHolidays);
          console.log('📦 Using cached holidays:', parsed.length);
          setHolidays(parsed);
        } catch (e) {
          console.warn('Failed to parse cached holidays');
        }
      }

      console.log('📊 Attendance API Result:', {
        status: attendanceResult.status,
        success: attendanceResult.status === 'fulfilled' ? attendanceResult.value?.success : false,
        hasData: attendanceResult.status === 'fulfilled' ? !!attendanceResult.value?.data : false,
        error: attendanceResult.status === 'rejected' ? attendanceResult.reason?.message : undefined
      });

      const attendanceData = attendanceResult.status === 'fulfilled' && attendanceResult.value?.success
        ? attendanceResult.value.data
        : null;

      if (attendanceData?.attendance) {
        const attendance = attendanceData.attendance;
        const checkInTime = attendance.checkIn
          ? new Date(attendance.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;
        const checkOutTime = attendance.checkOut
          ? new Date(attendance.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;

        const isCurrentlyCheckedIn = !!attendance.checkIn && !attendance.checkOut;

        let calculatedIsOnBreak = false;
        let calculatedBreakType = 'regular';
        let calculatedBreakDuration = 0;

        if (attendance.breaks && attendance.breaks.length > 0) {
          const lastBreak = attendance.breaks[attendance.breaks.length - 1];
          if (lastBreak.startTime && !lastBreak.endTime) {
            calculatedIsOnBreak = true;
            calculatedBreakType = lastBreak.breakType || 'regular';
            const breakStart = new Date(lastBreak.startTime).getTime();
            const now = new Date().getTime();
            calculatedBreakDuration = Math.round((now - breakStart) / (1000 * 60));
          }
        }

        console.log('✅ Updating attendance from API:', {
          isCheckedIn: isCurrentlyCheckedIn,
          isOnBreak: calculatedIsOnBreak,
          breakType: calculatedBreakType
        });

        updateAttendance({
          isCheckedIn: isCurrentlyCheckedIn,
          checkInTime: checkInTime,
          checkOutTime: checkOutTime,
          hoursWorked: attendance.hoursWorked || 0,
          status: attendance.status || 'absent',
          isOnBreak: calculatedIsOnBreak,
          isInMeeting: attendanceData.liveStatus?.isInMeeting || false,
          currentBreakDuration: calculatedBreakDuration,
          breakType: calculatedBreakType
        });

        const today = getTodayKey();
        const stateToSave = {
          isCheckedIn: isCurrentlyCheckedIn,
          checkedIn: isCurrentlyCheckedIn,
          checkInTime,
          checkOutTime,
          hoursWorked: attendance.hoursWorked || 0,
          currentHours: attendance.hoursWorked || 0,
          status: attendance.status || 'absent',
          isOnBreak: calculatedIsOnBreak,
          isInMeeting: attendanceData.liveStatus?.isInMeeting || false,
          currentBreakDuration: calculatedBreakDuration,
          breakType: calculatedBreakType,
          timestamp: Date.now()
        };
        localStorage.setItem(`checkedIn_${today}`, JSON.stringify(stateToSave));
        localStorage.setItem(attendanceCacheKey, JSON.stringify(stateToSave));
      } else {
        console.log('ℹ️ No attendance record for today - showing Log In button');
        if (attendanceResult.status === 'rejected') {
          console.error('❌ Attendance API Error:', attendanceResult.reason);
        }

        // FIX #2: Use ref here so we don't read a stale closure value
        if (!actionInProgressRef.current) {
          updateAttendance({
            isCheckedIn: false,
            checkInTime: null,
            checkOutTime: null,
            hoursWorked: 0,
            status: 'absent',
            isOnBreak: false,
            isInMeeting: false,
            currentBreakDuration: 0,
            breakType: 'regular'
          });

          const today = getTodayKey();
          localStorage.removeItem(`checkedIn_${today}`);
          localStorage.removeItem(attendanceCacheKey);
        }
      }

      setKpiMetrics({
        leaveBalance: "12 days",
        hoursThisWeek: `${attendanceData?.liveStatus?.currentHours || 0}h`,
        performance: "85%"
      });

      console.groupEnd();
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  // FIX #6: updateAttendance added to deps
  }, [user, attendanceCacheKey, isRecentlyUpdated, updateAttendance]);

  // Fetch data on mount with force refresh
  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Fetch employee ID on mount
  useEffect(() => {
    ensureEmployeeId();
  }, [user?.id]);

  // ============================================================================
  // SOCKET.IO LISTENERS
  // FIX #5: Cleanup now actually removes all listeners
  // ============================================================================
  useEffect(() => {
    if (!user?.orgId) return;

    console.group('[SOCKET LISTENERS SETUP]');
    console.log('📡 [EMPLOYEE-DASHBOARD] Setting up Socket.IO listeners');

    const handleBreakStarted = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] break:started event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break started for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isOnBreak: true,
          breakType: data.breakType || 'regular',
          currentBreakDuration: 0
        });
      }
    };

    const handleBreakEnded = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] break:ended event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break ended for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular'
        });
      }
    };

    const handleMeetingStarted = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] meeting:started event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Meeting started for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({ isInMeeting: true });
      }
    };

    const handleMeetingEnded = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] meeting:ended event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Meeting ended for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({ isInMeeting: false });
      }
    };

    const handleCheckedIn = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] attendance:checked_in event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Check-in for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isCheckedIn: true,
          checkInTime: data.checkInTime
            ? new Date(data.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : null
        });
      }
    };

    const handleCheckedOut = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] attendance:checked_out event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Check-out for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isCheckedIn: false,
          checkOutTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          hoursWorked: data.hoursWorked || 0,
          isOnBreak: false,
          isInMeeting: false
        });
      }
    };

    realTimeSocket.onBreakStarted(handleBreakStarted);
    realTimeSocket.onBreakEnded(handleBreakEnded);
    realTimeSocket.onMeetingStarted(handleMeetingStarted);
    realTimeSocket.onMeetingEnded(handleMeetingEnded);
    realTimeSocket.on('attendance:checked_in', handleCheckedIn);
    realTimeSocket.on('attendance:checked_out', handleCheckedOut);

    console.groupEnd();

    // FIX #5: Actually clean up all listeners on unmount
    return () => {
      console.log('📡 [EMPLOYEE-DASHBOARD] Cleaning up Socket.IO listeners');
      realTimeSocket.off('break:started', handleBreakStarted);
      realTimeSocket.off('break:ended', handleBreakEnded);
      realTimeSocket.off('meeting:started', handleMeetingStarted);
      realTimeSocket.off('meeting:ended', handleMeetingEnded);
      realTimeSocket.off('attendance:checked_in', handleCheckedIn);
      realTimeSocket.off('attendance:checked_out', handleCheckedOut);
    };
  }, [user?.orgId, updateAttendance]);

  // Fetch attendance history
  const fetchAttendanceHistory = useCallback(async () => {
    try {
      setAttendanceLoading(true);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await apiGet(`/attendance?limit=30&startDate=${thirtyDaysAgo.toISOString()}`);

      if (result.success && Array.isArray(result.data)) {
        setAttendanceHistory(result.data);

        const breaks: any[] = [];
        result.data.forEach((record: any) => {
          if (record.breaks && Array.isArray(record.breaks)) {
            record.breaks.forEach((breakItem: any) => {
              breaks.push({
                date: record.date,
                breakType: breakItem.breakType || 'regular',
                startTime: breakItem.startTime,
                endTime: breakItem.endTime,
                duration: breakItem.endTime && breakItem.startTime
                  ? ((new Date(breakItem.endTime).getTime() - new Date(breakItem.startTime).getTime()) / (1000 * 60)).toFixed(0)
                  : 'In Progress'
              });
            });
          }
        });
        setBreakHistory(breaks);
      }
    } catch (err) {
      console.warn('Failed to fetch attendance history:', err);
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  // ============================================================================
  // PERIODIC REFRESH - With enterprise-safe guards
  // ============================================================================
  useEffect(() => {
    if (!todayAttendance.isCheckedIn || disableRefresh) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;

      if (!actionInProgressRef.current && !disableRefreshRef.current && !isRecentlyUpdated()) {
        console.log('⏰ Periodic refresh triggered');
        safeRefresh();
      }
    }, SYNC_CONFIG.PERIODIC_REFRESH_MS);

    return () => clearInterval(interval);
  }, [todayAttendance.isCheckedIn, disableRefresh, safeRefresh, isRecentlyUpdated]);

  // ============================================================================
  // ATTENDANCE ACTION HANDLERS - REMOVED (moved to Attendance page)
  // ============================================================================

  return (
    <>
      <LoadingProgressBar isLoading={loading} color="bg-blue-500" />
      <div className="p-8 space-y-8">
        {/* Welcome Header with Attendance Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {user?.name || 'Employee'}! 👋
            </h1>
            <p className="text-muted-foreground">Here's what's happening with your work today</p>
          </div>

        {/* Attendance Action Buttons - Moved to Attendance page */}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KPICard
            title="Leave Balance"
            value={kpiMetrics.leaveBalance}
            icon={Calendar}
            color="primary"
          />
          <KPICard
            title="Hours This Week"
            value={kpiMetrics.hoursThisWeek}
            icon={Clock}
            color="secondary"
          />
          <KPICard
            title="Performance"
            value={kpiMetrics.performance}
            change={5.2}
            icon={TrendingUp}
            color="secondary"
          />
        </div>

        {/* Calendar and Holidays Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <InteractiveCalendar />
          </div>

          <Card className="rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex-shrink-0">
              <div>
                <h3 className="font-semibold text-lg">Holidays</h3>
                <p className="text-sm text-muted-foreground">
                  {holidays.length > 0
                    ? `${holidays.filter(h => new Date(h.date) >= new Date()).length} upcoming, ${holidays.length} total`
                    : 'Company holidays'
                  }
                </p>
              </div>
            </div>
            <div className="p-6 space-y-3 flex-1 min-h-0">
              {holidays && holidays.length > 0 ? (
                <div className="space-y-3 h-full">
                  {holidays
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((holiday) => {
                      const holidayDate = new Date(holiday.date);
                      const today = new Date();
                      const isUpcoming = holidayDate >= today;

                      return (
                        <div
                          key={holiday._id || holiday.id}
                          className={`p-3 rounded-lg border transition-all duration-300 holiday-item-3d ${isUpcoming
                            ? 'bg-green-50 border-green-200 shadow-sm hover:shadow-lg hover:border-green-300'
                            : 'bg-gray-50 border-gray-200 opacity-75 hover:opacity-100'
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{holiday.name}</p>
                                {isUpcoming && (
                                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                    Upcoming
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {holidayDate.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8 flex flex-col items-center justify-center h-full">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No holidays added yet</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Sections removed as per user request */}
          </div>
          <div className="space-y-6"></div>
        </div>

        {/* Attendance History Section */}
        <div className="mt-8 space-y-6">
          {/* Attendance History Table */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Attendance History</h3>
                  <p className="text-sm text-muted-foreground">Last 30 days</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {attendanceHistory.length} Records
              </Badge>
            </div>

            {attendanceLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : attendanceHistory.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Hours Worked</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Breaks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceHistory.slice(0, 10).map((record: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          {record.checkIn
                            ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {record.checkOut
                            ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {record.hoursWorked?.toFixed(2) || 0}h
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={record.status === 'present' ? 'default' : 'secondary'}
                            className="text-xs capitalize"
                          >
                            {record.status || 'absent'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.breaks && record.breaks.length > 0
                            ? `${record.breaks.length} break(s)`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Break History Table */}
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Break History</h3>
                  <p className="text-sm text-muted-foreground">Last 30 days</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {breakHistory.length} Breaks
              </Badge>
            </div>

            {attendanceLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : breakHistory.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No break records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Break Type</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakHistory.slice(0, 10).map((breakRecord: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {new Date(breakRecord.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={breakRecord.breakType === 'lunch' ? 'default' : 'secondary'}
                            className="text-xs capitalize"
                          >
                            {breakRecord.breakType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {breakRecord.startTime
                            ? new Date(breakRecord.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {breakRecord.endTime
                            ? new Date(breakRecord.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {breakRecord.duration} min
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {/* Chat Widget */}
        <ChatWidget />
      </div>
    </>
  );
}