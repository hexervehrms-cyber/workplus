import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KPICard } from '../../components/KPICard';
import InteractiveCalendar from '../../components/InteractiveCalendar';
import ChatWidget from '../../components/ChatWidget';
import LoadingProgressBar from '../../components/LoadingProgressBar';
import { useAuth } from '../../context/AuthContext';
import { TokenManager, LeaveAllocationService } from '../../utils/api';
import { parseBalanceApiResponse, sumRemainingDays } from '../../utils/leaveBalance';
import { apiGet, buildApiUrl, clearApiCache } from '../../utils/apiHelper';
import { clearPersistedAttendance, writePersistedAttendance, localDayKey } from '../../utils/attendancePersistence';
import realTimeSocket from '../../utils/realTimeSocket';
import { useAttendance } from '../../../context/AttendanceContext';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  TrendingUp,
  Play,
  Square,
  Pause,
  Loader2,
  Coffee,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
interface AttendanceEvent {
  employeeId: string;
  checkInTime?: string;
  checkOutTime?: string;
}

interface AttendanceRecord {
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status?: string;
  breaks?: BreakRecord[];
}

interface BreakRecord {
  date?: string;
  startTime: string;
  endTime: string;
  duration: number;
  type?: string;
  breakType?: string;
}

// ============================================================================
// DEBUG UTILITY - Conditional logging based on environment
// ============================================================================
const DEBUG_ENABLED = import.meta.env.VITE_ENABLE_DEBUG === 'true';
const debug = {
  log: (...args: any[]) => DEBUG_ENABLED && console.log(...args),
  error: (...args: any[]) => DEBUG_ENABLED && console.error(...args),
  warn: (...args: any[]) => DEBUG_ENABLED && console.warn(...args),
  group: (label: string) => DEBUG_ENABLED && console.group(label),
  groupEnd: () => DEBUG_ENABLED && console.groupEnd(),
};

// ============================================================================
// ATTENDANCE STATE MACHINE - Deterministic state transitions
// ============================================================================
type AttendanceUIState = 'IDLE' | 'WORKING' | 'ON_BREAK' | 'IN_MEETING' | 'SYNCING' | 'CHECKING_OUT';

// ============================================================================
// ENTERPRISE SYNC CONFIGURATION
// ============================================================================
const SYNC_CONFIG = {
  STALE_PROTECTION_MS: 10000, // Increased from 5s to 10s to account for socket delays
  SOCKET_PROTECTION_MS: 5000, // Increased from 3s to 5s
  REFRESH_COOLDOWN_MS: 4000,
  DEBOUNCE_MS: 1000,
  SOCKET_WAIT_MS: 1500,
  DB_SYNC_WAIT_MS: 2000,
  PERIODIC_REFRESH_MS: 30000,
  ACTION_TIMEOUT_MS: 8000
};

function isLikelyMongoObjectId(id: string | null | undefined): boolean {
  return !!id && /^[a-f\d]{24}$/i.test(id);
}

