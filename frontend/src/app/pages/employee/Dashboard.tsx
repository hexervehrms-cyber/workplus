import { useState, useEffect, useCallback } from 'react';
import { KPICard } from '../../components/KPICard';
import EmployeeDocuments from '../../components/EmployeeDocuments';
import InteractiveCalendar from '../../components/InteractiveCalendar';
import ChatWidget from '../../components/ChatWidget';
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
  const attendanceCacheKey = `employee_dashboard_attendance_${user?.id || 'unknown'}`;

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
      }, 5000); // 5 second timeout
      
      // Fetch only critical data first (attendance), then holidays separately
      const attendanceResult = await apiGet('/attendance/today');
      clearTimeout(timeoutId);
      
      // Fetch holidays in parallel but don't block on it - use cached version first
      const cachedHolidays = localStorage.getItem('cached_holidays');
      if (cachedHolidays) {
        try {
          const parsed = JSON.parse(cachedHolidays);
          setHolidays(parsed);
        } catch (e) {
          console.warn('Failed to parse cached holidays');
        }
      }
      
      // Fetch fresh holidays in background
      apiGet('/holidays').then(result => {
        if (result?.success && Array.isArray(result.data)) {
          console.log('✅ Dashboard: Loaded', result.data.length, 'holidays');
          setHolidays(result.data);
          // Cache holidays for offline access
          localStorage.setItem('cached_holidays', JSON.stringify(result.data));
        }
      }).catch(err => {
        console.warn('⚠️ Holiday fetch failed:', err);
        // Try to fetch from localStorage as fallback
        const cachedHolidays = localStorage.getItem('cached_holidays');
        if (cachedHolidays) {
          try {
            const parsed = JSON.parse(cachedHolidays);
            console.log('📦 Using cached holidays:', parsed.length);
            setHolidays(parsed);
          } catch (e) {
            console.warn('Failed to parse cached holidays');
          }
        }
      });

      const attendanceData =
        attendanceResult?.success
          ? attendanceResult.data
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
          // SIMPLIFIED LOGIC: Always trust the API data for break status
          // The API calculates break status from the database, which is the source of truth
          
          // Only preserve state if action is currently in progress (not just recent)
          if (actionInProgress) {
            return prev;
          }
          
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
        localStorage.setItem(attendanceCacheKey, JSON.stringify({
          isCheckedIn: isCurrentlyCheckedIn,
          checkInTime,
          checkOutTime,
          hoursWorked: attendance.hoursWorked || 0,
          status: attendance.status || 'absent',
          isOnBreak: calculatedIsOnBreak,
          isInMeeting: attendanceData.liveStatus?.isInMeeting || false,
          currentBreakDuration: calculatedBreakDuration,
          breakType: calculatedBreakType
        }));
      } else {
        setIsCheckedIn(false);
        setTodayAttendance(prev => {
          // Preserve break/meeting state if we're in the middle of an action
          const shouldPreserveState = disableRefresh;
          
          if (shouldPreserveState) {
            return {
              ...prev,
              isCheckedIn: false,
              status: 'absent'
            };
          }
          
          return {
            isCheckedIn: false,
            checkInTime: null,
            checkOutTime: null,
            hoursWorked: 0,
            status: 'absent',
            isOnBreak: false,
            isInMeeting: false,
            currentBreakDuration: 0,
            breakType: 'regular'
          };
        });
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
    const cachedAttendance = localStorage.getItem(attendanceCacheKey);
    if (cachedAttendance) {
      try {
        const parsed = JSON.parse(cachedAttendance);
        setIsCheckedIn(!!parsed.isCheckedIn);
        setTodayAttendance(prev => ({ ...prev, ...parsed }));
      } catch (_) {}
    }
    fetchDashboardData(true);  // Force refresh on page load
  }, [fetchDashboardData, attendanceCacheKey]);

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
      
      // Only update if it's for this employee
      if (data.employeeId === employeeId) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break started for current employee, updating state');
        setTodayAttendance(prev => ({
          ...prev,
          isOnBreak: true,
          breakType: data.breakType || 'regular',
          currentBreakDuration: 0
        }));
      }
    };

    // Listen for break ended events
    const handleBreakEnded = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] break:ended event received:', data);
      
      // Only update if it's for this employee
      if (data.employeeId === employeeId) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Break ended for current employee, updating state');
        setTodayAttendance(prev => ({
          ...prev,
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular'
        }));
      }
    };

    // Listen for attendance updates
    const handleAttendanceUpdate = (data: any) => {
      console.log('📡 [EMPLOYEE-DASHBOARD] attendance:update event received:', data);
      
      // Refresh dashboard data to get latest state
      if (!actionInProgress && !disableRefresh) {
        console.log('📡 [EMPLOYEE-DASHBOARD] Refreshing dashboard data after attendance update');
        fetchDashboardData();
      }
    };

    realTimeSocket.onBreakStarted(handleBreakStarted);
    realTimeSocket.onBreakEnded(handleBreakEnded);
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
    if (!isCheckedIn || disableRefresh || actionInProgress) return;
    
    // Don't refresh if an action was performed recently (within 5 seconds)
    const timeSinceLastAction = Date.now() - lastActionTime;
    if (timeSinceLastAction < 5000) return;
    
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      // Double check before refreshing
      if (!actionInProgress && (Date.now() - lastActionTime) >= 5000) {
        fetchDashboardData();
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [isCheckedIn, disableRefresh, fetchDashboardData, actionInProgress, lastActionTime]);

  // Handle check-in
  const handleCheckIn = async () => {
    // Prevent multiple simultaneous actions
    if (actionInProgress) {
      toast.error('Please wait, another action is in progress...');
      return;
    }

    try {
      setActionInProgress(true);
      setLastActionTime(Date.now());
      
      // Disable refresh during action
      setDisableRefresh(true);

      const result = await apiPost('/attendance/check-in', {
        location: 'Office',
        notes: 'Check-in from dashboard'
      });

      if (result.success) {
        const checkInAt = result?.data?.checkIn ? new Date(result.data.checkIn) : new Date();
        const checkInTime = checkInAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        setIsCheckedIn(true);
        const updatedState = {
          isCheckedIn: true,
          checkInTime: checkInTime,
          checkOutTime: null,
          hoursWorked: 0,
          status: 'present',
          isOnBreak: false,
          isInMeeting: false,
          currentBreakDuration: 0,
          breakType: 'regular'
        };
        setTodayAttendance(updatedState);
        localStorage.setItem(attendanceCacheKey, JSON.stringify(updatedState));
        toast.success('Checked in successfully!');
        
        // Fetch fresh data immediately to ensure UI is in sync with database
        setTimeout(async () => {
          await fetchDashboardData();
          setDisableRefresh(false);
        }, 800);
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setError(err instanceof Error ? err.message : 'Check-in failed');
      toast.error(err instanceof Error ? err.message : 'Check-in failed');
      setDisableRefresh(false);
    } finally {
      // Clear action lock after delay to prevent rapid re-clicks
      setTimeout(() => {
        setActionInProgress(false);
      }, 1500);
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    // Prevent multiple simultaneous actions
    if (actionInProgress) {
      toast.error('Please wait, another action is in progress...');
      return;
    }

    try {
      setActionInProgress(true);
      setLastActionTime(Date.now());

      // Disable refresh during action
      setDisableRefresh(true);

      const result = await apiPost('/attendance/check-out', {
        location: 'Office',
        notes: 'Check-out from dashboard'
      });

      if (result.success) {
        const checkOutAt = result?.data?.checkOut ? new Date(result.data.checkOut) : new Date();
        const checkOutTime = checkOutAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const hoursWorked = result.data?.hoursWorked || 0;

        setIsCheckedIn(false);
        const updatedState = {
          isCheckedIn: false,
          checkInTime: todayAttendance.checkInTime,
          checkOutTime: checkOutTime,
          hoursWorked: hoursWorked,
          status: 'checked_out',
          isOnBreak: false,
          isInMeeting: false,
          currentBreakDuration: 0,
          breakType: 'regular'
        };
        setTodayAttendance(updatedState);
        localStorage.setItem(attendanceCacheKey, JSON.stringify(updatedState));
        toast.success('Checked out successfully!');
        
        // Fetch fresh data immediately to ensure UI is in sync with database
        setTimeout(async () => {
          await fetchDashboardData();
          setDisableRefresh(false);
        }, 800);
      }
    } catch (err) {
      console.error('Check-out error:', err);
      setError(err instanceof Error ? err.message : 'Check-out failed');
      toast.error(err instanceof Error ? err.message : 'Check-out failed');
      setDisableRefresh(false);
    } finally {
      // Clear action lock after delay to prevent rapid re-clicks
      setTimeout(() => {
        setActionInProgress(false);
      }, 1500);
    }
  };

  // Handle break start
  const handleBreakStart = async (breakType = 'regular') => {
    // Prevent multiple simultaneous actions
    if (actionInProgress) {
      toast.error('Please wait, another action is in progress...');
      return;
    }

    try {
      setActionInProgress(true);
      setLastActionTime(Date.now());
      
      // Check if in meeting - show toast to end meeting first
      if (todayAttendance.isInMeeting) {
        toast.error('You are in a meeting. Please end it first to start a break.');
        setActionInProgress(false);  // Clear flag before returning
        return;
      }

      // Check if already on a different type of break
      if (todayAttendance.isOnBreak && todayAttendance.breakType !== breakType) {
        const currentBreakLabel = todayAttendance.breakType === 'lunch' ? 'Lunch Break' : 'Break';
        const newBreakLabel = breakType === 'lunch' ? 'Lunch Break' : 'Break';
        toast.error(`You are already on ${currentBreakLabel}. Please end it first to start ${newBreakLabel}.`);
        setActionInProgress(false);  // Clear flag before returning
        return;
      }

      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to start break.');
        toast.error('Unable to start break. Please try refreshing the page.');
        setActionInProgress(false);  // Clear flag before returning
        return;
      }

      // Disable refresh completely during action
      setDisableRefresh(true);

      const result = await apiPost('/attendance/break-start', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        employeeName: user?.name || 'Employee',
        breakType: breakType,
        notes: `${breakType === 'lunch' ? 'Lunch Break' : 'Break'} started from dashboard`
      });

      if (result.success) {
        // Immediately update state - this will persist until manually changed
        setTodayAttendance(prev => ({
          ...prev,
          isOnBreak: true,
          breakType: breakType
        }));
        
        const breakLabel = breakType === 'lunch' ? 'Lunch Break' : 'Break';
        toast.success(`${breakLabel} started!`);
        
        // Immediately fetch fresh data to ensure state is in sync with database
        console.log('☕ [BREAK-START] Fetching fresh data after break start');
        setTimeout(async () => {
          await fetchDashboardData();
          setDisableRefresh(false);
        }, 800);  // Increased delay to ensure database is updated
      } else {
        setDisableRefresh(false);
      }
    } catch (err) {
      console.error('Break start error:', err);
      toast.error(err instanceof Error ? err.message : 'Break start failed');
      // Re-enable refresh on error
      setDisableRefresh(false);
    } finally {
      // Always clear action lock after delay
      setTimeout(() => {
        setActionInProgress(false);
      }, 1500);
    }
  };

  // Handle break end
  const handleBreakEnd = async () => {
    // Prevent multiple simultaneous actions
    if (actionInProgress) {
      toast.error('Please wait, another action is in progress...');
      return;
    }

    try {
      setActionInProgress(true);
      setLastActionTime(Date.now());
      
      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to end break.');
        toast.error('Unable to end break. Please try refreshing the page.');
        setActionInProgress(false);  // Clear flag before returning
        return;
      }

      // Disable refresh completely during action
      setDisableRefresh(true);

      const result = await apiPost('/attendance/break-end', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        employeeName: user?.name || 'Employee',
        notes: 'Break ended from dashboard'
      });

      if (result.success) {
        // Immediately update state - this will persist until manually changed
        setTodayAttendance(prev => ({
          ...prev,
          isOnBreak: false,
          currentBreakDuration: 0,
          breakType: 'regular' // Reset break type
        }));
        
        toast.success('Break ended!');
        
        // Immediately fetch fresh data to ensure state is in sync with database
        console.log('☕ [BREAK-END] Fetching fresh data after break end');
        setTimeout(async () => {
          await fetchDashboardData();
          setDisableRefresh(false);
        }, 800);  // Increased delay to ensure database is updated
      } else {
        // Re-enable refresh if failed
        setDisableRefresh(false);
      }
    } catch (err) {
      console.error('Break end error:', err);
      toast.error(err instanceof Error ? err.message : 'Break end failed');
      // Re-enable refresh if error
      setDisableRefresh(false);
    } finally {
      // Always clear action lock after delay
      setTimeout(() => {
        setActionInProgress(false);
      }, 1500);
    }
  };

  // Handle meeting start
  const handleMeetingStart = async () => {
    // Prevent multiple simultaneous actions
    if (actionInProgress) {
      toast.error('Please wait, another action is in progress...');
      return;
    }

    try {
      setActionInProgress(true);
      setLastActionTime(Date.now());
      
      // Check if on break - show toast to end break first
      if (todayAttendance.isOnBreak) {
        toast.error(`You are on a ${todayAttendance.breakType === 'lunch' ? 'lunch break' : 'break'}. Please end it first to start a meeting.`);
        return;
      }

      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to start meeting.');
        toast.error('Unable to start meeting. Please try refreshing the page.');
        setActionInProgress(false);  // Clear flag before returning
        return;
      }

      // Disable refresh completely during action
      setDisableRefresh(true);

      const result = await apiPost('/attendance/meeting-start', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        meetingTitle: 'Meeting',
        meetingType: 'internal',
        notes: 'Meeting started from dashboard'
      });

      if (result.success) {
        // Immediately update state - this will persist until manually changed
        setTodayAttendance(prev => ({
          ...prev,
          isInMeeting: true
        }));
        
        toast.success('Meeting started!');
        
        // Fetch fresh data after meeting start
        setTimeout(async () => {
          await fetchDashboardData();
          setDisableRefresh(false);
        }, 800);  // Increased delay to ensure database is updated
      } else {
        setDisableRefresh(false);
      }
    } catch (err) {
      console.error('Meeting start error:', err);
      toast.error(err instanceof Error ? err.message : 'Meeting start failed');
      // Re-enable refresh on error
      setDisableRefresh(false);
    } finally {
      // Always clear action lock after delay
      setTimeout(() => {
        setActionInProgress(false);
      }, 1500);
    }
  };

  // Handle meeting end
  const handleMeetingEnd = async () => {
    // Prevent multiple simultaneous actions
    if (actionInProgress) {
      toast.error('Please wait, another action is in progress...');
      return;
    }

    try {
      setActionInProgress(true);
      setLastActionTime(Date.now());
      
      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to end meeting.');
        toast.error('Unable to end meeting. Please try refreshing the page.');
        setActionInProgress(false);  // Clear flag before returning
        return;
      }

      // Disable refresh completely during action
      setDisableRefresh(true);

      const result = await apiPost('/attendance/meeting-end', {
        employeeId: currentEmployeeId,
        orgId: user?.orgId || user?.tenantId || 'system',
        notes: 'Meeting ended from dashboard'
      });

      if (result.success) {
        // Immediately update state - this will persist until manually changed
        setTodayAttendance(prev => ({
          ...prev,
          isInMeeting: false
        }));
        
        toast.success('Meeting ended!');
        
        // Fetch fresh data after meeting end
        setTimeout(async () => {
          await fetchDashboardData();
          setDisableRefresh(false);
        }, 800);  // Increased delay to ensure database is updated
      } else {
        // Re-enable refresh if failed
        setDisableRefresh(false);
      }
    } catch (err) {
      console.error('Meeting end error:', err);
      toast.error(err instanceof Error ? err.message : 'Meeting end failed');
      // Re-enable refresh if error
      setDisableRefresh(false);
    } finally {
      // Always clear action lock after delay
      setTimeout(() => {
        setActionInProgress(false);
      }, 1500);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {user?.name || 'Employee'}! 👋
          </h1>
          <p className="text-muted-foreground">Here's what's happening with your work today</p>
        </div>
        <div className="flex gap-3">
          {/* Break Button */}
          <Button 
            variant={todayAttendance.isOnBreak && todayAttendance.breakType === 'regular' ? "destructive" : "outline"} 
            className="rounded-xl"
            onClick={todayAttendance.isOnBreak && todayAttendance.breakType === 'regular' ? handleBreakEnd : () => handleBreakStart('regular')}
            disabled={!todayAttendance.isCheckedIn || todayAttendance.isInMeeting || (todayAttendance.isOnBreak && todayAttendance.breakType !== 'regular') || actionInProgress}
          >
            {todayAttendance.isOnBreak && todayAttendance.breakType === 'regular' ? 'End Break' : 'Break'}
          </Button>

          {/* Meeting Button */}
          <Button 
            variant={todayAttendance.isInMeeting ? "destructive" : "outline"} 
            className="rounded-xl"
            onClick={todayAttendance.isInMeeting ? handleMeetingEnd : handleMeetingStart}
            disabled={!todayAttendance.isCheckedIn || todayAttendance.isOnBreak || actionInProgress}
          >
            {todayAttendance.isInMeeting ? 'End Meeting' : 'Meeting'}
          </Button>

          {/* Check In/Out Button */}
          {!isCheckedIn ? (
            <Button 
              className="rounded-xl bg-green-600 hover:bg-green-700" 
              onClick={handleCheckIn}
              disabled={actionInProgress}
            >
              <Clock className="w-4 h-4 mr-2" />
              Check In
            </Button>
          ) : (
            <Button 
              className="rounded-xl bg-red-600 hover:bg-red-700" 
              onClick={handleCheckOut}
              disabled={actionInProgress}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Check Out
            </Button>
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
                        className={`p-3 rounded-lg border transition-all duration-300 holiday-item-3d ${
                          isUpcoming 
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
          {/* Attendance Card */}
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold text-lg mb-4">Today's Attendance</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                <Clock className="w-8 h-8 text-secondary mb-2" />
                <p className="text-sm text-muted-foreground">Check-in Time</p>
                <p className="text-2xl font-bold text-foreground">
                  {todayAttendance.checkInTime || 'Not checked in'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <Target className="w-8 h-8 text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Hours Today</p>
                <p className="text-2xl font-bold text-foreground">
                  {todayAttendance.hoursWorked.toFixed(1)}h
                </p>
              </div>
            </div>

            {/* Check In Button */}
            <div className="mb-4">
              <Button 
                size="lg"
                className={`w-full font-semibold ${todayAttendance.isCheckedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                onClick={todayAttendance.isCheckedIn ? handleCheckOut : handleCheckIn}
              >
                {todayAttendance.isCheckedIn ? 'Check Out' : 'Check In'}
              </Button>
            </div>

            {/* Break and Meeting Buttons - Always visible */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {/* Break Button */}
                <Button 
                  variant={todayAttendance.isOnBreak && todayAttendance.breakType === 'regular' ? "destructive" : "outline"} 
                  size="sm"
                  onClick={todayAttendance.isOnBreak && todayAttendance.breakType === 'regular' ? handleBreakEnd : () => handleBreakStart('regular')}
                  disabled={!todayAttendance.isCheckedIn || todayAttendance.isInMeeting || (todayAttendance.isOnBreak && todayAttendance.breakType !== 'regular') || actionInProgress}
                  className="rounded-lg"
                >
                  {todayAttendance.isOnBreak && todayAttendance.breakType === 'regular' ? 'End Break' : 'Break'}
                </Button>

                {/* Meeting Button */}
                <Button 
                  variant={todayAttendance.isInMeeting ? "destructive" : "outline"} 
                  size="sm"
                  onClick={todayAttendance.isInMeeting ? handleMeetingEnd : handleMeetingStart}
                  disabled={!todayAttendance.isCheckedIn || todayAttendance.isOnBreak || actionInProgress}
                  className="rounded-lg"
                >
                  {todayAttendance.isInMeeting ? 'End Meeting' : 'Meeting'}
                </Button>
              </div>
              
              {/* Break Info */}
              {todayAttendance.isOnBreak && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>{todayAttendance.breakType === 'lunch' ? 'Lunch Break' : 'Break'}</strong> - {todayAttendance.currentBreakDuration} minutes
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Performance Overview */}
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold text-lg mb-4">Performance Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Task Completion</span>
                  <span className="text-sm font-medium">{performanceMetrics.taskCompletion}%</span>
                </div>
                <Progress value={performanceMetrics.taskCompletion} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Attendance</span>
                  <span className="text-sm font-medium">{performanceMetrics.attendance}%</span>
                </div>
                <Progress value={performanceMetrics.attendance} className="h-2 [&>div]:bg-secondary" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Quality Score</span>
                  <span className="text-sm font-medium">{performanceMetrics.qualityScore}%</span>
                </div>
                <Progress value={performanceMetrics.qualityScore} className="h-2 [&>div]:bg-accent" />
              </div>
            </div>
          </Card>
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
  );
}