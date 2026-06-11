import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KPICard } from '../../components/KPICard';
import ChatWidget from '../../components/ChatWidget';
import { useAuth } from '../../context/AuthContext';
import {
  fetchLeaveBalanceKpiSummary,
  formatLeaveBalanceKpi,
} from '../../utils/leaveBalance';
import { resolveEmployeeMongoId } from '../../utils/resolveEmployeeId';
import {
  apiGetSafe,
  appendOrgIdParam,
  clearApiCache,
  holidaysStorageKey,
  resolveAuthOrgId,
} from '../../utils/apiHelper';
import { safeLocaleTime, safeFormatTime, runSafe, authUserKey, safeArrayAccess } from '../../utils/safeUi';
import { postAttendanceAction } from '../../utils/attendanceApi';
import {
  formatWeekHours,
  readCachedWeekHours,
  writeCachedWeekHours,
  calendarWeekKey,
} from '../../utils/weekHours';
import {
    writePersistedAttendance,
  readPersistedAttendance,
  clearPersistedAttendance,
  isPayloadFresh,
  localDayKey,
} from '../../utils/attendancePersistence';

/** Apply server liveStatus without flipping break off due to stale/partial payloads. */
function resolveOnBreakFromServer(
  liveStatus: Record<string, unknown> | null | undefined,
  breaks: BreakRecord[] | undefined,
  fallback: boolean
): boolean {
  if (liveStatus?.isOnBreak === true || liveStatus?.status === 'on_break') return true;
  if (liveStatus?.isOnBreak === false && liveStatus?.status !== 'on_break') {
    if (Array.isArray(breaks) && breaks.length > 0) {
      const last = breaks[breaks.length - 1];
      if (last?.startTime && !last?.endTime) return true;
    }
    return false;
  }
  if (Array.isArray(breaks) && breaks.length > 0) {
    const last = breaks[breaks.length - 1];
    if (last?.startTime && !last?.endTime) return true;
  }
  return fallback;
}
import realTimeSocket from '../../utils/realTimeSocket';
import { onPageVisible } from '../../utils/pageVisibility';
import { useAttendance } from '../../../context/AttendanceContext';
import { toast } from '../../utils/portalToast';
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
import InteractiveCalendar from '../../components/InteractiveCalendar';
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

interface Holiday {
  _id?: string;
  id?: string;
  date: string;
  name: string;
  description?: string;
}

interface TodayAttendanceRow {
  checkIn?: string | Date;
  checkOut?: string | Date;
  hoursWorked?: number;
  status?: string;
  breaks?: BreakRecord[];
}

interface TodayLiveStatus {
  status?: string;
  isOnBreak?: boolean;
  currentBreakDuration?: number;
  currentHours?: number;
  breakType?: string;
}

interface TodayAttendanceApiData {
  attendance?: TodayAttendanceRow;
  liveStatus?: TodayLiveStatus;
  hoursThisWeek?: number;
  weekKey?: string;
}

