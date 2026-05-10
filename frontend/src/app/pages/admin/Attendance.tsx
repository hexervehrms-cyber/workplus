import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Clock, Search, Filter, Calendar, CheckCircle, AlertCircle, Activity, Coffee, Users, LogIn, LogOut, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { apiClient } from '../../utils/api';
import { toast } from 'sonner';
import { apiGet, apiPost, buildFileUrl } from '../../utils/apiHelper';

interface AttendanceRecord {
  _id: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  status: string;
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
  const [activeTab, setActiveTab] = useState<'attendance' | 'activity'>('activity');
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
  const [lateEmployees, setLateEmployees] = useState<any[]>([]);
  const [lateEmployeesLoading, setLateEmployeesLoading] = useState(false);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        
        // Debug authentication
        const token = localStorage.getItem('authToken');
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
        toast.error('Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };

    const fetchActivityLogs = async () => {
      try {
        setLogsLoading(true);
        
        // Fetch today's attendance records (which includes activity)
        console.log('Fetching activity logs...');
        const response = await apiClient.get(`/attendance/today?t=${Date.now()}`);
        console.log('Activity logs response:', response);
        if (response?.success && response.data?.attendance) {
          // Transform attendance data into activity logs format
          const attendance = response.data.attendance;
          const logs: ActivityLog[] = [];
          
          if (attendance.checkIn) {
            logs.push({
              _id: `checkin_${attendance._id}`,
              userId: attendance.userId || '',
              employeeName: attendance.employeeName || 'Unknown',
              action: 'Check In',
              timestamp: attendance.checkIn,
              details: { location: attendance.location || 'Office' }
            });
          }
          
          if (attendance.breaks && Array.isArray(attendance.breaks)) {
            attendance.breaks.forEach((breakItem: any, index: number) => {
              logs.push({
                _id: `break_${attendance._id}_${index}`,
                userId: attendance.userId || '',
                employeeName: attendance.employeeName || 'Unknown',
                action: `${breakItem.breakType || 'Break'} Started`,
                timestamp: breakItem.startTime,
                details: { breakType: breakItem.breakType || 'regular' }
              });
              
              if (breakItem.endTime) {
                logs.push({
                  _id: `break_end_${attendance._id}_${index}`,
                  userId: attendance.userId || '',
                  employeeName: attendance.employeeName || 'Unknown',
                  action: `${breakItem.breakType || 'Break'} Ended`,
                  timestamp: breakItem.endTime,
                  details: { breakType: breakItem.breakType || 'regular' }
                });
              }
            });
          }
          
          if (attendance.checkOut) {
            logs.push({
              _id: `checkout_${attendance._id}`,
              userId: attendance.userId || '',
              employeeName: attendance.employeeName || 'Unknown',
              action: 'Check Out',
              timestamp: attendance.checkOut,
              details: { location: attendance.location || 'Office' }
            });
          }
          
          console.log('Setting activity logs:', logs);
          setActivityLogs(logs);
        }
      } catch (error) {
        console.error('Error fetching activity logs:', error);
        toast.error('Failed to load activity logs');
      } finally {
        setLogsLoading(false);
      }
    };

    fetchAttendance();
    fetchActivityLogs();

    // Set up real-time updates
    const interval = setInterval(() => {
      fetchAttendance();
      fetchActivityLogs();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Separate function declarations for reuse
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      
      // Debug authentication
      const token = localStorage.getItem('authToken');
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
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setLogsLoading(true);
      
      // Fetch today's attendance records (which includes activity)
      console.log('Fetching activity logs...');
      const response = await apiClient.get(`/attendance/today?t=${Date.now()}`);
      console.log('Activity logs response:', response);
      if (response?.success && response.data?.attendance) {
        // Transform attendance data into activity logs format
        const attendance = response.data.attendance;
        const logs: ActivityLog[] = [];
        
        if (attendance.checkIn) {
          logs.push({
            _id: `checkin_${attendance._id}`,
            userId: attendance.userId || '',
            employeeName: attendance.employeeName || 'Unknown',
            action: 'Check In',
            timestamp: attendance.checkIn,
            details: { location: attendance.location || 'Office' }
          });
        }
        
        if (attendance.breaks && Array.isArray(attendance.breaks)) {
          attendance.breaks.forEach((breakItem: any, index: number) => {
            logs.push({
              _id: `break_${attendance._id}_${index}`,
              userId: attendance.userId || '',
              employeeName: attendance.employeeName || 'Unknown',
              action: `${breakItem.breakType || 'Break'} Started`,
              timestamp: breakItem.startTime,
              details: { breakType: breakItem.breakType || 'regular' }
            });
            
            if (breakItem.endTime) {
              logs.push({
                _id: `break_end_${attendance._id}_${index}`,
                userId: attendance.userId || '',
                employeeName: attendance.employeeName || 'Unknown',
                action: `${breakItem.breakType || 'Break'} Ended`,
                timestamp: breakItem.endTime,
                details: { breakType: breakItem.breakType || 'regular' }
              });
            }
          });
        }
        
        if (attendance.checkOut) {
          logs.push({
            _id: `checkout_${attendance._id}`,
            userId: attendance.userId || '',
            employeeName: attendance.employeeName || 'Unknown',
            action: 'Check Out',
            timestamp: attendance.checkOut,
            details: { location: attendance.location || 'Office' }
          });
        }
        
        console.log('Setting activity logs:', logs);
        setActivityLogs(logs);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLogsLoading(false);
    }
  };

  // Export attendance data
  const handleExport = async () => {
    try {
      if (!exportStartDate || !exportEndDate) {
        toast.error('Please select both start and end dates');
        return;
      }

      setExportLoading(true);
      
      const startDate = new Date(exportStartDate);
      const endDate = new Date(exportEndDate);
      
      if (startDate > endDate) {
        toast.error('Start date must be before end date');
        return;
      }
      
      // Call the new bulk-export endpoint
      const fileUrl = buildFileUrl(`/attendance/bulk-export?startDate=${exportStartDate}&endDate=${exportEndDate}`);
      
      const response = await fetch(fileUrl);
      
      if (response.ok) {
        // Get the CSV content
        const csvContent = await response.text();
        
        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_${exportStartDate}_to_${exportEndDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Attendance data exported successfully');
      } else {
        throw new Error('Failed to export');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export attendance data');
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

  // Debug log
  console.log('Rendering with activityLogs:', activityLogs, 'logsLoading:', logsLoading, 'activeTab:', activeTab);

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

      <div className="flex gap-4 items-center">
        <div className="flex bg-muted rounded-xl p-1">
          <Button
            variant={activeTab === 'attendance' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-lg"
            onClick={() => setActiveTab('attendance')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Attendance Records
          </Button>
          <Button
            variant={activeTab === 'activity' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-lg"
            onClick={() => setActiveTab('activity')}
          >
            <Activity className="w-4 h-4 mr-2" />
            Live Activity
          </Button>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={activeTab === 'attendance' ? "Search attendance records..." : "Search activity logs..."}
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
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

      {/* Attendance/Activity Tabs */}
      {activeTab === 'attendance' ? (
        <Card className="rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Employee</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Check In</th>
                  <th className="text-left p-4">Check Out</th>
                  <th className="text-left p-4">Hours</th>
                  <th className="text-left p-4">Breaks</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      Loading attendance records...
                    </td>
                  </tr>
                ) : filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((record) => (
                    <tr key={record._id} className="border-b hover:bg-accent/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{record.employeeName.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium">{record.employeeName}</p>
                            <p className="text-sm text-muted-foreground">{record.employeeName.toLowerCase().replace(/\s+/g, '')}@company.com</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{record.hoursWorked ? record.hoursWorked.toFixed(1) : '0.0'}h</p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {record.breaks && record.breaks.length > 0 ? (
                            record.breaks.map((breakItem, index) => (
                              <div key={index} className="flex items-center gap-1 text-xs">
                                <Coffee className="w-3 h-3 text-orange-500" />
                                <span>{breakItem.duration ? `${breakItem.duration}m` : 'Active'}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No breaks</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          record.status === 'present' ? 'bg-green-100 text-green-800' :
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'absent' ? 'bg-red-100 text-red-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </td>
                      <td className="p-4">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Attendance Activity ({activityLogs.length} logs)
            </h3>
            <p className="text-sm text-muted-foreground">Real-time employee check-ins, breaks, and check-outs</p>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                <strong>Debug:</strong> loading: {loading.toString()}, 
                attendance.length: {attendance.length},
                logsLoading: {logsLoading.toString()}, 
                activityLogs.length: {activityLogs.length},
                activeTab: {activeTab}
              </div>
            )}
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
                </tr>
              </thead>
              <tbody>
                {logsLoading ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Loading activity logs...
                    </td>
                  </tr>
                ) : activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      No activity logs for today
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log) => (
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
