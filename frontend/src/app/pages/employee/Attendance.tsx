import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Coffee, Users, Calendar, Loader } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

interface AttendanceRecord {
  _id: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  hoursWorked?: number;
  status: string;
  breaks: Array<{
    startTime: string;
    endTime?: string;
    duration?: number;
    breakType: string;
  }>;
}

interface TodayAttendance {
  attendance?: AttendanceRecord;
  liveStatus: {
    status: string;
    currentHours: number;
    isOnBreak: boolean;
    currentBreakDuration: number;
    totalBreakTime: number;
    isInMeeting: boolean;
    lastUpdated: string;
  };
}

export default function Attendance() {
  const { user } = useAuth();
  const [todayData, setTodayData] = useState<TodayAttendance | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentHours, setCurrentHours] = useState(0);
  const [status, setStatus] = useState<'working' | 'break' | 'meeting'>('working');
  const [checkedIn, setCheckedIn] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Fetch employee record to get employeeId
  const fetchEmployeeId = async () => {
    try {
      if (!user?.id) {
        console.warn('No user ID available');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('authToken');
      console.log('Fetching employee for userId:', user.id);
      
      const response = await fetch(`http://localhost:5000/api/employees/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Employee fetch response:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Employee data:', data);
        if (data.data && data.data._id) {
          console.log('Setting employeeId:', data.data._id);
          setEmployeeId(data.data._id);
        } else {
          console.warn('No employee found for user');
          setLoading(false);
        }
      } else {
        console.error('Failed to fetch employee:', response.status);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
      setLoading(false);
    }
  };

  // Fetch today's attendance
  const fetchTodayAttendance = async () => {
    if (!employeeId) {
      console.warn('No employeeId available');
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      console.log('Fetching today attendance for employeeId:', employeeId);
      
      const response = await fetch('http://localhost:5000/api/attendance/today', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch attendance:', response.status);
        throw new Error('Failed to fetch attendance');
      }

      const data = await response.json();
      console.log('Today attendance data:', data);
      setTodayData(data.data);
      
      if (data.data.attendance?.checkIn && !data.data.attendance?.checkOut) {
        setCheckedIn(true);
        setCurrentHours(data.data.liveStatus.currentHours);
        
        // Determine current status
        if (data.data.liveStatus.isInMeeting) {
          setStatus('meeting');
        } else if (data.data.liveStatus.isOnBreak) {
          setStatus('break');
        } else {
          setStatus('working');
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance history
  const fetchAttendanceHistory = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/attendance?limit=7', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();
      setAttendanceHistory(data.data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // Check in
  const handleCheckIn = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: employeeId,
          orgId: user?.orgId,
          location: 'Office',
          notes: 'Check-in from employee dashboard'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-in failed');
      }

      toast.success('Checked in successfully');
      setCheckedIn(true);
      await fetchTodayAttendance();
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error(error instanceof Error ? error.message : 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Check out
  const handleCheckOut = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: employeeId,
          orgId: user?.orgId,
          location: 'Office',
          notes: 'Check-out from employee dashboard'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-out failed');
      }

      toast.success('Checked out successfully');
      setCheckedIn(false);
      await fetchTodayAttendance();
    } catch (error) {
      console.error('Check-out error:', error);
      toast.error(error instanceof Error ? error.message : 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Start break
  const handleBreakStart = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/attendance/break/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: employeeId,
          orgId: user?.orgId,
          breakType: 'regular',
          notes: 'Break started from dashboard'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Break start failed');
      }

      toast.success('Break started');
      setStatus('break');
      await fetchTodayAttendance();
    } catch (error) {
      console.error('Break start error:', error);
      toast.error(error instanceof Error ? error.message : 'Break start failed');
    } finally {
      setActionLoading(false);
    }
  };

  // End break
  const handleBreakEnd = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/attendance/break/end', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId: employeeId,
          orgId: user?.orgId,
          notes: 'Break ended from dashboard'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Break end failed');
      }

      toast.success('Break ended');
      setStatus('working');
      await fetchTodayAttendance();
    } catch (error) {
      console.error('Break end error:', error);
      toast.error(error instanceof Error ? error.message : 'Break end failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle meeting mode
  const handleMeetingToggle = async (isActive: boolean) => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/attendance/meeting-mode', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId: employeeId,
          orgId: user?.orgId,
          isActive,
          meetingTitle: isActive ? 'Meeting' : undefined,
          meetingType: 'internal'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Meeting toggle failed');
      }

      toast.success(isActive ? 'Meeting mode activated' : 'Meeting mode deactivated');
      setStatus(isActive ? 'meeting' : 'working');
      await fetchTodayAttendance();
    } catch (error) {
      console.error('Meeting toggle error:', error);
      toast.error(error instanceof Error ? error.message : 'Meeting toggle failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Update hours every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (checkedIn && todayData?.attendance?.checkIn) {
        const checkInTime = new Date(todayData.attendance.checkIn);
        const now = new Date();
        const hours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        setCurrentHours(hours);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [checkedIn, todayData]);

  // Initial load - fetch employee ID first
  useEffect(() => {
    if (user?.id) {
      console.log('User ID available, fetching employee...');
      fetchEmployeeId();
      
      // Fallback timeout - if employee fetch takes too long, use userId as fallback
      const timeout = setTimeout(() => {
        console.warn('Employee fetch timeout, using userId as fallback');
        if (!employeeId) {
          setEmployeeId(user.id);
        }
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [user?.id]);

  // Fetch attendance data once we have employeeId
  useEffect(() => {
    if (employeeId) {
      console.log('EmployeeId available, fetching attendance...');
      fetchTodayAttendance();
      fetchAttendanceHistory();
    }
  }, [employeeId]);

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Attendance</h1>
        <p className="text-muted-foreground">Track your daily attendance and hours</p>
      </div>

      {loading ? (
        <Card className="p-8 rounded-2xl text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading attendance data...</p>
        </Card>
      ) : (
        <>
          {/* Check In/Out Card */}
          <Card className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Current Status */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Today's Attendance</h3>
                    <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-background/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <LogIn className="w-4 h-4 text-secondary" />
                      <span className="text-sm text-muted-foreground">Check-in</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {todayData?.attendance?.checkIn 
                        ? new Date(todayData.attendance.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Hours Today</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {checkedIn 
                        ? `${Math.floor(currentHours)}h ${Math.round((currentHours % 1) * 60)}m`
                        : todayData?.attendance?.hoursWorked 
                          ? `${Math.floor(todayData.attendance.hoursWorked)}h ${Math.round((todayData.attendance.hoursWorked % 1) * 60)}m`
                          : '-'}
                    </p>
                  </div>
                </div>

                {/* Status Toggle */}
                {checkedIn && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                    <div className="flex gap-2">
                      <Button
                        variant={status === 'working' ? 'default' : 'outline'}
                        className="flex-1 rounded-xl"
                        onClick={() => {
                          if (status === 'break') handleBreakEnd();
                          else if (status === 'meeting') handleMeetingToggle(false);
                          else setStatus('working');
                        }}
                        disabled={actionLoading}
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Working
                      </Button>
                      <Button
                        variant={status === 'break' ? 'default' : 'outline'}
                        className="flex-1 rounded-xl"
                        onClick={() => status === 'break' ? handleBreakEnd() : handleBreakStart()}
                        disabled={actionLoading}
                      >
                        <Coffee className="w-4 h-4 mr-2" />
                        {status === 'break' ? 'End Break' : 'Break'}
                      </Button>
                      <Button
                        variant={status === 'meeting' ? 'default' : 'outline'}
                        className="flex-1 rounded-xl"
                        onClick={() => handleMeetingToggle(status !== 'meeting')}
                        disabled={actionLoading}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {status === 'meeting' ? 'End Meeting' : 'Meeting'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Check In/Out Button */}
              <div className="flex flex-col justify-between">
                <div className="p-6 rounded-xl bg-background/50 border border-border text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                    <Badge className={`${checkedIn ? 'bg-secondary' : 'bg-muted'} text-secondary-foreground`}>
                      {checkedIn ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <p className="text-lg font-semibold capitalize">{checkedIn ? status : 'Not Checked In'}</p>
                </div>
                {!checkedIn ? (
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full rounded-xl bg-green-600 hover:bg-green-700"
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader className="w-5 h-5 mr-2 animate-spin" /> : <LogIn className="w-5 h-5 mr-2" />}
                    Check In
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader className="w-5 h-5 mr-2 animate-spin" /> : <LogOut className="w-5 h-5 mr-2" />}
                    Check Out
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Attendance History */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="font-semibold text-lg">Attendance History</h3>
              <p className="text-sm text-muted-foreground">Your recent attendance records</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Check-in</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Check-out</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Hours</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Breaks</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendanceHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-muted-foreground">
                        No attendance records found
                      </td>
                    </tr>
                  ) : (
                    attendanceHistory.map((record) => (
                      <tr key={record._id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{new Date(record.date).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {record.hoursWorked 
                            ? `${Math.floor(record.hoursWorked)}h ${Math.round((record.hoursWorked % 1) * 60)}m`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {record.breaks && record.breaks.length > 0
                            ? `${record.breaks.length} break(s)`
                            : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={record.status === 'present' ? 'default' : 'secondary'}>
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
