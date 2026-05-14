import { useState, useEffect, useCallback } from 'react';
import { Pause, Calendar, Loader } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiHelper';
import { TokenManager } from '../../utils/api';
import { readPersistedAttendance, isPayloadFresh } from '../../utils/attendancePersistence';
import realTimeSocket from '../../utils/realTimeSocket';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

import { useAuth } from '../../context/AuthContext';
import { useAttendance } from '../../../context/AttendanceContext';

interface AttendanceRecord {
  _id: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  hoursWorked?: number;
  status: string;
}

const HISTORY_PAGE_SIZE = 10;

function isLikelyMongoObjectId(id: string | null | undefined): boolean {
  return !!id && /^[a-f\d]{24}$/i.test(id);
}

export default function Attendance() {
  const { user } = useAuth();
  const { attendance: liveAttendance, updateAttendance: syncAttendance } = useAttendance();
  const [todayData, setTodayData] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentHours, setCurrentHours] = useState(0);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<Array<{
    id: string;
    action: string;
    time: string;
    status: string;
  }>>([]);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

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
  }, []);

  // Fetch employee ID
  const fetchEmployeeId = async () => {
    try {
      if (!user?.id) return;
      if ((user as any)?.employeeId) {
        const eid = String((user as any).employeeId);
        if (isLikelyMongoObjectId(eid)) {
          setEmployeeId(eid);
          return eid;
        }
      }
      const token = TokenManager.get();
      const response = await fetch(buildApiUrl(`/employees/user/${user.id}`), {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?._id && isLikelyMongoObjectId(data.data._id)) {
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

  // Fetch today's attendance — server liveStatus is source of truth for check-in and break
  const fetchTodayAttendance = useCallback(async () => {
    try {
      const token = TokenManager.get();
      const response = await fetch(buildApiUrl('/attendance/today'), {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch attendance');

      const data = await response.json();
      console.log('Fetched today attendance:', data.data);

      setTodayData(data.data);

      const liveStatus = data.data?.liveStatus?.status;
      const isCheckedInNow =
        liveStatus === 'checked_in' || liveStatus === 'on_break' || liveStatus === 'in_meeting';
      const isOnBreak = !!data.data?.liveStatus?.isOnBreak;
      const breakTypeFromApi = (data.data?.liveStatus?.breakType as string) || 'regular';
      const hours = data.data?.liveStatus?.currentHours || 0;

      const att = data.data?.attendance;
      const checkInTime = att?.checkIn
        ? new Date(att.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : null;
      const checkOutTime = att?.checkOut
        ? new Date(att.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : null;

      setCurrentHours(hours);
      syncAttendance(
        {
          isCheckedIn: isCheckedInNow,
          checkInTime,
          checkOutTime,
          hoursWorked: att?.hoursWorked ?? hours,
          status: att?.status || liveStatus || 'absent',
          isOnBreak,
          breakType: isOnBreak ? breakTypeFromApi : 'regular',
          currentBreakDuration: 0
        },
        'api'
      );
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, syncAttendance]);

  // Fetch attendance history (paginated)
  const fetchAttendanceHistoryPage = useCallback(
    async (page: number, append: boolean) => {
      try {
        if (append) setHistoryLoadingMore(true);
        const token = TokenManager.get();
        const response = await fetch(
          buildApiUrl(`/attendance?limit=${HISTORY_PAGE_SIZE}&page=${page}`),
          {
            credentials: 'include',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          console.warn('Failed to fetch history:', response.status);
          return;
        }
        const data = await response.json();
        const list: AttendanceRecord[] = data.data || [];
        setAttendanceHistory((prev) => (append ? [...prev, ...list] : list));
        const pages = data.pagination?.pages;
        if (typeof pages === 'number' && pages > 0) {
          setHistoryTotalPages(pages);
        } else {
          setHistoryTotalPages(list.length < HISTORY_PAGE_SIZE ? page : page + 1);
        }
        setHistoryPage(page);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setHistoryLoadingMore(false);
      }
    },
    []
  );

  const fetchAttendanceHistory = useCallback(async () => {
    await fetchAttendanceHistoryPage(1, false);
  }, [fetchAttendanceHistoryPage]);

  const loadMoreHistory = () => {
    if (historyPage >= historyTotalPages || historyLoadingMore) return;
    void fetchAttendanceHistoryPage(historyPage + 1, true);
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
  const handleBreakStart = async (kind: 'regular' = 'regular') => {
    // Prevent starting break if not checked in
    if (!liveAttendance.isCheckedIn) {
      console.log('⏸️ [BREAK START] Not checked in, cannot start break');
      alert('Please check in first before starting a break');
      return;
    }
    
    // Prevent starting break if already on break
    if (liveAttendance.isOnBreak) {
      console.log('⏸️ [BREAK START] Already on break, skipping');
      return;
    }
    
    try {
      setActionLoading(true);
      
      // Optimistic update
      syncAttendance(
        {
          isOnBreak: true,
          breakType: kind,
          currentBreakDuration: 0
        },
        'action'
      );
      
      const token = TokenManager.get();
      const payload: any = {
        breakType: kind,
        notes: `Break started`
      };
      if (isLikelyMongoObjectId(employeeId)) payload.employeeId = employeeId;
      if (getOrgId()) payload.orgId = getOrgId();
      
      const response = await fetch(buildApiUrl('/attendance/break-start'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Break start failed');
      }

      const result = await response.json();
      const liveStatus = result.data?.liveStatus;
      
      // Confirm with server response
      if (liveStatus) {
        syncAttendance(
          {
            isOnBreak: liveStatus.isOnBreak || true,
            breakType: liveStatus.breakType || kind,
            currentBreakDuration: liveStatus.currentBreakDuration || 0
          },
          'action'
        );
      }
      
      addActivityLog('Started Break', 'break');
    } catch (error) {
      console.error('Break start error:', error);
      // Rollback on error
      syncAttendance(
        {
          isOnBreak: false,
          breakType: 'regular',
          currentBreakDuration: 0
        },
        'action'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Break End
  const handleBreakEnd = async () => {
    // Prevent ending break if not on break
    if (!liveAttendance.isOnBreak) {
      console.log('⏸️ [BREAK END] Not on break, skipping');
      return;
    }
    
    const wasOnBreak = liveAttendance.isOnBreak;
    const prevBreakType = liveAttendance.breakType;
    
    try {
      setActionLoading(true);
      
      // Optimistic update
      syncAttendance(
        {
          isOnBreak: false,
          breakType: 'regular',
          currentBreakDuration: 0
        },
        'action'
      );
      
      const token = TokenManager.get();
      const payload: any = {
        notes: 'Break ended'
      };
      if (isLikelyMongoObjectId(employeeId)) payload.employeeId = employeeId;
      if (getOrgId()) payload.orgId = getOrgId();
      
      const response = await fetch(buildApiUrl('/attendance/break-end'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || 'Break end failed');
      }

      const liveStatus = responseData?.data?.liveStatus;
      
      // Confirm with server response
      if (liveStatus) {
        syncAttendance(
          {
            isOnBreak: liveStatus.isOnBreak || false,
            breakType: liveStatus.breakType || 'regular',
            currentBreakDuration: liveStatus.currentBreakDuration || 0
          },
          'action'
        );
      }
      
      addActivityLog('Ended Break', 'working');
    } catch (error) {
      console.error('Break end error:', error);
      // Rollback on error
      syncAttendance(
        {
          isOnBreak: wasOnBreak,
          breakType: prevBreakType || 'regular'
        },
        'action'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Update hours every second when checked in
  useEffect(() => {
    if (!liveAttendance.isCheckedIn || !todayData?.attendance?.checkIn) return;

    const interval = setInterval(() => {
      const checkInTime = new Date(todayData.attendance.checkIn);
      const now = new Date();
      const hours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      setCurrentHours(hours);
    }, 1000);

    return () => clearInterval(interval);
  }, [liveAttendance.isCheckedIn, todayData]);

  // Single subscription: refresh from API (context is updated in fetchTodayAttendance)
  useEffect(() => {
    const unsub = realTimeSocket.onAttendanceUpdate(() => {
      void fetchTodayAttendance();
    });
    return () => unsub();
  }, [fetchTodayAttendance]);

  // Refresh today's attendance periodically while checked in
  useEffect(() => {
    if (!employeeId) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!liveAttendance.isCheckedIn && !liveAttendance.isOnBreak) return;

      console.log('⏰ [ATTENDANCE] Periodic refresh triggered');
      fetchTodayAttendance();
    }, 30000); // Refresh every 30 seconds while checked in or on break

    return () => clearInterval(interval);
  }, [employeeId, fetchTodayAttendance, liveAttendance.isCheckedIn, liveAttendance.isOnBreak]);

  // Initial load only — hydrate from IndexedDB / local cache, then API
  useEffect(() => {
    void (async () => {
      const uid = user?.id ? String(user.id) : null;
      const payload = await readPersistedAttendance(uid);
      if (payload && isPayloadFresh(payload)) {
        setCurrentHours(payload.currentHours || payload.hoursWorked || 0);
        setLoading(false);
      }

      const empId = await fetchEmployeeId();
      if (empId) {
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
      }
    })();
  }, [user?.id, fetchTodayAttendance]);

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
          {liveAttendance.isCheckedIn && (
            <Card className="rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="font-semibold text-lg">Actions</h3>
                <p className="text-sm text-muted-foreground">Manage your break and meeting status</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <Button
                    variant={liveAttendance.isOnBreak ? "destructive" : "outline"}
                    size="lg"
                    className="rounded-xl"
                    onClick={
                      liveAttendance.isOnBreak
                        ? handleBreakEnd
                        : () => handleBreakStart('regular')
                    }
                    disabled={actionLoading}
                  >
                    <Pause className="w-5 h-5 mr-2" />
                    {liveAttendance.isOnBreak ? 'End Break' : 'Start Break'}
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
            {!filterStartDate && !filterEndDate && historyPage < historyTotalPages && (
              <div className="p-4 border-t border-border flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={loadMoreHistory}
                  disabled={historyLoadingMore}
                  aria-label="Load more attendance history"
                >
                  {historyLoadingMore ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}







