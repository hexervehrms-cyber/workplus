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
  LogOut,
  FileText
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

  const [holidays, setHolidays] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  // Helper function to fetch employee ID
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

  // Fetch dashboard data
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
      
      // Fetch today's attendance data
      const attendanceResponse = await fetch('/api/attendance/today', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      let attendanceData = null;
      if (attendanceResponse.ok) {
        const attendanceResult = await attendanceResponse.json();
        if (attendanceResult.success) {
          attendanceData = attendanceResult.data;
        }
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
      
      // Update today's attendance
      if (attendanceData?.attendance) {
        const attendance = attendanceData.attendance;
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
          hoursWorked: attendance.hoursWorked || 0,
          status: attendance.status || 'absent'
        });
        setIsCheckedIn(!!attendance.checkIn && !attendance.checkOut);
      }
      
      // Update KPI metrics
      setKpiMetrics({
        leaveBalance: "12 days",
        hoursThisWeek: `${attendanceData?.liveStatus?.currentHours || 0}h`, 
        currentSalary: employeeData?.baseSalary || 0,
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
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch data on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Fetch employee ID on mount
  useEffect(() => {
    ensureEmployeeId();
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
        setIsCheckedIn(true);
        setTodayAttendance(prev => ({
          ...prev,
          isCheckedIn: true,
          checkInTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          status: 'present'
        }));
        
        toast.success('Checked in successfully!');
        
        // Fetch updated data
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
        setIsCheckedIn(false);
        setTodayAttendance(prev => ({
          ...prev,
          isCheckedIn: false,
          checkOutTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          hoursWorked: result.data?.hoursWorked || prev.hoursWorked
        }));
        
        toast.success('Checked out successfully!');
        
        // Fetch updated data
        setTimeout(() => {
          fetchDashboardData();
        }, 1000);
      }
    } catch (err) {
      console.error('Check-out error:', err);
      setError(err instanceof Error ? err.message : 'Check-out failed');
      toast.error(err instanceof Error ? err.message : 'Check-out failed');
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
        </div>
      </div>

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
                })
            ) : (
              <div className="text-center py-8">
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
                  {todayAttendance.hoursWorked.toFixed(1)}h
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
            </div>
          </Card>
        </div>

        {/* Right Column - Events & Notifications */}
        <div className="space-y-6">
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
    </div>
  );
}
