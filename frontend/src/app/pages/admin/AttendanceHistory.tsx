import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Loader, Download, Filter, X, Calendar, Clock, Coffee, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { apiGet } from '../../utils/apiHelper';

interface AttendanceRecord {
  _id: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  hoursWorked: number;
  status: string;
  breaks: number;
  isLate: boolean;
  lateMinutes?: number;
}

interface BreakRecord {
  date: string;
  breakType: string;
  startTime: string;
  endTime: string;
  duration: number;
  reason?: string;
}

interface LeaveRecord {
  _id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  reason: string;
  status: string;
  approvalDate?: string;
  approvedBy?: { name: string };
}

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  workFromHomeDays: number;
  onLeaveDays: number;
  lateDays: number;
  totalBreaks: number;
  totalBreakDuration: number;
  totalHoursWorked: number;
  averageHoursPerDay: number;
}

export default function AttendanceHistory() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'breaks' | 'leaves'>('attendance');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Date range filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Data
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [breakRecords, setBreakRecords] = useState<BreakRecord[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const limit = 50;

  // Salary slip modal state
  const [showSalarySlipModal, setShowSalarySlipModal] = useState(false);
  const [salarySlipMonth, setSalarySlipMonth] = useState('');
  const [salarySlipYear, setSalarySlipYear] = useState('');
  const [salarySlipLoading, setSalarySlipLoading] = useState(false);
  const [salarySlipContent, setSalarySlipContent] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await apiGet('/employees?simple=true&limit=1000');
      setEmployees(data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    }
  };

  const fetchAttendanceHistory = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);

      const data = await apiGet(`/attendance-history/employee/${selectedEmployee}?${params}`);

      if (data.success) {
        setAttendanceRecords(data.data || []);
        setTotalRecords(data.total || 0);
        toast.success(`Loaded ${data.data?.length || 0} attendance records`);
      } else {
        toast.error('Failed to fetch attendance history');
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      toast.error('Failed to fetch attendance history');
    } finally {
      setLoading(false);
    }
  };

  const fetchBreakHistory = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/attendance-history/breaks/${selectedEmployee}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBreakRecords(data.breaks || []);
        toast.success(`Loaded ${data.breaks?.length || 0} break records`);
      } else {
        toast.error('Failed to fetch break history');
      }
    } catch (error) {
      console.error('Error fetching break history:', error);
      toast.error('Failed to fetch break history');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceSummary = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/attendance-history/summary/${selectedEmployee}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchLeaveHistory = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(
        `/api/attendance-history/leaves/${selectedEmployee}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLeaveRecords(data.data || []);
        setTotalRecords(data.total || 0);
        toast.success(`Loaded ${data.data?.length || 0} leave records`);
      } else {
        toast.error('Failed to fetch leave history');
      }
    } catch (error) {
      console.error('Error fetching leave history:', error);
      toast.error('Failed to fetch leave history');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    if (activeTab === 'attendance') {
      fetchAttendanceHistory();
    } else if (activeTab === 'breaks') {
      fetchBreakHistory();
    } else if (activeTab === 'leaves') {
      fetchLeaveHistory();
    }
    fetchAttendanceSummary();
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('');
    setPage(1);
    setAttendanceRecords([]);
    setBreakRecords([]);
    setLeaveRecords([]);
    setSummary(null);
  };

  const handleViewSalarySlip = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    if (!salarySlipMonth || !salarySlipYear) {
      toast.error('Please select month and year');
      return;
    }

    try {
      setSalarySlipLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(
        `/api/salary/slip/${selectedEmployee}/${salarySlipMonth}/${salarySlipYear}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSalarySlipContent(data.data);
        toast.success('Salary slip loaded successfully');
      } else if (response.status === 404) {
        toast.error('Salary slip not found for this month');
      } else {
        toast.error('Failed to fetch salary slip');
      }
    } catch (error) {
      console.error('Error fetching salary slip:', error);
      toast.error('Failed to fetch salary slip');
    } finally {
      setSalarySlipLoading(false);
    }
  };

  const handleDownloadSalarySlip = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    if (!salarySlipMonth || !salarySlipYear) {
      toast.error('Please select month and year');
      return;
    }

    try {
      setSalarySlipLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(
        `/api/salary/slip/${selectedEmployee}/${salarySlipMonth}/${salarySlipYear}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const slip = data.data;
        
        // Create blob and download
        const blob = new Blob([slip.htmlContent || salarySlipContent], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `salary-slip-${salarySlipMonth}-${salarySlipYear}.html`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Salary slip downloaded successfully');
      } else {
        toast.error('Failed to download salary slip');
      }
    } catch (error) {
      console.error('Error downloading salary slip:', error);
      toast.error('Failed to download salary slip');
    } finally {
      setSalarySlipLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      let csvContent = '';
      
      if (activeTab === 'attendance') {
        csvContent = 'Date,Check In,Check Out,Hours Worked,Status,Breaks,Late\n';
        attendanceRecords.forEach((record) => {
          const date = new Date(record.date).toLocaleDateString();
          const checkIn = record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : '-';
          const checkOut = record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : '-';
          const hours = record.hoursWorked.toFixed(2);
          const status = record.status;
          const breaks = record.breaks;
          const isLate = record.isLate ? 'Yes' : 'No';
          csvContent += `"${date}","${checkIn}","${checkOut}","${hours}","${status}","${breaks}","${isLate}"\n`;
        });
      } else if (activeTab === 'breaks') {
        csvContent = 'Date,Break Type,Start Time,End Time,Duration (min),Reason\n';
        breakRecords.forEach((record) => {
          const date = new Date(record.date).toLocaleDateString();
          const breakType = record.breakType;
          const startTime = new Date(record.startTime).toLocaleTimeString();
          const endTime = new Date(record.endTime).toLocaleTimeString();
          const duration = record.duration;
          const reason = record.reason || '-';
          csvContent += `"${date}","${breakType}","${startTime}","${endTime}","${duration}","${reason}"\n`;
        });
      } else if (activeTab === 'leaves') {
        csvContent = 'Leave Type,Start Date,End Date,Total Days,Half Day,Reason,Status,Approved By,Approval Date\n';
        leaveRecords.forEach((record) => {
          const leaveType = record.leaveType;
          const startDate = new Date(record.startDate).toLocaleDateString();
          const endDate = new Date(record.endDate).toLocaleDateString();
          const totalDays = record.totalDays;
          const isHalfDay = record.isHalfDay ? 'Yes' : 'No';
          const reason = record.reason;
          const status = record.status;
          const approvedBy = record.approvedBy?.name || '-';
          const approvalDate = record.approvalDate ? new Date(record.approvalDate).toLocaleDateString() : '-';
          csvContent += `"${leaveType}","${startDate}","${endDate}","${totalDays}","${isHalfDay}","${reason}","${status}","${approvedBy}","${approvalDate}"\n`;
        });
      }

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${activeTab}-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'half-day':
        return 'bg-yellow-100 text-yellow-800';
      case 'work-from-home':
        return 'bg-blue-100 text-blue-800';
      case 'on-leave':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBreakTypeColor = (breakType: string) => {
    switch (breakType) {
      case 'regular':
        return 'bg-green-100 text-green-800';
      case 'meal':
        return 'bg-orange-100 text-orange-800';
      case 'emergency':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const summaryData = summary ? [
    { name: 'Present', value: summary.presentDays, fill: '#10b981' },
    { name: 'Absent', value: summary.absentDays, fill: '#ef4444' },
    { name: 'Half Day', value: summary.halfDays, fill: '#f59e0b' },
    { name: 'WFH', value: summary.workFromHomeDays, fill: '#3b82f6' },
    { name: 'Leave', value: summary.onLeaveDays, fill: '#8b5cf6' }
  ] : [];

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Attendance History</h1>
        <p className="text-muted-foreground">View complete attendance, break, and leave history with custom date range filtering</p>
      </div>

      {/* Employee Selection and Filters */}
      <Card className="p-6 rounded-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="rounded-lg mt-2">
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg mt-2"
              />
            </div>

            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg mt-2"
              />
            </div>

            {activeTab === 'attendance' && (
              <div>
                <Label>Status Filter</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-lg mt-2">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="half-day">Half Day</SelectItem>
                    <SelectItem value="work-from-home">Work From Home</SelectItem>
                    <SelectItem value="on-leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={handleSearch} className="rounded-lg">
              <Filter className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button onClick={handleReset} variant="outline" className="rounded-lg">
              <X className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Dialog open={showSalarySlipModal} onOpenChange={setShowSalarySlipModal}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-lg">
                  <Eye className="w-4 h-4 mr-2" />
                  View Salary Slip
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>View Salary Slip</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Month</Label>
                      <Select value={salarySlipMonth} onValueChange={setSalarySlipMonth}>
                        <SelectTrigger className="rounded-lg mt-2">
                          <SelectValue placeholder="Select month..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01">January</SelectItem>
                          <SelectItem value="02">February</SelectItem>
                          <SelectItem value="03">March</SelectItem>
                          <SelectItem value="04">April</SelectItem>
                          <SelectItem value="05">May</SelectItem>
                          <SelectItem value="06">June</SelectItem>
                          <SelectItem value="07">July</SelectItem>
                          <SelectItem value="08">August</SelectItem>
                          <SelectItem value="09">September</SelectItem>
                          <SelectItem value="10">October</SelectItem>
                          <SelectItem value="11">November</SelectItem>
                          <SelectItem value="12">December</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Year</Label>
                      <Select value={salarySlipYear} onValueChange={setSalarySlipYear}>
                        <SelectTrigger className="rounded-lg mt-2">
                          <SelectValue placeholder="Select year..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024">2024</SelectItem>
                          <SelectItem value="2025">2025</SelectItem>
                          <SelectItem value="2026">2026</SelectItem>
                          <SelectItem value="2027">2027</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {salarySlipContent && (
                    <div className="border border-border rounded-lg p-4 bg-muted/50 max-h-96 overflow-y-auto">
                      <div dangerouslySetInnerHTML={{ __html: salarySlipContent }} />
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={handleViewSalarySlip}
                      disabled={salarySlipLoading || !salarySlipMonth || !salarySlipYear}
                      className="rounded-lg"
                    >
                      {salarySlipLoading ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleDownloadSalarySlip}
                      disabled={salarySlipLoading || !salarySlipMonth || !salarySlipYear || !salarySlipContent}
                      variant="outline"
                      className="rounded-lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={handleExport} variant="outline" className="rounded-lg ml-auto" disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'attendance'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Attendance History
        </button>
        <button
          onClick={() => setActiveTab('breaks')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'breaks'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Break History
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'leaves'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Leave History
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Present Days</p>
            <p className="text-2xl font-bold text-green-600">{summary.presentDays}</p>
          </Card>
          <Card className="p-4 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Absent Days</p>
            <p className="text-2xl font-bold text-red-600">{summary.absentDays}</p>
          </Card>
          <Card className="p-4 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Late Days</p>
            <p className="text-2xl font-bold text-orange-600">{summary.lateDays}</p>
          </Card>
          <Card className="p-4 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Total Breaks</p>
            <p className="text-2xl font-bold text-blue-600">{summary.totalBreaks}</p>
          </Card>
          <Card className="p-4 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Avg Hours/Day</p>
            <p className="text-2xl font-bold text-purple-600">{summary.averageHoursPerDay}h</p>
          </Card>
        </div>
      )}

      {/* Summary Chart */}
      {summary && summaryData.length > 0 && (
        <Card className="p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Attendance Summary</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={summaryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {summaryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Attendance Records Table */}
      {activeTab === 'attendance' && (
        <Card className="p-6 rounded-2xl overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Attendance Records</h3>
            <p className="text-sm text-muted-foreground">{totalRecords} total records</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : attendanceRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Check In</th>
                    <th className="text-left py-3 px-4 font-semibold">Check Out</th>
                    <th className="text-left py-3 px-4 font-semibold">Hours Worked</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Breaks</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((record) => (
                    <tr key={record._id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString() : '-'}
                      </td>
                      <td className="py-3 px-4">{record.hoursWorked.toFixed(2)}h</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Coffee className="w-4 h-4" />
                          {record.breaks}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records found
            </div>
          )}
        </Card>
      )}

      {/* Break Records Table */}
      {activeTab === 'breaks' && (
        <Card className="p-6 rounded-2xl overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Break History</h3>
            <p className="text-sm text-muted-foreground">{breakRecords.length} total breaks</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : breakRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Break Type</th>
                    <th className="text-left py-3 px-4 font-semibold">Start Time</th>
                    <th className="text-left py-3 px-4 font-semibold">End Time</th>
                    <th className="text-left py-3 px-4 font-semibold">Duration</th>
                    <th className="text-left py-3 px-4 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {breakRecords.map((record, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <Badge className={getBreakTypeColor(record.breakType)}>
                          {record.breakType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{new Date(record.startTime).toLocaleTimeString()}</td>
                      <td className="py-3 px-4">{new Date(record.endTime).toLocaleTimeString()}</td>
                      <td className="py-3 px-4">{record.duration} min</td>
                      <td className="py-3 px-4">{record.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No break records found
            </div>
          )}
        </Card>
      )}

      {/* Leave History Tab */}
      {activeTab === 'leaves' && (
        <Card className="p-6 rounded-2xl overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Leave History</h3>
            <p className="text-sm text-muted-foreground">{totalRecords} total leave records</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : leaveRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold">Leave Type</th>
                    <th className="text-left py-3 px-4 font-semibold">Start Date</th>
                    <th className="text-left py-3 px-4 font-semibold">End Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Total Days</th>
                    <th className="text-left py-3 px-4 font-semibold">Reason</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRecords.map((record) => (
                    <tr key={record._id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(record.leaveType)}>
                          {record.leaveType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{new Date(record.startDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{new Date(record.endDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {record.totalDays} {record.isHalfDay ? '(Half)' : ''}
                      </td>
                      <td className="py-3 px-4">{record.reason}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{record.approvedBy?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No leave records found
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
