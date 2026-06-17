import { KPICard } from '../../components/KPICard';
import ChatWidget from '../../components/ChatWidget';
import {
  Users,
  TrendingUp,
  Receipt,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  IndianRupee,
  LogIn,
  Coffee,
  TrendingDown,
  Gift,
  Zap,
  Trash2,
  Edit,
  Download,
  Loader2,
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useIsMounted } from '../../hooks/useIsMounted';
import { useFetchGeneration } from '../../hooks/useFetchGeneration';
import { extractApiList } from '../../utils/api';
import { apiGet, apiPatch, apiDelete, clearApiCache } from '../../utils/apiHelper';
import { ensureAccessToken } from '../../utils/sessionAuth';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';
import { ensureArray, safeCell, authUserKey } from '../../utils/safeUi';

const DASHBOARD_SOCKET_DEBOUNCE_MS = 2500;

type BreakRow = {
  attendanceId?: string;
  employeeId?: string;
  employeeName: string;
  department?: string;
  breakIndex?: number;
  breakType?: string;
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  status: 'active' | 'ended';
};

type DashboardStats = {
  totalEmployees: number;
  avgProductivity: number;
  thisMonthExpenses: number;
  thisMonthPayroll: number;
  totalCost: number;
  loggedInEmployees: number;
  onLeave: number;
};

type QuickStats = {
  totalEmployees: number;
  presentToday: number;
  attendanceRate: number;
  pendingLeaves: number;
  pendingExpenses: number;
  activeUsers: number;
  onLeave: number;
  onBreak: number;
  totalSales: number;
  totalLoss: number;
  totalBonus: number;
  totalIncentive: number;
};

type ExpenseTrendRow = { month: string; amount: number };

type LeaveRequestRow = {
  _id?: string;
  id?: string;
  employeeName?: string;
  employeeEmail?: string;
  department?: string;
  type?: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  createdAt?: string;
  userId?: { name?: string };
};

type AttendanceRow = {
  _id?: string;
  employeeName: string;
  department?: string;
  employeeId?: { department?: string };
  checkIn?: string;
  hoursWorked?: number;
  breaks?: Array<{ startTime?: string; endTime?: string | null; breakType?: string }>;
};

type EditingLeave = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  employeeName: string;
};

const defaultDashboardStats: DashboardStats = {
  totalEmployees: 0,
  avgProductivity: 0,
  thisMonthExpenses: 0,
  thisMonthPayroll: 0,
  totalCost: 0,
  loggedInEmployees: 0,
  onLeave: 0,
};

