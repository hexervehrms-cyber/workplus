import { useState, useEffect, useCallback } from 'react';
import { Calendar, Loader } from 'lucide-react';
import { apiGet } from '../../utils/apiHelper';
import { extractApiList } from '../../utils/api';
import { safeLocaleTime, hasCheckOutValue, safeTitleCase } from '../../utils/safeUi';
import {
  readPersistedAttendance,
  isPayloadFresh,
  clearPersistedAttendance,
  writePersistedAttendance,
} from '../../utils/attendancePersistence';
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

function formatActivityAction(action: string): string {
  const labels: Record<string, string> = {
    attendance_checkin: 'Checked in',
    attendance_checkout: 'Checked out',
    attendance_break_start: 'Break started',
    attendance_break_end: 'Break ended',
  };
  return labels[action] || action.replace(/_/g, ' ');
}

function statusFromActivityAction(action: string): string {
  if (action.includes('break_start')) return 'break';
  if (action.includes('break_end')) return 'working';
  if (action.includes('checkout')) return 'working';
  return 'working';
}

function buildActivityLogsFromAttendance(att: any) {
  if (!att) return [];
  type Row = { id: string; action: string; time: string; status: string; sortKey: number };
  const rows: Row[] = [];
  const pushRow = (id: string, action: string, d: string | Date, status: string) => {
    const dt = new Date(d);
    rows.push({
      id,
      action,
      time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status,
      sortKey: dt.getTime(),
    });
  };
  if (att.checkIn) pushRow(`in-${att._id}`, 'Checked in', att.checkIn, 'working');
  if (Array.isArray(att.breaks)) {
    att.breaks.forEach((b: any, i: number) => {
      if (b.startTime) {
        pushRow(`bs-${att._id}-${i}`, `Break started (${b.breakType || 'regular'})`, b.startTime, 'break');
      }
      if (b.endTime) {
        pushRow(`be-${att._id}-${i}`, 'Break ended', b.endTime, 'working');
      }
    });
  }
  if (att.checkOut) pushRow(`out-${att._id}`, 'Checked out', att.checkOut, 'working');
  rows.sort((a, b) => b.sortKey - a.sortKey);
  return rows.map(({ sortKey, ...rest }) => ({
    ...rest,
    date: new Date(sortKey).toLocaleDateString('en-GB'),
  }));
}

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
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<
    Array<{
      id: string;
      action: string;
      time: string;
      date: string;
      status: string;
    }>
  >([]);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchEmployeeActivityLogs = useCallback(async () => {
    try {
      const response = await apiGet<{ success?: boolean; data?: unknown }>(
        `/attendance/activity-logs/me?limit=2000&t=${Date.now()}`,
        false
      );
      const rows = extractApiList<{
        _id: string;
        action: string;
        timestamp: string;
        details?: { breakType?: string };
      }>(response);
      if (response?.success !== false && rows.length > 0) {
        const mapped = rows
          .map((log: { _id: string; action: string; timestamp: string; details?: { breakType?: string } }) => {
            const ts = new Date(log.timestamp);
            const breakLabel =
              log.action.includes('break') && log.details?.breakType
                ? ` (${log.details.breakType})`
                : '';
            return {
              id: String(log._id),
              action: `${formatActivityAction(log.action)}${breakLabel}`,
              time: ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              date: ts.toLocaleDateString('en-GB'),
              status: statusFromActivityAction(log.action),
              sortKey: ts.getTime(),
            };
          })
          .sort((a, b) => b.sortKey - a.sortKey);
        setActivityLogs(mapped.map(({ sortKey: _s, ...rest }) => rest));
        return;
      }
    } catch (error) {
      console.warn('Activity logs API unavailable, using today record', error);
    }
    const att = todayData?.attendance;
    setActivityLogs(buildActivityLogsFromAttendance(att));
  }, [todayData]);
  const fetchEmployeeId = async () => {
    try {
      const authUserId = user?.userId || user?.id;
      if (!authUserId) return null;
      if ((user as any)?.employeeId) {
        const eid = String((user as any).employeeId);
        if (isLikelyMongoObjectId(eid)) {
          setEmployeeId(eid);
          return eid;
        }
      }
      const data = await apiGet<{ data?: { _id?: string } }>(
        `employees/user/${authUserId}`,
        false
      );
      if (data?.data?._id && isLikelyMongoObjectId(data.data._id)) {
        setEmployeeId(data.data._id);
        return data.data._id;
      }
      setEmployeeId(null);
      return null;
    } catch (error) {
      console.error('Error fetching employee:', error);
      setEmployeeId(null);
      return null;
    }
  };

  const applyCachedCheckedIn = useCallback(
    async (uid: string | null) => {
      const cached = await readPersistedAttendance(uid);
      const hasFreshCheckedIn =
        cached &&
        isPayloadFresh(cached) &&
        (cached.isCheckedIn || cached.checkedIn) &&
        !cached.checkOutTime;

      if (!hasFreshCheckedIn) return false;

      syncAttendance(
        {
          isCheckedIn: true,
          checkInTime: cached.checkInTime || null,
          checkOutTime: cached.checkOutTime || null,
          hoursWorked: cached.hoursWorked || cached.currentHours || 0,
          status: cached.status || 'present',
          isOnBreak: cached.isOnBreak || false,
          breakType: cached.breakType || 'regular',
          currentBreakDuration: cached.currentBreakDuration || 0,
        },
        'api'
      );
      return true;
    },
    [syncAttendance]
  );

  // Fetch today's attendance — server liveStatus is source of truth; cache fills orgId-mismatch gaps
  const fetchTodayAttendance = useCallback(async () => {
    const uid = user?.id ? String(user.id) : null;

    try {
      const data = await apiGet<{ data?: { attendance?: any; liveStatus?: any } }>('attendance/today', false);
      const payload = data?.data;
      setTodayData(payload);

      const att = payload?.attendance;
      if (!att) {
        const kept = await applyCachedCheckedIn(uid);
        if (!kept) {
          syncAttendance(
            {
              isCheckedIn: false,
              checkInTime: null,
              checkOutTime: null,
              hoursWorked: 0,
              status: 'absent',
              isOnBreak: false,
              breakType: 'regular',
              currentBreakDuration: 0,
            },
            'api'
          );
          await clearPersistedAttendance(uid);
        }
        return;
      }

      const ls = payload?.liveStatus;
      const checkInTime = safeLocaleTime(att.checkIn);
      const checkOutTime = safeLocaleTime(att.checkOut);

      const hasCheckOut = hasCheckOutValue(att.checkOut);
      let isCheckedInNow = false;
      if (hasCheckOut) {
        isCheckedInNow = false;
      } else if (ls?.status === 'checked_out' || ls?.status === 'not_checked_in') {
        isCheckedInNow = false;
      } else if (
        ls?.status === 'checked_in' ||
        ls?.status === 'on_break' ||
        ls?.status === 'in_meeting'
      ) {
        isCheckedInNow = true;
      } else {
        isCheckedInNow = Boolean(att.checkIn);
      }

      let isOnBreak = Boolean(ls?.isOnBreak || ls?.status === 'on_break');
      let breakType = (ls?.breakType as string) || 'regular';
      if (Array.isArray(att.breaks) && att.breaks.length > 0) {
        const lastBreak = att.breaks[att.breaks.length - 1];
        if (lastBreak?.startTime && !lastBreak?.endTime) {
          isOnBreak = true;
          breakType = lastBreak.breakType || 'regular';
        }
      }

      const hours = att.hoursWorked ?? ls?.currentHours ?? 0;

      syncAttendance(
        {
          isCheckedIn: isCheckedInNow,
          checkInTime,
          checkOutTime,
          hoursWorked: hours,
          status: att.status || ls?.status || 'absent',
          isOnBreak,
          breakType: isOnBreak ? breakType : 'regular',
          currentBreakDuration:
            typeof ls?.currentBreakDuration === 'number' ? Math.round(ls.currentBreakDuration) : 0,
        },
        'api'
      );

      void writePersistedAttendance(uid, {
        checkedIn: isCheckedInNow,
        isCheckedIn: isCheckedInNow,
        checkInTime,
        checkOutTime,
        hoursWorked: hours,
        currentHours: hours,
        status: att.status || ls?.status || 'absent',
        isOnBreak,
        breakType,
        currentBreakDuration:
          typeof ls?.currentBreakDuration === 'number' ? Math.round(ls.currentBreakDuration) : 0,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      await applyCachedCheckedIn(uid);
    } finally {
      setLoading(false);
    }
  }, [user?.id, syncAttendance, applyCachedCheckedIn]);

  // Fetch attendance history (paginated)
  const fetchAttendanceHistoryPage = useCallback(
    async (page: number) => {
      try {
        setHistoryLoadingMore(true);
        const data = await apiGet<{ data?: AttendanceRecord[]; pagination?: { pages?: number } }>(
          `attendance?limit=${HISTORY_PAGE_SIZE}&page=${page}`,
          false
        );
        const list: AttendanceRecord[] = data?.data || [];
        setAttendanceHistory(list);
        const pages = data?.pagination?.pages;
        if (typeof pages === 'number' && pages > 0) {
          setHistoryTotalPages(pages);
        } else {
          setHistoryTotalPages(Math.max(1, Math.ceil(list.length / HISTORY_PAGE_SIZE)));
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
    await fetchAttendanceHistoryPage(1);
  }, [fetchAttendanceHistoryPage]);

  const handleHistoryPrevious = () => {
    if (historyPage > 1) {
      void fetchAttendanceHistoryPage(historyPage - 1);
    }
  };

  const handleHistoryNext = () => {
    if (historyPage < historyTotalPages) {
      void fetchAttendanceHistoryPage(historyPage + 1);
    }
  };

  // Handle filter submission
  const handleFilterSubmit = () => {
    setFilterLoading(true);
    setHistoryPage(1); // Reset to page 1 when filtering
    
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
    setHistoryPage(1); // Reset to page 1 when clearing filters
    setFilteredAttendance(attendanceHistory);
  };

  // Initialize filtered attendance with all records on mount
  useEffect(() => {
    setFilteredAttendance(attendanceHistory);
  }, [attendanceHistory]);

  // Single subscription: refresh from API (context is updated in fetchTodayAttendance)
  useEffect(() => {
    const unsub = realTimeSocket.onAttendanceUpdate(() => {
      void fetchTodayAttendance();
      void fetchEmployeeActivityLogs();
    });
    return () => unsub();
  }, [fetchTodayAttendance, fetchEmployeeActivityLogs]);

  useEffect(() => {
    void fetchEmployeeActivityLogs();
  }, [todayData, fetchEmployeeActivityLogs]);

  // Refresh today's attendance periodically while checked in
  useEffect(() => {
    if (!employeeId) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!liveAttendance.isCheckedIn) return;

      console.log('⏰ [ATTENDANCE] Periodic refresh triggered');
      fetchTodayAttendance();
    }, 30000); // Refresh every 30 seconds while checked in or on break

    return () => clearInterval(interval);
  }, [employeeId, fetchTodayAttendance, liveAttendance.isCheckedIn]);

  // Initial load only — hydrate from IndexedDB / local cache, then API
  useEffect(() => {
    void (async () => {
      const uid = user?.id ? String(user.id) : null;
      const payload = await readPersistedAttendance(uid);
      if (payload && isPayloadFresh(payload)) {
        setLoading(false);
      }

      const empId = await fetchEmployeeId();
      if (empId) {
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
        await fetchEmployeeActivityLogs();
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
          {/* Activity Logs */}
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="font-semibold text-lg">Live Activity Logs</h3>
              <p className="text-sm text-muted-foreground">
                All your check-ins, breaks, and check-outs (full history)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Time</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Action</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-muted-foreground">
                        No activities yet
                      </td>
                    </tr>
                  ) : (
                    activityLogs.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE).map((log) => (
                      <tr key={log.id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-muted-foreground">{log.date || '—'}</td>
                        <td className="px-6 py-4 text-sm font-medium">{log.time}</td>
                        <td className="px-6 py-4 text-sm">{log.action}</td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            log.status === 'working' ? 'default' :
                            log.status === 'break' ? 'secondary' :
                            log.status === 'meeting' ? 'outline' :
                            'default'
                          }>
                            {safeTitleCase(log.status, '—')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {activityLogs.length > 0 && (
              <div className="p-4 border-t border-border flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {activityPage} of {Math.max(1, Math.ceil(activityLogs.length / PAGE_SIZE))}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={activityPage <= 1}
                    onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                    aria-label="Previous page"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={activityPage >= Math.ceil(activityLogs.length / PAGE_SIZE)}
                    onClick={() => setActivityPage(prev => Math.min(Math.ceil(activityLogs.length / PAGE_SIZE), prev + 1))}
                    aria-label="Next page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
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
                            {safeTitleCase(record.status, '—')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {historyPage} of {historyTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={historyPage <= 1 || historyLoadingMore}
                  onClick={handleHistoryPrevious}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={historyPage >= historyTotalPages || historyLoadingMore}
                  onClick={handleHistoryNext}
                  aria-label="Next page"
                >
                  {historyLoadingMore ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    'Next'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}