/** Parse values from toLocaleTimeString (e.g. "02:30 PM") for today's clock math */
function parseTodayCheckInTime(checkInTime: string): Date | null {
  const raw = checkInTime?.trim();
  if (!raw) return null;
  const d = new Date();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = m[3] ? parseInt(m[3], 10) : 0;
    const ap = m[4]?.toUpperCase();
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    d.setHours(h, min, Number.isNaN(sec) ? 0 : sec, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parts = raw.split(':').map((p) => parseInt(String(p).replace(/\D/g, ''), 10));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    d.setHours(parts[0], parts[1], 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ============================================================================
// STATIC GREETING (fixed at first render — no auto-rotation)
// ============================================================================
function StaticGreetingHeader({ userName }: { userName: string }) {
  const { title, subtitle } = useMemo(() => {
    const capitalized =
      userName.trim().charAt(0).toUpperCase() + userName.trim().slice(1) || 'Employee';
    const hour = new Date().getHours();
    const period =
      hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return {
      title: `${period}, ${capitalized}.`,
      subtitle: 'Review current tasks and progress.',
    };
  }, [userName]);

  return (
    <div className="flex-1 min-w-0 space-y-2">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="text-base md:text-lg text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { attendance: todayAttendance, updateAttendance, loadFromLocalStorage } = useAttendance();
  const [loading, setLoading] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState<
    null | 'check-in' | 'check-out' | 'break-start' | 'break-end'
  >(null);
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
  const lastUserActivityRef = useRef(Date.now());

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

  useEffect(() => {
    const bump = () => {
      lastUserActivityRef.current = Date.now();
    };
    const opts: AddEventListenerOptions = { passive: true };
    ['pointerdown', 'keydown', 'scroll'].forEach((ev) => {
      document.addEventListener(ev, bump, opts);
    });
    return () => {
      ['pointerdown', 'keydown', 'scroll'].forEach((ev) => {
        document.removeEventListener(ev, bump, opts);
      });
    };
  }, []);

  const [kpiMetrics, setKpiMetrics] = useState({
    leaveBalance: "0 days",
    hoursThisWeek: "0h",
    performance: "0%"
  });

  const [holidays, setHolidays] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [breakHistory, setBreakHistory] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [currentBreakDuration, setCurrentBreakDuration] = useState(0);
  const [workingHours, setWorkingHours] = useState(0);
  // ============================================================================
  // DERIVED UI STATE - Computed from attendance state
  // ============================================================================
  const attendanceUIState = useMemo((): AttendanceUIState => {
    if (!todayAttendance.isCheckedIn) return 'IDLE';
    if (todayAttendance.isOnBreak) return 'ON_BREAK';
    return 'WORKING';
  }, [todayAttendance.isCheckedIn, todayAttendance.isOnBreak]);

  // Debug: Log todayAttendance changes
  useEffect(() => {
    debug.group('[ATTENDANCE STATE]');
    debug.log('🔍 [DASHBOARD] todayAttendance changed:', {
      isOnBreak: todayAttendance.isOnBreak,
      isCheckedIn: todayAttendance.isCheckedIn,
      breakType: todayAttendance.breakType,
      uiState: attendanceUIState
    });
    debug.log('⏱️ Sync timing:', {
      lastSocketEventTime,
      timeSinceSocket: Date.now() - lastSocketEventTime
    });
    debug.groupEnd();
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
      debug.log('🛡️ [STALE PROTECTION] Blocking refresh:', {
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
  // FETCH DASHBOARD DATA - With stale protection (must be above safeRefresh — TDZ)
  // ============================================================================
  const fetchDashboardData = useCallback(async (_forceRefresh = false) => {
    if (!user) return;

    if (!_forceRefresh && isRecentlyUpdated()) {
      debug.log('⏸️ [FETCH] Skipping due to recent update');
      return;
    }

    // FIX #2: Use ref (not state) to read live actionInProgress value
    if (!_forceRefresh && actionInProgressRef.current) {
      debug.log('⏸️ [FETCH] Skipping because action is in progress');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      setLoading(true);

      timeoutId = setTimeout(() => {
        setLoading(false);
      }, SYNC_CONFIG.ACTION_TIMEOUT_MS);

      debug.group('[FETCH DASHBOARD]');
      debug.log('⚡ Fetching all dashboard data in parallel...');

      const [attendanceResult, holidaysResult] = await Promise.allSettled([
        apiGet('/attendance/today'),
        apiGet('/holidays')
      ]);

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

      debug.log('📊 Attendance API Result:', {
        status: attendanceResult.status,
        success: attendanceResult.status === 'fulfilled' ? attendanceResult.value?.success : false,
        hasData: attendanceResult.status === 'fulfilled' ? !!attendanceResult.value?.data : false,
        error: attendanceResult.status === 'rejected' ? attendanceResult.reason?.message : undefined
      });

      const attendanceApiOk =
        attendanceResult.status === 'fulfilled' &&
        attendanceResult.value &&
        attendanceResult.value.success === true;

      const attendanceData = attendanceApiOk ? attendanceResult.value.data : null;

      if (!attendanceApiOk) {
        debug.warn('📊 Attendance sync skipped — no definitive server response; keeping cached/local state', {
          status: attendanceResult.status,
          success: attendanceResult.status === 'fulfilled' ? attendanceResult.value?.success : undefined,
          error: attendanceResult.status === 'rejected' ? String((attendanceResult.reason as Error)?.message || attendanceResult.reason) : undefined
        });
        if (!actionInProgressRef.current) {
          loadFromLocalStorage();
        }
      } else if (attendanceData?.attendance) {
        const attendance = attendanceData.attendance;
        const checkInTime = attendance.checkIn
          ? new Date(attendance.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;
        const checkOutTime = attendance.checkOut
          ? new Date(attendance.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;

        const ls = attendanceData.liveStatus;
        const hasCheckOut =
          attendance.checkOut != null && String(attendance.checkOut).trim() !== '';

        let isCurrentlyCheckedIn = false;
        if (hasCheckOut) {
          isCurrentlyCheckedIn = false;
        } else if (ls?.status === 'checked_out' || ls?.status === 'not_checked_in') {
          isCurrentlyCheckedIn = false;
        } else if (ls?.status === 'checked_in' || ls?.status === 'on_break' || ls?.status === 'in_meeting') {
          isCurrentlyCheckedIn = true;
        } else {
          isCurrentlyCheckedIn = Boolean(attendance.checkIn);
        }

        let calculatedIsOnBreak = false;
        let calculatedBreakType = 'regular';
        let calculatedBreakDuration = 0;

        if (ls?.isOnBreak || ls?.status === 'on_break') {
          calculatedIsOnBreak = true;
          calculatedBreakDuration =
            typeof ls.currentBreakDuration === 'number'
              ? Math.round(ls.currentBreakDuration)
              : 0;
        }

        if (attendance.breaks && attendance.breaks.length > 0) {
          const lastBreak = attendance.breaks[attendance.breaks.length - 1];
          if (lastBreak.startTime && !lastBreak.endTime) {
            if (!calculatedIsOnBreak) {
              calculatedIsOnBreak = true;
              const breakStart = new Date(lastBreak.startTime).getTime();
              const now = new Date().getTime();
              calculatedBreakDuration = Math.round((now - breakStart) / (1000 * 60));
            }
            calculatedBreakType = lastBreak.breakType || 'regular';
          }
        }

        debug.log('✅ Updating attendance from API:', {
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
          currentBreakDuration: calculatedBreakDuration,
          breakType: calculatedBreakType
        });

        const uid = user?.id ? String(user.id) : null;
        writePersistedAttendance(uid, {
          checkedIn: isCurrentlyCheckedIn,
          isCheckedIn: isCurrentlyCheckedIn,
          checkInTime,
          checkOutTime,
          currentHours: attendance.hoursWorked || 0,
          hoursWorked: attendance.hoursWorked || 0,
          status: attendance.status || 'absent',
          isOnBreak: calculatedIsOnBreak,
          currentBreakDuration: calculatedBreakDuration,
          breakType: calculatedBreakType,
          timestamp: Date.now()
        });
      } else {
        console.log('ℹ️ Server confirmed no attendance row for today — showing Check In');

        updateAttendance({
          isCheckedIn: false,
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: 0,
          status: 'absent',
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular'
        });

        await clearPersistedAttendance(user?.id ? String(user.id) : null);
      }

      if (attendanceApiOk) {
        clearApiCache('/attendance/today');
      }

      const weekHours = typeof attendanceData?.hoursThisWeek === 'number' ? attendanceData.hoursThisWeek : 0;

      let leaveBalanceLabel = '0 days';
      try {
        const empId = employeeIdRef.current || (await ensureEmployeeId());
        if (empId) {
          const now = new Date();
          const balanceRes = await LeaveAllocationService.getEmployeeBalance(
            empId,
            now.getFullYear(),
            now.getMonth() + 1
          );
          if (balanceRes.success) {
            const parsed = parseBalanceApiResponse(balanceRes);
            const totalRemaining = sumRemainingDays(parsed.balances);
            leaveBalanceLabel = `${totalRemaining} day${totalRemaining === 1 ? '' : 's'}`;
          }
        }
      } catch {
        /* keep default */
      }

      setKpiMetrics({
        leaveBalance: leaveBalanceLabel,
        hoursThisWeek: `${weekHours}h`,
        performance: "85%"
      });

      debug.groupEnd();
    } catch (err) {
      debug.error('Failed to fetch dashboard data:', err);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  // FIX #6: updateAttendance added to deps
  }, [user, isRecentlyUpdated, updateAttendance, loadFromLocalStorage]);

  const ensureEmployeeId = async (): Promise<string | null> => {
    if (employeeIdRef.current) return employeeIdRef.current;

    if (!user?.id) return null;
    const fromUser = user.employeeId != null ? String(user.employeeId) : '';
    if (isLikelyMongoObjectId(fromUser)) {
      setEmployeeId(fromUser);
      return fromUser;
    }

    try {
      const token = TokenManager.get();
      const response = await fetch(buildApiUrl(`/employees/user/${user.id}`), {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const empId = result.data?._id || result.data?.id;
        if (empId && isLikelyMongoObjectId(String(empId))) {
          const idStr = String(empId);
          setEmployeeId(idStr);
          return idStr;
        }
      }
    } catch (err) {
      debug.error('Error fetching employee data:', err);
    }

    return null;
  };

  const safeRefresh = useCallback(
    async (forceRefresh = false) => {
      if (disableRefreshRef.current && !forceRefresh) {
        debug.log('⏸️ [SAFE REFRESH] Refresh disabled, skipping');
        return;
      }

      if (isRecentlyUpdated() && !forceRefresh) {
        debug.log('⏸️ [SAFE REFRESH] Recently updated, skipping');
        return;
      }

      if (actionInProgressRef.current) {
        debug.log('⏸️ [SAFE REFRESH] Action in progress, skipping to avoid overwriting optimistic state');
        return;
      }

      debug.log('🔄 [SAFE REFRESH] Starting safe refresh');
      setDisableRefresh(true);

      try {
        await fetchDashboardData(forceRefresh);
      } finally {
        setTimeout(() => {
          setDisableRefresh(false);
        }, SYNC_CONFIG.REFRESH_COOLDOWN_MS);
      }
    },
    [isRecentlyUpdated, fetchDashboardData]
  );

  // Fetch data on mount with force refresh
  useEffect(() => {
    // FIX #7: Load from localStorage FIRST to restore state immediately
    // This ensures buttons are visible before API call completes
    console.log('🚀 [DASHBOARD MOUNT] Loading state from localStorage first');
    loadFromLocalStorage();
    
    // Then fetch from API to sync with server
    // Use a longer delay to ensure auth context is fully initialized
    const timeoutId = setTimeout(() => {
      console.log('🚀 [DASHBOARD MOUNT] Fetching from API to sync with server');
      fetchDashboardData(true);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fetchDashboardData, loadFromLocalStorage]);

  // Fetch employee ID on mount
  useEffect(() => {
    ensureEmployeeId();
  }, [user?.id]);

  // ============================================================================
  // SOCKET.IO LISTENERS - FIXED: Use refs to prevent stale closures
  // ============================================================================
  useEffect(() => {
    // Match realTimeSocket: org can be orgId or tenantId; listeners only need employeeId + user session
    if (!user?.id || !employeeIdRef.current) return;

    debug.group('[SOCKET LISTENERS SETUP]');
    debug.log('📡 [EMPLOYEE-DASHBOARD] Setting up Socket.IO listeners with employeeId:', employeeIdRef.current);

    // CRITICAL FIX: Use refs instead of state to prevent stale closures
    const handleBreakStarted = (data: any) => {
      debug.log('📡 [EMPLOYEE-DASHBOARD] break:started event received:', data);
      // Use ref, not state - always has current value
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        debug.log('📡 [EMPLOYEE-DASHBOARD] Break started for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isOnBreak: true,
          breakType: data.breakType || 'regular',
          currentBreakDuration: 0
        }, 'socket');
      }
    };

    const handleBreakEnded = (data: any) => {
      console.log('� [EMPLOYEE-DASHBOARD] break:ended event received:', data);
      const matchEmployee =
        data.employeeId && String(data.employeeId) === String(employeeIdRef.current);
      const matchUser =
        user?.id &&
        (String(data.userId) === String(user.id) ||
          String(data.attendance?.userId) === String(user.id));
      if (matchEmployee || matchUser) {
        setLastSocketEventTime(Date.now());
        const ls = data.liveStatus;
        updateAttendance(
          {
            isOnBreak: ls?.isOnBreak === true,
            currentBreakDuration: ls?.currentBreakDuration || 0,
            breakType: ls?.breakType || 'regular',
            isCheckedIn: true,
          },
          'socket'
        );
      }
    };

    const handleCheckedIn = (data: AttendanceEvent) => {
      debug.log('📡 [EMPLOYEE-DASHBOARD] attendance:checked_in event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        debug.log('📡 [EMPLOYEE-DASHBOARD] Check-in for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isCheckedIn: true,
          checkInTime: data.checkInTime
            ? new Date(data.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : null
        }, 'socket');
      }
    };

    const handleCheckedOut = (data: AttendanceEvent) => {
      debug.log('📡 [EMPLOYEE-DASHBOARD] attendance:checked_out event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        debug.log('📡 [EMPLOYEE-DASHBOARD] Check-out for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isCheckedIn: false,
          checkOutTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          isOnBreak: false
        }, 'socket');
      }
    };

    // Subscribe to events and store unsubscribe functions
    const unsubscribeBreakStarted = realTimeSocket.onBreakStarted(handleBreakStarted);
    const unsubscribeBreakEnded = realTimeSocket.onBreakEnded(handleBreakEnded);
    realTimeSocket.on('attendance:checked_in', handleCheckedIn);
    realTimeSocket.on('attendance:checked_out', handleCheckedOut);

    debug.groupEnd();

    // CRITICAL FIX: Clean up all listeners on unmount
    return () => {
      debug.log('📡 [EMPLOYEE-DASHBOARD] Cleaning up Socket.IO listeners');
      unsubscribeBreakStarted?.();
      unsubscribeBreakEnded?.();
      realTimeSocket.off('attendance:checked_in', handleCheckedIn);
      realTimeSocket.off('attendance:checked_out', handleCheckedOut);
    };
  }, [user?.id, employeeId]);

  // Fetch attendance history
  const fetchAttendanceHistory = useCallback(async () => {
    try {
      setAttendanceLoading(true);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await apiGet(`/attendance?limit=30&startDate=${thirtyDaysAgo.toISOString()}`);

      if (result.success && Array.isArray(result.data)) {
        setAttendanceHistory(result.data);

        const breaks: BreakRecord[] = [];
        result.data.forEach((record: AttendanceRecord) => {
          if (record.breaks && Array.isArray(record.breaks)) {
            record.breaks.forEach((breakItem: BreakRecord) => {
              breaks.push({
                date: record.date,
                breakType: breakItem.breakType || 'regular',
                startTime: breakItem.startTime,
                endTime: breakItem.endTime,
                duration: breakItem.endTime && breakItem.startTime
                  ? Math.round((new Date(breakItem.endTime).getTime() - new Date(breakItem.startTime).getTime()) / (1000 * 60))
                  : 0
              });
            });
          }
        });
        setBreakHistory(breaks);
      }
    } catch (err) {
      debug.warn('Failed to fetch attendance history:', err);
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  // ============================================================================
  // PERIODIC REFRESH - With enterprise-safe guards
  // FIXED: Removed safeRefresh and isRecentlyUpdated from deps to prevent recreation
  // ============================================================================
  useEffect(() => {
    if (!todayAttendance.isCheckedIn || disableRefresh) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastUserActivityRef.current > 120_000) return;

      // Use refs directly to avoid dependency array issues
      if (!actionInProgressRef.current && !disableRefreshRef.current && !isRecentlyUpdated()) {
        debug.log('⏰ Periodic refresh triggered');
        safeRefresh();
      }
    }, SYNC_CONFIG.PERIODIC_REFRESH_MS);

    return () => clearInterval(interval);
  }, [todayAttendance.isCheckedIn, disableRefresh]);

  // ============================================================================
  // TIMER SYSTEM - Track working hours, breaks, and meetings in real-time
  // ============================================================================
  useEffect(() => {
    if (!todayAttendance.isCheckedIn) {
      setWorkingHours(0);
      setCurrentBreakDuration(0);
      return;
    }

    const interval = setInterval(() => {
      // Calculate working hours (excluding breaks and meetings)
      if (todayAttendance.checkInTime) {
        const checkInTime = parseTodayCheckInTime(todayAttendance.checkInTime);
        if (!checkInTime) return;

        const now = new Date();
        let totalSeconds = (now.getTime() - checkInTime.getTime()) / 1000;
        
        // Subtract break time - accumulate all breaks taken so far
        if (todayAttendance.isOnBreak) {
          // Currently on break - add current break duration
          setCurrentBreakDuration(prev => prev + 1);
          totalSeconds -= (currentBreakDuration + 1) * 60;
        } else {
          // Not on break - keep current break duration as is
          if (currentBreakDuration > 0) {
            totalSeconds -= currentBreakDuration * 60;
          }
        }
        
        const hours_worked = totalSeconds / 3600;
        setWorkingHours(Math.max(0, hours_worked));
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [todayAttendance.isCheckedIn, todayAttendance.isOnBreak, todayAttendance.checkInTime, currentBreakDuration]);

  // Format time display (HH:MM:SS)
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ============================================================================
  // ATTENDANCE ACTION HANDLERS - Integrated from Attendance page
  // ============================================================================
  
  const handleBreakStart = async (breakType: 'regular' = 'regular') => {
    // Debounce: prevent multiple clicks
    if (actionInProgressRef.current) {
      console.log('⏸️ [BREAK START] Action already in progress, skipping');
      return;
    }
    
    // Prevent starting break if not checked in
    if (!todayAttendance.isCheckedIn) {
      console.log('⏸️ [BREAK START] Not checked in, cannot start break');
      toast.warning('Please check in first before starting a break');
      return;
    }
    
    // Prevent starting break if already on break
    if (todayAttendance.isOnBreak) {
      debug.log('⏸️ [BREAK START] Already on break, skipping');
      return;
    }
    
    try {
      actionInProgressRef.current = true;
      setAttendanceBusy('break-start');
      lastActionTimeRef.current = Date.now();

      const resolvedEmployeeId = await ensureEmployeeId();
      const token = TokenManager.get();
      const idempotencyKey = `break-start-${resolvedEmployeeId || 'me'}-${Date.now()}`;
      
      const payload: { breakType: string; notes: string; idempotencyKey: string; employeeId?: string | null } = {
        breakType,
        notes: `Break started`,
        idempotencyKey
      };
      if (isLikelyMongoObjectId(resolvedEmployeeId)) payload.employeeId = resolvedEmployeeId;
      
      debug.log('🔄 [BREAK START] Sending request:', { breakType, employeeId: resolvedEmployeeId });
      
      // Optimistic update - immediately show break started
      updateAttendance({
        isOnBreak: true,
        breakType: breakType,
        currentBreakDuration: 0
      }, 'action');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.ACTION_TIMEOUT_MS);
      
      try {
        const response = await fetch(buildApiUrl('/attendance/break-start'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) {
          let errorMessage = 'Break start failed';
          try {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } catch (e) {
            // Response body is not JSON
          }
          debug.error('❌ [BREAK START] API Error:', errorMessage);
          throw new Error(errorMessage);
        }

        const result = await response.json();
        debug.log('✅ [BREAK START] Success:', result);

        // Confirm optimistic update with server response
        const liveStatus = result.data?.liveStatus;
        if (liveStatus) {
          updateAttendance({
            isOnBreak: liveStatus.isOnBreak || true,
            breakType: liveStatus.breakType || breakType,
            currentBreakDuration: liveStatus.currentBreakDuration || 0
          }, 'action');
        }

        clearApiCache('/attendance/today');
        toast.success('Break started');
        setLastSocketEventTime(Date.now());
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      debug.error('❌ [BREAK START] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Could not start break');
      updateAttendance({
        isOnBreak: false,
        breakType: 'regular',
        currentBreakDuration: 0
      }, 'action');
    } finally {
      actionInProgressRef.current = false;
      setAttendanceBusy(null);
    }
  };

  const handleBreakEnd = async () => {
    // Debounce: prevent multiple clicks
    if (actionInProgressRef.current) {
      console.log('⏸️ [BREAK END] Action already in progress, skipping');
      return;
    }
    
    // Prevent ending break if not on break
    if (!todayAttendance.isOnBreak) {
      console.log('⏸️ [BREAK END] Not on break, skipping');
      return;
    }
    
    let wasOnBreak = todayAttendance.isOnBreak;
    let prevBreakType = todayAttendance.breakType;
    let prevBreakDuration = todayAttendance.currentBreakDuration;

    try {
      actionInProgressRef.current = true;
      setAttendanceBusy('break-end');
      lastActionTimeRef.current = Date.now();
      
      const resolvedEmployeeId = await ensureEmployeeId();
      const token = TokenManager.get();
      const idempotencyKey = `break-end-${resolvedEmployeeId || 'me'}-${Date.now()}`;
      
      const payload: { notes: string; idempotencyKey: string; employeeId?: string | null } = {
        notes: 'Break ended',
        idempotencyKey
      };
      if (isLikelyMongoObjectId(resolvedEmployeeId)) payload.employeeId = resolvedEmployeeId;
      
      debug.log('🔄 [BREAK END] Sending request:', { employeeId: resolvedEmployeeId });
      
      // Optimistic update - immediately show break ended
      updateAttendance({
        isOnBreak: false,
        breakType: 'regular',
        currentBreakDuration: 0
      }, 'action');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.ACTION_TIMEOUT_MS);
      
      try {
        const response = await fetch(buildApiUrl('/attendance/break-end'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) {
          let errorMessage = 'Break end failed';
          try {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } catch (e) {
            // Response body is not JSON
          }
          debug.error('❌ [BREAK END] API Error:', errorMessage);
          throw new Error(errorMessage);
        }

        const result = await response.json();
        debug.log('✅ [BREAK END] Success:', result);

        const liveStatus = result.data?.liveStatus;
        updateAttendance(
          {
            isOnBreak: liveStatus?.isOnBreak === true,
            breakType: liveStatus?.breakType || 'regular',
            currentBreakDuration: liveStatus?.currentBreakDuration || 0,
            isCheckedIn: true,
          },
          'action'
        );

        const uid = user?.id ? String(user.id) : null;
        writePersistedAttendance(uid, {
          checkedIn: true,
          isCheckedIn: true,
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular',
          timestamp: Date.now(),
        });

        clearApiCache('/attendance/today');
        setLastSocketEventTime(Date.now());
        disableRefreshRef.current = true;
        toast.success('Break ended');
        setTimeout(() => {
          disableRefreshRef.current = false;
        }, 4000);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      debug.error('❌ [BREAK END] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Could not end break');
      updateAttendance({
        isOnBreak: wasOnBreak,
        breakType: prevBreakType || 'regular',
        currentBreakDuration: prevBreakDuration || 0
      }, 'action');
    } finally {
      actionInProgressRef.current = false;
      setAttendanceBusy(null);
    }
  };

  const handleCheckIn = async () => {
    // Debounce: prevent multiple clicks
    if (actionInProgressRef.current) return;
    
    try {
      actionInProgressRef.current = true;
      setAttendanceBusy('check-in');
      lastActionTimeRef.current = Date.now();

      const token = TokenManager.get();
      const idempotencyKey = `check-in-${user?.id || 'me'}-${localDayKey()}`;
      const payload: { notes: string; idempotencyKey: string } = {
        notes: 'Checked in',
        idempotencyKey
      };
      
      // CRITICAL FIX: Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.ACTION_TIMEOUT_MS);
      try {
        const response = await fetch(buildApiUrl('/attendance/check-in'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) {
          let errorMessage = 'Check-in failed';
          try {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } catch (e) {
            // Response body is not JSON
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        const serverAtt = result?.data;
        const checkInTime = serverAtt?.checkIn
          ? new Date(serverAtt.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Update state immediately
        updateAttendance({
          isCheckedIn: true,
          checkInTime: checkInTime,
          status: 'present'
        }, 'action');

        const uid = user?.id ? String(user.id) : null;
        writePersistedAttendance(uid, {
          checkedIn: true,
          isCheckedIn: true,
          checkInTime,
          checkOutTime: null,
          currentHours: 0,
          hoursWorked: 0,
          status: 'present',
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular',
          timestamp: Date.now()
        });

        clearApiCache('/attendance/today');
        toast.success('Checked in successfully');
        setLastSocketEventTime(Date.now());
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error(error instanceof Error ? error.message : 'Check-in failed');
      // Rollback optimistic update on error
      updateAttendance({
        isCheckedIn: false,
        checkInTime: null,
        status: 'absent'
      }, 'action');
    } finally {
      actionInProgressRef.current = false;
      setAttendanceBusy(null);
    }
  };

  const handleCheckOut = async () => {
    // Debounce: prevent multiple clicks
    if (actionInProgressRef.current) return;
    
    try {
      actionInProgressRef.current = true;
      setAttendanceBusy('check-out');
      lastActionTimeRef.current = Date.now();

      const resolvedEmployeeId = await ensureEmployeeId();
      const token = TokenManager.get();
      const idempotencyKey = `check-out-${user?.id || 'me'}-${localDayKey()}`;
      const payload: { notes: string; employeeId?: string | null; idempotencyKey: string } = {
        notes: 'Checked out',
        idempotencyKey
      };
      if (isLikelyMongoObjectId(resolvedEmployeeId)) payload.employeeId = resolvedEmployeeId;
      
      // CRITICAL FIX: Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNC_CONFIG.ACTION_TIMEOUT_MS);
      try {
        const response = await fetch(buildApiUrl('/attendance/check-out'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) {
          let errorMessage = 'Check-out failed';
          try {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          } catch (e) {
            // Response body is not JSON
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        const serverAtt = result?.data;
        const hoursWorked =
          typeof serverAtt?.hoursWorked === 'number' && !Number.isNaN(serverAtt.hoursWorked)
            ? serverAtt.hoursWorked
            : 0;
        const checkOutTime = serverAtt?.checkOut
          ? new Date(serverAtt.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const prevCheckInTime = todayAttendance.checkInTime;

        // Update state immediately
        updateAttendance({
          isCheckedIn: false,
          checkOutTime: checkOutTime,
          hoursWorked,
          isOnBreak: false,
          breakType: 'regular',
          currentBreakDuration: 0
        }, 'action');

        const uid = user?.id ? String(user.id) : null;
        writePersistedAttendance(uid, {
          checkedIn: false,
          isCheckedIn: false,
          checkInTime: prevCheckInTime,
          checkOutTime,
          currentHours: hoursWorked,
          hoursWorked,
          status: 'present',
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular',
          timestamp: Date.now()
        });

        clearApiCache('/attendance/today');
        setTimeout(() => {
          void safeRefresh(true);
        }, 600);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Check-out error:', error);
      toast.error(error instanceof Error ? error.message : 'Check-out failed');
      // Rollback optimistic update on error
      updateAttendance({
        isCheckedIn: true,
        checkOutTime: null
      }, 'action');
    } finally {
      actionInProgressRef.current = false;
      setAttendanceBusy(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <LoadingProgressBar isLoading={loading} color="bg-blue-500" />
      <div className="p-8 space-y-8">
        {/* Welcome Header with Attendance Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-2">
          <StaticGreetingHeader userName={user?.name || 'Employee'} />

          <Card className="w-full lg:w-auto shrink-0 border-border/80 shadow-sm p-4 md:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Today&apos;s attendance
            </p>
            {todayAttendance.isCheckedIn && (
              <Badge
                className={`mb-3 px-3 py-1 text-xs font-semibold rounded-full ${
                  todayAttendance.isOnBreak
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {todayAttendance.isOnBreak
                  ? `On break · ${formatTime(currentBreakDuration * 60)}`
                  : `Working · ${formatTime(workingHours * 3600)}`}
              </Badge>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!todayAttendance.isCheckedIn ? (
                <Button
                  type="button"
                  size="default"
                  className="h-10 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  disabled={loading || !!attendanceBusy}
                  onClick={handleCheckIn}
                  aria-label="Check in to work for today"
                >
                  {attendanceBusy === 'check-in' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Check In
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="default"
                    variant="destructive"
                    className="h-10 min-w-[120px] font-semibold shadow-sm"
                    disabled={loading || !!attendanceBusy}
                    onClick={handleCheckOut}
                    aria-label="Check out from work for today"
                  >
                    {attendanceBusy === 'check-out' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4 mr-2" />
                    )}
                    Check Out
                  </Button>

                  {!todayAttendance.isOnBreak ? (
                    <Button
                      type="button"
                      size="default"
                      className="h-10 min-w-[100px] bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
                      onClick={() => handleBreakStart('regular')}
                      disabled={loading || !!attendanceBusy}
                      aria-label="Start a break"
                    >
                      {attendanceBusy === 'break-start' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Coffee className="w-4 h-4 mr-2" />
                      )}
                      Break
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="default"
                      className="h-10 min-w-[120px] bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
                      onClick={handleBreakEnd}
                      disabled={loading || !!attendanceBusy}
                      aria-label="End break"
                    >
                      {attendanceBusy === 'break-end' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4 mr-2" />
                      )}
                      End Break
                    </Button>
                  )}

                </>
              )}
              
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 shrink-0"
                disabled={loading || disableRefresh || !!attendanceBusy}
                onClick={() => safeRefresh(true)}
                title="Refresh attendance"
                aria-label="Refresh attendance from server"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </Card>
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
                            ? 'dark:bg-green-950 dark:border-green-800 dark:text-green-200 bg-green-50 border-green-200 shadow-sm hover:shadow-lg hover:border-green-300'
                            : 'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 bg-gray-50 border-gray-200 opacity-75 hover:opacity-100'
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{holiday.name}</p>
                                {isUpcoming && (
                                  <span className="px-2 py-1 text-xs dark:bg-green-900 dark:text-green-200 bg-green-100 text-green-700 rounded-full">
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
                    {attendanceHistory.slice(0, 10).map((record: AttendanceRecord, index: number) => (
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
                    {breakHistory.slice(0, 10).map((breakRecord: BreakRecord, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {breakRecord.date ? new Date(breakRecord.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          }) : 'N/A'}
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