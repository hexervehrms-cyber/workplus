import { useState, useEffect, useCallback } from 'react';
import { KPICard } from '../../components/KPICard';
import EmployeeDocuments from '../../components/EmployeeDocuments';
import EmployeeHolidayCalendar from '../../components/EmployeeHolidayCalendar';
import LeaveCalendar from '../../components/LeaveCalendar';
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
  FileText
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';

interface TimeRecord {
  id: number;
  type: 'check-in' | 'check-out' | 'break' | 'meeting';
  timestamp: string;
  duration?: string;
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

  // Fetch dashboard data on component mount
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/employee', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        setDashboardData(data);
        
        // Calculate leave balance (total leaves - used leaves)
        // Assuming 20 days annual leave, calculate remaining
        const totalAnnualLeave = 20;
        const usedLeave = data.leaves?.approvedThisMonth || 0;
        const leaveBalance = Math.max(0, totalAnnualLeave - usedLeave);
        
        // Calculate hours this week (from attendance records)
        const hoursThisWeek = data.attendance?.today?.hoursWorked || 0;
        
        // Get current salary from latest payslip
        const currentSalary = data.payroll?.latest?.netSalary || data.payroll?.latest?.baseSalary || 0;
        
        // Calculate performance score based on attendance
        const attendancePercentage = data.attendance?.isPresent ? 100 : 0;
        
        // Update KPI metrics with real data
        setKpiMetrics({
          leaveBalance: `${leaveBalance} days`,
          hoursThisWeek: `${hoursThisWeek}h`, 
          currentSalary: currentSalary,
          performance: `${attendancePercentage}%`
        });
        
        // Update today's attendance
        if (data.attendance?.today) {
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
        }
        
        // Update performance metrics
        setPerformanceMetrics({
          taskCompletion: 85, // Can be updated from task data if available
          attendance: data.attendance?.isPresent ? 100 : 0,
          qualityScore: 90, // Can be updated from performance review data
          presentDays: 1, // Can be calculated from attendance records
          totalHours: hoursThisWeek
        });
        
        // Update recent activities
        const activities: any[] = [];
        if (data.attendance?.today?.checkIn) {
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
      }
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

    const handleAttendanceUpdate = (data: any) => {
      console.log('Attendance updated:', data);
      fetchDashboardData();
    };

    const handleLeaveUpdate = (data: any) => {
      console.log('Leave updated:', data);
      fetchDashboardData();
    };

    const handleDashboardUpdate = (data: any) => {
      console.log('Dashboard updated:', data);
      fetchDashboardData();
    };

    socket.on('attendance:update', handleAttendanceUpdate);
    socket.on('leave:update', handleLeaveUpdate);
    socket.on('dashboard:update', handleDashboardUpdate);

