import { useState, useEffect } from 'react';
import { Pause, MessageSquare, Calendar, Loader } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiHelper';
import realTimeSocket from '../../utils/realTimeSocket';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

import { useAuth } from '../../context/AuthContext';

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
  const attendanceCacheKey = `employee_attendance_state_${user?.id || 'unknown'}`;

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
        // Don't load from localStorage - fetch from API instead
        // setIsOnBreak(state.isOnBreak || false);
        // setBreakType(state.breakType || null);
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
      if ((user as any)?.employeeId) {
        setEmployeeId((user as any).employeeId);
        return (user as any).employeeId;
      }
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl(`/employees/user/${user.id}`), {
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
      setEmployeeId(user?.id || null);
      return user?.id || null;
    }
  };

  // Fetch today's attendance - ONLY on initial load
  const fetchTodayAttendance = async () => {
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
          // Don't load from localStorage - fetch from API instead
          // setIsOnBreak(state.isOnBreak || false);
          // setBreakType(state.breakType || null);
          setIsInMeeting(state.isInMeeting || false);
          localStorage.setItem(attendanceCacheKey, JSON.stringify(state));
        } catch (e) {
          console.warn('Failed to parse stored state, using server state');
          // Fallback to server state - ALWAYS get break status from API
          const liveStatus = data.data?.liveStatus?.status;
          const isCheckedInNow = liveStatus === 'checked_in' || liveStatus === 'on_break' || liveStatus === 'in_meeting';
          setCheckedIn(isCheckedInNow);
          setCurrentHours(data.data?.liveStatus?.currentHours || 0);
          // ALWAYS get break status from API, never from localStorage
          setIsOnBreak(data.data?.liveStatus?.isOnBreak || false);
          setBreakType(null);
          setIsInMeeting(data.data?.liveStatus?.isInMeeting || false);
          localStorage.setItem(attendanceCacheKey, JSON.stringify({
            checkedIn: isCheckedInNow,
            currentHours: data.data?.liveStatus?.currentHours || 0,
            isOnBreak: data.data?.liveStatus?.isOnBreak || false,
            breakType: null,
            isInMeeting: data.data?.liveStatus?.isInMeeting || false
          }));
        }
      } else {
        // No localStorage state, use server state
        console.log('No localStorage state, using server state');
        const liveStatus = data.data?.liveStatus?.status;
        const isCheckedInNow = liveStatus === 'checked_in' || liveStatus === 'on_break' || liveStatus === 'in_meeting';
        setCheckedIn(isCheckedInNow);
        setCurrentHours(data.data?.liveStatus?.currentHours || 0);
        // ALWAYS get break status from API, never from localStorage
        setIsOnBreak(data.data?.liveStatus?.isOnBreak || false);
        setBreakType(null);
        setIsInMeeting(data.data?.liveStatus?.isInMeeting || false);
        localStorage.setItem(attendanceCacheKey, JSON.stringify({
          checkedIn: isCheckedInNow,
          currentHours: data.data?.liveStatus?.currentHours || 0,
          isOnBreak: data.data?.liveStatus?.isOnBreak || false,
          breakType: null,
          isInMeeting: data.data?.liveStatus?.isInMeeting || false
        }));
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance history
  const fetchAttendanceHistory = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(buildApiUrl('/attendance?limit=7'), {
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
        // Intentionally silent to keep UI free of non-critical info toasts.
      }
    } catch (error) {
      console.error('Error filtering records:', error);
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

  // Break Start
  const handleBreakStart = async (breakType: 'regular' = 'regular') => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const payload: any = {
        breakType,
        notes: `Break started`
      };
      if (employeeId) payload.employeeId = employeeId;
      if (getOrgId()) payload.orgId = getOrgId();
      const response = await fetch(buildApiUrl('/attendance/break-start'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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
      localStorage.setItem(attendanceCacheKey, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: true,
        breakType,
        isInMeeting: false
      }));
    } catch (error) {
      console.error('Break start error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Break End
  const handleBreakEnd = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const payload: any = {
        notes: 'Break ended'
      };
      if (employeeId) payload.employeeId = employeeId;
      if (getOrgId()) payload.orgId = getOrgId();
      const response = await fetch(buildApiUrl('/attendance/break-end'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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
      localStorage.setItem(attendanceCacheKey, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: false,
        breakType: null,
        isInMeeting: false
      }));
    } catch (error) {
      console.error('Break end error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Meeting Start
  const handleMeetingStart = async () => {
    console.log('Meeting start clicked - isOnBreak:', isOnBreak);
    
    if (!checkedIn) {
      console.error('Please check in first before starting a meeting');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      
      // If on break, automatically end it first
      if (isOnBreak) {
        console.log('On break, ending break first...');
        try {
          const breakEndResponse = await fetch(buildApiUrl('/attendance/break-end'), {
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
      
      const meetingData: any = {
        meetingTitle: 'Meeting',
        meetingType: 'internal',
        notes: 'Meeting started'
      };
      if (employeeId) meetingData.employeeId = employeeId;
      if (getOrgId()) meetingData.orgId = getOrgId();
      
      console.log('Sending meeting-start request:', meetingData);
      
      const response = await fetch(buildApiUrl('/attendance/meeting-start'), {
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
      localStorage.setItem(attendanceCacheKey, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: false,
        breakType: null,
        isInMeeting: true
      }));
    } catch (error) {
      console.error('Meeting start error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Meeting start failed';
      console.error('Full error:', errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Meeting End
  const handleMeetingEnd = async () => {
    try {
      setActionLoading(true);
        const token = localStorage.getItem('authToken');
      const payload: any = {
        notes: 'Meeting ended'
      };
      if (employeeId) payload.employeeId = employeeId;
      if (getOrgId()) payload.orgId = getOrgId();
      const response = await fetch(buildApiUrl('/attendance/meeting-end'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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
      localStorage.setItem(attendanceCacheKey, JSON.stringify({
        checkedIn: true,
        currentHours,
        isOnBreak: false,
        breakType: null,
        isInMeeting: false
      }));
      
      // Wait 1 second for database to update, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (employeeId) {
        await fetchTodayAttendance();
      }
    } catch (error) {
      console.error('Meeting end error:', error);
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

  // Listen to break events from Dashboard and sync state
  useEffect(() => {
    const today = new Date().toDateString();
    
    const handleBreakStarted = (data: any) => {
      try {
        console.log('📡 [ATTENDANCE] Break started event received:', data);
        console.log('📡 [ATTENDANCE] Current employeeId:', employeeId);
        console.log('📡 [ATTENDANCE] Event employeeId:', data.employeeId);
        console.log('📡 [ATTENDANCE] Match:', data.employeeId === employeeId);
        
        // Only update if it's for this employee
        if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
          console.log('📡 [ATTENDANCE] Break started for current employee, updating state');
          setIsOnBreak(true);
          setBreakType(data.breakType || 'regular');
          
          // Update localStorage to keep in sync
          const currentState = localStorage.getItem(`checkedIn_${today}`);
          if (currentState) {
            try {
              const parsed = JSON.parse(currentState);
              const updated = {
                ...parsed,
                isOnBreak: true,
                breakType: data.breakType || 'regular'
              };
              localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updated));
              localStorage.setItem(attendanceCacheKey, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to update localStorage:', e);
            }
          }
        } else {
          console.log('📡 [ATTENDANCE] Break started for different employee, ignoring');
        }
      } catch (error) {
        console.error('Error in handleBreakStarted:', error);
      }
    };

    const handleBreakEnded = (data: any) => {
      try {
        console.log('📡 [ATTENDANCE] Break ended event received:', data);
        console.log('📡 [ATTENDANCE] Current employeeId:', employeeId);
        console.log('📡 [ATTENDANCE] Event employeeId:', data.employeeId);
        console.log('📡 [ATTENDANCE] Match:', data.employeeId === employeeId);
        
        // Only update if it's for this employee
        if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
          console.log('📡 [ATTENDANCE] Break ended for current employee, updating state');
          setIsOnBreak(false);
          setBreakType(null);
          
          // Update localStorage to keep in sync
          const currentState = localStorage.getItem(`checkedIn_${today}`);
          if (currentState) {
            try {
              const parsed = JSON.parse(currentState);
              const updated = {
                ...parsed,
                isOnBreak: false,
                breakType: null
              };
              localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updated));
              localStorage.setItem(attendanceCacheKey, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to update localStorage:', e);
            }
          }
        } else {
          console.log('📡 [ATTENDANCE] Break ended for different employee, ignoring');
        }
      } catch (error) {
        console.error('Error in handleBreakEnded:', error);
      }
    };

    // Listen for meeting started events
    const handleMeetingStarted = (data: any) => {
      try {
        console.log('📡 [ATTENDANCE] Meeting started event received:', data);
        console.log('📡 [ATTENDANCE] Current employeeId:', employeeId);
        console.log('📡 [ATTENDANCE] Event employeeId:', data.employeeId);

        // Only update if it's for this employee
        if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
          console.log('📡 [ATTENDANCE] Meeting started for current employee, updating state');
          setIsInMeeting(true);

          // Update localStorage
          const currentState = localStorage.getItem(`checkedIn_${today}`);
          if (currentState) {
            try {
              const parsed = JSON.parse(currentState);
              const updated = {
                ...parsed,
                isInMeeting: true
              };
              localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updated));
              localStorage.setItem(attendanceCacheKey, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to update localStorage:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error in handleMeetingStarted:', error);
      }
    };

    // Listen for meeting ended events
    const handleMeetingEnded = (data: any) => {
      try {
        console.log('📡 [ATTENDANCE] Meeting ended event received:', data);
        console.log('📡 [ATTENDANCE] Current employeeId:', employeeId);
        console.log('📡 [ATTENDANCE] Event employeeId:', data.employeeId);

        // Only update if it's for this employee
        if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
          console.log('📡 [ATTENDANCE] Meeting ended for current employee, updating state');
          setIsInMeeting(false);

          // Update localStorage
          const currentState = localStorage.getItem(`checkedIn_${today}`);
          if (currentState) {
            try {
              const parsed = JSON.parse(currentState);
              const updated = {
                ...parsed,
                isInMeeting: false
              };
              localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updated));
              localStorage.setItem(attendanceCacheKey, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to update localStorage:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error in handleMeetingEnded:', error);
      }
    };

    // Listen for all attendance updates (check-in, check-out, meeting, etc.)
    const handleAttendanceUpdate = (data: any) => {
      console.log('📡 [ATTENDANCE] Attendance update event received:', data);
      // Refresh data when attendance updates
      if (employeeId) {
        fetchTodayAttendance();
      }
    };

    // Listen for check-in events
    const handleCheckedIn = (data: any) => {
      try {
        console.log('📡 [ATTENDANCE] attendance:checked_in event received:', data);
        console.log('📡 [ATTENDANCE] Current employeeId:', employeeId);
        console.log('📡 [ATTENDANCE] Event employeeId:', data.employeeId);

        // Only update if it's for this employee
        if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
          console.log('📡 [ATTENDANCE] Check-in for current employee, updating state');
          setCheckedIn(true);
                    
          // Update localStorage
          const today = new Date().toDateString();
          const currentState = localStorage.getItem(`checkedIn_${today}`);
          if (currentState) {
            try {
              const parsed = JSON.parse(currentState);
              const updated = {
                ...parsed,
                checkedIn: true
              };
              localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updated));
              localStorage.setItem(attendanceCacheKey, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to update localStorage:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error in handleCheckedIn:', error);
      }
    };

    // Listen for check-out events
    const handleCheckedOut = (data: any) => {
      try {
        console.log('📡 [ATTENDANCE] attendance:checked_out event received:', data);
        console.log('📡 [ATTENDANCE] Current employeeId:', employeeId);
        console.log('📡 [ATTENDANCE] Event employeeId:', data.employeeId);

        // Only update if it's for this employee
        if (data.employeeId === employeeId || String(data.employeeId) === String(employeeId)) {
          console.log('📡 [ATTENDANCE] Check-out for current employee, updating state');
          setCheckedIn(false);
          setIsOnBreak(false);
          setBreakType(null);
          setIsInMeeting(false);
                    
          // Update localStorage
          const today = new Date().toDateString();
          const currentState = localStorage.getItem(`checkedIn_${today}`);
          if (currentState) {
            try {
              const parsed = JSON.parse(currentState);
              const updated = {
                ...parsed,
                checkedIn: false,
                isOnBreak: false,
                breakType: null,
                isInMeeting: false,
                currentHours: data.hoursWorked || parsed.currentHours || 0
              };
              localStorage.setItem(`checkedIn_${today}`, JSON.stringify(updated));
              localStorage.setItem(attendanceCacheKey, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to update localStorage:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error in handleCheckedOut:', error);
      }
    };

    realTimeSocket.onBreakStarted(handleBreakStarted);
    realTimeSocket.onBreakEnded(handleBreakEnded);
    realTimeSocket.onMeetingStarted(handleMeetingStarted);
    realTimeSocket.onMeetingEnded(handleMeetingEnded);
    realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);
    realTimeSocket.on('attendance:checked_in', handleCheckedIn);
    realTimeSocket.on('attendance:checked_out', handleCheckedOut);

    return () => {
      // Note: realTimeSocket doesn't expose removeListener methods
      // The listeners will be cleaned up when the component unmounts
    };
  }, [employeeId, attendanceCacheKey]);

  // Refresh today's attendance periodically while checked in
  useEffect(() => {
    if (!employeeId) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      
      // Refresh every 10 seconds regardless of checked-in status
      console.log('⏰ [ATTENDANCE] Periodic refresh triggered');
      fetchTodayAttendance();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [employeeId]);

  // Initial load only
  useEffect(() => {
    const cached = localStorage.getItem(attendanceCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setCheckedIn(!!parsed.checkedIn);
        setCurrentHours(parsed.currentHours || 0);
        // NEVER load breakType from localStorage - it's stale data
        // setIsOnBreak(!!parsed.isOnBreak);
        // setBreakType(parsed.breakType || null);
        setIsInMeeting(!!parsed.isInMeeting);
        setLoading(false);
      } catch (_) {}
    }

    const init = async () => {
      const empId = await fetchEmployeeId();
      if (empId) {
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
      }
    };
    void init();
  }, [user?.id, attendanceCacheKey]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Attendance</h1>
        <p className="text-muted-foreground">Track your daily attendance and hours</p>
      </div>

      {loading ? (
        <Card className="p-8 rounded-2xl text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
        </Card>
      ) : (
        <>

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
    </div>
  );
}