const defaultQuickStats: QuickStats = {
  totalEmployees: 0,
  presentToday: 0,
  attendanceRate: 0,
  pendingLeaves: 0,
  pendingExpenses: 0,
  activeUsers: 0,
  onLeave: 0,
  onBreak: 0,
  totalSales: 0,
  totalLoss: 0,
  totalBonus: 0,
  totalIncentive: 0,
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function breakMinutesSince(startTime: string) {
  return Math.max(0, Math.round((Date.now() - new Date(startTime).getTime()) / (1000 * 60)));
}

function summarizeAttendanceBreaks(
  breaks?: Array<{ startTime?: string; endTime?: string | null; breakType?: string }>
) {
  if (!breaks?.length) {
    return { label: 'No breaks', start: null as string | null, end: null as string | null, onBreak: false };
  }
  const last = breaks[breaks.length - 1];
  const onBreak = Boolean(last.startTime && !last.endTime);
  const lastEnded = [...breaks].reverse().find((b) => b.endTime);
  return {
    label: onBreak ? 'On break' : breaks.some((b) => b.endTime) ? 'Break logged' : 'No breaks',
    start: (onBreak ? last.startTime : lastEnded?.startTime ?? last.startTime) ?? null,
    end: onBreak ? null : (last.endTime ?? lastEnded?.endTime ?? null),
    onBreak,
    breakType: (onBreak ? last : lastEnded || last).breakType || 'regular',
  };
}

export default function AdminDashboard() {
  const { formatCurrency, selectedCurrency } = useCurrency();
  const { user } = useAuth();
  const mounted = useIsMounted();
  const { nextGeneration, isStale } = useFetchGeneration();
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Organization selection for super_admin
  const isSuperAdmin = user?.role === 'super_admin';
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(isSuperAdmin);
  
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(defaultDashboardStats);
  const [quickStats, setQuickStats] = useState<QuickStats>(defaultQuickStats);
  const [expenseData, setExpenseData] = useState<ExpenseTrendRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [todaysAttendance, setTodaysAttendance] = useState<AttendanceRow[]>([]);
  const [todayBreakLog, setTodayBreakLog] = useState<BreakRow[]>([]);
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendancePagination, setAttendancePagination] = useState({ page: 1, total: 0, totalPages: 1, hasNext: false, hasPrev: false });
  const [leavePage, setLeavePage] = useState(1);
  const [leavePagination, setLeavePagination] = useState({ page: 1, total: 0, totalPages: 1, hasNext: false, hasPrev: false });
  const [breakPage, setBreakPage] = useState(1);
  const [breakPagination, setBreakPagination] = useState({ page: 1, total: 0, totalPages: 1, hasNext: false, hasPrev: false });
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // Force re-render timestamp

  const chartExpenseData = useMemo(() => ensureArray<ExpenseTrendRow>(expenseData), [expenseData]);
  const safeLeaveRequests = useMemo(() => ensureArray<LeaveRequestRow>(leaveRequests), [leaveRequests]);
  const safeTodaysAttendance = useMemo(() => ensureArray<AttendanceRow>(todaysAttendance), [todaysAttendance]);
  const safeTodayBreakLog = useMemo(() => ensureArray<BreakRow>(todayBreakLog), [todayBreakLog]);
  const pendingLeaveCount = useMemo(
    () => safeLeaveRequests.filter((r) => r?.status === 'pending').length,
    [safeLeaveRequests]
  );

  const formatMoney = useCallback(
    (amount: unknown) => {
      try {
        return formatCurrency(safeNum(amount, 0));
      } catch {
        return '₹0.00';
      }
    },
    [formatCurrency]
  );
  
  // Fetch organizations for super_admin on mount
  useEffect(() => {
    if (!isSuperAdmin || !mounted.current) return;
    
    (async () => {
      try {
        await ensureAccessToken();
        const response = await apiGet<{ success?: boolean; data?: Array<{ _id: string; name: string; isActive?: boolean }> }>(
          '/organizations?page=1&limit=100',
          false
        );
        if (response?.data) {
          const activeOrgs = response.data.filter(o => o.isActive !== false);
          setOrganizations(activeOrgs);
          // Auto-select first organization if available
          if (activeOrgs.length > 0 && !selectedOrgId) {
            setSelectedOrgId(activeOrgs[0]._id);
          }
        }
      } catch (error) {
        console.warn('[ADMIN-DASHBOARD] Failed to load organizations:', error);
      } finally {
        setLoadingOrgs(false);
      }
    })();
  }, [isSuperAdmin, mounted]);
  
  // Edit leave modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<EditingLeave | null>(null);
  const [showRejectLeaveDialog, setShowRejectLeaveDialog] = useState(false);
  const [showDeleteLeaveDialog, setShowDeleteLeaveDialog] = useState(false);
  const [pendingLeaveRequestId, setPendingLeaveRequestId] = useState<string | null>(null);
  const [leaveRejectionReason, setLeaveRejectionReason] = useState('Rejected by admin');
  const [leaveActionLoading, setLeaveActionLoading] = useState(false);

  const refreshDashboardData = useCallback(async () => {
    const gen = nextGeneration();

    // For super_admin, require organization selection
    if (isSuperAdmin && !selectedOrgId) {
      return;
    }

    console.log('⚡ [ADMIN-DASHBOARD] Loading KPI summary first with period:', filterType);
    
    await ensureAccessToken();

    // Build period query params
    const params = new URLSearchParams();
    params.append('period', filterType);
    if (filterType === 'custom' && customStartDate && customEndDate) {
      params.append('startDate', customStartDate);
      params.append('endDate', customEndDate);
    }
    if (isSuperAdmin && selectedOrgId) {
      params.append('orgId', selectedOrgId);
    }

    // PHASE 1: Fetch critical KPI summary first
    try {
      const summaryResponse = await apiGet<{ success?: boolean; data?: any }>(
        `/dashboard/admin/summary?${params.toString()}`,
        false
      );

      if (!mounted.current || isStale(gen)) return;

      if (summaryResponse?.success !== false && summaryResponse?.data?.kpis) {
        const kpis = summaryResponse.data.kpis;
        setDashboardStats({
          totalEmployees: kpis.totalEmployees || 0,
          avgProductivity: kpis.avgProductivity || 0,
          thisMonthExpenses: kpis.thisMonthExpense || 0,
          thisMonthPayroll: kpis.thisMonthPayroll || 0,
          totalCost: kpis.totalCost || 0,
          loggedInEmployees: kpis.loggedInEmployees || 0,
          onLeave: kpis.onLeave || 0,
        });
        setQuickStats({
          totalEmployees: kpis.totalEmployees || 0,
          presentToday: kpis.presentToday || 0,
          attendanceRate: 0,
          pendingLeaves: 0,
          pendingExpenses: 0,
          activeUsers: kpis.loggedInEmployees || 0,
          onLeave: kpis.onLeave || 0,
          onBreak: kpis.onBreak || 0,
          totalSales: 0,
          totalLoss: 0,
          totalBonus: 0,
          totalIncentive: 0,
        });
        setLastUpdate(Date.now());
        console.log('✅ [ADMIN-DASHBOARD] KPI summary loaded:', kpis);
      }
    } catch (error) {
      console.warn('[ADMIN-DASHBOARD] KPI summary failed:', error);
      // Use fallback zeros, don't block dashboard
    }

    // PHASE 2: Lazy-load tables/charts after KPIs with Promise.allSettled
    console.log('⚡ [ADMIN-DASHBOARD] Loading tables with pagination...');
    
    const buildTableParams = (baseParams: URLSearchParams) => {
      if (isSuperAdmin && selectedOrgId) {
        baseParams.append('orgId', selectedOrgId);
      }
      return baseParams.toString();
    };
    
    const [expenseTrendsResponse, leaveResponse, attendanceResponse, breakResponse] =
      await Promise.allSettled([
        apiGet<{ success?: boolean; data?: ExpenseTrendRow[] }>('/dashboard/expense-trends', false),
        apiGet<{ success?: boolean; data?: any; pagination?: any }>(
          `/dashboard/leave-requests?status=pending&page=1&limit=10&period=${filterType}${isSuperAdmin && selectedOrgId ? `&orgId=${selectedOrgId}` : ''}`,
          false
        ),
        apiGet<{ success?: boolean; data?: any; pagination?: any }>(
          `/dashboard/today-attendance?page=1&limit=10${isSuperAdmin && selectedOrgId ? `&orgId=${selectedOrgId}` : ''}`,
          false
        ),
        apiGet<{ success?: boolean; data?: any; pagination?: any }>(
          `/dashboard/break-records?page=1&limit=10${isSuperAdmin && selectedOrgId ? `&orgId=${selectedOrgId}` : ''}`,
          false
        ),
      ]);

    if (!mounted.current || isStale(gen)) return;

    const unwrap = <T,>(r: PromiseSettledResult<{ success?: boolean; data?: T; pagination?: any; message?: string }>) =>
      r.status === 'fulfilled' ? r.value : null;

    const trendsPayload = unwrap(expenseTrendsResponse);
    if (trendsPayload?.success !== false) {
      setExpenseData(extractApiList<ExpenseTrendRow>(trendsPayload));
    }

    const leavePayload = unwrap(leaveResponse);
    if (leavePayload?.success !== false) {
      setLeaveRequests(extractApiList<LeaveRequestRow>(leavePayload?.data || []));
      if (leavePayload?.pagination) {
        setLeavePagination(leavePayload.pagination);
      }
    }

    const attPayload = unwrap(attendanceResponse);
    if (attPayload?.success !== false) {
      const extractedAtt = extractApiList<AttendanceRow>(attPayload?.data || []);
      setTodaysAttendance(extractedAtt);
      if (attPayload?.pagination) {
        setAttendancePagination(attPayload.pagination);
      }
    }

    const breakPayload = unwrap(breakResponse);
    if (breakPayload?.success !== false && Array.isArray(breakPayload?.data)) {
      const breakData = breakPayload.data;
      setTodayBreakLog(breakData.map((br: any) => ({
        attendanceId: br.attendanceId,
        employeeId: br.employeeId,
        employeeName: br.employeeName || 'Unknown',
        department: br.department || 'N/A',
        breakType: br.breakType,
        startTime: br.startTime,
        endTime: br.endTime || null,
        duration: br.duration || 0,
        status: br.status as 'active' | 'ended'
      })));
      if (breakPayload?.pagination) {
        setBreakPagination(breakPayload.pagination);
      }
    }

    console.log('✅ [ADMIN-DASHBOARD] All data loaded');
  }, [filterType, customStartDate, customEndDate, mounted, nextGeneration, isStale]);

  const dashboardSocketDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleDashboardRefresh = useCallback(() => {
    if (!mounted.current) return;
    if (dashboardSocketDebounceRef.current) {
      clearTimeout(dashboardSocketDebounceRef.current);
    }
    dashboardSocketDebounceRef.current = setTimeout(() => {
      dashboardSocketDebounceRef.current = null;
      void refreshDashboardData().catch((error) => {
        console.error('Error refreshing dashboard data:', error);
      });
    }, DASHBOARD_SOCKET_DEBOUNCE_MS);
  }, [refreshDashboardData, mounted]);

  useEffect(() => {
    return () => {
      if (dashboardSocketDebounceRef.current) {
        clearTimeout(dashboardSocketDebounceRef.current);
      }
    };
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setLeavePage(1);
    setAttendancePage(1);
    setBreakPage(1);
  }, [filterType, customStartDate, customEndDate]);

  const refreshLeaveList = useCallback(async () => {
    const leaveResponse = await apiGet<{ success?: boolean; data?: unknown }>(
      '/dashboard/recent-leave-requests',
      false
    );
    if (leaveResponse?.success !== false) {
      setLeaveRequests(extractApiList<LeaveRequestRow>(leaveResponse));
    }
  }, []);

  const refreshBreakSections = useCallback(async () => {
    try {
      await ensureAccessToken();
      
      // Fetch break records with pagination
      const breakResponse = await apiGet<{ 
        success?: boolean; 
        data?: any[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      }>(
        `/dashboard/break-records?page=${breakPage}&limit=10`,
        false
      );
      
      if (!mounted.current) return;
      if (breakResponse?.success !== false && Array.isArray(breakResponse?.data)) {
        const breakData = breakResponse.data;
        setTodayBreakLog(breakData.map((br: any) => ({
          attendanceId: br.attendanceId,
          employeeId: br.employeeId,
          employeeName: br.employeeName || 'Unknown',
          department: br.department || 'N/A',
          breakType: br.breakType,
          startTime: br.startTime,
          endTime: br.endTime || null,
          duration: br.duration || 0,
          status: br.status as 'active' | 'ended'
        })));
      }
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Error refreshing break section:', error);
    }
  }, [mounted, breakPage]);

  // Pagination handlers
  const handleLeavePageChange = useCallback(async (newPage: number) => {
    setLeavePage(newPage);
    try {
      const orgParam = isSuperAdmin && selectedOrgId ? `&orgId=${selectedOrgId}` : '';
      const response = await apiGet<{ success?: boolean; data?: any; pagination?: any }>(
        `/dashboard/leave-requests?status=pending&page=${newPage}&limit=10&period=${filterType}${orgParam}`,
        false
      );
      if (response?.success !== false) {
        setLeaveRequests(extractApiList<LeaveRequestRow>(response?.data || []));
        if (response?.pagination) {
          setLeavePagination(response.pagination);
        }
      }
    } catch (error) {
      console.error('Error changing leave page:', error);
    }
  }, [filterType, isSuperAdmin, selectedOrgId]);

  const handleAttendancePageChange = useCallback(async (newPage: number) => {
    setAttendancePage(newPage);
    try {
      const orgParam = isSuperAdmin && selectedOrgId ? `&orgId=${selectedOrgId}` : '';
      const response = await apiGet<{ success?: boolean; data?: any; pagination?: any }>(
        `/dashboard/today-attendance?page=${newPage}&limit=10${orgParam}`,
        false
      );
      if (response?.success !== false) {
        const extractedAtt = extractApiList<AttendanceRow>(response?.data || []);
        setTodaysAttendance(extractedAtt);
        if (response?.pagination) {
          setAttendancePagination(response.pagination);
        }
      }
    } catch (error) {
      console.error('Error changing attendance page:', error);
    }
  }, [isSuperAdmin, selectedOrgId]);

  const handleBreakPageChange = useCallback(async (newPage: number) => {
    setBreakPage(newPage);
    try {
      const orgParam = isSuperAdmin && selectedOrgId ? `&orgId=${selectedOrgId}` : '';
      const response = await apiGet<{ success?: boolean; data?: any; pagination?: any }>(
        `/dashboard/break-records?page=${newPage}&limit=10${orgParam}`,
        false
      );
      if (response?.success !== false && Array.isArray(response?.data)) {
        const breakData = response.data;
        setTodayBreakLog(breakData.map((br: any) => ({
          attendanceId: br.attendanceId,
          employeeId: br.employeeId,
          employeeName: br.employeeName || 'Unknown',
          department: br.department || 'N/A',
          breakType: br.breakType,
          startTime: br.startTime,
          endTime: br.endTime || null,
          duration: br.duration || 0,
          status: br.status as 'active' | 'ended'
        })));
        if (response?.pagination) {
          setBreakPagination(response.pagination);
        }
      }
    } catch (error) {
      console.error('Error changing break page:', error);
    }
  }, [mounted]);

  // Refresh employees on break data
  const applyKpiPayload = useCallback((kpis: Record<string, unknown>) => {
    if (!kpis || typeof kpis !== 'object') return;
    const num = (v: unknown, fallback: number) =>
      typeof v === 'number' && !Number.isNaN(v) ? v : fallback;

    setDashboardStats((prev) => ({
      ...prev,
      totalEmployees: num(kpis.totalEmployees, prev.totalEmployees),
      avgProductivity: num(kpis.avgProductivity, prev.avgProductivity),
      thisMonthExpenses: num(kpis.thisMonthExpenses, prev.thisMonthExpenses),
      thisMonthPayroll: num(kpis.thisMonthPayroll, prev.thisMonthPayroll),
      totalCost: num(
        kpis.totalCost,
        num(kpis.thisMonthExpenses, prev.thisMonthExpenses) +
          num(kpis.thisMonthPayroll, prev.thisMonthPayroll)
      ),
      loggedInEmployees: num(kpis.activeUsers, prev.loggedInEmployees),
      onLeave: num(kpis.onLeave, prev.onLeave),
    }));

    setQuickStats((prev) => ({
      totalEmployees: num(kpis.totalEmployees, prev.totalEmployees),
      presentToday: num(kpis.presentToday, prev.presentToday),
      attendanceRate: num(kpis.attendanceRate, prev.attendanceRate),
      pendingLeaves: num(kpis.pendingLeaves, prev.pendingLeaves),
      pendingExpenses: num(kpis.pendingExpenses, prev.pendingExpenses),
      activeUsers: num(kpis.activeUsers, prev.activeUsers),
      onLeave: num(kpis.onLeave, prev.onLeave),
      onBreak: num(kpis.onBreak, prev.onBreak),
      totalSales: num(kpis.totalSales, prev.totalSales),
      totalLoss: num(kpis.totalLoss, prev.totalLoss),
      totalBonus: num(kpis.totalBonus, prev.totalBonus),
      totalIncentive: num(kpis.totalIncentive, prev.totalIncentive),
    }));
    setLastUpdate(Date.now());
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        await refreshDashboardData();
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    fetchDashboardData();
    
    // DISABLED: Auto-refresh polling - causing state reset issues
    // Set up polling to refresh data every 5 seconds
    // const pollInterval = setInterval(() => {
    //   console.log('📊 [POLLING] Refreshing dashboard data...');
    //   fetchDashboardData();
    // }, 5000); // Refresh every 5 seconds

    // Cleanup interval on unmount
    return () => {
      // clearInterval(pollInterval);
    };
  }, [filterType, customStartDate, customEndDate, refreshDashboardData, mounted, selectedOrgId]);

  useEffect(() => {
    const uid = authUserKey(user);
    if (!uid) return;
    realTimeSocket.connectFromAuth({
      id: uid,
      role: user!.role,
      orgId: user!.orgId || user!.tenantId,
      tenantId: user!.tenantId || user!.orgId,
    });
  }, [user?.userId, user?.id, user?.role, user?.orgId, user?.tenantId]);

  // Socket.IO real-time updates
  useEffect(() => {
    const handleEmployeeCreated = () => {
      scheduleDashboardRefresh();
    };

    const handleDashboardUpdate = (data: any) => {
      if (data.type === 'active_users_updated') {
        // Update logged-in employees count in real-time
        setQuickStats(prev => ({
          ...prev,
          activeUsers: data.data?.activeUsers || prev.activeUsers
        }));
      } else if (data.type === 'employee_count') {
        setDashboardStats(prev => ({
          ...prev,
          totalEmployees: data.data?.totalEmployees || prev.totalEmployees
        }));
      } else if (data.type === 'dashboard_refresh') {
        const reason = data.reason || data.data?.reason;
        if (reason === 'break_started' || reason === 'break_ended') {
          refreshBreakSections();
        } else {
          scheduleDashboardRefresh();
        }
      } else if (data.type === 'kpi_update') {
        const kpis = data.data?.kpis || data.kpis;
        if (kpis) {
          applyKpiPayload(kpis);
        }
      }
    };

    const handleExpenseUpdate = (type: string, _expense: any) => {
      if (type === 'created' || type === 'updated' || type === 'deleted') {
        scheduleDashboardRefresh();
      }
    };

    const handleLeaveUpdate = (type: string, _leave: any) => {
      if (type === 'created' || type === 'updated' || type === 'approved' || type === 'rejected') {
        scheduleDashboardRefresh();
      }
    };

    const handleAttendanceUpdate = (_attendance: any) => {
      scheduleDashboardRefresh();
    };

    // Subscribe to real-time events using the correct methods
    const unsubscribeEmployee = realTimeSocket.onEmployeeUpdate((type) => {
      if (type === 'created') {
        handleEmployeeCreated();
      }
    });

    const unsubscribeDashboard = realTimeSocket.onDashboardUpdate(handleDashboardUpdate);
    const unsubscribeExpense = realTimeSocket.onExpenseUpdate(handleExpenseUpdate);
    const unsubscribeLeave = realTimeSocket.onLeaveUpdate(handleLeaveUpdate);
    const unsubscribeAttendance = realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);

    const onBreakStarted = (data: any) => {
      console.log('☕ break:started event received:', data);
      refreshBreakSections();
      scheduleDashboardRefresh();
    };

    const onBreakEnded = (data: any) => {
      console.log('☕ break:ended event received:', data);
      refreshBreakSections();
      scheduleDashboardRefresh();
    };

    const onKpiUpdate = (data: any) => {
      const kpis = data?.kpis || data?.data?.kpis;
      if (kpis) {
        applyKpiPayload(kpis);
      } else {
        handleDashboardUpdate({ type: 'kpi_update', data });
      }
    };

    const unsubscribeBreakStart = realTimeSocket.onBreakStarted(onBreakStarted);
    const unsubscribeBreakEnd = realTimeSocket.onBreakEnded(onBreakEnded);
    const unsubscribeKpi = realTimeSocket.onKPIUpdate(onKpiUpdate);

    return () => {
      unsubscribeEmployee();
      unsubscribeDashboard();
      unsubscribeExpense();
      unsubscribeLeave();
      unsubscribeAttendance();
      unsubscribeBreakStart();
      unsubscribeBreakEnd();
      unsubscribeKpi();
    };
  }, [scheduleDashboardRefresh, refreshBreakSections, applyKpiPayload]);

  // Tick live durations for active breaks in the log table
  useEffect(() => {
    if (!safeTodayBreakLog.some((r) => r.status === 'active')) return;
    const timer = setInterval(() => setLastUpdate(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [safeTodayBreakLog]);

  const handleApproveLeave = async (requestId: string) => {
    try {
      console.log('✅ Approving leave request:', requestId);
      
      const userId = authUserKey(user);
      if (!userId) {
        toast.error('Unable to get user information. Please log in again.');
        return;
      }

      await ensureAccessToken();
      const response = await apiPatch<{ success?: boolean }>(`/leave-requests/${requestId}/approve`, {
        approvedBy: userId
      });
      console.log('✅ Approve response:', response);
      
      if (response?.success !== false) {
        clearApiCache('/dashboard');
        await refreshLeaveList();
        toast.success('Leave request approved');
      }
    } catch (error) {
      console.error('❌ Error approving leave:', error);
      toast.error(`Failed to approve leave request: ${getErrorMessage(error, 'Unknown error')}`);
    }
  };

  const openRejectLeaveDialog = (requestId: string) => {
    setPendingLeaveRequestId(requestId);
    setLeaveRejectionReason('Rejected by admin');
    setShowRejectLeaveDialog(true);
  };

  const confirmRejectLeave = async () => {
    const requestId = pendingLeaveRequestId;
    const reason = leaveRejectionReason.trim();
    if (!requestId) return;
    if (!reason) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setLeaveActionLoading(true);
      const userId = authUserKey(user);
      if (!userId) {
        toast.error('Unable to get user information. Please log in again.');
        return;
      }

      await ensureAccessToken();
      const response = await apiPatch<{ success?: boolean }>(`/leave-requests/${requestId}/reject`, {
        rejectedBy: userId,
        rejectionReason: reason,
      });

      if (response?.success !== false) {
        clearApiCache('/dashboard');
        await refreshLeaveList();
        toast.success('Leave request rejected');
        setShowRejectLeaveDialog(false);
        setPendingLeaveRequestId(null);
        setLeaveRejectionReason('Rejected by admin');
      }
    } catch (error) {
      console.error('❌ Error rejecting leave:', error);
      toast.error(`Failed to reject leave request: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setLeaveActionLoading(false);
    }
  };

  const openDeleteLeaveDialog = (requestId: string) => {
    setPendingLeaveRequestId(requestId);
    setShowDeleteLeaveDialog(true);
  };

  const confirmDeleteLeave = async () => {
    const requestId = pendingLeaveRequestId;
    if (!requestId) return;

    try {
      setLeaveActionLoading(true);
      await ensureAccessToken();
      const response = await apiDelete<{ success?: boolean }>(`/leave-requests/${requestId}`);

      if (response?.success !== false) {
        clearApiCache('/dashboard');
        await refreshLeaveList();
        toast.success('Leave request deleted');
        setShowDeleteLeaveDialog(false);
        setPendingLeaveRequestId(null);
      }
    } catch (error) {
      console.error('❌ Error deleting leave:', error);
      toast.error(`Failed to delete leave request: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setLeaveActionLoading(false);
    }
  };

  // Handle leave request edit (open modal with leave data)
  const handleEditLeave = (request: LeaveRequestRow) => {
    console.log('✏️ Opening edit modal for leave:', request);
    const requestId = request._id || request.id || '';
    setEditingLeave({
      id: requestId,
      type: request.type || request.leaveType || 'casual',
      startDate: new Date(request.startDate).toISOString().split('T')[0],
      endDate: new Date(request.endDate).toISOString().split('T')[0],
      reason: request.reason || '',
      employeeName: request.employeeName || request.userId?.name || 'Unknown'
    });
    setEditModalOpen(true);
  };

  // Handle save edited leave
  const handleSaveEditLeave = async () => {
    if (!editingLeave) return;
    
    try {
      console.log('💾 Saving edited leave:', editingLeave);
      await ensureAccessToken();
      const response = await apiPatch<{ success?: boolean }>(`/leave-requests/${editingLeave.id}`, {
        leaveType: editingLeave.type,
        startDate: editingLeave.startDate,
        endDate: editingLeave.endDate,
        reason: editingLeave.reason
      });

      if (response?.success !== false) {
        setEditModalOpen(false);
        setEditingLeave(null);
        clearApiCache('/dashboard');
        await refreshLeaveList();
        toast.success('Leave request updated');
      }
    } catch (error) {
      console.error('❌ Error updating leave:', error);
      toast.error(`Failed to update leave request: ${getErrorMessage(error, 'Unknown error')}`);
    }
  };

  // Handle leave request download (generate PDF)
  const handleDownloadLeave = async (request: LeaveRequestRow) => {
    try {
      console.log('📥 Downloading leave request:', request);
      
      const days = Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Create a simple text content for download
      const content = `
LEAVE REQUEST DETAILS
=====================

Employee: ${request.employeeName || request.userId?.name || 'Unknown'}
Email: ${request.employeeEmail || 'N/A'}
Department: ${request.department}

Leave Type: ${request.type || request.leaveType || 'N/A'}
Start Date: ${new Date(request.startDate).toLocaleDateString()}
End Date: ${new Date(request.endDate).toLocaleDateString()}
Duration: ${days} days

Reason: ${request.reason || 'N/A'}
Status: ${request.status}

Applied On: ${request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'}
      `.trim();
      
      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nameSlug = (request.employeeName || request.userId?.name || 'employee').replace(/\s+/g, '-');
      a.download = `leave-request-${nameSlug}-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Leave request downloaded successfully');
    } catch (error) {
      console.error('❌ Error downloading leave:', error);
      toast.error(`Failed to download leave request: ${getErrorMessage(error, 'Unknown error')}`);
    }
  };

  // Weekly productivity data - fetched from real attendance data
  const [productivityData, setProductivityData] = useState<Array<{ day: string; productivity: number }>>([]);

  // Fetch weekly productivity from backend
  useEffect(() => {
    const fetchProductivity = async () => {
      try {
        await ensureAccessToken();
        const response = await apiGet<{ success?: boolean; data?: Array<{ day: string; productivity: number }> }>(
          '/dashboard/weekly-productivity',
          false
        );
        if (response?.success !== false && response?.data) {
          setProductivityData(response.data);
        }
      } catch (error) {
        console.error('Error fetching weekly productivity:', error);
      }
    };
    
    fetchProductivity();
  }, []);

  // Currency amount display component with INR icon is not currently used
  // Keeping selectedCurrency for future use

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8" role="status" aria-label="Loading dashboard">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Organization overview and management</p>
      </div>

      {/* Organization Selection for Super Admin */}
      {isSuperAdmin && (
        <Card className="p-6 rounded-2xl border-blue-200 bg-blue-50">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Select Organization
          </h3>
          {loadingOrgs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading organizations...
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations available</p>
          ) : (
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-full md:w-64 rounded-xl">
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org._id} value={org._id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Select an organization to view its dashboard data, attendance, and leave requests.
          </p>
        </Card>
      )}

      {/* Empty State if Super Admin with No Organization Selected */}
      {isSuperAdmin && !selectedOrgId && (
        <Card className="p-12 rounded-2xl border-dashed border-2 border-muted-foreground/30 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">Select an Organization</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            To view dashboard data, you must first select an organization from the selector above.
          </p>
        </Card>
      )}

      {/* Announcement Banner */}
      <Card className="p-4 bg-gradient-to-r from-accent/20 to-accent/10 border-accent/30 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Reminder: Monthly all-hands meeting tomorrow at 10:00 AM</p>
            <p className="text-sm text-muted-foreground">Please ensure all team members are notified</p>
          </div>
        </div>
      </Card>

      {/* Filter Section */}
      <Card className="p-6 rounded-2xl">
        <h3 className="font-semibold text-lg mb-4">Filter by Period</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Period</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {filterType === 'custom' && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* KPI Cards - Financial Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            key={`expense-${lastUpdate}-${dashboardStats.thisMonthExpenses}`}
            title="This Month Expense"
            value={formatMoney(dashboardStats.thisMonthExpenses)}
            icon={selectedCurrency.code === 'INR' ? IndianRupee : Receipt}
            color="accent"
          />
          <KPICard
            key={`payroll-${lastUpdate}-${dashboardStats.thisMonthPayroll}`}
            title="This Month Payroll"
            value={formatMoney(dashboardStats.thisMonthPayroll)}
            icon={selectedCurrency.code === 'INR' ? IndianRupee : DollarSign}
            color="primary"
          />
          <KPICard
            key={`totalcost-${lastUpdate}-${dashboardStats.totalCost}`}
            title="Total Cost (Payroll + Expenses)"
            value={formatMoney(dashboardStats.totalCost)}
            icon={selectedCurrency.code === 'INR' ? IndianRupee : DollarSign}
            color="destructive"
          />
          <KPICard
            key={`employees-${lastUpdate}-${dashboardStats.totalEmployees}`}
            title="Total Employees"
            value={String(dashboardStats.totalEmployees ?? 0)}
            icon={Users}
            color="secondary"
          />
        </div>
      </div>

      {/* KPI Cards - Operational Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Operational Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            key={`activeUsers-${quickStats.activeUsers}-${lastUpdate}`}
            title="Logged In Employees"
            value={String(safeNum(quickStats.activeUsers, 0))}
            icon={LogIn}
            color="primary"
            emphasize
          />
          <KPICard
            key={`onBreak-${quickStats.onBreak}-${lastUpdate}`}
            title="On Break"
            value={String(safeNum(quickStats.onBreak, 0))}
            icon={Coffee}
            color="accent"
            emphasize
          />
          <KPICard
            key={`onLeave-${quickStats.onLeave}-${lastUpdate}`}
            title="On Leave"
            value={quickStats.onLeave?.toString() || '0'}
            icon={Calendar}
            color="accent"
          />
          <KPICard
            key={`avgProductivity-${dashboardStats.avgProductivity}-${lastUpdate}`}
            title="Avg Productivity"
            value={`${dashboardStats.avgProductivity}%`}
            icon={TrendingUp}
            color="primary"
          />
        </div>
      </div>

      {/* KPI Cards - Sales & Bonus Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Sales & Incentives</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total Sales"
            value={formatMoney(quickStats.totalSales)}
            icon={TrendingUp}
            color="secondary"
          />
          <KPICard
            title="Total Loss"
            value={formatMoney(quickStats.totalLoss)}
            icon={TrendingDown}
            color="destructive"
          />
          <KPICard
            title="Total Bonus"
            value={formatMoney(quickStats.totalBonus)}
            icon={Gift}
            color="accent"
          />
          <KPICard
            title="Total Incentive"
            value={formatMoney(quickStats.totalIncentive)}
            icon={Zap}
            color="primary"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Trend */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Weekly Productivity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={productivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Line type="monotone" dataKey="productivity" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Expense Trend */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Monthly Expenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartExpenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Bar dataKey="amount" fill="#F59E0B" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Leave Requests */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Leave Requests</h3>
            <p className="text-sm text-muted-foreground">Pending approval</p>
          </div>
          <Badge variant="secondary">{pendingLeaveCount} Pending</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeLeaveRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No pending leave requests
                </TableCell>
              </TableRow>
            ) : (
              safeLeaveRequests.map((request) => {
                const requestId = request._id || request.id || '';
                const employeeName = safeCell(
                  request.employeeName ||
                    (typeof request.userId === 'object' ? request.userId?.name : null) ||
                    'Unknown'
                );
                const leaveType = safeCell(request.type || request.leaveType || 'N/A');
                const startMs = new Date(request.startDate).getTime();
                const endMs = new Date(request.endDate).getTime();
                const days =
                  Number.isNaN(startMs) || Number.isNaN(endMs)
                    ? '—'
                    : Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <TableRow key={requestId || `${employeeName}-${request.startDate}`}>
                    <TableCell className="font-medium">{employeeName}</TableCell>
                    <TableCell>{leaveType}</TableCell>
                    <TableCell>{formatDate(request.startDate)}</TableCell>
                    <TableCell>{formatDate(request.endDate)}</TableCell>
                    <TableCell>{days}</TableCell>
                    <TableCell>
                      <Badge variant={request.status === 'pending' ? 'secondary' : 'default'}>
                        {safeCell(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {request.status === 'pending' && requestId && (
                          <>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="bg-secondary hover:bg-secondary/90"
                              onClick={() => handleApproveLeave(requestId)}
                              title="Approve leave request"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => openRejectLeaveDialog(requestId)}
                              title="Reject leave request"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditLeave(request)}
                          title="Edit leave request"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadLeave(request)}
                          title="Download leave request"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {requestId && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteLeaveDialog(requestId)}
                          title="Delete leave request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        
        {/* Pagination Controls for Leave Requests */}
        {(() => {
          return leavePagination.totalPages > 1 ? (
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing page <span className="font-semibold">{leavePagination.page}</span> of{' '}
                <span className="font-semibold">{leavePagination.totalPages}</span> ({leavePagination.total} total leave requests)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLeavePageChange(leavePage - 1)}
                  disabled={!leavePagination.hasPrev}
                >
                  Previous
                </Button>
                <div className="text-xs font-medium">
                  Page {leavePagination.page} of {leavePagination.totalPages}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLeavePageChange(leavePage + 1)}
                  disabled={!leavePagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null;
        })()}
      </Card>

      {/* Employee Overview */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Today's Attendance</h3>
          <p className="text-sm text-muted-foreground">Check-in status and break start / end times</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Break start</TableHead>
              <TableHead>Break end</TableHead>
              <TableHead>Break status</TableHead>
              <TableHead>Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              if (safeTodaysAttendance.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No attendance records for today
                    </TableCell>
                  </TableRow>
                );
              }
              return safeTodaysAttendance.map((attendance) => {
                const breakInfo = summarizeAttendanceBreaks(attendance.breaks);
                const rowKey = attendance._id || `${safeCell(attendance.employeeName)}-${attendance.checkIn}`;
                return (
                  <TableRow key={rowKey}>
                    <TableCell className="font-medium">{safeCell(attendance.employeeName)}</TableCell>
                    <TableCell>
                      {safeCell(
                        attendance.department ||
                          (typeof attendance.employeeId === 'object'
                            ? attendance.employeeId?.department
                            : null) ||
                          'N/A'
                      )}
                    </TableCell>
                    <TableCell>{formatTime(attendance.checkIn)}</TableCell>
                    <TableCell>{formatTime(breakInfo.start)}</TableCell>
                    <TableCell>{formatTime(breakInfo.end)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={breakInfo.onBreak ? 'secondary' : 'outline'}
                        className={breakInfo.onBreak ? 'bg-accent/20 text-accent' : ''}
                      >
                        {breakInfo.label}
                        {breakInfo.breakType ? ` (${breakInfo.breakType})` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(attendance.hoursWorked ?? 0) > 0 ? `${attendance.hoursWorked}h` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            })()}
          </TableBody>
        </Table>
        
        {/* Pagination Controls */}
        {attendancePagination.totalPages > 1 && (
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Showing page <span className="font-semibold">{attendancePagination.page}</span> of{' '}
              <span className="font-semibold">{attendancePagination.totalPages}</span> ({attendancePagination.total} total records)
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAttendancePageChange(attendancePage - 1)}
                disabled={!attendancePagination.hasPrev}
              >
                Previous
              </Button>
              <div className="text-xs font-medium">
                Page {attendancePagination.page} of {attendancePagination.totalPages}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAttendancePageChange(attendancePage + 1)}
                disabled={!attendancePagination.hasNext}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">All Employees Break Records</h3>
            <p className="text-sm text-muted-foreground">Break start and end times stored for every employee today</p>
          </div>
          <Badge variant="secondary">{safeTodayBreakLog.length} entries</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeTodayBreakLog.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No break records for today yet
                </TableCell>
              </TableRow>
            ) : (
              safeTodayBreakLog.map((row) => {
                const rowKey = `${row.attendanceId}-${row.breakIndex}-${row.startTime}`;
                const duration =
                  row.status === 'active' && row.startTime
                    ? breakMinutesSince(row.startTime)
                    : row.duration;
                return (
                  <TableRow key={rowKey}>
                    <TableCell className="font-medium">{safeCell(row.employeeName)}</TableCell>
                    <TableCell>{safeCell(row.department || 'N/A')}</TableCell>
                    <TableCell>{safeCell(row.breakType || 'regular')}</TableCell>
                    <TableCell>{formatTime(row.startTime)}</TableCell>
                    <TableCell>{formatTime(row.endTime)}</TableCell>
                    <TableCell>{duration != null ? `${duration} min` : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
                        {row.status === 'active' ? 'On break' : 'Ended'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        
        {/* Pagination Controls for Break Records */}
        {(() => {
          return breakPagination.totalPages > 1 ? (
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing page <span className="font-semibold">{breakPagination.page}</span> of{' '}
                <span className="font-semibold">{breakPagination.totalPages}</span> ({breakPagination.total} total break records)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBreakPageChange(breakPage - 1)}
                  disabled={!breakPagination.hasPrev}
                >
                  Previous
                </Button>
                <div className="text-xs font-medium">
                  Page {breakPagination.page} of {breakPagination.totalPages}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBreakPageChange(breakPage + 1)}
                  disabled={!breakPagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null;
        })()}
      </Card>

      {/* Chat Widget */}
      <ChatWidget />
      
      {/* Reject Leave Dialog */}
      <Dialog open={showRejectLeaveDialog} onOpenChange={setShowRejectLeaveDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="dashboard-reject-reason">Rejection reason</Label>
            <Textarea
              id="dashboard-reject-reason"
              rows={3}
              value={leaveRejectionReason}
              onChange={(e) => setLeaveRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectLeaveDialog(false);
                setPendingLeaveRequestId(null);
              }}
              disabled={leaveActionLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRejectLeave} disabled={leaveActionLoading}>
              {leaveActionLoading ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Leave Confirmation */}
      <Dialog open={showDeleteLeaveDialog} onOpenChange={setShowDeleteLeaveDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete Leave Request</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The leave request will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteLeaveDialog(false);
                setPendingLeaveRequestId(null);
              }}
              disabled={leaveActionLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteLeave} disabled={leaveActionLoading}>
              {leaveActionLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Leave Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
          </DialogHeader>
          {editingLeave && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Input value={editingLeave.employeeName} disabled className="bg-muted" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-leave-type">Leave Type</Label>
                <Select 
                  value={editingLeave.type} 
                  onValueChange={(value) => setEditingLeave({...editingLeave, type: value})}
                >
                  <SelectTrigger id="edit-leave-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="earned">Earned Leave</SelectItem>
                    <SelectItem value="maternity">Maternity Leave</SelectItem>
                    <SelectItem value="paternity">Paternity Leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start-date">Start Date</Label>
                  <Input 
                    id="edit-start-date"
                    type="date" 
                    value={editingLeave.startDate}
                    onChange={(e) => setEditingLeave({...editingLeave, startDate: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-end-date">End Date</Label>
                  <Input 
                    id="edit-end-date"
                    type="date" 
                    value={editingLeave.endDate}
                    onChange={(e) => setEditingLeave({...editingLeave, endDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-reason">Reason</Label>
                <Textarea 
                  id="edit-reason"
                  value={editingLeave.reason}
                  onChange={(e) => setEditingLeave({...editingLeave, reason: e.target.value})}
                  placeholder="Enter reason for leave"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditLeave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
