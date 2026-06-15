import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { ensureAccessToken } from '../../utils/sessionAuth';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Clock, Search, CheckCircle, AlertCircle, Upload, Download, FileSpreadsheet, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { extractApiList } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import {
  apiFetch,
  apiGet,
  apiPost,
  appendOrgIdParam,
  resolveAuthOrgId,
  resolveOrgIdForApi,
} from '../../utils/apiHelper';
import realTimeSocket from '../../utils/realTimeSocket';
import { safeTitleCase } from '../../utils/safeUi';

interface AttendanceRecord {
  _id: string;
  employeeName: string;
  employeeEmail?: string;
  department?: string;
  employeeCode?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked: number;
  status: string;
  isLate?: boolean;
  lateMinutes?: number;
  notes?: string;
}

interface ActivityLog {
  _id: string;
  userId: string;
  employeeName: string;
  action: string;
  timestamp: string;
  details: any;
}

export default function AttendanceUnified() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') || 'dashboard') as string;
  
  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const { user, loading: authLoading } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [_activityLogs, _setActivityLogs] = useState<ActivityLog[]>([]);
  const [_loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    rate: 0
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [attendancePage, setAttendancePage] = useState(1);
  const [_attendancePageSize, _setAttendancePageSize] = useState(10);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [_employees, _setEmployees] = useState<any[]>([]);
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    if (exportStartDate && exportEndDate) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setExportStartDate(fmt(start));
    setExportEndDate(fmt(now));
  }, [exportStartDate, exportEndDate]);

  const fetchGenRef = useRef(0);

  const fetchAttendance = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    try {
      setLoading(true);
      await ensureAccessToken();
      const orgId = resolveAuthOrgId(user) || (await resolveOrgIdForApi(user));
      let url = `/dashboard/todays-attendance?t=${Date.now()}`;
      if (orgId) {
        url = appendOrgIdParam(url, user, orgId);
      }
      const response = await apiGet<{ success?: boolean; data?: AttendanceRecord[]; message?: string }>(
        url,
        false
      );
      if (gen !== fetchGenRef.current) return;
      
      // Check if response indicates success (explicitly true or falsy means successful data response)
      const isSuccessResponse = response?.success !== false;
      
      if (isSuccessResponse) {
        const records = extractApiList<AttendanceRecord>(response);
        setAttendance(records);
        const present = records.filter((r: AttendanceRecord) => r.status === 'present').length;
        const late = records.filter((r: AttendanceRecord) => r.status === 'late').length;
        const absent = records.filter((r: AttendanceRecord) => r.status === 'absent').length;
        const total = records.length || 1;
        setStats({
          present,
          late,
          absent,
          rate: records.length > 0 ? Math.round((present / total) * 100) : 0,
        });
        // Empty state is OK - no error toast needed
      } else {
        // Only show error toast if API explicitly returned failure
        toast.error(response?.message || 'Could not load today\'s attendance');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      // Only show error toast for actual exceptions (network, parsing, etc.)
      const errorMsg = error instanceof Error ? error.message : 'Failed to load today\'s attendance';
      if (errorMsg.toLowerCase().includes('401') || errorMsg.toLowerCase().includes('403')) {
        toast.error('Permission denied. Please check your access rights.');
      } else if (errorMsg.toLowerCase().includes('500')) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error('Failed to load today\'s attendance. Try refreshing.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const authUserKey = user?.userId || user?.id;
    if (authLoading || !authUserKey) return;

    realTimeSocket.connectFromAuth({
      id: String(authUserKey),
      role: user.role,
      orgId: user.orgId || user.tenantId,
      tenantId: user.tenantId || user.orgId,
    });

    fetchAttendance();

    const handleAttendanceUpdate = () => {
      fetchAttendance();
    };

    const unsubAttendance = realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchAttendance();
    }, 60000);

    return () => {
      clearInterval(interval);
      unsubAttendance();
    };
  }, [authLoading, user?.userId, user?.id, user?.role, user?.orgId, user?.tenantId, fetchAttendance]);

  const applyFilter = useCallback(() => {
    setAttendancePage(1);
    if (filterStatus === 'all') {
      setFilteredAttendance(attendance);
    } else {
      setFilteredAttendance(attendance.filter(record => record.status === filterStatus));
    }
  }, [filterStatus, attendance]);

  useEffect(() => {
    applyFilter();
  }, [applyFilter]);

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (new Date(exportStartDate) > new Date(exportEndDate)) {
      toast.error('Start date must be before end date');
      return;
    }

    try {
      setExportLoading(true);
      const response = await apiFetch(
        `attendance/bulk-export?startDate=${exportStartDate}&endDate=${exportEndDate}`,
        {
          method: 'GET',
          skipContentType: true,
          headers: { Accept: 'text/csv, application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${exportStartDate}_to_${exportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Attendance exported successfully');
    } catch (error) {
      console.error('[EXPORT] error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export attendance data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    try {
      setImportLoading(true);
      const text = await file.text();
      const lines = text.split('\n');

      if (lines.length < 2) {
        toast.error('CSV file is empty');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].match(/("([^"]*)"|[^,]+)/g) || [];
        const record: any = {};
        headers.forEach((header, index) => {
          let value = values[index] || '';
          value = value.replace(/^"|"$/g, '').trim();
          record[header] = value;
        });
        records.push({
          employeeId: record['employee id'] || record['employeeid'],
          email: record['email'],
          date: record['date'],
          checkIn: record['check in'] || record['checkin'],
          checkOut: record['check out'] || record['checkout'],
          status: record['status'],
          notes: record['notes']
        });
      }

      if (records.length === 0) {
        toast.error('No valid records found in CSV');
        return;
      }

      const data = await apiPost('/attendance/bulk-import', { records });
      toast.success(`Successfully imported ${data.data.imported} attendance records`);
      await fetchAttendance();
      event.target.value = '';
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import attendance data');
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `Employee Name,Employee Email,Date,Check In Time,Check Out Time,Status,Notes
John Doe,john.doe@company.com,2026-05-05,09:00,17:30,present,Regular day
Jane Smith,jane.smith@company.com,2026-05-05,09:15,17:45,late,Late arrival
Bob Johnson,bob.johnson@company.com,2026-05-05,,,absent,Sick leave`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attendance_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded successfully');
  };

  const formatTime = (value?: string | Date | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'late':
        return 'bg-orange-100 text-orange-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'on-leave':
        return 'bg-blue-100 text-blue-800';
      case 'half-day':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  // Calendar View Helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    let firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const getAttendanceForDate = (day: number) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    let filteredData = attendance.filter(a => {
      const recordDate = new Date(a.date).toISOString().split('T')[0];
      return recordDate === dateStr;
    });
    
    if (selectedEmployee !== 'all') {
      filteredData = filteredData.filter(a => a.employeeName === selectedEmployee);
    }
    
    return filteredData;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  // Render tabs
  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 border-b border-border pb-4 mb-6">
      {[
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'calendar', label: 'Calendar View' },
        { id: 'history', label: 'History' },
        { id: 'import-export', label: 'Import / Export' }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentTab === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">Track employee attendance and manage time sheets</p>
      </div>

      {renderTabs()}

      {/* Dashboard Tab */}
      {currentTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.present}</p>
                  <p className="text-sm text-muted-foreground">Present Today</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.late}</p>
                  <p className="text-sm text-muted-foreground">Late Today</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.absent}</p>
                  <p className="text-sm text-muted-foreground">Absent Today</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.rate}%</p>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background text-sm"
              />
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border rounded-xl bg-background text-sm"
              >
                <option value="all">All Status</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>

          <Card className="rounded-xl">
            <div className="p-6">
              <h3 className="font-semibold mb-4">Today's Attendance ({filteredAttendance.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4">Employee</th>
                      <th className="text-left p-4">Department</th>
                      <th className="text-left p-4">Check In</th>
                      <th className="text-left p-4">Check Out</th>
                      <th className="text-left p-4">Hours</th>
                      <th className="text-left p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-muted-foreground">
                          No records for today
                        </td>
                      </tr>
                    ) : (
                      filteredAttendance.slice((attendancePage - 1) * _attendancePageSize, attendancePage * _attendancePageSize).map((record) => (
                        <tr key={record._id} className="border-b hover:bg-accent/50">
                          <td className="p-4">
                            <p className="font-medium">{record.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{record.employeeEmail}</p>
                          </td>
                          <td className="p-4">{record.department || '—'}</td>
                          <td className="p-4">{formatTime(record.checkIn)}</td>
                          <td className="p-4">{formatTime(record.checkOut)}</td>
                          <td className="p-4">{record.hoursWorked ? record.hoursWorked.toFixed(1) : '0.0'}h</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${statusBadgeClass(record.status)}`}>
                              {safeTitleCase(record.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Calendar Tab */}
      {currentTab === 'calendar' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Select Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full mt-2 px-4 py-2 border rounded-xl bg-background text-sm"
              >
                <option value="all">All Employees</option>
                {_employees.map((emp: any) => (
                  <option key={emp._id} value={emp.userId?.name || emp.name || 'Unknown'}>
                    {emp.userId?.name || emp.name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Month & Year</label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 flex items-center justify-center px-4 py-2 border rounded-xl bg-background">
                  <span className="font-medium">{monthName}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <Card className="p-6 rounded-xl">
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center font-semibold text-sm p-2">
                  {day}
                </div>
              ))}
              {emptyDays.map((_, i) => (
                <div key={`empty-${i}`} className="p-2"></div>
              ))}
              {days.map((day) => {
                const dayAttendance = getAttendanceForDate(day);
                const hasRecords = dayAttendance.length > 0;
                return (
                  <div
                    key={day}
                    className={`p-2 border rounded-lg min-h-20 ${
                      hasRecords ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="font-semibold text-sm mb-1">{day}</div>
                    <div className="space-y-1">
                      {dayAttendance.slice(0, 2).map((record, idx) => (
                        <div
                          key={idx}
                          className={`text-xs px-1 py-0.5 rounded truncate ${getStatusColor(record.status)}`}
                        >
                          {(record.employeeName || 'Unknown').split(/\s+/)[0]}: {record.status || '—'}
                        </div>
                      ))}
                      {dayAttendance.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayAttendance.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* History Tab */}
      {currentTab === 'history' && (
        <Card className="rounded-xl p-6">
          <p className="text-muted-foreground">Navigate to detailed historical records from the Import/Export section or filter the Dashboard tab for specific dates.</p>
        </Card>
      )}

      {/* Import/Export Tab */}
      {currentTab === 'import-export' && (
        <div className="space-y-6">
          <Card className="p-6 rounded-xl">
            <h3 className="text-lg font-semibold mb-4">Export Attendance</h3>
            <div className="flex flex-wrap gap-4 items-center mb-4">
              <div>
                <label className="text-sm font-medium">From Date:</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="mt-2 px-3 py-2 border rounded-lg bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">To Date:</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="mt-2 px-3 py-2 border rounded-lg bg-background text-sm"
                />
              </div>
              <Button
                className="rounded-xl mt-6"
                onClick={handleExport}
                disabled={exportLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                {exportLoading ? 'Exporting...' : 'Export'}
              </Button>
            </div>
          </Card>

          <Card className="p-6 rounded-xl">
            <h3 className="text-lg font-semibold mb-4">Import Attendance</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={downloadTemplate}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={importLoading}
                />
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={importLoading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importLoading ? 'Importing...' : 'Import CSV'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