// ============================================================================
// DEBUG UTILITY - Conditional logging based on environment
// ============================================================================
const DEBUG_ENABLED =
  (import.meta as { env?: { VITE_ENABLE_DEBUG?: string } }).env?.VITE_ENABLE_DEBUG === 'true';
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
  PERIODIC_REFRESH_MS: 90_000,
  ACTION_TIMEOUT_MS: 8000,
  WEEK_HOURS_SYNC_MS: 60_000,
  BREAK_ACTION_GUARD_MS: 12_000,
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
  const authUid = authUserKey(user);
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
  const fetchDashboardDataRef = useRef<((_force?: boolean) => Promise<void>) | null>(null);
  const safeRefreshRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const lastWeekSyncRef = useRef(0);
  const lastWeekKeyRef = useRef<string | null>(null); // FIX #2: Track week boundaries
  /** Completed break seconds today (closed breaks only). */
  const completedBreakSecondsRef = useRef(0);
  /** Total break seconds = completed + current open segment (for working-hours math). */
  const breakSecondsRef = useRef(0);
  /** Seconds elapsed for the current open break segment only. */
  const currentBreakSegmentSecondsRef = useRef(0);
  const [breakDisplaySeconds, setBreakDisplaySeconds] = useState(0);
  const isOnBreakRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    leaveBalanceSubtitle: "",
    hoursThisWeek: "0h",
    breakTodayMinutes: 0,
    weekHoursSubtitle: "Mon–Sun · check-in/out sessions",
    performance: "0%"
  });

  /** Completed week hours before today's live session (updated on each server sync). */
  const weekHoursExclTodayRef = useRef(0);

  const applyWeekHours = useCallback((hours: number, weekKey?: string, force = false) => {
    const key = weekKey || calendarWeekKey();
    if (!force && key !== calendarWeekKey()) return;
    const safe = Math.max(0, hours);
    setKpiMetrics((prev) => ({ ...prev, hoursThisWeek: formatWeekHours(safe) }));
    const uid = authUid;
    writeCachedWeekHours(uid, safe);
  }, [authUid]);

  const ingestWeekHoursFromServer = useCallback(
    (hoursThisWeek: number, weekKey?: string, todayLiveHours = 0) => {
      // FIX #2: Only update baseline if:
      // 1. Week boundary changed (new weekKey), OR
      // 2. We have credible today live hours (> 0), OR
      // 3. Baseline is empty (first sync)
      const currentWeekKey = weekKey || calendarWeekKey();
      const isNewWeek = lastWeekKeyRef.current !== currentWeekKey;
      const hasCreditableTodayData = todayLiveHours > 0;
      const needsInit = weekHoursExclTodayRef.current === 0;

      if (isNewWeek || hasCreditableTodayData || needsInit) {
        weekHoursExclTodayRef.current = Math.max(0, hoursThisWeek - todayLiveHours);
        lastWeekKeyRef.current = currentWeekKey;
      }
      applyWeekHours(hoursThisWeek, weekKey, true);
    },
    [applyWeekHours]
  );

  const syncWeeklyHours = useCallback(async () => {
    if (!authUid) return;
    const now = Date.now();
    if (now - lastWeekSyncRef.current < 15_000) return;
    lastWeekSyncRef.current = now;
    try {
      clearApiCache('/attendance/today');
      const res = await apiGetSafe<{
        success?: boolean;
        data?: { hoursThisWeek?: number; weekKey?: string; liveStatus?: { currentHours?: number } };
      }>('/attendance/today', false);
      if (!res.ok) return;
      const data = res.data?.data ?? res.data;
      const weekHours =
        typeof (data as { hoursThisWeek?: number })?.hoursThisWeek === 'number'
          ? (data as { hoursThisWeek: number }).hoursThisWeek
          : null;
      if (weekHours !== null) {
        const live = (data as { liveStatus?: { currentHours?: number } }).liveStatus;
        const todayLive =
          typeof live?.currentHours === 'number' ? live.currentHours : 0;
        ingestWeekHoursFromServer(
          weekHours,
          (data as { weekKey?: string }).weekKey,
          todayLive
        );
        if (mountedRef.current) {
          const todayLabel =
            todayLive > 0
              ? `${formatWeekHours(todayLive)} today · Mon–Sun total`
              : 'Mon–Sun · from check-in/out';
          setKpiMetrics((prev) => ({ ...prev, weekHoursSubtitle: todayLabel }));
        }
      }
    } catch (err) {
      debug.warn('syncWeeklyHours failed', err);
    }
  }, [authUid, ingestWeekHoursFromServer]);

  useEffect(() => {
    if (!authUid) return;
    const cached = readCachedWeekHours(authUid);
    if (cached) {
      setKpiMetrics((prev) => ({ ...prev, hoursThisWeek: formatWeekHours(cached.hours) }));
    }
  }, [authUid]);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [payrollCycleSummary, setPayrollCycleSummary] = useState<{
    cycleStartDate: string;
    cycleEndDate: string;
    salaryReleaseDate: string;
    salaryHoldUntil: string;
    holdDays: number;
    cycleLabel: string;
    currency: string;
  } | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [breakHistory, setBreakHistory] = useState<BreakRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
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
    isOnBreakRef.current = todayAttendance.isOnBreak;
  }, [todayAttendance.isOnBreak]);

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
    const onBreakGuard =
      isOnBreakRef.current && timeSinceAction < SYNC_CONFIG.BREAK_ACTION_GUARD_MS;

    if (recentAction || recentSocket || onBreakGuard) {
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
        if (mountedRef.current) setLoading(false);
      }, SYNC_CONFIG.ACTION_TIMEOUT_MS);

      debug.group('[FETCH DASHBOARD]');
      debug.log('⚡ Fetching all dashboard data in parallel...');

      const holidayYear = new Date().getFullYear();
      const tenantOrgId = resolveAuthOrgId(user);
      const holidaysUrl = appendOrgIdParam(
        `holidays?year=${holidayYear}&limit=500`,
        user,
        tenantOrgId
      );

      const [attendanceResult, holidaysResult, payrollResult] = await Promise.allSettled([
        apiGetSafe('/attendance/today', false),
        apiGetSafe(holidaysUrl, false),
        apiGetSafe('/payroll/employee/cycle-summary', false),
      ]);

      const holidayKey = holidaysStorageKey(authUid, user?.orgId || user?.tenantId);
      const cachedHolidays = localStorage.getItem(holidayKey);
      if (cachedHolidays) {
        try {
          const parsed = JSON.parse(cachedHolidays) as Holiday[];
          setHolidays(parsed);
        } catch (e) {
          console.warn('Failed to parse cached holidays');
        }
      }

      if (
        holidaysResult.status === 'fulfilled' &&
        holidaysResult.value.ok &&
        holidaysResult.value.data &&
        (holidaysResult.value.data as { success?: boolean }).success !== false
      ) {
        const holidayPayload = holidaysResult.value.data as { data?: Holiday[] };
        const list: Holiday[] = Array.isArray(holidayPayload.data)
          ? holidayPayload.data
          : Array.isArray(holidayPayload)
            ? (holidayPayload as Holiday[])
            : [];
        if (list.length > 0) {
          console.log('✅ Loaded', list.length, 'holidays');
          if (mountedRef.current) setHolidays(list);
          localStorage.setItem(holidayKey, JSON.stringify(list));
        }
      } else if (cachedHolidays) {
        try {
          const parsed = JSON.parse(cachedHolidays) as Holiday[];
          console.log('📦 Using cached holidays:', parsed.length);
          setHolidays(parsed);
        } catch (e) {
          console.warn('Failed to parse cached holidays');
        }
      }

      // Handle payroll cycle summary
      if (
        payrollResult.status === 'fulfilled' &&
        payrollResult.value.ok &&
        payrollResult.value.data &&
        (payrollResult.value.data as { success?: boolean }).success !== false
      ) {
        const payrollPayload = payrollResult.value.data as { data?: Record<string, unknown> };
        const cycleData = payrollPayload.data;
        if (cycleData && typeof cycleData === 'object') {
          console.log('✅ Loaded payroll cycle summary');
          if (mountedRef.current) setPayrollCycleSummary(cycleData as typeof payrollCycleSummary);
        }
      } else {
        console.warn('Payroll cycle summary unavailable');
      }

      const attendanceResolved =
        attendanceResult.status === 'fulfilled' ? attendanceResult.value : null;

      debug.log('📊 Attendance API Result:', {
        status: attendanceResult.status,
        ok: attendanceResolved?.ok,
        hasData: attendanceResolved?.ok ? !!(attendanceResolved.data as { data?: unknown })?.data : false,
        error:
          attendanceResult.status === 'rejected'
            ? String((attendanceResult.reason as Error)?.message || attendanceResult.reason)
            : attendanceResolved && !attendanceResolved.ok
              ? attendanceResolved.error
              : undefined,
      });

      const attendanceApiOk =
        attendanceResult.status === 'fulfilled' &&
        attendanceResolved?.ok === true &&
        (attendanceResolved.data as { success?: boolean })?.success === true;

      const attendanceData: TodayAttendanceApiData | null = attendanceApiOk
        ? ((attendanceResolved!.data as { data?: TodayAttendanceApiData }).data ?? null)
        : null;

      if (!attendanceApiOk) {
        debug.warn('📊 Attendance sync skipped — no definitive server response; keeping cached/local state', {
          status: attendanceResult.status,
          error:
            attendanceResult.status === 'rejected'
              ? String((attendanceResult.reason as Error)?.message || attendanceResult.reason)
              : attendanceResolved && !attendanceResolved.ok
                ? attendanceResolved.error
                : undefined,
        });
        if (!actionInProgressRef.current) {
          loadFromLocalStorage();
        }
      } else if (attendanceData?.attendance) {
        const attendance = attendanceData.attendance;
        const checkInTime = safeLocaleTime(attendance.checkIn);
        const checkOutTime = safeLocaleTime(attendance.checkOut);

        const ls = attendanceData.liveStatus;
        const hasCheckOut = attendance.checkOut != null && checkOutTime != null;

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

        let completedBreakSeconds = 0;
        let openBreakSegmentSeconds = 0;
        if (attendance.breaks && attendance.breaks.length > 0) {
          for (const br of attendance.breaks as BreakRecord[]) {
            if (!br.startTime) continue;
            const start = new Date(br.startTime).getTime();
            if (!Number.isFinite(start)) continue;
            if (br.endTime) {
              const end = new Date(br.endTime).getTime();
              if (Number.isFinite(end) && end > start) {
                completedBreakSeconds += Math.floor((end - start) / 1000);
              }
            }
          }
          // FIX: Use safeArrayAccess to safely get last break without throwing
          const lastBreak = safeArrayAccess(
            attendance.breaks,
            attendance.breaks.length - 1,
            {} as BreakRecord
          );
          if (lastBreak?.startTime && !lastBreak?.endTime) {
            calculatedIsOnBreak = true;
            const breakStart = new Date(lastBreak.startTime).getTime();
            openBreakSegmentSeconds = Math.max(0, Math.floor((Date.now() - breakStart) / 1000));
            calculatedBreakDuration = Math.round(openBreakSegmentSeconds / 60);
            calculatedBreakType = lastBreak.breakType || lastBreak.type || 'regular';
            currentBreakSegmentSecondsRef.current = openBreakSegmentSeconds;
            setBreakDisplaySeconds(openBreakSegmentSeconds);
          }
        }
        completedBreakSecondsRef.current = completedBreakSeconds;
        breakSecondsRef.current = completedBreakSeconds + openBreakSegmentSeconds;

        calculatedIsOnBreak = resolveOnBreakFromServer(
          ls as Record<string, unknown> | undefined,
          attendance.breaks as BreakRecord[] | undefined,
          calculatedIsOnBreak
        );

        if (calculatedIsOnBreak) {
          const fromLs = (ls as { currentBreakDuration?: number })?.currentBreakDuration;
          if (typeof fromLs === 'number' && fromLs > 0) {
            calculatedBreakDuration = Math.round(fromLs);
            const segFromLs = Math.round(fromLs * 60);
            currentBreakSegmentSecondsRef.current = Math.max(
              currentBreakSegmentSecondsRef.current,
              segFromLs
            );
            setBreakDisplaySeconds(currentBreakSegmentSecondsRef.current);
            breakSecondsRef.current =
              completedBreakSecondsRef.current + currentBreakSegmentSecondsRef.current;
          }
        }

        // Break duration now tracked via state only, not separate useState

        const totalBreakMin =
          typeof (ls as { totalBreakTime?: number })?.totalBreakTime === 'number'
            ? Math.round((ls as { totalBreakTime: number }).totalBreakTime)
            : 0;
        if (mountedRef.current) {
          setKpiMetrics((prev) => ({ ...prev, breakTodayMinutes: totalBreakMin }));
        }

        debug.log('✅ Updating attendance from API:', {
          isCheckedIn: isCurrentlyCheckedIn,
          isOnBreak: calculatedIsOnBreak,
          breakType: calculatedBreakType
        });

        if (mountedRef.current) {
          updateAttendance({
            isCheckedIn: isCurrentlyCheckedIn,
            checkInTime: checkInTime,
            checkOutTime: checkOutTime,
            hoursWorked: (attendance.hoursWorked as number) || 0,
            status: (attendance.status as string) || 'absent',
            isOnBreak: calculatedIsOnBreak,
            currentBreakDuration: calculatedBreakDuration,
            breakType: calculatedBreakType,
          });
        }

        const uid = authUid;
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
        const uid = authUid;
        const cached = await readPersistedAttendance(uid);
        const hasFreshCheckedIn =
          cached &&
          isPayloadFresh(cached) &&
          (cached.isCheckedIn || cached.checkedIn) &&
          !cached.checkOutTime;

        if (hasFreshCheckedIn && !attendanceApiOk) {
          debug.warn(
            'Attendance API failed — using short-lived local cache'
          );
          updateAttendance({
            isCheckedIn: true,
            checkInTime: cached.checkInTime || null,
            checkOutTime: cached.checkOutTime || null,
            hoursWorked: cached.hoursWorked || cached.currentHours || 0,
            status: cached.status || 'present',
            isOnBreak: cached.isOnBreak || false,
            currentBreakDuration: cached.currentBreakDuration || 0,
            breakType: cached.breakType || 'regular',
          });
        } else {
          debug.log('ℹ️ No attendance for today — showing Check In');
          updateAttendance({
            isCheckedIn: false,
            checkInTime: null,
            checkOutTime: null,
            hoursWorked: 0,
            status: 'absent',
            isOnBreak: false,
            currentBreakDuration: 0,
            breakType: 'regular',
          });
          await clearPersistedAttendance(uid);
        }
      }

      if (attendanceApiOk) {
        clearApiCache('/attendance/today');
        if (typeof attendanceData?.hoursThisWeek === 'number') {
          const todayLive =
            typeof attendanceData?.liveStatus?.currentHours === 'number'
              ? attendanceData.liveStatus.currentHours
              : 0;
          ingestWeekHoursFromServer(
            attendanceData.hoursThisWeek,
            attendanceData.weekKey,
            todayLive
          );
        }
      }

      let leaveBalanceLabel = '0 days';
      let leaveBalanceSubtitle = '';
      try {
        const empId =
          employeeIdRef.current || (await resolveEmployeeMongoId(user));
        if (empId) {
          employeeIdRef.current = empId;
          setEmployeeId(empId);
          const now = new Date();
          const summary = await fetchLeaveBalanceKpiSummary(
            empId,
            now.getFullYear(),
            now.getMonth() + 1
          );
          const formatted = formatLeaveBalanceKpi(summary);
          leaveBalanceLabel = formatted.value;
          leaveBalanceSubtitle = formatted.subtitle;
        }
      } catch (err) {
        debug.warn('Leave balance KPI fetch failed', err);
      }

      setKpiMetrics((prev) => ({
        ...prev,
        leaveBalance: leaveBalanceLabel,
        leaveBalanceSubtitle,
        performance: "85%",
      }));

      debug.groupEnd();
    } catch (err) {
      debug.error('Failed to fetch dashboard data:', err);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (mountedRef.current) setLoading(false);
    }
  }, [user, isRecentlyUpdated, updateAttendance, loadFromLocalStorage, ingestWeekHoursFromServer]);

  fetchDashboardDataRef.current = fetchDashboardData;

  const ensureEmployeeId = async (): Promise<string | null> => {
    if (employeeIdRef.current) return employeeIdRef.current;
    const empId = await resolveEmployeeMongoId(user);
    if (empId) {
      setEmployeeId(empId);
      employeeIdRef.current = empId;
    }
    return empId;
  };

  const refreshLeaveBalance = useCallback(async () => {
    if (!authUid) return;
    try {
      const empId = await ensureEmployeeId();
      if (!empId) return;
      const now = new Date();
      const summary = await fetchLeaveBalanceKpiSummary(
        empId,
        now.getFullYear(),
        now.getMonth() + 1
      );
      if (mountedRef.current) {
        const formatted = formatLeaveBalanceKpi(summary);
        setKpiMetrics((prev) => ({
          ...prev,
          leaveBalance: formatted.value,
          leaveBalanceSubtitle: formatted.subtitle,
        }));
      }
    } catch (err) {
      debug.warn('refreshLeaveBalance failed', err);
    }
  }, [user]);

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

  safeRefreshRef.current = safeRefresh;

  // Fetch data on mount — cache hydrates via AttendanceContext when user is ready
  useEffect(() => {
    if (!authUid) {
      // FIX #2: Reset week hours tracking on logout
      lastWeekKeyRef.current = null;
      weekHoursExclTodayRef.current = 0;
      return;
    }
    loadFromLocalStorage();
    const timeoutId = setTimeout(() => {
      void fetchDashboardDataRef.current?.(true);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [authUid, loadFromLocalStorage]);

  // Seed employeeId from auth profile (avoids 404 on strict org employee lookup)
  useEffect(() => {
    const fromAuth = user?.employeeId != null ? String(user.employeeId) : '';
    if (isLikelyMongoObjectId(fromAuth)) {
      setEmployeeId(fromAuth);
    } else {
      void ensureEmployeeId();
    }
  }, [authUid, user?.employeeId]);

  // ============================================================================
  // SOCKET.IO LISTENERS - FIXED: Use refs to prevent stale closures
  // ============================================================================
  useEffect(() => {
    // Match realTimeSocket: org can be orgId or tenantId; listeners only need employeeId + user session
    if (!authUid || !employeeIdRef.current) return;

    debug.group('[SOCKET LISTENERS SETUP]');
    debug.log('📡 [EMPLOYEE-DASHBOARD] Setting up Socket.IO listeners with employeeId:', employeeIdRef.current);

    // CRITICAL FIX: Use refs instead of state to prevent stale closures
    const handleBreakStarted = (data: any) => {
      debug.log('📡 [EMPLOYEE-DASHBOARD] break:started event received:', data);
      if (!data?.employeeId || !employeeIdRef.current) return;
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        debug.log('📡 [EMPLOYEE-DASHBOARD] Break started for current employee, updating state');
        setLastSocketEventTime(Date.now());
        resetCurrentBreakSegment();
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
        authUid &&
        (String(data.userId) === authUid ||
          String(data.attendance?.userId) === authUid);
      if (matchEmployee || matchUser) {
        setLastSocketEventTime(Date.now());
        completedBreakSecondsRef.current = breakSecondsRef.current;
        resetCurrentBreakSegment();
        const ls = data.liveStatus;
        updateAttendance(
          {
            isOnBreak: false,
            currentBreakDuration: 0,
            breakType: (ls?.breakType as string) || 'regular',
            isCheckedIn: true,
          },
          'socket'
        );
        disableRefreshRef.current = true;
        setTimeout(() => {
          disableRefreshRef.current = false;
        }, SYNC_CONFIG.BREAK_ACTION_GUARD_MS);
      }
    };

    const handleCheckedIn = (data: AttendanceEvent) => {
      debug.log('📡 [EMPLOYEE-DASHBOARD] attendance:checked_in event received:', data);
      if (String(data.employeeId) === String(employeeIdRef.current)) {
        debug.log('📡 [EMPLOYEE-DASHBOARD] Check-in for current employee, updating state');
        setLastSocketEventTime(Date.now());
        updateAttendance({
          isCheckedIn: true,
          checkInTime: safeLocaleTime(data.checkInTime),
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
          checkOutTime: safeLocaleTime(new Date()) || null,
          isOnBreak: false,
        }, 'socket');
      }
    };

    // Subscribe to events and store unsubscribe functions
    const unsubscribeBreakStarted = realTimeSocket.onBreakStarted(handleBreakStarted);
    const unsubscribeBreakEnded = realTimeSocket.onBreakEnded(handleBreakEnded);
    const unsubscribeCheckedIn = realTimeSocket.on('attendance:checked_in', handleCheckedIn);
    const unsubscribeCheckedOut = realTimeSocket.on('attendance:checked_out', handleCheckedOut);

    debug.groupEnd();

    return () => {
      debug.log('📡 [EMPLOYEE-DASHBOARD] Cleaning up Socket.IO listeners');
      unsubscribeBreakStarted?.();
      unsubscribeBreakEnded?.();
      unsubscribeCheckedIn();
      unsubscribeCheckedOut();
    };
  }, [authUid, employeeId]);

  // Fetch attendance history
  const resetCurrentBreakSegment = useCallback(() => {
    currentBreakSegmentSecondsRef.current = 0;
    setBreakDisplaySeconds(0);
  }, []);

  const resetAllBreakTracking = useCallback(() => {
    completedBreakSecondsRef.current = 0;
    breakSecondsRef.current = 0;
    currentBreakSegmentSecondsRef.current = 0;
    setBreakDisplaySeconds(0);
  }, []);

  const fetchAttendanceHistory = useCallback(async () => {
    try {
      setAttendanceLoading(true);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await apiGetSafe<{ success?: boolean; data?: AttendanceRecord[] }>(
        `/attendance?limit=30&startDate=${thirtyDaysAgo.toISOString()}`
      );

      if (result.ok && result.data?.success && Array.isArray(result.data.data)) {
        const rows = result.data.data;
        if (!mountedRef.current) return;
        setAttendanceHistory(rows);

        const breaks: BreakRecord[] = [];
        rows.forEach((record: AttendanceRecord) => {
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
      if (mountedRef.current) setAttendanceLoading(false);
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
    if (!todayAttendance.isCheckedIn || disableRefresh || todayAttendance.isOnBreak) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastUserActivityRef.current > 120_000) return;
      if (isOnBreakRef.current) return;

      // Use refs directly to avoid dependency array issues
      if (!actionInProgressRef.current && !disableRefreshRef.current && !isRecentlyUpdated()) {
        debug.log('⏰ Periodic refresh triggered');
        void safeRefreshRef.current?.();
      }
    }, SYNC_CONFIG.PERIODIC_REFRESH_MS);

    return () => clearInterval(interval);
  }, [todayAttendance.isCheckedIn, todayAttendance.isOnBreak, disableRefresh, isRecentlyUpdated]);

  // Refresh KPIs from server (hours + leave balance) — single interval to reduce load
  useEffect(() => {
    if (!authUid) return;
    void syncWeeklyHours();
    void refreshLeaveBalance();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void syncWeeklyHours();
      void refreshLeaveBalance();
    }, SYNC_CONFIG.WEEK_HOURS_SYNC_MS);
    const unsubLeave = realTimeSocket.onLeaveUpdate(() => {
      void refreshLeaveBalance();
    });
    const unsubAlloc = realTimeSocket.on('leave_allocation_created', () => {
      void refreshLeaveBalance();
    });
    const unsubAttendance = realTimeSocket.on('attendance:update', () => {
      lastWeekSyncRef.current = 0;
      void syncWeeklyHours();
    });
    return () => {
      clearInterval(interval);
      unsubLeave();
      unsubAlloc();
      unsubAttendance();
    };
  }, [authUid, syncWeeklyHours, refreshLeaveBalance]);

  // Refresh stale KPIs once when user returns to the tab
  useEffect(() => {
    if (!authUid) return;
    return onPageVisible(() => {
      void syncWeeklyHours();
      void refreshLeaveBalance();
      if (todayAttendance.isCheckedIn && !disableRefresh) {
        void safeRefresh(true);
      }
    });
  }, [authUid, todayAttendance.isCheckedIn, disableRefresh, syncWeeklyHours, refreshLeaveBalance, safeRefresh]);

  // ============================================================================
  // TIMER SYSTEM - Track working hours, breaks, and meetings in real-time
  // ============================================================================
  useEffect(() => {
    if (!todayAttendance.isCheckedIn) {
      setWorkingHours(0);
      resetAllBreakTracking();
      return;
    }

    const interval = setInterval(() => {
      // FIX #1: Pause timer when tab is hidden to prevent drift
      if (document.visibilityState !== 'visible') return;
      
      if (!todayAttendance.checkInTime) return;
      const checkInTime = parseTodayCheckInTime(todayAttendance.checkInTime);
      if (!checkInTime) return;

      const elapsedSec = Math.max(0, (Date.now() - checkInTime.getTime()) / 1000);

      if (todayAttendance.isOnBreak) {
        currentBreakSegmentSecondsRef.current += 1;
        const seg = currentBreakSegmentSecondsRef.current;
        breakSecondsRef.current = completedBreakSecondsRef.current + seg;
        setBreakDisplaySeconds(seg);
      } else {
        setBreakDisplaySeconds(0);
        breakSecondsRef.current = completedBreakSecondsRef.current;
      }

      const workedSec = Math.max(0, elapsedSec - breakSecondsRef.current);
      setWorkingHours(workedSec / 3600);
    }, 1000);

    return () => clearInterval(interval);
  }, [todayAttendance.isCheckedIn, todayAttendance.isOnBreak, todayAttendance.checkInTime, resetAllBreakTracking]);

  // Live "Hours This Week" — server baseline + today's worked hours (pauses live increment on break)
  useEffect(() => {
    if (!todayAttendance.isCheckedIn) return;
    const tick = () => {
      const todayPart = workingHours;
      applyWeekHours(weekHoursExclTodayRef.current + todayPart, calendarWeekKey(), true);
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [todayAttendance.isCheckedIn, todayAttendance.isOnBreak, workingHours, applyWeekHours]);

  const formatTime = safeFormatTime;

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
      const day = localDayKey();
      const idempotencyKey = `break-start-${resolvedEmployeeId || authUid || 'me'}-${day}-${Date.now()}`;
      
      const requestPayload: {
        breakType: string;
        notes: string;
        idempotencyKey: string;
        employeeId?: string | null;
      } = {
        breakType,
        notes: `Break started`,
        idempotencyKey
      };
      if (isLikelyMongoObjectId(resolvedEmployeeId)) requestPayload.employeeId = resolvedEmployeeId;
      
      debug.log('🔄 [BREAK START] Sending request:', { breakType, employeeId: resolvedEmployeeId });
      
      resetCurrentBreakSegment();
      updateAttendance({
        isOnBreak: true,
        breakType: breakType,
        currentBreakDuration: 0
      }, 'action');
      
        const result = await postAttendanceAction(
          '/attendance/break-start',
          requestPayload,
          idempotencyKey
        );

        if (!result.ok) {
          if (result.status === 409) {
            toast.info('Break action is processing. Syncing…');
            disableRefreshRef.current = true;
            clearApiCache('/attendance/today');
            await new Promise((r) => setTimeout(r, 2000));
            await fetchDashboardDataRef.current?.(true);
            setTimeout(() => {
              disableRefreshRef.current = false;
            }, SYNC_CONFIG.BREAK_ACTION_GUARD_MS);
            return;
          }
          throw new Error(result.message);
        }

        debug.log('✅ [BREAK START] Success:', result);

        const payload = result.data as {
          liveStatus?: Record<string, unknown>;
          hoursThisWeek?: number;
          weekKey?: string;
          attendance?: { breaks?: BreakRecord[] };
        };
        const liveStatus = payload?.liveStatus;
        updateAttendance(
          {
            isOnBreak: resolveOnBreakFromServer(
              liveStatus,
              payload?.attendance?.breaks,
              true
            ),
            breakType: (liveStatus?.breakType as string) || breakType,
            currentBreakDuration:
              typeof liveStatus?.currentBreakDuration === 'number'
                ? Math.round(liveStatus.currentBreakDuration as number)
                : 0,
          },
          'action'
        );

        if (typeof payload?.hoursThisWeek === 'number') {
          const liveH =
            typeof liveStatus?.currentHours === 'number'
              ? (liveStatus.currentHours as number)
              : 0;
          ingestWeekHoursFromServer(payload.hoursThisWeek, payload.weekKey, liveH);
        } else {
          void syncWeeklyHours();
        }

        clearApiCache('/attendance/today');
        disableRefreshRef.current = true;
        void fetchAttendanceHistory();
        setTimeout(() => {
          disableRefreshRef.current = false;
        }, SYNC_CONFIG.BREAK_ACTION_GUARD_MS);
        toast.success('Break started');
        setLastSocketEventTime(Date.now());
    } catch (error) {
      debug.error('❌ [BREAK START] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Could not start break');
      resetCurrentBreakSegment();
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
    
    let wasOnBreak = todayAttendance.isOnBreak;
    let prevBreakType = todayAttendance.breakType;
    let prevBreakDuration = todayAttendance.currentBreakDuration;

    try {
      actionInProgressRef.current = true;
      setAttendanceBusy('break-end');
      lastActionTimeRef.current = Date.now();
      
      const resolvedEmployeeId = await ensureEmployeeId();
      const idempotencyKey = `break-end-${resolvedEmployeeId || authUid || 'me'}-${localDayKey()}-${Date.now()}`;
      
      const payload: { notes: string; idempotencyKey: string; employeeId?: string | null } = {
        notes: 'Break ended',
        idempotencyKey
      };
      if (isLikelyMongoObjectId(resolvedEmployeeId)) payload.employeeId = resolvedEmployeeId;
      
      debug.log('🔄 [BREAK END] Sending request:', { employeeId: resolvedEmployeeId });
      
      completedBreakSecondsRef.current = breakSecondsRef.current;
      resetCurrentBreakSegment();
      updateAttendance({
        isOnBreak: false,
        breakType: 'regular',
        currentBreakDuration: 0
      }, 'action');
      
        const result = await postAttendanceAction('/attendance/break-end', payload, idempotencyKey);

        if (!result.ok) {
          if (result.status === 409) {
            toast.info('Break action is processing. Syncing…');
            disableRefreshRef.current = true;
            clearApiCache('/attendance/today');
            await new Promise((r) => setTimeout(r, 2000));
            await fetchDashboardDataRef.current?.(true);
            setTimeout(() => {
              disableRefreshRef.current = false;
            }, SYNC_CONFIG.BREAK_ACTION_GUARD_MS);
            return;
          }
          throw new Error(result.message);
        }

        debug.log('✅ [BREAK END] Success:', result);

        const breakPayload = result.data as {
          liveStatus?: Record<string, unknown>;
          hoursThisWeek?: number;
          weekKey?: string;
          attendance?: { breaks?: BreakRecord[] };
        };
        const liveStatus = breakPayload?.liveStatus;
        updateAttendance(
          {
            isOnBreak: resolveOnBreakFromServer(
              liveStatus,
              breakPayload?.attendance?.breaks,
              false
            ),
            breakType: (liveStatus?.breakType as string) || 'regular',
            currentBreakDuration: 0,
            isCheckedIn: true,
          },
          'action'
        );

        if (typeof breakPayload?.hoursThisWeek === 'number') {
          const liveH =
            typeof liveStatus?.currentHours === 'number' ? liveStatus.currentHours : 0;
          ingestWeekHoursFromServer(breakPayload.hoursThisWeek, breakPayload.weekKey, liveH);
        } else {
          void syncWeeklyHours();
        }

        const uid = authUid;
        writePersistedAttendance(uid, {
          checkedIn: true,
          isCheckedIn: true,
          checkInTime: todayAttendance.checkInTime,
          checkOutTime: todayAttendance.checkOutTime,
          currentHours: todayAttendance.hoursWorked,
          hoursWorked: todayAttendance.hoursWorked,
          status: todayAttendance.status || 'present',
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular',
          timestamp: Date.now(),
        });

        clearApiCache('/attendance/today');
        void fetchAttendanceHistory();
        setLastSocketEventTime(Date.now());
        disableRefreshRef.current = true;
        toast.success('Break ended');
        // FIX: Use consistent BREAK_ACTION_GUARD_MS instead of hardcoded 4000
        setTimeout(() => {
          disableRefreshRef.current = false;
        }, SYNC_CONFIG.BREAK_ACTION_GUARD_MS);
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

      const idempotencyKey = `check-in-${authUid || 'me'}-${localDayKey()}-${Date.now()}`;
      const payload: { notes: string; idempotencyKey: string } = {
        notes: 'Checked in',
        idempotencyKey
      };

        const result = await postAttendanceAction('/attendance/check-in', payload, idempotencyKey);

        if (!result.ok) {
          if (result.status === 409) {
            clearApiCache('/attendance/today');
            runSafe('check-in-sync', () => fetchDashboardDataRef.current?.(true));
            return;
          }
          throw new Error(result.message);
        }

        const responsePayload = result.data as {
          attendance?: Record<string, unknown>;
          hoursThisWeek?: number;
          weekKey?: string;
          checkIn?: string | Date;
          message?: string;
        };
        const serverAtt = (responsePayload?.attendance ?? responsePayload) as Record<
          string,
          unknown
        >;

        const checkInTime =
          safeLocaleTime(serverAtt?.checkIn) ||
          safeLocaleTime(new Date()) ||
          new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        if (typeof responsePayload?.hoursThisWeek === 'number') {
          ingestWeekHoursFromServer(responsePayload.hoursThisWeek, responsePayload.weekKey, 0);
        }

        updateAttendance({
          isCheckedIn: true,
          checkInTime: checkInTime,
          checkOutTime: null,
          status: 'present',
          isOnBreak: false,
          currentBreakDuration: 0,
        }, 'action');

        const uid = authUid;
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
        void syncWeeklyHours();
        toast.success('Checked in successfully');
        setLastSocketEventTime(Date.now());
        lastActionTimeRef.current = Date.now();
        setTimeout(() => {
          runSafe('post-check-in', () => fetchDashboardDataRef.current?.(true));
        }, 400);
    } catch (error) {
      console.error('Check-in error:', error);
      const message = error instanceof Error ? error.message : 'Check-in failed';
      toast.error(message);
      if (message.toLowerCase().includes('session') || message.toLowerCase().includes('token')) {
        return;
      }
      clearApiCache('/attendance/today');
      runSafe('post-check-in-error', () => fetchDashboardDataRef.current?.(true));
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
      const idempotencyKey = `check-out-${authUid || 'me'}-${localDayKey()}-${Date.now()}`;
      const payload: { notes: string; employeeId?: string | null; idempotencyKey: string } = {
        notes: 'Checked out',
        idempotencyKey
      };
      if (isLikelyMongoObjectId(resolvedEmployeeId)) payload.employeeId = resolvedEmployeeId;

        const result = await postAttendanceAction('/attendance/check-out', payload, idempotencyKey);

        if (!result.ok) {
          if (result.status === 409) {
            clearApiCache('/attendance/today');
            runSafe('attendance-sync', () => fetchDashboardDataRef.current?.(true));
            return;
          }
          throw new Error(result.message);
        }

        const checkOutPayload = result.data as {
          attendance?: Record<string, unknown>;
          hoursThisWeek?: number;
          weekKey?: string;
        };
        const serverAtt = (checkOutPayload?.attendance ?? checkOutPayload) as Record<string, unknown>;
        const hoursWorked =
          typeof serverAtt?.hoursWorked === 'number' && !Number.isNaN(serverAtt.hoursWorked)
            ? serverAtt.hoursWorked
            : 0;
        const checkOutTime =
          safeLocaleTime(serverAtt?.checkOut) ||
          safeLocaleTime(new Date()) ||
          new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        if (typeof checkOutPayload?.hoursThisWeek === 'number') {
          ingestWeekHoursFromServer(checkOutPayload.hoursThisWeek, checkOutPayload.weekKey, 0);
        } else {
          void syncWeeklyHours();
        }
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

        const uid = authUid;
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
        void syncWeeklyHours();
        const apiMessage = (checkOutPayload as { message?: string })?.message || '';
        toast.success(
          apiMessage.toLowerCase().includes('check in again')
            ? 'Session ended. You can check in again anytime.'
            : 'Checked out successfully'
        );
        setLastSocketEventTime(Date.now());
        lastActionTimeRef.current = Date.now();
        setTimeout(() => {
          runSafe('post-check-in', () => fetchDashboardDataRef.current?.(true));
        }, 400);
    } catch (error) {
      console.error('Check-out error:', error);
      toast.error(error instanceof Error ? error.message : 'Check-out failed');
      clearApiCache('/attendance/today');
      runSafe('post-check-out-error', () => fetchDashboardDataRef.current?.(true));
    } finally {
      actionInProgressRef.current = false;
      setAttendanceBusy(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="p-8 space-y-8">
        {/* Welcome Header with Attendance Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-2">
          <StaticGreetingHeader userName={user?.name || 'Employee'} />

          <div className="w-full lg:min-w-[340px] lg:max-w-[420px] shrink-0 rounded-2xl bg-muted/35 px-5 py-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Today&apos;s attendance
              </p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 border-0 shadow-none text-muted-foreground hover:text-foreground hover:bg-background/60"
                disabled={loading || disableRefresh || !!attendanceBusy}
                onClick={() => safeRefresh(true)}
                title="Refresh attendance"
                aria-label="Refresh attendance from server"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {todayAttendance.isCheckedIn ? (
              <div className="space-y-1">
                <Badge
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border-0 ${
                    todayAttendance.isOnBreak
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {todayAttendance.isOnBreak
                    ? `On break · ${formatTime(breakDisplaySeconds)}`
                    : `Working · ${formatTime(workingHours * 3600)}`}
                </Badge>
                {todayAttendance.checkInTime && (
                  <p className="text-xs text-muted-foreground">
                    Checked in at {todayAttendance.checkInTime}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not checked in yet today</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {!todayAttendance.isCheckedIn ? (
                <Button
                  type="button"
                  size="default"
                  className="h-11 flex-1 min-w-[140px] border-0 shadow-none bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
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
                    className="h-11 flex-1 min-w-[120px] border-0 shadow-none bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl"
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
                      className="h-11 flex-1 min-w-[100px] border-0 shadow-none bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl"
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
                      className="h-11 flex-1 min-w-[120px] border-0 shadow-none bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl"
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
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KPICard
            title="Leave Balance"
            value={kpiMetrics.leaveBalance}
            subtitle={kpiMetrics.leaveBalanceSubtitle || 'Available to use'}
            icon={Calendar}
            color="primary"
          />
          <KPICard
            title="Hours This Week"
            value={kpiMetrics.hoursThisWeek}
            subtitle={
              kpiMetrics.weekHoursSubtitle || 'Mon–Sun · working hours only (breaks excluded)'
            }
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

        {/* Payroll Cycle Summary */}
        {payrollCycleSummary && (
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Payroll Cycle</h3>
                    <p className="text-sm text-muted-foreground">Current cycle dates</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Cycle</p>
                  <p className="text-sm font-medium">{payrollCycleSummary.cycleLabel}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Hold Period</p>
                  <p className="text-sm font-medium">
                    {payrollCycleSummary.cycleStartDate ? 
                      `${new Date(payrollCycleSummary.cycleStartDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })} - ${new Date(payrollCycleSummary.salaryHoldUntil).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}`
                      : 'N/A'
                    }
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Payment Date</p>
                  <p className="text-sm font-medium">
                    {payrollCycleSummary.salaryReleaseDate ?
                      new Date(payrollCycleSummary.salaryReleaseDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })
                      : 'N/A'
                    }
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Currency</p>
                  <p className="text-sm font-medium">₹ {payrollCycleSummary.currency}</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Apply leave — click a day on the calendar */}
        <InteractiveCalendar />

        {/* Holidays */}
        <div className="grid grid-cols-1 gap-6">
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