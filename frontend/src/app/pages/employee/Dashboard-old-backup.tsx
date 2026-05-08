import { useState, useEffect, useCallback } from 'react';
import { KPICard } from '../../components/KPICard';
import EmployeeDocuments from '../../components/EmployeeDocuments';
import InteractiveCalendar from '../../components/InteractiveCalendar';
import ChatWidget from '../../components/ChatWidget';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { ExpenseService, LeaveRequestService } from '../../utils/api';
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
  Coffee,
  Users,
  LogOut,
  FileText,
  LogIn,
  Pause,
  Play,
  Activity
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { toast } from 'sonner';

interface TimeRecord {
  id: number;
  type: 'check-in' | 'check-out' | 'break' | 'meeting';
  timestamp: string;
  duration?: string;
  ipAddress?: string;
}

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
  const [selectedTab, setSelectedTab] = useState('overview');
  const [currentBreak, setCurrentBreak] = useState<string | null>(null);
  const [currentMeeting, setCurrentMeeting] = useState<string | null>(null);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [showReCheckInDialog, setShowReCheckInDialog] = useState(false);
  const [wasOnBreakBeforeCheckout, setWasOnBreakBeforeCheckout] = useState(false);
  const [reCheckInTimer, setReCheckInTimer] = useState<NodeJS.Timeout | null>(null);

  // State for real data
  const [kpiMetrics, setKpiMetrics] = useState({
    leaveBalance: "0 days",
    hoursThisWeek: "0h", 
    currentSalary: 0,
    performance: "0%"
  });
  
  const [todayAttendance, setTodayAttendance] = useState({
    isCheckedIn: false,
    checkInTime: null,
    checkOutTime: null,
    hoursWorked: 0,
    status: 'absent'
  });
  
  const [performanceMetrics, setPerformanceMetrics] = useState({
    taskCompletion: 0,
    attendance: 0,
    qualityScore: 0,
    presentDays: 0,
    totalHours: 0
  });

  // State for holidays
  const [holidays, setHolidays] = useState<any[]>([]);
  
  // State for time tracking view tabs
  const [timeTrackingTab, setTimeTrackingTab] = useState<'records' | 'activity'>('records');

  // Helper function to fetch employee ID if not available
  const ensureEmployeeId = async (): Promise<string | null> => {
    if (employeeId) return employeeId;
    
    if (!user?.id) return null;
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`/api/employees/user/${user.id}`, {
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

  // Fetch dashboard data on component mount
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const orgId = user?.orgId || user?.tenantId || 'system';
      
      // Fetch employee data
      let employeeData = null;
      try {
        const employeeResponse = await fetch(`/api/employees/user/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (employeeResponse.ok) {
          const employeeResult = await employeeResponse.json();
          if (employeeResult.data) {
            employeeData = employeeResult.data;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch employee data:', err);
      }
      
      // Fetch salary cycle for leave policy
      let salaryCycleData = null;
      try {
        const cycleResponse = await fetch(`/api/salary-cycles?orgId=${orgId}&isActive=true`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (cycleResponse.ok) {
          const cycleResult = await cycleResponse.json();
          if (cycleResult.data && Array.isArray(cycleResult.data) && cycleResult.data.length > 0) {
            salaryCycleData = cycleResult.data[0];
          }
        }
      } catch (err) {
        console.warn('Failed to fetch salary cycle:', err);
      }
      
      // Fetch today's attendance data
      const attendanceResponse = await fetch(`/api/attendance/today?employeeId=${employeeData?._id || ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Fetching attendance with employeeId:', employeeData?._id);
      console.log('Attendance URL:', `/api/attendance/today?employeeId=${employeeData?._id || ''}`);
      
      let attendanceData = null;
      if (attendanceResponse.ok) {
        const attendanceResult = await attendanceResponse.json();
        console.log('Attendance API Response:', attendanceResult);
        if (attendanceResult.success) {
          attendanceData = attendanceResult.data;
          console.log('Attendance Data:', attendanceData);
          console.log('Breaks from API:', attendanceData?.attendance?.breaks?.length || 0);
          if (attendanceData?.attendance?.breaks) {
            console.log('Breaks details:', attendanceData.attendance.breaks);
          }
        }
      } else {
        console.error('Attendance API error:', attendanceResponse.status, attendanceResponse.statusText);
      }
      
      // Fetch dashboard data
      const response = await fetch('/api/dashboard/employee', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      let data = {};
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          data = result.data;
        }
      }
      
      // Merge all data
      if (attendanceData) {
        data = { ...data, attendance: { today: attendanceData.attendance } };
      }
      if (employeeData) {
        data = { ...data, employee: employeeData };
      }
      if (salaryCycleData) {
        data = { ...data, salaryCycle: salaryCycleData };
      }
      
      setDashboardData(data);
      
      // Fetch holidays
      try {
        const holidayResponse = await fetch('/api/holidays', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (holidayResponse.ok) {
          const holidayData = await holidayResponse.json();
          if (holidayData.success && Array.isArray(holidayData.data)) {
            setHolidays(holidayData.data);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch holidays:', err);
      }
      
      // Calculate leave balance from salary cycle policy
      const paidLeavePerMonth = salaryCycleData?.leavePolicy?.paidLeavePerMonth || 2;
      const sickLeavePerMonth = salaryCycleData?.leavePolicy?.sickLeavePerMonth || 1;
      const casualLeavePerMonth = salaryCycleData?.leavePolicy?.casualLeavePerMonth || 1;
      const totalMonthlyLeave = paidLeavePerMonth + sickLeavePerMonth + casualLeavePerMonth;
      const annualLeaveBalance = totalMonthlyLeave * 12;
      
      // Calculate hours this week (from attendance records)
      const hoursThisWeek = data.attendance?.today?.hoursWorked || 0;
      
      // Calculate current salary based on salary calculation type
      let currentSalary = 0;
      const salaryType = employeeData?.salaryCalculationType || 'fixed';
      
      if (salaryType === 'hourly') {
        // Salary = Hourly Rate × Hours Worked
        const hourlyRate = employeeData?.hourlyRate || 0;
        currentSalary = hourlyRate * hoursThisWeek;
      } else if (salaryType === 'daily') {
        // Salary = Daily Rate × Days Worked
        const dailyRate = employeeData?.dailyRate || 0;
        const daysWorked = hoursThisWeek > 0 ? 1 : 0; // Count as 1 day if any hours worked
        currentSalary = dailyRate * daysWorked;
      } else {
        // Fixed salary (default)
        currentSalary = employeeData?.baseSalary || 0;
      }
      
      // Calculate performance score based on attendance
      const attendancePercentage = data.attendance?.today?.status === 'present' ? 100 : 0;
      
      // Update KPI metrics with real data
      setKpiMetrics({
        leaveBalance: `${annualLeaveBalance} days`,
        hoursThisWeek: `${hoursThisWeek}h`, 
        currentSalary: currentSalary,
        performance: `${attendancePercentage}%`
      });
      
      // Update today's attendance using the fetched attendance data
      if (attendanceData) {
        const liveStatus = attendanceData.liveStatus;
        const attendance = attendanceData.attendance;
        
        // Set current break state based on live status
        if (liveStatus?.isOnBreak) {
          setCurrentBreak(`Break started (${liveStatus.currentBreakDuration} min)`);
        } else {
          setCurrentBreak(null);
        }
        
        // Set current meeting state based on live status
        if (liveStatus?.isInMeeting) {
          setCurrentMeeting('Meeting in progress');
        } else {
          setCurrentMeeting(null);
        }
        
        if (attendance) {
          const checkInTime = attendance.checkIn 
            ? new Date(attendance.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : null;
          const checkOutTime = attendance.checkOut 
            ? new Date(attendance.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : null;
          
          setTodayAttendance({
            isCheckedIn: !!attendance.checkIn && !attendance.checkOut,
            checkInTime: checkInTime,
            checkOutTime: checkOutTime,
            hoursWorked: liveStatus?.currentHours || 0,
            status: attendance.status || 'absent'
          });
          setIsCheckedIn(!!attendance.checkIn && !attendance.checkOut);
          
          // Build comprehensive time records from attendance data
          // Preserve locally added break/meeting records that haven't been synced to API yet
          const records: TimeRecord[] = [];
          let recordId = 1;
          
          console.log('Building time records from attendance:', attendance);
          console.log('Attendance breaks:', attendance?.breaks?.length || 0);
          
          if (attendance.checkIn) {
            records.push({
              id: recordId++,
              type: 'check-in',
              timestamp: new Date(attendance.checkIn).toLocaleString()
            });
          }
          
          // Add breaks with proper duration
          if (attendance.breaks && Array.isArray(attendance.breaks)) {
            console.log('Processing breaks:', attendance.breaks.length);
            attendance.breaks.forEach((breakItem: any) => {
              if (breakItem.startTime) {
                records.push({
                  id: recordId++,
                  type: 'break',
                  timestamp: new Date(breakItem.startTime).toLocaleString(),
                  duration: breakItem.duration ? `${breakItem.duration} min` : 
                           (breakItem.endTime ? 
                            `${Math.round((new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60))} min` : 
                            'In progress'),
                  ipAddress: breakItem.ipAddress
                });
              }
            });
          }
          
          // Add meetings from meetings array
          if (attendance.meetings && Array.isArray(attendance.meetings)) {
            attendance.meetings.forEach((meetingItem: any) => {
              if (meetingItem.startTime) {
                records.push({
                  id: recordId++,
                  type: 'meeting',
                  timestamp: new Date(meetingItem.startTime).toLocaleString(),
                  duration: meetingItem.duration ? `${meetingItem.duration} min` : 
                           (meetingItem.endTime ? 
                            `${Math.round((new Date(meetingItem.endTime) - new Date(meetingItem.startTime)) / (1000 * 60))} min` : 
                            'In progress'),
                  ipAddress: meetingItem.ipAddress
                });
              }
            });
          }
          
          // Add current meeting mode (stored as single object, not array)
          if (attendance.meetingMode && attendance.meetingMode.toggledAt) {
            records.push({
              id: recordId++,
              type: 'meeting',
              timestamp: new Date(attendance.meetingMode.toggledAt).toLocaleString(),
              duration: attendance.meetingMode.isActive ? 'In progress' : 'Ended'
            });
          }
          
          if (attendance.checkOut) {
            records.push({
              id: recordId++,
              type: 'check-out',
              timestamp: new Date(attendance.checkOut).toLocaleString()
            });
          }
          
          // Merge with existing local records to preserve unsync'd break/meeting records
          setTimeRecords(prevRecords => {
            // Get all locally added break/meeting records that are not yet in the API data
            const localBreaksAndMeetings = prevRecords.filter(record => 
              (record.type === 'break' || record.type === 'meeting') &&
              !records.some(apiRecord => 
                apiRecord.type === record.type && 
                apiRecord.timestamp === record.timestamp
              )
            );
            
            // Combine API records with local unsync'd records
            const finalRecords = [...records, ...localBreaksAndMeetings].sort((a, b) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              return timeA - timeB;
            });
            
            console.log('Final time records:', finalRecords.length);
            console.log('Final records:', finalRecords);
            return finalRecords;
          });
        }
      }
      
      // Fallback: Update today's attendance from dashboard data if attendance API failed
      if (!attendanceData && data.attendance?.today) {
        const checkInTime = data.attendance.today.checkIn 
          ? new Date(data.attendance.today.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;
        const checkOutTime = data.attendance.today.checkOut 
          ? new Date(data.attendance.today.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null;
        
        setTodayAttendance({
          isCheckedIn: !!data.attendance.today.checkIn && !data.attendance.today.checkOut,
          checkInTime: checkInTime,
          checkOutTime: checkOutTime,
          hoursWorked: data.attendance.today.hoursWorked || 0,
          status: data.attendance.today.status || 'absent'
        });
        setIsCheckedIn(!!data.attendance.today.checkIn && !data.attendance.today.checkOut);
        
        // Build basic time records from dashboard data
        const records: TimeRecord[] = [];
        let recordId = 1;
        
        if (data.attendance.today.checkIn) {
          records.push({
            id: recordId++,
            type: 'check-in',
            timestamp: new Date(data.attendance.today.checkIn).toLocaleString()
          });
        }
        
        // Add breaks with proper duration
        if (data.attendance.today.breaks && Array.isArray(data.attendance.today.breaks)) {
          data.attendance.today.breaks.forEach((breakItem: any) => {
            if (breakItem.startTime) {
              records.push({
                id: recordId++,
                type: 'break',
                timestamp: new Date(breakItem.startTime).toLocaleString(),
                duration: breakItem.duration ? `${breakItem.duration} min` : 
                         (breakItem.endTime ? 
                          `${Math.round((new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60))} min` : 
                          'In progress'),
                ipAddress: breakItem.ipAddress
              });
            }
          });
        }
        
        // Add meetings from meetings array
        if (data.attendance.today.meetings && Array.isArray(data.attendance.today.meetings)) {
          data.attendance.today.meetings.forEach((meetingItem: any) => {
            if (meetingItem.startTime) {
              records.push({
                id: recordId++,
                type: 'meeting',
                timestamp: new Date(meetingItem.startTime).toLocaleString(),
                duration: meetingItem.duration ? `${meetingItem.duration} min` : 
                         (meetingItem.endTime ? 
                          `${Math.round((new Date(meetingItem.endTime) - new Date(meetingItem.startTime)) / (1000 * 60))} min` : 
                          'In progress'),
                ipAddress: meetingItem.ipAddress
              });
            }
          });
        }
        
        // Add current meeting mode (stored as single object, not array)
        if (data.attendance.today.meetingMode && data.attendance.today.meetingMode.toggledAt) {
          records.push({
            id: recordId++,
            type: 'meeting',
            timestamp: new Date(data.attendance.today.meetingMode.toggledAt).toLocaleString(),
            duration: data.attendance.today.meetingMode.isActive ? 'In progress' : 'Ended'
          });
        }
        
        if (data.attendance.today.checkOut) {
          records.push({
            id: recordId++,
            type: 'check-out',
            timestamp: new Date(data.attendance.today.checkOut).toLocaleString()
          });
        }
        
        // Merge with existing local records to preserve unsync'd break/meeting records
        setTimeRecords(prevRecords => {
          // Get all locally added break/meeting records that are not yet in the API data
          const localBreaksAndMeetings = prevRecords.filter(record => 
            (record.type === 'break' || record.type === 'meeting') &&
            !records.some(apiRecord => 
              apiRecord.type === record.type && 
              apiRecord.timestamp === record.timestamp
            )
          );
          
          // Combine API records with local unsync'd records
          return [...records, ...localBreaksAndMeetings].sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB;
          });
        });
      }
      
      // Update performance metrics
      setPerformanceMetrics({
        taskCompletion: 85, // Can be updated from task data if available
        attendance: data.attendance?.today?.status === 'present' ? 100 : 0,
        qualityScore: 90, // Can be updated from performance review data
        presentDays: 1, // Can be calculated from attendance records
        totalHours: hoursThisWeek
      });
      
      // Update recent activities
      const activities: any[] = [];
      if (data.attendance?.today?.checkIn) {
        const checkInTime = new Date(data.attendance.today.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        activities.push({
          action: 'Checked In',
          description: `Started work at ${checkInTime}`,
          time: 'Today',
          icon: 'clock'
        });
      }
      if (data.leaves?.recent && data.leaves.recent.length > 0) {
        data.leaves.recent.slice(0, 2).forEach((leave: any) => {
          activities.push({
            action: leave.status === 'approved' ? 'Leave Approved' : 'Leave Requested',
            description: `${leave.leaveType || 'Leave'} leave`,
            time: new Date(leave.createdAt).toLocaleDateString(),
            icon: 'calendar'
          });
        });
      }
      if (data.expenses?.recent && data.expenses.recent.length > 0) {
        data.expenses.recent.slice(0, 1).forEach((expense: any) => {
          activities.push({
            action: 'Expense Submitted',
            description: `${expense.category} - ${formatCurrency(expense.amount)}`,
            time: new Date(expense.createdAt).toLocaleDateString(),
            icon: 'dollar-sign'
          });
        });
      }
      setRecentActivities(activities);
      
      // Update upcoming events
      const events: any[] = [];
      if (data.leaves?.recent) {
        data.leaves.recent
          .filter((leave: any) => leave.status === 'approved')
          .slice(0, 3)
          .forEach((leave: any) => {
            events.push({
              type: 'Leave',
              name: `${leave.leaveType || 'Leave'} leave`,
              date: new Date(leave.startDate).toLocaleDateString(),
              icon: Calendar,
              color: 'text-primary'
            });
          });
      }
      setUpcomingEvents(events);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user, formatCurrency]);

  // Fetch data on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Set up real-time Socket.IO listeners
  useEffect(() => {
    const socket = realTimeSocket;
    if (!socket) return;

    // Debounce function to prevent multiple rapid calls
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const debouncedFetchDashboardData = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        fetchDashboardData();
      }, 2000); // Wait 2 seconds before fetching to allow database to update
    };

    const handleAttendanceUpdate = (data: any) => {
      console.log('Attendance updated:', data);
      debouncedFetchDashboardData();
    };

    const handleLeaveUpdate = (data: any) => {
      console.log('Leave updated:', data);
      debouncedFetchDashboardData();
    };

    const handleDashboardUpdate = (data: any) => {
      console.log('Dashboard updated:', data);
      debouncedFetchDashboardData();
    };

    const handleEmployeeUpdate = (data: any) => {
      console.log('Employee updated:', data);
      debouncedFetchDashboardData();
    };

    const handleHolidayUpdate = (data: any) => {
      console.log('Holiday updated:', data);
      debouncedFetchDashboardData();
    };

    socket.on('attendance:update', handleAttendanceUpdate);
    socket.on('leave:update', handleLeaveUpdate);
    socket.on('dashboard:update', handleDashboardUpdate);
    socket.on('employee:update', handleEmployeeUpdate);
    socket.on('holiday:update', handleHolidayUpdate);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      socket.off('attendance:update', handleAttendanceUpdate);
      socket.off('leave:update', handleLeaveUpdate);
      socket.off('dashboard:update', handleDashboardUpdate);
      socket.off('employee:update', handleEmployeeUpdate);
      socket.off('holiday:update', handleHolidayUpdate);
    };
  }, [fetchDashboardData]);

  // Fetch employee ID on mount
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user?.id) return;
      
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`/api/employees/user/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data?._id) {
            setEmployeeId(result.data._id);
          }
        }
      } catch (err) {
        console.error('Error fetching employee data:', err);
      }
    };

    fetchEmployeeData();
  }, [user?.id]);

  // Handle check-in
  const handleCheckIn = async () => {
    try {
      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to check in.');
        toast.error('Unable to check in. Please try refreshing the page.');
        return;
      }

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: currentEmployeeId,
          employeeName: user?.name || 'Employee',
          orgId: user?.orgId || user?.tenantId || 'system',
          location: 'Office',
          notes: 'Check-in from dashboard'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Check-in failed');
      }

      const result = await response.json();
      if (result.success) {
        // Immediately update UI state
        setIsCheckedIn(true);
        const newRecord: TimeRecord = {
          id: timeRecords.length + 1,
          type: 'check-in',
          timestamp: new Date().toLocaleString()
        };
        setTimeRecords([...timeRecords, newRecord]);
        
        // Update today's attendance state immediately
        setTodayAttendance(prev => ({
          ...prev,
          isCheckedIn: true,
          checkInTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          status: 'present'
        }));
        
        toast.success('Checked in successfully!');
        
        // Fetch updated data after a short delay to ensure database is updated
        setTimeout(() => {
          fetchDashboardData();
        }, 1000);
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setError(err instanceof Error ? err.message : 'Check-in failed');
      toast.error(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    // Store break state before checkout
    setWasOnBreakBeforeCheckout(!!currentBreak);
    
    try {
      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to check out.');
        toast.error('Unable to check out. Please try refreshing the page.');
        return;
      }

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: currentEmployeeId,
          employeeName: user?.name || 'Employee',
          orgId: user?.orgId || user?.tenantId || 'system',
          location: 'Office',
          notes: 'Check-out from dashboard'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Check-out failed');
      }

      const result = await response.json();
      if (result.success) {
        // Immediately update UI state
        setIsCheckedIn(false);
        setCurrentBreak(null);
        setCurrentMeeting(null);
        const newRecord: TimeRecord = {
          id: timeRecords.length + 1,
          type: 'check-out',
          timestamp: new Date().toLocaleString()
        };
        setTimeRecords([...timeRecords, newRecord]);
        
        // Update today's attendance state immediately
        setTodayAttendance(prev => ({
          ...prev,
          isCheckedIn: false,
          checkOutTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          hoursWorked: result.data?.hoursWorked || prev.hoursWorked
        }));
        
        // Show success message and re-check-in dialog after successful checkout
        toast.success('Checked out successfully! You can resume working if needed.');
        setTimeout(() => {
          setShowReCheckInDialog(true);
          // Auto-dismiss dialog after 30 seconds
          const timer = setTimeout(() => {
            setShowReCheckInDialog(false);
            toast.info('Re-check-in option expired. You can check in again manually if needed.');
          }, 30000);
          setReCheckInTimer(timer);
        }, 1000);
        
        // Fetch updated data after a short delay
        setTimeout(() => {
          fetchDashboardData();
        }, 1500);
      }
    } catch (err) {
      console.error('Check-out error:', err);
      setError(err instanceof Error ? err.message : 'Check-out failed');
      toast.error(err instanceof Error ? err.message : 'Check-out failed');
    }
  };

  // Handle re-check-in (resume working)
  const handleReCheckIn = async (resumeBreak: boolean = false) => {
    try {
      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to re-check in.');
        toast.error('Unable to resume work. Please try refreshing the page.');
        return;
      }

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // First, check back in
      const checkInResponse = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: currentEmployeeId,
          employeeName: user?.name || 'Employee',
          orgId: user?.orgId || user?.tenantId || 'system',
          location: 'Office',
          notes: 'Re-check-in after accidental checkout'
        })
      });

      if (!checkInResponse.ok) {
        const errorData = await checkInResponse.json();
        throw new Error(errorData.message || 'Re-check-in failed');
      }

      const checkInResult = await checkInResponse.json();
      if (checkInResult.success) {
        // Immediately update UI state
        setIsCheckedIn(true);
        const newRecord: TimeRecord = {
          id: timeRecords.length + 1,
          type: 'check-in',
          timestamp: new Date().toLocaleString()
        };
        setTimeRecords([...timeRecords, newRecord]);

        // Update today's attendance state immediately
        setTodayAttendance(prev => ({
          ...prev,
          isCheckedIn: true,
          checkInTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          status: 'present'
        }));

        // If user wants to resume break, start break immediately
        if (resumeBreak) {
          const breakResponse = await fetch('/api/attendance/break-start', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user?.id,
              employeeId: currentEmployeeId,
              employeeName: user?.name || 'Employee',
              breakType: 'regular',
              orgId: user?.orgId || user?.tenantId || 'system',
              notes: 'Resumed break after re-check-in'
            })
          });

          if (breakResponse.ok) {
            setCurrentBreak('Break started');
          }
        }

        setShowReCheckInDialog(false);
        
        // Clear the auto-dismiss timer
        if (reCheckInTimer) {
          clearTimeout(reCheckInTimer);
          setReCheckInTimer(null);
        }
        
        toast.success(resumeBreak ? 'Resumed work and break successfully!' : 'Resumed work successfully!');
        
        // Fetch updated data after a short delay
        setTimeout(() => {
          fetchDashboardData();
        }, 1000);
      }
    } catch (err) {
      console.error('Re-check-in error:', err);
      setError(err instanceof Error ? err.message : 'Re-check-in failed');
      toast.error('Failed to resume work. Please try again.');
    }
  };

  // Handle break start/end
  const handleBreak = async () => {
    try {
      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to manage break.');
        toast.error('Unable to manage break. Please try refreshing the page.');
        return;
      }

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const endpoint = currentBreak ? '/api/attendance/break-end' : '/api/attendance/break-start';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: currentEmployeeId,
          employeeName: user?.name || 'Employee',
          breakType: 'regular',
          orgId: user?.orgId || user?.tenantId || 'system',
          notes: currentBreak ? 'Break ended' : 'Break started'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Break action failed');
      }

      const result = await response.json();
      if (result.success) {
        if (currentBreak) {
          // Break ended
          setCurrentBreak(null);
          const newRecord: TimeRecord = {
            id: Date.now(), // Use timestamp as unique ID
            type: 'break',
            timestamp: new Date().toLocaleString(),
            duration: result.data?.breakDuration ? `${result.data.breakDuration} min` : '15 min'
          };
          setTimeRecords(prev => [...prev, newRecord]);
          toast.success('Break ended successfully!');
        } else {
          // Break started
          setCurrentBreak('Break started');
          const newRecord: TimeRecord = {
            id: Date.now(), // Use timestamp as unique ID
            type: 'break',
            timestamp: new Date().toLocaleString(),
            duration: 'In progress'
          };
          setTimeRecords(prev => [...prev, newRecord]);
          toast.success('Break started successfully!');
        }
      }
    } catch (err) {
      console.error('Break action error:', err);
      setError(err instanceof Error ? err.message : 'Break action failed');
      toast.error(err instanceof Error ? err.message : 'Break action failed');
    }
  };

  // Handle meeting start/end
  const handleMeeting = async () => {
    try {
      const currentEmployeeId = await ensureEmployeeId();

      if (!currentEmployeeId) {
        setError('Employee ID not found. Unable to manage meeting.');
        toast.error('Unable to manage meeting. Please try refreshing the page.');
        return;
      }

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch('/api/attendance/meeting-mode', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: currentEmployeeId,
          employeeName: user?.name || 'Employee',
          isActive: !currentMeeting,
          meetingTitle: 'Meeting',
          meetingType: 'internal',
          orgId: user?.orgId || user?.tenantId || 'system',
          notes: currentMeeting ? 'Meeting ended' : 'Meeting started'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Meeting action failed');
      }

      const result = await response.json();
      if (result.success) {
        if (currentMeeting) {
          // Meeting ended
          setCurrentMeeting(null);
          const newRecord: TimeRecord = {
            id: Date.now(), // Use timestamp as unique ID
            type: 'meeting',
            timestamp: new Date().toLocaleString(),
            duration: 'Ended'
          };
          setTimeRecords(prev => [...prev, newRecord]);
          toast.success('Meeting ended successfully!');
        } else {
          // Meeting started
          setCurrentMeeting('Meeting started');
          const newRecord: TimeRecord = {
            id: Date.now(), // Use timestamp as unique ID
            type: 'meeting',
            timestamp: new Date().toLocaleString(),
            duration: 'In progress'
          };
          setTimeRecords(prev => [...prev, newRecord]);
          toast.success('Meeting started successfully!');
        }
      }
    } catch (err) {
      console.error('Meeting action error:', err);
      setError(err instanceof Error ? err.message : 'Meeting action failed');
      toast.error(err instanceof Error ? err.message : 'Meeting action failed');
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Header with Time Tracking */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {user?.name || 'Employee'}! 👋
          </h1>
          <p className="text-muted-foreground">Here's what's happening with your work today</p>
        </div>
        <div className="flex gap-3">
          {!isCheckedIn ? (
            <Button className="rounded-xl bg-green-600 hover:bg-green-700" onClick={handleCheckIn}>
              <Clock className="w-4 h-4 mr-2" />
              Check In
            </Button>
          ) : (
            <Button className="rounded-xl bg-red-600 hover:bg-red-700" onClick={handleCheckOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Check Out
            </Button>
          )}
          <Button 
            className={`rounded-xl ${currentBreak ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-gray-600'}`}
            onClick={handleBreak}
            disabled={!isCheckedIn}
          >
            <Coffee className="w-4 h-4 mr-2" />
            {currentBreak ? 'End Break' : 'Break'}
          </Button>
          <Button 
            className={`rounded-xl ${currentMeeting ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            onClick={handleMeeting}
            disabled={!isCheckedIn}
          >
            <Users className="w-4 h-4 mr-2" />
            {currentMeeting ? 'End Meeting' : 'Meeting'}
          </Button>
        </div>
      </div>

      {/* Current Status */}
      {(currentBreak || currentMeeting) && (
        <Card className="p-4 rounded-xl bg-gray-50 border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              {currentBreak ? <Coffee className="w-5 h-5 text-gray-700" /> : <Users className="w-5 h-5 text-gray-700" />}
            </div>
            <div>
              <p className="font-semibold text-gray-800">
                {currentBreak ? currentBreak : currentMeeting}
              </p>
              <p className="text-sm text-gray-600">
                {currentBreak ? 'Take a short break to refresh' : 'Meeting in progress'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Time Tracking Records */}
      <Card className="rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Today's Time Tracking</h3>
              <p className="text-sm text-muted-foreground">All your check-ins, breaks, and meetings</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {timeRecords.length} Records
            </Badge>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 bg-muted rounded-lg p-1 w-fit">
            <Button
              variant={timeTrackingTab === 'records' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
              onClick={() => setTimeTrackingTab('records')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Attendance Records
            </Button>
            <Button
              variant={timeTrackingTab === 'activity' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
              onClick={() => setTimeTrackingTab('activity')}
            >
              <Activity className="w-4 h-4 mr-2" />
              Live Activity
            </Button>
          </div>
        </div>

        {/* Attendance Records Tab */}
        {timeTrackingTab === 'records' && (
          <div className="p-6">
            {timeRecords.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No time tracking records yet. Check in to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="font-semibold text-foreground">Time</TableHead>
                      <TableHead className="font-semibold text-foreground">Employee</TableHead>
                      <TableHead className="font-semibold text-foreground">Action</TableHead>
                      <TableHead className="font-semibold text-foreground">Details</TableHead>
                      <TableHead className="font-semibold text-foreground">Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeRecords.map((record) => {
                      // Parse timestamp to extract time and date
                      const recordDate = new Date(record.timestamp);
                      const timeStr = recordDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = recordDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                      
                      // Determine action badge color and icon
                      let actionColor = 'bg-gray-100';
                      let actionTextColor = 'text-gray-700';
                      let actionIcon = null;
                      let actionLabel = '';
                      
                      switch (record.type) {
                        case 'check-in':
                          actionColor = 'bg-green-100';
                          actionTextColor = 'text-green-700';
                          actionIcon = <LogIn className="w-3 h-3" />;
                          actionLabel = 'CHECK IN';
                          break;
                        case 'check-out':
                          actionColor = 'bg-red-100';
                          actionTextColor = 'text-red-700';
                          actionIcon = <LogOut className="w-3 h-3" />;
                          actionLabel = 'CHECK OUT';
                          break;
                        case 'break':
                          actionColor = 'bg-orange-100';
                          actionTextColor = 'text-orange-700';
                          actionIcon = <Pause className="w-3 h-3" />;
                          actionLabel = 'BREAK';
                          break;
                        case 'meeting':
                          actionColor = 'bg-blue-100';
                          actionTextColor = 'text-blue-700';
                          actionIcon = <Users className="w-3 h-3" />;
                          actionLabel = 'MEETING';
                          break;
                      }
                      
                      return (
                        <TableRow key={record.id} className="border-b border-border/50 hover:bg-accent/30">
                          <TableCell className="font-medium">
                            <div className="text-sm">
                              <div className="font-semibold">{timeStr}</div>
                              <div className="text-xs text-muted-foreground">{dateStr}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs bg-primary/10">
                                  {user?.name?.charAt(0) || 'E'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{user?.name || 'Employee'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${actionColor} ${actionTextColor} border-0 text-xs font-semibold`}>
                              <span className="flex items-center gap-1">
                                {actionIcon}
                                {actionLabel}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record.type === 'break' && record.duration && (
                              <span>{record.duration}</span>
                            )}
                            {record.type === 'check-out' && record.duration && (
                              <span>Total hours: {record.duration}</span>
                            )}
                            {record.type === 'meeting' && record.duration && (
                              <span>{record.duration}</span>
                            )}
                            {!record.duration && record.type !== 'check-in' && record.type !== 'check-out' && (
                              <span>-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record.ipAddress ? (
                              <span>IP: {record.ipAddress}</span>
                            ) : (
                              <span>IP: -</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Live Activity Tab */}
        {timeTrackingTab === 'activity' && (
          <div className="p-6">
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Live activity logs will appear here as you perform actions</p>
              <p className="text-xs text-muted-foreground mt-2">Check-ins, breaks, meetings, and check-outs are tracked in real-time</p>
            </div>
          </div>
        )}
      </Card>

      {/* Profile Completion */}
      <Card className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Complete Your Profile</h3>
            <p className="text-sm text-muted-foreground">Add missing information to unlock all features</p>
          </div>
          <Button variant="outline" className="rounded-xl">Complete Now</Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Profile Completion</span>
            <span className="font-medium">75%</span>
          </div>
          <Progress value={75} className="h-2" />
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          title="Current Salary"
          value={formatCurrency(kpiMetrics.currentSalary)}
          icon={DollarSign}
          color="accent"
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
        <Card className="rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border">
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
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {holidays && holidays.length > 0 ? (
              holidays
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((holiday) => {
                  const holidayDate = new Date(holiday.date);
                  const today = new Date();
                  const isUpcoming = holidayDate >= today;
                  const isPast = holidayDate < today;
                  
                  return (
                    <div 
                      key={holiday._id || holiday.id} 
                      className={`p-3 rounded-lg border transition-all ${
                        isUpcoming 
                          ? 'bg-green-50 border-green-200 shadow-sm' 
                          : 'bg-gray-50 border-gray-200 opacity-75'
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
                            {isPast && (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                Past
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
                          {holiday.description && (
                            <p className="text-xs text-muted-foreground mt-1">{holiday.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-muted-foreground">
                            {holidayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No holidays added yet</p>
                <p className="text-xs text-muted-foreground mt-1">Holidays will appear here when added by HR</p>
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
            <div className="grid grid-cols-2 gap-4">
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
                  {todayAttendance.hoursWorked}h
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-accent/10 border border-accent/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={`${todayAttendance.status === 'present' ? 'bg-secondary' : 'bg-muted'} text-secondary-foreground`}>
                  {todayAttendance.status === 'present' ? 'Working' : 'Not checked in'}
                </Badge>
              </div>
              <Button 
                variant={todayAttendance.isCheckedIn ? "destructive" : "default"} 
                size="sm" 
                className="w-full"
                onClick={todayAttendance.isCheckedIn ? handleCheckOut : handleCheckIn}
              >
                {todayAttendance.isCheckedIn ? 'Check Out' : 'Check In'}
              </Button>
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
              <div className="pt-2 border-t border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Present Days:</span>
                    <span className="font-medium ml-2">{performanceMetrics.presentDays}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Hours:</span>
                    <span className="font-medium ml-2">{performanceMetrics.totalHours}h</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex gap-4 p-4 rounded-xl bg-accent/50">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column - Events & Notifications */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold text-lg mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              {upcomingEvents.map((event, index) => {
                const Icon = event.icon;
                return (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-accent/50">
                    <div className={`w-10 h-10 rounded-xl bg-background flex items-center justify-center ${event.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{event.type}</p>
                      <p className="text-sm text-foreground">{event.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{event.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Employee Documents */}
          <EmployeeDocuments />

          {/* Quick Actions */}
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start rounded-xl">
                <Calendar className="w-4 h-4 mr-2" />
                Apply Leave
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl">
                <DollarSign className="w-4 h-4 mr-2" />
                Submit Expense
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Performance
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start rounded-xl bg-primary/10 hover:bg-primary/20 border-primary/30"
                onClick={() => window.location.href = '/employee/onboarding'}
              >
                <FileText className="w-4 h-4 mr-2" />
                Onboarding Form
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Chat Widget */}
      <ChatWidget />

      {/* Re-Check-In Dialog */}
      <Dialog open={showReCheckInDialog} onOpenChange={(open) => {
        setShowReCheckInDialog(open);
        if (!open && reCheckInTimer) {
          clearTimeout(reCheckInTimer);
          setReCheckInTimer(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resume Working?</DialogTitle>
            <DialogDescription>
              You just checked out. Would you like to resume working for today?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you checked out by mistake, you can resume working immediately.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full rounded-xl bg-green-600 hover:bg-green-700" 
                onClick={() => handleReCheckIn(false)}
              >
                <Clock className="w-4 h-4 mr-2" />
                Resume Working
              </Button>
              {wasOnBreakBeforeCheckout && (
                <Button 
                  variant="outline"
                  className="w-full rounded-xl" 
                  onClick={() => handleReCheckIn(true)}
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Resume Break
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full rounded-xl" 
                onClick={() => {
                  setShowReCheckInDialog(false);
                  if (reCheckInTimer) {
                    clearTimeout(reCheckInTimer);
                    setReCheckInTimer(null);
                  }
                }}
              >
                No, I'm Done for Today
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              This dialog will auto-close in 30 seconds
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
