import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Pause, MessageSquare, Moon, Calendar, Loader } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiHelper';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

interface AttendanceRecord {
  _id: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  hoursWorked?: number;
  status: string;
}

export default function Attendance() {
  const { user } = useAuth();
  const [todayData, setTodayData] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentHours, setCurrentHours] = useState(0);
  const [checkedIn, setCheckedIn] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakType, setBreakType] = useState<'regular' | null>(null);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [activityLogs, setActivityLogs] = useState<Array<{
    id: string;
    action: string;
    time: string;
    status: string;
  }>>([]);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterLoading, setFilterLoading] = useState(false);

  // Load activity logs from localStorage on mount
  useEffect(() => {
    const today = new Date().toDateString();
    const storedLogs = localStorage.getItem(`activityLogs_${today}`);
    if (storedLogs) {
      try {
        setActivityLogs(JSON.parse(storedLogs));
      } catch (e) {
        console.warn('Failed to parse stored activity logs');
      }
    }
    
    // Also load checked-in state from localStorage
    const storedCheckedIn = localStorage.getItem(`checkedIn_${today}`);
    if (storedCheckedIn) {
      try {
        const state = JSON.parse(storedCheckedIn);
        console.log('Loaded checked-in state from localStorage:', state);
        setCheckedIn(state.checkedIn);
        setCurrentHours(state.currentHours || 0);
        setIsOnBreak(state.isOnBreak || false);
        setBreakType(state.breakType || null);
        setIsInMeeting(state.isInMeeting || false);
      } catch (e) {
        console.warn('Failed to parse stored checked-in state');
      }
    }
  }, []);

  // Fetch employee ID
  const fetchEmployeeId = async () => {
    try {
      if (!user?.id) return;
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/employees/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?._id) {
          setEmployeeId(data.data._id);
          return data.data._id;
        }
      }
      setEmployeeId(user.id);
      return user.id;
    } catch (error) {
      console.error('Error fetching employee:', error);
      setEmployeeId(user.id);
      return user.id;
    }
  };

  // Fetch today's attendance - ONLY on initial load
  const fetchTodayAttendance = async (empId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl('/attendance/today'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch attendance');

      const data = await response.json();
      console.log('Fetched today attendance:', data.data);
      
      setTodayData(data.data);
      
      // Check if we have localStorage state - if yes, use it instead of server state
      const today = new Date().toDateString();
      const storedState = localStorage.getItem(`checkedIn_${today}`);
      
      if (storedState) {
        // Use localStorage state (it's more up-to-date than server)
        console.log('Using localStorage state instead of server state');
        try {
          const state = JSON.parse(storedState);
          setCheckedIn(state.checkedIn);
          setCurrentHours(state.currentHours || 0);
          setIsOnBreak(state.isOnBreak || false);
          setBreakType(state.breakType || null);
          setIsInMeeting(state.isInMeeting || false);
        } catch (e) {
          console.warn('Failed to parse stored state, using server state');
          // Fallback to server state
          const liveStatus = data.data?.liveStatus?.status;
          const isCheckedInNow = liveStatus === 'checked_in' || liveStatus === 'on_break' || liveStatus === 'in_meeting';
          setCheckedIn(isCheckedInNow);
          setCurrentHours(data.data?.liveStatus?.currentHours || 0);
          setIsOnBreak(data.data?.liveStatus?.isOnBreak || false);
          setBreakType(null);
          setIsInMeeting(data.data?.liveStatus?.isInMeeting || false);
        }
      } else {
        // No localStorage state, use server state
        console.log('No localStorage state, using server state');
        const liveStatus = data.data?.liveStatus?.status;
        const isCheckedInNow = liveStatus === 'checked_in' || liveStatus === 'on_break' || liveStatus === 'in_meeting';
        setCheckedIn(isCheckedInNow);
        setCurrentHours(data.data?.liveStatus?.currentHours || 0);
        setIsOnBreak(data.data?.liveStatus?.isOnBreak || false);
        setBreakType(null);
        setIsInMeeting(data.data?.liveStatus?.isInMeeting || false);
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
      const response = await fetch('/api/attendance?limit=7', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('Failed to fetch history:', response.status);
        return;
      }
      const data = await response.json();
      console.log('Fetched attendance history:', data.data);
      setAttendanceHistory(data.data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // Handle filter submission
  const handleFilterSubmit = () => {
    setFilterLoading(true);
    
    try {
      let filtered = attendanceHistory;

      if (filterStartDate) {
        const startDate = new Date(filterStartDate);
        startDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(record => new Date(record.date) >= startDate);
      }

      if (filterEndDate) {
        const endDate = new Date(filterEndDate);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(record => new Date(record.date) <= endDate);
      }

      setFilteredAttendance(filtered);
      
      if (filtered.length === 0 && (filterStartDate || filterEndDate)) {
        toast.info('No records found for the selected date range');
      }
    } catch (error) {
      console.error('Error filtering records:', error);
      toast.error('Failed to filter records');
    } finally {
      setFilterLoading(false);
    }
  };

  // Handle filter reset
  const handleFilterReset = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilteredAttendance(attendanceHistory);
  };

  // Initialize filtered attendance with all records on mount
  useEffect(() => {
    setFilteredAttendance(attendanceHistory);
  }, [attendanceHistory]);

  // Add activity log
  const addActivityLog = (action: string, status: string) => {
    const newLog = {
      id: Date.now().toString(),
      action,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status
    };
    setActivityLogs(prev => {
      const updated = [newLog, ...prev];
      // Save to localStorage
      const today = new Date().toDateString();
      localStorage.setItem(`activityLogs_${today}`, JSON.stringify(updated));
      return updated;
    });
  };

  // Get orgId
  const getOrgId = () => {
    let orgId = user?.orgId;
    if (!orgId) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          orgId = parsedUser.orgId || parsedUser.tenantId || 'system';
        } catch (e) {
          console.warn('Could not parse stored user');
        }
      }
    }
    return orgId || 'system';
  };

  // Check In
  const handleCheckIn = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId,
          employeeName: user?.name || 'Employee',
          orgId: getOrgId(),
          location: 'Office',
          notes: 'Check-in from attendance page'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-in failed');
      }

      // Update state immediately - DO NOT fetch from server
      setCheckedIn(true);
      setCurrentHours(0);
      setIsOnBreak(false);
      setBreakType(null);
      setIsInMeeting(false);
      addActivityLog('Checked In', 'working');
      
      // Save checked-in state to localStorage
      const today = new Date().toDateString();
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify({
        checkedIn: true,
        currentHours: 0,
        isOnBreak: false,
        breakType: null,
        isInMeeting: false
      }));
      
      // Add today's check-in to attendance history immediately
      const checkInRecord: AttendanceRecord = {
        _id: Date.now().toString(),
        date: new Date().toISOString(),
        checkIn: new Date().toISOString(),
        status: 'present'
      };
      setAttendanceHistory(prev => [checkInRecord, ...prev]);
      
      // Also refresh from server
      setTimeout(() => {
        fetchAttendanceHistory();
      }, 500);
      
      toast.success('Checked in successfully');
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error(error instanceof Error ? error.message : 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Check Out
  const handleCheckOut = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          employeeId,
          orgId: getOrgId(),
          location: 'Office',
          notes: 'Check-out from attendance page'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-out failed');
      }

      const result = await response.json();

      // Update state immediately - DO NOT fetch from server
      setCheckedIn(false);
      setShowCheckOutConfirm(false);
      setIsOnBreak(false);
      setBreakType(null);
      setIsInMeeting(false);
      addActivityLog('Checked Out', 'completed');
      
      // Save checked-out state to localStorage
      const today = new Date().toDateString();
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify({
        checkedIn: false,
        currentHours: result.data?.hoursWorked || 0,
        isOnBreak: false,
        breakType: null,
        isInMeeting: false
      }));
      
      // Update hours from response
      if (result.data?.hoursWorked) {
        setCurrentHours(result.data.hoursWorked);
      }

      // Refresh history only
      fetchAttendanceHistory();
      
      toast.success('Checked out successfully');
    } catch (error) {
      console.error('Check-out error:', error);
      toast.error(error instanceof Error ? error.message : 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Break Start
  const handleBreakStart = async (breakType = 'regular') => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/attendance/break-start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId,
          orgId: getOrgId(),
          breakType,
          notes: `Break started`
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Break start failed');
      }

      // Update state immediately
      setIsOnBreak(true);
      setBreakType(breakType);
      const breakLabel = 'Break';
      addActivityLog(`Started ${breakLabel}`, 'break');
      
      // Save state to localStorage
      const today = new Date().toDateString();
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: true,
        breakType,
        isInMeeting: false
      }));
      
      toast.success(`${breakLabel} started`);
    } catch (error) {
      console.error('Break start error:', error);
      toast.error(error instanceof Error ? error.message : 'Break start failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Break End
  const handleBreakEnd = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/attendance/break-end', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId,
          orgId: getOrgId(),
          notes: 'Break ended'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Break end failed');
      }

      // Update state immediately
      setIsOnBreak(false);
      setBreakType(null);
      addActivityLog('Ended Break', 'working');
      
      // Save state to localStorage
      const today = new Date().toDateString();
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: false,
        breakType: null,
        isInMeeting: false
      }));
      
      toast.success('Break ended');
    } catch (error) {
      console.error('Break end error:', error);
      toast.error(error instanceof Error ? error.message : 'Break end failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Meeting Start
  const handleMeetingStart = async () => {
    console.log('Meeting start clicked - isOnBreak:', isOnBreak);
    
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    if (!checkedIn) {
      toast.error('Please check in first before starting a meeting');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      
      // If on break, automatically end it first
      if (isOnBreak) {
        console.log('On break, ending break first...');
        try {
          const breakEndResponse = await fetch('/api/attendance/break-end', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              employeeId,
              orgId: getOrgId(),
              notes: 'Break ended to start meeting'
            })
          });

          if (breakEndResponse.ok) {
            console.log('Break ended successfully');
            setIsOnBreak(false);
            // Update localStorage
            const today = new Date().toDateString();
            localStorage.setItem(`checkedIn_${today}`, JSON.stringify({
              checkedIn: true,
              currentHours,
              isOnBreak: false,
              breakType: null,
              isInMeeting: false
            }));
            // Add small delay to ensure database is updated
            await new Promise(resolve => setTimeout(resolve, 300));
          } else {
            const breakError = await breakEndResponse.json();
            console.warn('Failed to end break:', breakError.message);
            throw new Error(`Failed to end break: ${breakError.message}`);
          }
        } catch (breakError) {
          console.error('Error ending break:', breakError);
          throw new Error(`Cannot start meeting: ${breakError instanceof Error ? breakError.message : 'Failed to end break'}`);
        }
      }
      
      const meetingData = {
        employeeId,
        orgId: getOrgId(),
        meetingTitle: 'Meeting',
        meetingType: 'internal',
        notes: 'Meeting started'
      };
      
      console.log('Sending meeting-start request:', meetingData);
      
      const response = await fetch('/api/attendance/meeting-start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingData)
      });

      console.log('Meeting-start response status:', response.status);
      
      const responseData = await response.json();
      console.log('Meeting-start response data:', responseData);
      
      if (!response.ok) {
        const errorMsg = responseData.message || 'Meeting start failed';
        console.error('Meeting start error from backend:', errorMsg);
        throw new Error(errorMsg);
      }

      // Update state immediately
      setIsInMeeting(true);
      setIsOnBreak(false);
      setBreakType(null);
      addActivityLog('Started Meeting', 'meeting');
      
      // Save state to localStorage
      const today = new Date().toDateString();
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: false,
        breakType: null,
        isInMeeting: true
      }));
      
      toast.success('Meeting started');
    } catch (error) {
      console.error('Meeting start error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Meeting start failed';
      console.error('Full error:', errorMsg);
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Meeting End
  const handleMeetingEnd = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/attendance/meeting-end', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId,
          orgId: getOrgId(),
          notes: 'Meeting ended'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Meeting end failed');
      }

      // Update state immediately
      setIsInMeeting(false);
      addActivityLog('Ended Meeting', 'working');
      
      // Save state to localStorage
      const today = new Date().toDateString();
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: false,
        breakType: null,
        isInMeeting: false
      }));
      
      toast.success('Meeting ended');
    } catch (error) {
      console.error('Meeting end error:', error);
      toast.error(error instanceof Error ? error.message : 'Meeting end failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Update hours every second when checked in
  useEffect(() => {
    if (!checkedIn || !todayData?.attendance?.checkIn) return;

    const interval = setInterval(() => {
      const checkInTime = new Date(todayData.attendance.checkIn);
      const now = new Date();
      const hours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      setCurrentHours(hours);
    }, 1000);

    return () => clearInterval(interval);
  }, [checkedIn, todayData]);

  // Refresh attendance history every 10 seconds when checked in
  useEffect(() => {
    if (!checkedIn) return;

    const interval = setInterval(() => {
      fetchAttendanceHistory();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [checkedIn]);

  // Initial load only
  useEffect(() => {
    const init = async () => {
      const empId = await fetchEmployeeId();
      if (empId) {
        await fetchTodayAttendance(empId);
        await fetchAttendanceHistory();
      }
    };
    init();
  }, [user?.id]);

  return (
    <div className="p-8 space-y-8">
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

                {checkedIn && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                    <div className="flex gap-2">
                      <Button variant="default" className="flex-1 rounded-xl" disabled>
                        <LogIn className="w-4 h-4 mr-2" />
                        Working
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between">
                <div className="p-6 rounded-xl bg-background/50 border border-border text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                    <Badge className={`${checkedIn ? 'bg-secondary' : 'bg-muted'} text-secondary-foreground`}>
                      {checkedIn ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <p className="text-lg font-semibold capitalize">{checkedIn ? 'Checked In' : 'Not Checked In'}</p>
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
                    onClick={() => setShowCheckOutConfirm(true)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader className="w-5 h-5 mr-2 animate-spin" /> : <LogOut className="w-5 h-5 mr-2" />}
                    Check Out
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Break and Meeting Actions */}
          {checkedIn && (
            <Card className="rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="font-semibold text-lg">Actions</h3>
                <p className="text-sm text-muted-foreground">Manage your break and meeting status</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant={breakType === 'regular' ? "destructive" : "outline"}
                    size="lg"
                    className="rounded-xl"
                    onClick={breakType === 'regular' ? handleBreakEnd : () => handleBreakStart('regular')}
                    disabled={actionLoading || isInMeeting}
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    {breakType === 'regular' ? 'End Break' : 'Start Break'}
                  </Button>

                  <Button
                    variant={isInMeeting ? "destructive" : "outline"}
                    size="lg"
                    className="rounded-xl"
                    onClick={isInMeeting ? handleMeetingEnd : handleMeetingStart}
                    disabled={actionLoading || isOnBreak}
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    {isInMeeting ? 'End Meeting' : 'Start Meeting'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Activity Logs */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="font-semibold text-lg">Live Activity Logs</h3>
              <p className="text-sm text-muted-foreground">Today's attendance activities</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Time</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Action</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-muted-foreground">
                        No activities yet
                      </td>
                    </tr>
                  ) : (
                    activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium">{log.time}</td>
                        <td className="px-6 py-4 text-sm">{log.action}</td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            log.status === 'working' ? 'default' :
                            log.status === 'break' ? 'secondary' :
                            log.status === 'meeting' ? 'outline' :
                            'default'
                          }>
                            {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Attendance History */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Attendance History</h3>
                  <p className="text-sm text-muted-foreground">Your recent attendance records</p>
                </div>
              </div>
              
              {/* Date Filter */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">From Date</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">To Date</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFilterReset}
                  className="rounded-lg"
                  disabled={filterLoading}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleFilterSubmit}
                  className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={filterLoading}
                >
                  {filterLoading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Filtering...
                    </>
                  ) : (
                    'Search'
                  )}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Check-in</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Check-out</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Hours</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-muted-foreground">
                        {attendanceHistory.length === 0 ? 'No attendance records found' : 'No records match the selected date range'}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((record) => (
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

      {/* Check Out Confirmation Dialog */}
      <AlertDialog open={showCheckOutConfirm} onOpenChange={setShowCheckOutConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Check Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to check out? You have worked for {Math.floor(currentHours)}h {Math.round((currentHours % 1) * 60)}m today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <p className="text-sm text-muted-foreground mb-2">Check-in Time:</p>
            <p className="font-semibold">
              {todayData?.attendance?.checkIn 
                ? new Date(todayData.attendance.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : '-'}
            </p>
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCheckOut}
              disabled={actionLoading}
              className="rounded-lg bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
              Check Out
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
