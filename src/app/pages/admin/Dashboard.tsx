import { KPICard } from '../../components/KPICard';
import {
  Users,
  TrendingUp,
  Receipt,
  DollarSign,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  IndianRupee
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '../../utils/api';

export default function AdminDashboard() {
  const { formatCurrency, convertAmount, selectedCurrency } = useCurrency();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalEmployees: 0,
    avgProductivity: 0,
    monthlyExpenses: 0,
    payrollCost: 0
  });
  const [expenseData, setExpenseData] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [todaysAttendance, setTodaysAttendance] = useState([]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch dashboard statistics
        const statsResponse = await apiClient.get('/api/dashboard/stats');
        if (statsResponse.data.success) {
          setDashboardStats(statsResponse.data.data);
        }

        // Fetch expense trends
        const expenseTrendsResponse = await apiClient.get('/api/dashboard/expense-trends');
        if (expenseTrendsResponse.data.success) {
          setExpenseData(expenseTrendsResponse.data.data);
        }

        // Fetch recent leave requests
        const leaveResponse = await apiClient.get('/api/dashboard/recent-leave-requests');
        if (leaveResponse.data.success) {
          setLeaveRequests(leaveResponse.data.data);
        }

        // Fetch today's attendance
        const attendanceResponse = await apiClient.get('/api/dashboard/todays-attendance');
        if (attendanceResponse.data.success) {
          setTodaysAttendance(attendanceResponse.data.data);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Handle leave request approval
  const handleApproveLeave = async (requestId) => {
    try {
      const response = await apiClient.patch(`/api/leave-requests/${requestId}/approve`, {
        approvedBy: 'Admin'
      });
      
      if (response.data.success) {
        // Refresh leave requests
        const leaveResponse = await apiClient.get('/api/dashboard/recent-leave-requests');
        if (leaveResponse.data.success) {
          setLeaveRequests(leaveResponse.data.data);
        }
      }
    } catch (error) {
      console.error('Error approving leave:', error);
    }
  };

  // Handle leave request rejection
  const handleRejectLeave = async (requestId) => {
    try {
      const response = await apiClient.patch(`/api/leave-requests/${requestId}/reject`, {
        rejectedBy: 'Admin',
        rejectionReason: 'Rejected by admin'
      });
      
      if (response.data.success) {
        // Refresh leave requests
        const leaveResponse = await apiClient.get('/api/dashboard/recent-leave-requests');
        if (leaveResponse.data.success) {
          setLeaveRequests(leaveResponse.data.data);
        }
      }
    } catch (error) {
      console.error('Error rejecting leave:', error);
    }
  };

  // Mock productivity data (would come from attendance/performance tracking)
  const productivityData = [
    { day: 'Mon', productivity: 85 },
    { day: 'Tue', productivity: 92 },
    { day: 'Wed', productivity: 88 },
    { day: 'Thu', productivity: 95 },
    { day: 'Fri', productivity: 78 },
    { day: 'Sat', productivity: 65 },
    { day: 'Sun', productivity: 45 },
  ];

  // Currency amount display component with INR icon
  const CurrencyAmount: React.FC<{ amount: number; className?: string }> = ({ amount, className }) => {
    if (selectedCurrency.code === 'INR') {
      return (
        <div className={`flex items-center gap-1 ${className || ''}`}>
          <IndianRupee className="w-4 h-4 text-primary" />
          <span>{formatCurrency(amount).replace('₹', '')}</span>
        </div>
      );
    }
    
    return <span className={className}>{formatCurrency(amount)}</span>;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Organization overview and management</p>
      </div>

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Employees"
          value={dashboardStats.totalEmployees.toString()}
          change={3.2}
          icon={Users}
          color="primary"
        />
        <KPICard
          title="Avg Productivity"
          value={`${dashboardStats.avgProductivity}%`}
          change={5.8}
          icon={TrendingUp}
          color="secondary"
        />
        <KPICard
          title="Monthly Expenses"
          value={formatCurrency(dashboardStats.monthlyExpenses)}
          change={-2.3}
          icon={selectedCurrency.code === 'INR' ? IndianRupee : Receipt}
          color="accent"
        />
        <KPICard
          title="Payroll Cost"
          value={formatCurrency(dashboardStats.payrollCost)}
          change={1.2}
          icon={selectedCurrency.code === 'INR' ? IndianRupee : DollarSign}
          color="primary"
        />
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
            <BarChart data={expenseData}>
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
          <Badge variant="secondary">{leaveRequests.filter(r => r.status === 'pending').length} Pending</Badge>
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
            {leaveRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No pending leave requests
                </TableCell>
              </TableRow>
            ) : (
              leaveRequests.map((request) => {
                const days = Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <TableRow key={request._id}>
                    <TableCell className="font-medium">{request.employeeName}</TableCell>
                    <TableCell>{request.type}</TableCell>
                    <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>{days}</TableCell>
                    <TableCell>
                      <Badge variant={request.status === 'pending' ? 'secondary' : 'default'}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="bg-secondary hover:bg-secondary/90"
                            onClick={() => handleApproveLeave(request._id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleRejectLeave(request._id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Employee Overview */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Today's Attendance</h3>
          <p className="text-sm text-muted-foreground">Employee check-in status</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {todaysAttendance.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No attendance records for today
              </div>
            ) : (
              todaysAttendance.map((attendance, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-accent/50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{attendance.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {attendance.employeeId?.department || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {attendance.checkIn ? new Date(attendance.checkIn).toLocaleTimeString() : 'Not checked in'}
                      </p>
                      <Badge variant={attendance.status === 'present' ? 'default' : 'secondary'} className="mt-1">
                        {attendance.status}
                      </Badge>
                    </div>
                    {attendance.status === 'present' && attendance.hoursWorked > 0 && (
                      <div className="w-24">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Hours</span>
                          <span className="text-xs font-medium">{attendance.hoursWorked}h</span>
                        </div>
                        <Progress value={(attendance.hoursWorked / 8) * 100} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
