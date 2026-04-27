import { useState, useEffect } from 'react';
import { KPICard } from '../../components/KPICard';
import EmployeeDocuments from '../../components/EmployeeDocuments';
import EmployeeHolidayCalendar from '../../components/EmployeeHolidayCalendar';
import LeaveCalendar from '../../components/LeaveCalendar';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { ExpenseService, LeaveRequestService } from '../../utils/api';
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

// These will be populated by API calls in useEffect

interface TimeRecord {
  id: number;
  type: 'check-in' | 'check-out' | 'break' | 'meeting';
  timestamp: string;
  duration?: string;
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

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Fetch user's expenses
        const expensesData = await ExpenseService.getExpensesByUserId(user.id);
        
        // Fetch user's leave requests
        const leaveRequestsData = await LeaveRequestService.getLeaveRequestsByUserId(user.id);
        
        // Process expenses into recent activities
        const expenseActivities = (expensesData || []).map((expense: any) => ({
          action: 'Expense submitted',
          description: `${expense.category} expense #${expense.id}`,
          time: '2 hours ago'
        }));
        
        // Process leave requests into recent activities
        const leaveActivities = (leaveRequestsData || []).map((leave: any) => ({
          action: leave.status === 'approved' ? 'Leave approved' : 'Leave requested',
          description: `${leave.type} leave for ${Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days`,
          time: '1 day ago'
        }));
        
        // Combine activities
        const allActivities = [...expenseActivities, ...leaveActivities].slice(0, 5);
        setRecentActivities(allActivities);
        
        // Create upcoming events from leave requests
        const upcomingLeaveEvents = (leaveRequestsData || [])
          .filter((leave: any) => leave.status === 'approved')
          .map((leave: any) => ({
            type: 'Leave',
            name: `${leave.type} leave`,
            date: new Date(leave.startDate).toLocaleDateString(),
            icon: Calendar,
            color: 'text-primary'
          }));
        
        setUpcomingEvents(upcomingLeaveEvents);
        
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleCheckIn = () => {
    setIsCheckedIn(true);
    const newRecord: TimeRecord = {
      id: timeRecords.length + 1,
      type: 'check-in',
      timestamp: new Date().toLocaleString()
    };
    setTimeRecords([...timeRecords, newRecord]);
    console.log('Checked in:', newRecord);
  };

  const handleCheckOut = () => {
    setIsCheckedIn(false);
    setCurrentBreak(null);
    setCurrentMeeting(null);
    const newRecord: TimeRecord = {
      id: timeRecords.length + 1,
      type: 'check-out',
      timestamp: new Date().toLocaleString()
    };
    setTimeRecords([...timeRecords, newRecord]);
    console.log('Checked out:', newRecord);
  };

  const handleBreak = () => {
    if (currentBreak) {
      // End break
      setCurrentBreak(null);
      const newRecord: TimeRecord = {
        id: timeRecords.length + 1,
        type: 'break',
        timestamp: new Date().toLocaleString(),
        duration: '15 min'
      };
      setTimeRecords([...timeRecords, newRecord]);
      console.log('Break ended:', newRecord);
    } else {
      // Start break
      setCurrentBreak('Break started');
      console.log('Break started');
    }
  };

  const handleMeeting = () => {
    if (currentMeeting) {
      // End meeting
      setCurrentMeeting(null);
      const newRecord: TimeRecord = {
        id: timeRecords.length + 1,
        type: 'meeting',
        timestamp: new Date().toLocaleString(),
        duration: '1 hour'
      };
      setTimeRecords([...timeRecords, newRecord]);
      console.log('Meeting ended:', newRecord);
    } else {
      // Start meeting
      setCurrentMeeting('Meeting started');
      console.log('Meeting started');
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
          value="18 days"
          icon={Calendar}
          color="primary"
        />
        <KPICard
          title="Hours This Week"
          value="38.5h"
          icon={Clock}
          color="secondary"
        />
        <KPICard
          title="Current Salary"
          value={formatCurrency(5500)}
          icon={DollarSign}
          color="accent"
        />
        <KPICard
          title="Performance"
          value="92%"
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
                <p className="text-2xl font-bold text-foreground">09:00 AM</p>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <Target className="w-8 h-8 text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Hours Today</p>
                <p className="text-2xl font-bold text-foreground">7.5h</p>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-accent/10 border border-accent/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className="bg-secondary text-secondary-foreground">Working</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Take Break</Button>
                <Button variant="outline" size="sm" className="flex-1">In Meeting</Button>
                <Button variant="destructive" size="sm" className="flex-1">Check Out</Button>
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
                  <span className="text-sm font-medium">95%</span>
                </div>
                <Progress value={95} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Attendance</span>
                  <span className="text-sm font-medium">98%</span>
                </div>
                <Progress value={98} className="h-2 [&>div]:bg-secondary" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Quality Score</span>
                  <span className="text-sm font-medium">88%</span>
                </div>
                <Progress value={88} className="h-2 [&>div]:bg-accent" />
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
