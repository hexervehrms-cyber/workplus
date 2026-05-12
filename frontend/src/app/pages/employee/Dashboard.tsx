import { useState, useEffect, useCallback, useRef } from 'react';
import { KPICard } from '../../components/KPICard';
import EmployeeDocuments from '../../components/EmployeeDocuments';
import InteractiveCalendar from '../../components/InteractiveCalendar';
import ChatWidget from '../../components/ChatWidget';
import LoadingProgressBar from '../../components/LoadingProgressBar';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { ExpenseService, LeaveRequestService } from '../../utils/api';
import { apiGet, apiPost, buildApiUrl } from '../../utils/apiHelper';
import realTimeSocket from '../../utils/realTimeSocket';
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Cake,
  Bell,
  Award,
  Target,
  LogOut,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { toast } from 'sonner';

interface DashboardData {
  employee: any;
  attendance: any;
  leaves: any;
  expenses: any;
  payroll: any;
}

export default function EmployeeDashboard() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Dropdown states
  const [breakDropdownOpen, setBreakDropdownOpen] = useState(false);
  const [meetingDropdownOpen, setMeetingDropdownOpen] = useState(false);
  const breakDropdownRef = useRef<HTMLDivElement>(null);
  const meetingDropdownRef = useRef<HTMLDivElement>(null);

  const [kpiMetrics, setKpiMetrics] = useState({
    leaveBalance: "0 days",
    hoursThisWeek: "0h",
    performance: "0%"
  });

  const [todayAttendance, setTodayAttendance] = useState({
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

  // Add action lock states to prevent UI conflicts
  const [actionInProgress, setActionInProgress] = useState(false);
  const [lastActionTime, setLastActionTime] = useState(0);  // Initialize to 0 so page load is never blocked
  const [lastSocketEventTime, setLastSocketEventTime] = useState(0); // Track last socket event to prevent refresh overwrite

  const [performanceMetrics, setPerformanceMetrics] = useState({
    taskCompletion: 0,
    attendance: 0,
    qualityScore: 0,
    presentDays: 0,
    totalHours: 0
  });

  const [holidays, setHolidays] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [disableRefresh, setDisableRefresh] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [breakHistory, setBreakHistory] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const attendanceCacheKey = `employee_attendance_state_${user?.id || 'unknown'}`;
  
  // Get today's date string for localStorage key (same format as Attendance page)
  const getTodayKey = () => new Date().toDateString();

  // Debug: Log todayAttendance changes
  useEffect(() => {
    console.log('🔍 [DASHBOARD] todayAttendance changed:', {
      isOnBreak: todayAttendance.isOnBreak,
      isInMeeting: todayAttendance.isInMeeting,
      isCheckedIn: todayAttendance.isCheckedIn,
      breakType: todayAttendance.breakType
    });
  }, [todayAttendance]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (breakDropdownRef.current && !breakDropdownRef.current.contains(event.target as Node)) {
        setBreakDropdownOpen(false);
      }
      if (meetingDropdownRef.current && !meetingDropdownRef.current.contains(event.target as Node)) {
        setMeetingDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to fetch employee ID
  const ensureEmployeeId = async (): Promise<string | null> => {
    if (employeeId) return employeeId;

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

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (_forceRefresh = false) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, 8000); // 8 second timeout

      // Fetch all data in parallel using Promise.allSettled for resilience
      console.log('⚡ Fetching all dashboard data in parallel...');
      const [attendanceResult, holidaysResult, activitiesResult] = await Promise.allSettled([
        apiGet('/attendance/today'),
        apiGet('/holidays'),
        apiGet('/activity-logs?limit=5')
      ]);

      clearTimeout(timeoutId);

      // Use cached holidays as fallback
      const cachedHolidays = localStorage.getItem('cached_holidays');
      if (cachedHolidays) {
        try {
          const parsed = JSON.parse(cachedHolidays);
          setHolidays(parsed);
        } catch (e) {
          console.warn('Failed to parse cached holidays');
        }
      }

      // Process holidays result
      if (holidaysResult.status === 'fulfilled' && holidaysResult.value?.success && Array.isArray(holidaysResult.value.data)) {
        console.log('✅ Dashboard: Loaded', holidaysResult.value.data.length, 'holidays');
        setHolidays(holidaysResult.value.data);
        // Cache holidays for offline access
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

      // Process attendance result
      console.log('📊 Attendance API Result:', {
        status: attendanceResult.status,
        success: attendanceResult.value?.success,
        hasData: !!attendanceResult.value?.data,
        error: attendanceResult.reason?.message
      });

      const attendanceData = attendanceResult.status === 'fulfilled' && attendanceResult.value?.success
        ? attendanceResult.value.data
        : null;

      let data = { attendance: { today: attendanceData?.attendance } };

      setDashboardData(data);

      // Update today's attendance
      if (attendanceData?.attendance) {
        const attendance = attendanceData.attendance;
        const checkInTime = attendance.checkIn
          ? new Date(attendance.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;
        const checkOutTime = attendance.checkOut
          ? new Date(attendance.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;

        const isCurrentlyCheckedIn = !!attendance.checkIn && !attendance.checkOut;

        // Calculate isOnBreak from actual breaks array (most reliable source)
        let calculatedIsOnBreak = false;
        let calculatedBreakType = 'regular';
        let calculatedBreakDuration = 0;

        if (attendance.breaks && attendance.breaks.length > 0) {
          const lastBreak = attendance.breaks[attendance.breaks.length - 1];
          if (lastBreak.startTime && !lastBreak.endTime) {
            calculatedIsOnBreak = true;
            calculatedBreakType = lastBreak.breakType || 'regular';
            const breakStart = new Date(lastBreak.startTime);
            const now = new Date();
            calculatedBreakDuration = Math.round((now - breakStart.getTime()) / (1000 * 60));
          }
        }

        setTodayAttendance(prev => {
          // CRITICAL: If an action just completed, ALWAYS trust the optimistic state
          // Don't overwrite it with API data for at least 5 seconds
          const timeSinceLastAction = Date.now() - lastActionTime;
          if (timeSinceLastAction < 5000) {
            console.log('🔒 [DASHBOARD] Action just completed - preserving optimistic state for 5 seconds');
            return prev;
          }

          // Don't overwrite if a socket event happened recently (within 30 seconds)
          // This prevents the periodic refresh from overwriting socket event updates
          const timeSinceSocketEvent = Date.now() - lastSocketEventTime;
          if (timeSinceSocketEvent < 30000 && prev.isCheckedIn) {
            // Only skip if we're still checked in
            // If we're checked out, always allow refresh to confirm the state
            console.log('🔒 [DASHBOARD] Socket event too recent (within 30s) - preserving state');
            return prev;
          }

          // If we're currently checked in but API returns no data, keep the checked-in state
          // This prevents race conditions where check-in hasn't synced to DB yet
          if (prev.isCheckedIn && !isCurrentlyCheckedIn) {
            console.log('⚠️ [DASHBOARD] API returned no check-in but we are checked in - preserving state');
            return prev;
          }

          console.log('✅ [DASHBOARD] Updating state from API data');
          return {
            isCheckedIn: isCurrentlyCheckedIn,
            checkInTime: checkInTime,
            checkOutTime: checkOutTime,
            hoursWorked: attendance.hoursWorked || 0,
            status: attendance.status || 'absent',
            isOnBreak: calculatedIsOnBreak,  // Always use calculated value from API
            isInMeeting: attendanceData.liveStatus?.isInMeeting || false,
            currentBreakDuration: calculatedBreakDuration,
            breakType: calculatedBreakType
          };
        });
        setIsCheckedIn(isCurrentlyCheckedIn);
        
        // Save to BOTH localStorage keys (same as Attendance page)
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
          breakType: calculatedBreakType
        };
        localStorage.setItem(`checkedIn_${today}`, JSON.stringify(stateToSave));
        localStorage.setItem(attendanceCacheKey, JSON.stringify(stateToSave));
      } else {
        // NO attendance data from API - employee hasn't checked in yet today
        // ALWAYS show the "Log In" button - this is the normal state
        console.log('ℹ️ No attendance record for today - showing Log In button');
        console.log('📊 Attendance API Status:', attendanceResult.status);
        if (attendanceResult.status === 'rejected') {
          console.error('❌ Attendance API Error:', attendanceResult.reason);
        }
        
        // Only update state if not in the middle of an action
        if (!actionInProgress) {
          setIsCheckedIn(false);
          setTodayAttendance({
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
          
          // Clear localStorage to ensure clean state
          const today = getTodayKey();
          localStorage.removeItem(`checkedIn_${today}`);
          localStorage.removeItem(attendanceCacheKey);
        }
      }

      // Update KPI metrics
      setKpiMetrics({
        leaveBalance: "12 days",
        hoursThisWeek: `${attendanceData?.liveStatus?.currentHours || 0}h`,
        performance: "85%"
      });

      // Update performance metrics
      setPerformanceMetrics({
        taskCompletion: 85,
        attendance: attendanceData?.attendance?.status === 'present' ? 100 : 0,
        qualityScore: 90,
        presentDays: 1,
        totalHours: attendanceData?.liveStatus?.currentHours || 0
      });

      // Update recent activities
      const activities: any[] = [];
      if (attendanceData?.attendance?.checkIn) {
        const checkInTime = new Date(attendanceData.attendance.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        activities.push({
          action: 'Checked In',
          description: `Started work at ${checkInTime}`,
          time: 'Today',
          icon: 'clock'
        });
      }
      setRecentActivities(activities);

      // Update upcoming events
      const events: any[] = [];
      setUpcomingEvents(events);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  }, [user, attendanceCacheKey, actionInProgress, disableRefresh]);

  // Fetch data on mount with force refresh
  useEffect(() => {
    // DON'T load from localStorage on initial mount
    // Always fetch fresh data from API to ensure accuracy
    // localStorage is only used for optimistic updates during actions
    fetchDashboardData(true);  // Force refresh on page load
  }, [fetchDashboardData]);

  // Fetch employee ID on mount
  useEffect(() => {
    ensureEmployeeId();
  }, [user?.id]);

  // Socket.IO listeners for real-time updates
  useEffect(() => {
    if (!user?.orgId) return;

    console.log('📡 [EMPLOYEE-DASHBOARD] Setting up Socket.IO listeners');

    // Listen for break started events
    const handleBreakStarted = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] break:started event received:', data);
      console.log('📡 [EMPLOYEE-DASHBOARD] Current employeeId:', employeeId);
      console.log('📡 [EMPLOYEE-DASHBOARD] Event employeeId:', data.employeeId);
      console.log('📡 [EMPLOYEE-DASHBOARD] Match:', data.employeeId === employeeId);

      // Only update if it's for this employee
      if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break started for current employee, updating state');
        setTodayAttendance(prev => ({
          ...prev,
          isOnBreak: true,
          breakType: data.breakType || 'regular',
          currentBreakDuration: 0
        }));
        setLastSocketEventTime(Date.now()); // Mark socket event time
      } else {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break started for different employee, ignoring');
      }
    };

    // Listen for break ended events
    const handleBreakEnded = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] break:ended event received:', data);
      console.log('📡 [EMPLOYEE-DASHBOARD] Current employeeId:', employeeId);
      console.log('📡 [EMPLOYEE-DASHBOARD] Event employeeId:', data.employeeId);
      console.log('📡 [EMPLOYEE-DASHBOARD] Match:', data.employeeId === employeeId);

      // Only update if it's for this employee
      if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break ended for current employee, updating state');
        setTodayAttendance(prev => ({
          ...prev,
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular'
        }));
        setLastSocketEventTime(Date.now()); // Mark socket event time
      } else {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break ended for different employee, ignoring');
      }
    };

    // Listen for meeting started events
    const handleMeetingStarted = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] meeting:started event received:', data);
      console.log('📡 [EMPLOYEE-DASHBOARD] Current employeeId:', employeeId);
      console.log('📡 [EMPLOYEE-DASHBOARD] Event employeeId:', data.employeeId);

      // Only update if it's for this employee
      if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Meeting started for current employee, updating state');
        setTodayAttendance(prev => ({
          ...prev,
          isInMeeting: true
        }));
        setLastSocketEventTime(Date.now()); // Mark socket event time
      }
    };

    // Listen for meeting ended events
    const handleMeetingEnded = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] meeting:ended event received:', data);
      console.log('📡 [EMPLOYEE-DASHBOARD] Current employeeId:', employeeId);
      console.log('📡 [EMPLOYEE-DASHBOARD] Event employeeId:', data.employeeId);

      // Only update if it's for this employee
      if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Meeting ended for current employee, updating state');
        setTodayAttendance(prev => ({
          ...prev,
          isInMeeting: false
        }));
        setLastSocketEventTime(Date.now()); // Mark socket event time
      }
    };

    // Listen for attendance updates
    const handleAttendanceUpdate = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] attendance:update event received:', data);
      // Refresh data when attendance updates
      if (!actionInProgress) {
        fetchDashboardData();
      }
    };

    realTimeSocket.onBreakStarted(handleBreakStarted);
    realTimeSocket.onBreakEnded(handleBreakEnded);
    realTimeSocket.onMeetingStarted(handleMeetingStarted);
    realTimeSocket.onMeetingEnded(handleMeetingEnded);
    realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);

    return () => {
      console.log('📡 [EMPLOYEE-DASHBOARD] Cleaning up Socket.IO listeners');
      // Note: realTimeSocket doesn't expose removeListener methods
      // The listeners will be cleaned up when the component unmounts
    };
  }, [user?.orgId, employeeId, actionInProgress, disableRefresh, fetchDashboardData]);

  // Fetch attendance history
  const fetchAttendanceHistory = useCallback(async () => {
    try {
      setAttendanceLoading(true);

      // Fetch last 30 days of attendance
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await apiGet(`/attendance?limit=30&startDate=${thirtyDaysAgo.toISOString()}`);

      if (result.success && Array.isArray(result.data)) {
        setAttendanceHistory(result.data);

        // Extract break history from attendance records
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

  // Fetch attendance history on mount
  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  // Periodic refresh of attendance data every 30 seconds when checked in
  useEffect(() => {
    if (!isCheckedIn || actionInProgress) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      
      if (!actionInProgress) {
        console.log('⏰ Periodic refresh triggered');
        fetchDashboardData();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isCheckedIn, fetchDashboardData, actionInProgress]);

  // Handle check-in
  const handleCheckIn = async () => {
    console.log('🔵 Check-in button clicked');
    
    if (actionInProgress) {
      console.log('⚠️ Action already in progress');
      return;
    }

    try {
      console.log('✅ Starting check-in process');
      setActionInProgress(true);

      // Update UI immediately (optimistic update)
      const checkInAt = new Date();
      const checkInTime = checkInAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const optimisticState = {
        isCheckedIn: true,
        checkInTime: checkInTime,
        checkOutTime: null,
        hoursWorked: 0,
        status: 'present',
        isOnBreak: false,
        isInMeeting: false,
        currentBreakDuration: 0,
        breakType: 'regular' as const
      };

      console.log('🔄 Setting state to:', optimisticState);
      setTodayAttendance(optimisticState);
      setIsCheckedIn(true);
      
      // Save to localStorage
      const today = getTodayKey();
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify(optimisticState));
      localStorage.setItem(attendanceCacheKey, JSON.stringify(optimisticState));
      
      console.log('✅ State updated and saved to localStorage');

      // Make API call
      console.log('📡 Making API call to /attendance/check-in');
      const result = await apiPost('/attendance/check-in', {
        location: 'Office',
        notes: 'Check-in from dashboard'
      });

      console.log('📡 API Response:', result);

      if (result.success) {
        console.log('✅ Check-in API successful');
        // Update with actual server data if needed
        const actualCheckInAt = result?.data?.checkIn ? new Date(result.data.checkIn) : checkInAt;
        const actualCheckInTime = actualCheckInAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const serverState = {
          ...optimisticState,
          checkInTime: actualCheckInTime
        };
        console.log('🔄 Updating with server state:', serverState);
        setTodayAttendance(serverState);
        
        // Save to localStorage
        const today = getTodayKey();
        localStorage.setItem(`checkedIn_${today}`, JSON.stringify(serverState));
        localStorage.setItem(attendanceCacheKey, JSON.stringify(serverState));
      } else {
        console.error('❌ Check-in API failed:', result?.message);
      }
    } catch (err) {
      console.error('❌ Check-in error:', err);
    } finally {
      setTimeout(() => {
        setActionInProgress(false);
      }, 300);
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    console.log('🔴 Checking out');
    
    if (actionInProgress) {
      return;
    }

    try {
      setActionInProgress(true);

      // Make the API call
      const result = await apiPost('/attendance/check-out', {
        location: 'Office',
        notes: 'Check-out from dashboard'
      });

      if (result?.success) {
        console.log('✅ Check-out successful');
        // Wait 2 seconds for database to update AND socket event to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Fetch fresh data from API
        await fetchDashboardData(true);
      } else {
        console.error('❌ Check-out failed:', result?.message);
      }
    } catch (err) {
      console.error('Check-out error:', err);
      setError(err instanceof Error ? err.message : 'Check-out failed');
    } finally {
      setTimeout(() => {
        setActionInProgress(false);
      }, 300);
    }
  };

  // Handle break start
  const handleBreakStart = async (breakType = 'regular') => {
    console.log('🟢 Starting break:', breakType);
    
    if (actionInProgress) {
      return;
    }

    try {
      setActionInProgress(true);

      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to start break.');
        setActionInProgress(false);
        return;
      }

      const result = await apiPost('/attendance/break-start', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        employeeName: user?.name || 'Employee',
        breakType: breakType,
        notes: `${breakType === 'lunch' ? 'Lunch Break' : 'Break'} started from dashboard`
      });

      if (result.success) {
        setTodayAttendance(prev => ({
          ...prev,
          isOnBreak: true,
          breakType: breakType
        }));
        
        const today = getTodayKey();
        const updatedState = {
          checkedIn: true,
          currentHours: todayAttendance.hoursWorked,
          isOnBreak: true,
          breakType,
          isInMeeting: false
        };
        localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updatedState));
        localStorage.setItem(attendanceCacheKey, JSON.stringify(updatedState));

        console.log('📡 [DASHBOARD] Break started successfully, backend will broadcast socket event');
      }
    } catch (err) {
      console.error('Break start error:', err);
    } finally {
      setTimeout(() => {
        setActionInProgress(false);
      }, 300);
    }
  };

  // Handle break end
  const handleBreakEnd = async () => {
    if (actionInProgress) {
      return;
    }

    try {
      setActionInProgress(true);

      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to end break.');
        setActionInProgress(false);
        return;
      }

      const result = await apiPost('/attendance/break-end', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        employeeName: user?.name || 'Employee',
        notes: 'Break ended from dashboard'
      });

      if (result.success) {
        console.log('✅ Break end successful');
        // Wait 2 seconds for database to update AND socket event to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Fetch fresh data from API
        await fetchDashboardData(true);
      } else {
        console.error('❌ Break end failed:', result);
      }
    } catch (err) {
      console.error('Break end error:', err);
    } finally {
      setTimeout(() => {
        setActionInProgress(false);
      }, 300);
    }
  };

  // Handle meeting start
  const handleMeetingStart = async () => {
    console.log('🟢 Starting meeting');
    
    if (actionInProgress) {
      return;
    }

    try {
      setActionInProgress(true);

      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to start meeting.');
        setActionInProgress(false);
        return;
      }

      const result = await apiPost('/attendance/meeting-start', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        meetingTitle: 'Meeting',
        meetingType: 'internal',
        notes: 'Meeting started from dashboard'
      });

      if (result.success) {
        setTodayAttendance(prev => ({
          ...prev,
          isInMeeting: true
        }));
        
        const today = getTodayKey();
        const updatedState = {
          checkedIn: true,
          currentHours: todayAttendance.hoursWorked,
          isOnBreak: false,
          breakType: null,
          isInMeeting: true
        };
        localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updatedState));
        localStorage.setItem(attendanceCacheKey, JSON.stringify(updatedState));
      }
    } catch (err) {
      console.error('Meeting start error:', err);
    } finally {
      setTimeout(() => {
        setActionInProgress(false);
      }, 300);
    }
  };

  // Handle meeting end
  const handleMeetingEnd = async () => {
    if (actionInProgress) {
      return;
    }

    try {
      setActionInProgress(true);

      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to end meeting.');
        setActionInProgress(false);
        return;
      }

      const result = await apiPost('/attendance/meeting-end', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        notes: 'Meeting ended from dashboard'
      });

      if (result.success) {
        console.log('✅ Meeting end successful');
        // Wait 2 seconds for database to update AND socket event to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Fetch fresh data from API
        await fetchDashboardData(true);
      } else {
        console.error('❌ Meeting end failed:', result);
      }
    } catch (err) {
      console.error('Meeting end error:', err);
    } finally {
      setTimeout(() => {
        setActionInProgress(false);
      }, 300);
    }
  };

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
        
        {/* Attendance Action Buttons - Synced with Attendance Page */}
        <div className="flex items-center gap-2">
          {!todayAttendance.isCheckedIn ? (
            <Button
              onClick={handleCheckIn}
              disabled={actionInProgress}
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Clock className="w-4 h-4" />
              Log In
            </Button>
          ) : (
            <>
              {/* Break Button */}
              {!todayAttendance.isOnBreak ? (
                <Button
                  onClick={() => handleBreakStart('regular')}
                  disabled={actionInProgress || todayAttendance.isInMeeting}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Break
                </Button>
              ) : (
                <Button
                  onClick={handleBreakEnd}
                  disabled={actionInProgress}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Clock className="w-4 h-4" />
                  End Break
                </Button>
              )}

              {/* Meeting Button */}
              {!todayAttendance.isInMeeting ? (
                <Button
                  onClick={handleMeetingStart}
                  disabled={actionInProgress}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Meeting
                </Button>
              ) : (
                <Button
                  onClick={handleMeetingEnd}
                  disabled={actionInProgress}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  End Meeting
                </Button>
              )}

              {/* Log Out Button */}
              <Button
                onClick={handleCheckOut}
                disabled={actionInProgress}
                size="sm"
                variant="destructive"
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </Button>
            </>
          )}

          {/* Status Badge */}
          {todayAttendance.isCheckedIn && (
            <Badge variant="default" className="ml-2">
              {todayAttendance.isOnBreak ? 'On Break' : todayAttendance.isInMeeting ? 'In Meeting' : 'Working'}
            </Badge>
          )}
        </div>
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
        {/* Interactive Calendar */}
        <div className="lg:col-span-2">
          <InteractiveCalendar />
        </div>

        {/* Holidays List */}
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
        {/* Left Column - Quick Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sections removed as per user request */}
        </div>

        {/* Right Column - Events & Notifications */}
        <div className="space-y-6">
        </div>
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
                          ? new Date(record.checkIn).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {record.checkOut
                          ? new Date(record.checkOut).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
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
                          ? new Date(breakRecord.startTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {breakRecord.endTime
                          ? new Date(breakRecord.endTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
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