    return () => {
      socket.off('attendance:update', handleAttendanceUpdate);
      socket.off('leave:update', handleLeaveUpdate);
      socket.off('dashboard:update', handleDashboardUpdate);
    };
  }, [fetchDashboardData]);

  // Handle check-in
  const handleCheckIn = async () => {
    try {
      if (!dashboardData?.employee) {
        setError('Employee data not loaded');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.userId || user?.id,
          employeeId: dashboardData.employee.id,
          orgId: user?.orgId || user?.tenantId || 'system',
          location: 'Office',
          notes: 'Check-in from dashboard'
        })
      });

      if (!response.ok) {
        throw new Error('Check-in failed');
      }

      const result = await response.json();
      if (result.success) {
        setIsCheckedIn(true);
        const newRecord: TimeRecord = {
          id: timeRecords.length + 1,
          type: 'check-in',
          timestamp: new Date().toLocaleString()
        };
        setTimeRecords([...timeRecords, newRecord]);
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setError(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    try {
      if (!dashboardData?.employee) {
        setError('Employee data not loaded');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.userId || user?.id,
          employeeId: dashboardData.employee.id,
          orgId: user?.orgId || user?.tenantId || 'system',
          location: 'Office',
          notes: 'Check-out from dashboard'
        })
      });

      if (!response.ok) {
        throw new Error('Check-out failed');
      }

      const result = await response.json();
      if (result.success) {
        setIsCheckedIn(false);
        setCurrentBreak(null);
        setCurrentMeeting(null);
        const newRecord: TimeRecord = {
          id: timeRecords.length + 1,
          type: 'check-out',
          timestamp: new Date().toLocaleString()
        };
        setTimeRecords([...timeRecords, newRecord]);
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Check-out error:', err);
      setError(err instanceof Error ? err.message : 'Check-out failed');
    }
  };

  // Handle break start/end
  const handleBreak = async () => {
    try {
      if (!dashboardData?.employee) {
        setError('Employee data not loaded');
        return;
      }

      const token = localStorage.getItem('token');
      const endpoint = currentBreak ? '/api/attendance/break-end' : '/api/attendance/break-start';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.userId || user?.id,
          employeeId: dashboardData.employee.id,
          orgId: user?.orgId || user?.tenantId || 'system',
          breakType: 'regular',
          notes: currentBreak ? 'Break ended' : 'Break started'
        })
      });

      if (!response.ok) {
        throw new Error('Break action failed');
      }

      const result = await response.json();
      if (result.success) {
        if (currentBreak) {
          setCurrentBreak(null);
          const newRecord: TimeRecord = {
            id: timeRecords.length + 1,
            type: 'break',
            timestamp: new Date().toLocaleString(),
            duration: result.data?.breakDuration ? `${result.data.breakDuration} min` : '15 min'
          };
          setTimeRecords([...timeRecords, newRecord]);
        } else {
          setCurrentBreak('Break started');
        }
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Break action error:', err);
      setError(err instanceof Error ? err.message : 'Break action failed');
    }
  };

  // Handle meeting start/end
  const handleMeeting = async () => {
    try {
      if (!dashboardData?.employee) {
        setError('Employee data not loaded');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/attendance/meeting-mode', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.userId || user?.id,
          employeeId: dashboardData.employee.id,
          orgId: user?.orgId || user?.tenantId || 'system',
          isActive: !currentMeeting,
          meetingTitle: 'Meeting',
          meetingType: 'internal',
          notes: currentMeeting ? 'Meeting ended' : 'Meeting started'
        })
      });

      if (!response.ok) {
        throw new Error('Meeting action failed');
      }

      const result = await response.json();
      if (result.success) {
        if (currentMeeting) {
          setCurrentMeeting(null);
          const newRecord: TimeRecord = {
            id: timeRecords.length + 1,
            type: 'meeting',
            timestamp: new Date().toLocaleString(),
            duration: '1 hour'
          };
          setTimeRecords([...timeRecords, newRecord]);
        } else {
          setCurrentMeeting('Meeting started');
        }
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Meeting action error:', err);
      setError(err instanceof Error ? err.message : 'Meeting action failed');
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
      <Card className="p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Today's Time Tracking</h3>
          <Badge variant="outline" className="text-xs">
            {timeRecords.filter(r => r.type !== 'check-in' && r.type !== 'check-out').length} Activities
          </Badge>
        </div>
        <div className="space-y-3">
          {timeRecords.slice(-6).reverse().map((record) => (
            <div key={record.id} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  record.type === 'check-in' ? 'bg-green-100' :
                  record.type === 'check-out' ? 'bg-red-100' :
                  record.type === 'break' ? 'bg-gray-100' :
                  'bg-purple-100'
                }`}>
                  {record.type === 'check-in' && <Clock className="w-4 h-4 text-green-600" />}
                  {record.type === 'check-out' && <LogOut className="w-4 h-4 text-red-600" />}
                  {record.type === 'break' && <Coffee className="w-4 h-4 text-gray-600" />}
                  {record.type === 'meeting' && <Users className="w-4 h-4 text-purple-600" />}
                </div>
                <div>
                  <p className="font-medium capitalize">{record.type.replace('-', ' ')}</p>
                  <p className="text-sm text-muted-foreground">{record.timestamp}</p>
                </div>
              </div>
              <div className="text-right">
                {record.duration && (
                  <Badge variant="secondary" className="text-xs">
                    {record.duration}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
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

      {/* Leave Calendar */}
      <LeaveCalendar />

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
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  disabled={!todayAttendance.isCheckedIn}
                >
                  Take Break
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  disabled={!todayAttendance.isCheckedIn}
                >
                  In Meeting
                </Button>
                <Button 
                  variant={todayAttendance.isCheckedIn ? "destructive" : "default"} 
                  size="sm" 
                  className="flex-1"
                  onClick={todayAttendance.isCheckedIn ? handleCheckOut : handleCheckIn}
                >
                  {todayAttendance.isCheckedIn ? 'Check Out' : 'Check In'}
                </Button>
              </div>
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

          {/* Holiday Calendar */}
          <EmployeeHolidayCalendar organizationId="ORG-001" />

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
    </div>
  );
}
