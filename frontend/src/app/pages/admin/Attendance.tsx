import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Clock, Search, Filter, Calendar, CheckCircle, AlertCircle, Activity, Coffee, Users, LogIn, LogOut, Upload, Download, FileSpreadsheet, Eye, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { apiClient } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import { apiGet, apiPost, buildApiUrl, getBearerToken } from '../../utils/apiHelper';
import { TokenManager } from '../../utils/api';
import realTimeSocket from '../../utils/realTimeSocket';

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
  breaks?: Array<{
    startTime: string;
    endTime?: string;
    duration?: number;
    breakType?: string;
  }>;
  meetings?: Array<{
    startTime: string;
    endTime?: string;
    duration?: number;
    title?: string;
    type?: string;
  }>;
}

interface ActivityLog {
  _id: string;
  userId: string;
  employeeName: string;
  action: string;
  timestamp: string;
  details: any;
  ipAddress?: string;
  deviceInfo?: any;
}

export default function AttendanceAdmin() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [activeTab] = useState<'activity'>('activity');
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [stats, setStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    rate: 0
  });
  const [exportPeriod, setExportPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [activityStartDate, setActivityStartDate] = useState<string>('');
  const [activityEndDate, setActivityEndDate] = useState<string>('');
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [lateEmployees, setLateEmployees] = useState<any[]>([]);
  const [lateEmployeesLoading, setLateEmployeesLoading] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewRecord, setViewRecord] = useState<AttendanceRecord | null>(null);
  const [viewTitle, setViewTitle] = useState('Attendance details');

  useEffect(() => {
    fetchAttendance();
    fetchActivityLogs(activityStartDate || undefined, activityEndDate || undefined);

    const handleAttendanceUpdate = () => {
      fetchAttendance();
      fetchActivityLogs(activityStartDate || undefined, activityEndDate || undefined);
    };

    const unsubAttendance = realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);
    const unsubBreakStart = realTimeSocket.onBreakStarted(handleAttendanceUpdate);
    const unsubBreakEnd = realTimeSocket.onBreakEnded(handleAttendanceUpdate);
    const unsubMeetingStart = realTimeSocket.onMeetingStarted(handleAttendanceUpdate);
    const unsubMeetingEnd = realTimeSocket.onMeetingEnded(handleAttendanceUpdate);
    const unsubKpi = realTimeSocket.onKPIUpdate(handleAttendanceUpdate);

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchAttendance();
      fetchActivityLogs();
    }, 60000);

    return () => {
      clearInterval(interval);
      unsubAttendance();
      unsubBreakStart();
      unsubBreakEnd();
      unsubMeetingStart();
      unsubMeetingEnd();
      unsubKpi();
    };
  }, []);

  // Separate function declarations for reuse
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      
      // Debug authentication
      const token = getBearerToken();
      console.log('Current token:', token ? token.substring(0, 50) + '...' : 'No token');
      console.log('User data:', localStorage.getItem('user'));
      
      // Fetch today's attendance
      console.log('Fetching attendance records...');
      const response = await apiClient.get(`/dashboard/todays-attendance?t=${Date.now()}`);
      console.log('Attendance response:', response);
      if (response?.success) {
        const records = response.data || [];
        console.log('Setting attendance records:', records);
        setAttendance(records);
        
        // Calculate stats
        const present = records.filter((r: AttendanceRecord) => r.status === 'present').length;
        const late = records.filter((r: AttendanceRecord) => r.status === 'late').length;
        const absent = records.filter((r: AttendanceRecord) => r.status === 'absent').length;
        const total = records.length || 1;
        
        setStats({
          present,
          late,
          absent,
          rate: Math.round((present / total) * 100)
        });
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async (startDate?: string, endDate?: string) => {
    try {
      setLogsLoading(true);
      const params: Record<string, string> = { limit: '500', t: String(Date.now()) };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const qs = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/attendance/activity-logs?${qs}`);
      if (response?.success) {
        setActivityLogs(response.data || []);
      } else {
        setActivityLogs([]);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      setActivityLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Export attendance data
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

      const apiUrl = buildApiUrl(`/attendance/bulk-export?startDate=${exportStartDate}&endDate=${exportEndDate}`);
      const token = TokenManager.get();

      const headers: HeadersInit = { 'Accept': 'text/csv, application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        let msg = `Export failed (${response.status})`;
        try {
          const body = await response.json();
          msg = body.message || msg;
        } catch { /* ignore */ }
        throw new Error(msg);
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

  // Import attendance data
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    try {
      setImportLoading(true);
      
      // Parse CSV file
      const text = await file.text();
      const lines = text.split('\n');
      
      if (lines.length < 2) {
        toast.error('CSV file is empty');
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      
      // Parse records
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Simple CSV parsing (handles quoted fields)
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

      // Call the new bulk-import endpoint
      const data = await apiPost('/attendance/bulk-import', { records });
      
      toast.success(`Successfully imported ${data.data.imported} attendance records${data.data.failed > 0 ? `, ${data.data.failed} failed` : ''}`);
      
      if (data.data.errors && data.data.errors.length > 0) {
        console.log('Import errors:', data.data.errors);
        // Show first few errors
        const errorMessages = data.data.errors.slice(0, 3).map(e => `Row ${e.row}: ${e.error}`).join('\n');
        toast.error(`Some records failed:\n${errorMessages}`);
      }
      
      // Refresh the attendance data
      await fetchAttendance();
      await fetchActivityLogs();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import attendance data');
    } finally {
      setImportLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Fetch late employees today
  const fetchLateEmployees = async () => {
    try {
      setLateEmployeesLoading(true);
      const response = await apiClient.get('/attendance/late-today');
      if (response?.success) {
        setLateEmployees(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching late employees:', error);
      // Don't show error toast as this is optional
    } finally {
      setLateEmployeesLoading(false);
    }
  };

  // Fetch late employees when component mounts
  useEffect(() => {
    fetchLateEmployees();
    const interval = setInterval(fetchLateEmployees, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Filtered activity logs (search)
  const filteredActivityLogs = activitySearch.trim()
    ? activityLogs.filter((log) => {
        const q = activitySearch.trim().toLowerCase();
        return (
          log.employeeName?.toLowerCase().includes(q) ||
          log.action?.toLowerCase().includes(q) ||
          log.details?.breakType?.toLowerCase().includes(q) ||
          log.details?.meetingTitle?.toLowerCase().includes(q)
        );
      })
    : activityLogs;

  // Filter attendance data
  const applyFilter = () => {
    if (filterStatus === 'all') {
      setFilteredAttendance(attendance);
    } else {
      setFilteredAttendance(attendance.filter(record => record.status === filterStatus));
    }
  };

  // Update filtered attendance when attendance or filter status changes
  useEffect(() => {
    applyFilter();
  }, [attendance, filterStatus]);

  const formatTime = (value?: string | Date | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB');
  };

  const mapApiAttendance = (r: Record<string, unknown>, fallbackName?: string): AttendanceRecord => ({
    _id: String(r._id),
    employeeName: String(r.employeeName || (r.userId as { name?: string })?.name || fallbackName || 'Employee'),
    employeeEmail: (r.employeeEmail as string) || (r.userId as { email?: string })?.email,
    department: (r.department as string) || (r.employeeId as { department?: string })?.department,
    employeeCode: (r.employeeId as { employeeCode?: string })?.employeeCode,
    date: String(r.date || ''),
    checkIn: r.checkIn as string | undefined,
    checkOut: r.checkOut as string | undefined,
    hoursWorked: Number(r.hoursWorked) || 0,
    status: String(r.status || 'present'),
    isLate: Boolean(r.isLate),
    lateMinutes: Number(r.lateMinutes) || 0,
    notes: r.notes as string | undefined,
    breaks: (r.breaks as AttendanceRecord['breaks']) || [],
    meetings: (r.meetings as AttendanceRecord['meetings']) || [],
  });

  const openViewRecord = async (record: AttendanceRecord) => {
    setViewOpen(true);
    setViewTitle(`${record.employeeName} — ${formatDate(record.date)}`);
    setViewRecord(record);
    setViewLoading(true);
    try {
      const res = await apiClient.get<AttendanceRecord>(`/attendance/record/${record._id}`);
      if (res?.success && res.data) {
        setViewRecord(mapApiAttendance(res.data as unknown as Record<string, unknown>, record.employeeName));
      }
    } catch (error) {
      console.error('View attendance error:', error);
    } finally {
      setViewLoading(false);
    }
  };

  const openViewFromLog = async (log: ActivityLog) => {
    const day = new Date(log.timestamp);
    const dateStr = day.toISOString().split('T')[0];
    setViewOpen(true);
    setViewTitle(`${log.employeeName} — ${formatDate(day)}`);
    setViewLoading(true);
    setViewRecord(null);
    try {
      if (!log.userId) {
        toast.error('Employee not linked to this log');
        return;
      }
      const qs = new URLSearchParams({
        userId: String(log.userId),
        startDate: dateStr,
        endDate: dateStr,
        limit: '5',
      }).toString();
      const res = await apiClient.get<AttendanceRecord[]>(`/attendance?${qs}`);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (rows.length > 0) {
        const mapped = mapApiAttendance(rows[0] as unknown as Record<string, unknown>, log.employeeName);
        const detail = await apiClient.get<AttendanceRecord>(`/attendance/record/${mapped._id}`);
        if (detail?.success && detail.data) {
          setViewRecord(mapApiAttendance(detail.data as unknown as Record<string, unknown>, log.employeeName));
        } else {
          setViewRecord(mapped);
        }
      } else {
        toast.info('No attendance sheet for this day — showing activity only');
        setViewRecord({
          _id: log._id,
          employeeName: log.employeeName,
          date: dateStr,
          hoursWorked: log.details?.hoursWorked ?? 0,
          status: log.details?.isLate ? 'late' : 'present',
          isLate: log.details?.isLate,
          lateMinutes: log.details?.minutesLate,
          breaks: [],
          meetings: [],
        });
      }
    } catch (error) {
      console.error('View from log error:', error);
    } finally {
      setViewLoading(false);
    }
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

  // Download sample CSV template
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance Dashboard</h1>
          <p className="text-muted-foreground">Track employee attendance and time sheets - Updated with Live Activity</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={downloadTemplate}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">From:</label>
            <input
              type="date"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background text-sm"
            />
            <label className="text-sm font-medium">To:</label>
            <input
              type="date"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background text-sm"
            />
            <Button 
              variant="outline" 
              className="rounded-xl"
              onClick={handleExport}
              disabled={exportLoading || !exportStartDate || !exportEndDate}
            >
              <Download className="w-4 h-4 mr-2" />
              {exportLoading ? 'Exporting...' : 'Export'}
            </Button>
          </div>
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
              {importLoading ? 'Importing...' : 'Import Data'}
            </Button>
          </div>
          <Button className="rounded-xl" onClick={() => navigate('/admin/attendance-calendar')}>
            <Calendar className="w-4 h-4 mr-2" />
            View Calendar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-muted rounded-xl p-1">
          <Button variant="default" size="sm" className="rounded-lg">
            <Activity className="w-4 h-4 mr-2" />
            Live Activity
          </Button>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activity logs..."
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background text-sm"
          />
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-muted-foreground">From:</label>
          <input
            type="date"
            value={activityStartDate}
            onChange={(e) => setActivityStartDate(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          />
          <label className="text-sm font-medium text-muted-foreground">To:</label>
          <input
            type="date"
            value={activityEndDate}
            onChange={(e) => setActivityEndDate(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => fetchActivityLogs(activityStartDate || undefined, activityEndDate || undefined)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
          {(activityStartDate || activityEndDate) && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl text-xs"
              onClick={() => {
                setActivityStartDate('');
                setActivityEndDate('');
                fetchActivityLogs();
              }}
            >
              Clear
            </Button>
          )}
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

      {/* Late Today Section */}
      <Card className="rounded-xl">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Today&apos;s Attendance ({filteredAttendance.length})
            </h3>
            <p className="text-sm text-muted-foreground">Daily check-in summary — click View for full details</p>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background text-sm min-w-[140px]"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="on-leave">On Leave</option>
            <option value="half-day">Half Day</option>
          </select>
        </div>
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
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Loading attendance…
                  </td>
                </tr>
              ) : filteredAttendance.length > 0 ? (
                filteredAttendance.map((record) => (
                  <tr key={record._id} className="border-b hover:bg-accent/50">
                    <td className="p-4">
                      <p className="font-medium text-sm">{record.employeeName}</p>
                      {record.employeeEmail && (
                        <p className="text-xs text-muted-foreground">{record.employeeEmail}</p>
                      )}
                    </td>
                    <td className="p-4 text-sm">{record.department || '—'}</td>
                    <td className="p-4 text-sm">{formatTime(record.checkIn)}</td>
                    <td className="p-4 text-sm">{formatTime(record.checkOut)}</td>
                    <td className="p-4 text-sm font-medium">{record.hoursWorked?.toFixed(1) ?? '0.0'}h</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${statusBadgeClass(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => openViewRecord(record)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No attendance records for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {lateEmployees.length > 0 && (
        <Card className="rounded-xl mb-6 border-orange-200 bg-orange-50">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Late Today ({lateEmployees.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lateEmployees.map((employee, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{employee.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        Check-in: {new Date(employee.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                      {employee.lateMinutes} min late
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Shift starts: {employee.shiftStartTime}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card className="rounded-xl">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Attendance Activity ({filteredActivityLogs.length} logs)
            </h3>
            <p className="text-sm text-muted-foreground">Real-time employee check-ins, breaks, and check-outs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Time</th>
                  <th className="text-left p-4">Employee</th>
                  <th className="text-left p-4">Action</th>
                  <th className="text-left p-4">Details</th>
                  <th className="text-left p-4">Location</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivityLogs.length > 0 ? (
                  filteredActivityLogs.map((log) => (
                    <tr key={log._id} className="border-b hover:bg-accent/50">
                      <td className="p-4">
                        <p className="font-medium">{new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleDateString()}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium">{log.employeeName.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{log.employeeName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {log.action === 'attendance_checkin' && <LogIn className="w-4 h-4 text-green-600" />}
                          {log.action === 'attendance_checkout' && <LogOut className="w-4 h-4 text-red-600" />}
                          {log.action === 'attendance_break_start' && <Coffee className="w-4 h-4 text-orange-600" />}
                          {log.action === 'attendance_break_end' && <Coffee className="w-4 h-4 text-blue-600" />}
                          {log.action === 'attendance_meeting_start' && <Users className="w-4 h-4 text-purple-600" />}
                          {log.action === 'attendance_meeting_end' && <Users className="w-4 h-4 text-gray-600" />}
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            log.action === 'attendance_checkin' ? 'bg-green-100 text-green-800' :
                            log.action === 'attendance_checkout' ? 'bg-red-100 text-red-800' :
                            log.action.includes('break') ? 'bg-orange-100 text-orange-800' :
                            log.action.includes('meeting') ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action.replace('attendance_', '').replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {log.details?.isLate && (
                            <p className="text-yellow-600 font-medium">Late by {log.details.minutesLate} minutes</p>
                          )}
                          {log.details?.breakType && (
                            <p className="text-muted-foreground">Break type: {log.details.breakType}</p>
                          )}
                          {log.details?.meetingTitle && (
                            <p className="text-muted-foreground">Meeting: {log.details.meetingTitle}</p>
                          )}
                          {log.details?.duration && (
                            <p className="text-muted-foreground">Duration: {log.details.duration} minutes</p>
                          )}
                          {log.details?.hoursWorked && (
                            <p className="text-muted-foreground">Total hours: {log.details.hoursWorked.toFixed(1)}h</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-muted-foreground">
                          {log.ipAddress && <p>IP: {log.ipAddress}</p>}
                          {log.deviceInfo?.type && <p>Device: {log.deviceInfo.type}</p>}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => openViewFromLog(log)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {logsLoading ? 'Loading activity logs…' : activitySearch || activityStartDate || activityEndDate ? 'No logs match your filter.' : 'No activity logged today.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTitle}</DialogTitle>
            <DialogDescription>Full attendance record for this employee</DialogDescription>
          </DialogHeader>

          {viewLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading…
            </div>
          ) : viewRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Employee</p>
                  <p className="font-medium">{viewRecord.employeeName}</p>
                  {viewRecord.employeeEmail && (
                    <p className="text-xs text-muted-foreground">{viewRecord.employeeEmail}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Department</p>
                  <p className="font-medium">{viewRecord.department || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date</p>
                  <p className="font-medium">{formatDate(viewRecord.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full capitalize ${statusBadgeClass(viewRecord.status)}`}>
                    {viewRecord.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Check in</p>
                  <p className="font-medium">{formatTime(viewRecord.checkIn)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Check out</p>
                  <p className="font-medium">{formatTime(viewRecord.checkOut)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Hours worked</p>
                  <p className="font-medium">{viewRecord.hoursWorked?.toFixed(1) ?? '0.0'}h</p>
                </div>
                {viewRecord.isLate && (
                  <div>
                    <p className="text-muted-foreground text-xs">Late</p>
                    <p className="font-medium text-orange-700">{viewRecord.lateMinutes ?? 0} min</p>
                  </div>
                )}
              </div>

              {viewRecord.breaks && viewRecord.breaks.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Coffee className="w-4 h-4" />
                    Breaks ({viewRecord.breaks.length})
                  </p>
                  <div className="rounded-lg border divide-y text-sm">
                    {viewRecord.breaks.map((b, i) => (
                      <div key={i} className="px-3 py-2 flex justify-between gap-2">
                        <span className="capitalize">{b.breakType || 'regular'}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatTime(b.startTime)} – {b.endTime ? formatTime(b.endTime) : 'ongoing'}
                          {b.duration != null ? ` (${b.duration}m)` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewRecord.meetings && viewRecord.meetings.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Meetings ({viewRecord.meetings.length})
                  </p>
                  <div className="rounded-lg border divide-y text-sm">
                    {viewRecord.meetings.map((m, i) => (
                      <div key={i} className="px-3 py-2">
                        <p className="font-medium">{m.title || 'Meeting'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(m.startTime)} – {m.endTime ? formatTime(m.endTime) : 'ongoing'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewRecord.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs mb-1">Notes</p>
                  <p className="bg-muted/50 rounded-lg p-3">{viewRecord.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No attendance details available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
