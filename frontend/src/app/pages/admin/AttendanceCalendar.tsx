import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { extractApiList } from '../../utils/api';
import { apiGet } from '../../utils/apiHelper';
import { toast } from '../../utils/portalToast';
import { safeTitleCase } from '../../utils/safeUi';

interface AttendanceRecord {
  _id: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  hoursWorked: number;
  status: string;
}

export default function AttendanceCalendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<any[]>([]);
  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsPageSize, setDetailsPageSize] = useState(10);

  useEffect(() => {
    loadAttendanceData();
    loadEmployees();
  }, [currentDate]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0).toISOString();
      
      const response = await apiGet<{ success?: boolean; data?: AttendanceRecord[] }>(
        `/attendance?startDate=${startDate}&endDate=${endDate}&limit=100`
      );
      if (response?.success !== false) {
        setAttendance(extractApiList<AttendanceRecord>(response));
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
      toast.error('Could not load attendance for this month');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await apiGet<{ success?: boolean; data?: unknown[] }>('/employees');
      if (response?.success !== false) {
        setEmployees(extractApiList(response));
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Could not load employees');
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    let firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Convert Sunday (0) to 6, so Monday becomes 0
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setDetailsPage(1);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setDetailsPage(1);
  };

  const getAttendanceForDate = (day: number) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    let filteredAttendance = attendance.filter(a => {
      const recordDate = new Date(a.date).toISOString().split('T')[0];
      return recordDate === dateStr;
    });
    
    if (selectedEmployee !== 'all') {
      filteredAttendance = filteredAttendance.filter(a => a.employeeName === selectedEmployee);
    }
    
    return filteredAttendance;
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance Calendar</h1>
          <p className="text-muted-foreground">View attendance records by calendar</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/attendance')}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Attendance
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Select Employee</label>
          <Select value={selectedEmployee} onValueChange={(val) => {
            setSelectedEmployee(val);
            setDetailsPage(1);
          }}>
            <SelectTrigger className="mt-2 rounded-xl">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp._id} value={emp.userId?.name || emp.name || 'Unknown'}>
                  {emp.userId?.name || emp.name || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium">Month & Year</label>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 flex items-center justify-center px-4 py-2 border rounded-xl bg-background">
              <span className="font-medium">{monthName}</span>
            </div>
            <Button variant="outline" size="sm" onClick={nextMonth}>
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

      {/* Attendance Details Table */}
      <Card className="rounded-xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Attendance Details for {monthName}</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Rows:</label>
              <select
                value={detailsPageSize}
                onChange={(e) => {
                  setDetailsPageSize(Number(e.target.value));
                  setDetailsPage(1);
                }}
                className="px-2 py-1 border rounded-lg bg-background text-sm"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Employee</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Check In</th>
                  <th className="text-left p-4">Check Out</th>
                  <th className="text-left p-4">Hours</th>
                  <th className="text-left p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      
                    </td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No attendance records for this month
                    </td>
                  </tr>
                ) : (() => {
                  const filteredRecords = attendance.filter(record => {
                    if (selectedEmployee === 'all') return true;
                    return record.employeeName === selectedEmployee;
                  });
                  
                  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / detailsPageSize));
                  const paginatedRecords = filteredRecords.slice(
                    (detailsPage - 1) * detailsPageSize,
                    detailsPage * detailsPageSize
                  );
                  
                  return (
                    <>
                      {paginatedRecords.map((record) => (
                        <tr key={record._id} className="border-b hover:bg-accent/50">
                          <td className="p-4">
                            <p className="font-medium">{record.employeeName}</p>
                          </td>
                          <td className="p-4">{new Date(record.date).toLocaleDateString()}</td>
                          <td className="p-4">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td className="p-4">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td className="p-4">{record.hoursWorked ? record.hoursWorked.toFixed(1) : '0.0'}h</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                              {safeTitleCase(record.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
          {(() => {
            const filteredRecords = attendance.filter(record => {
              if (selectedEmployee === 'all') return true;
              return record.employeeName === selectedEmployee;
            });
            const totalPages = Math.max(1, Math.ceil(filteredRecords.length / detailsPageSize));
            return filteredRecords.length > 0 ? (
              <div className="flex items-center justify-between border-t pt-3 mt-3">
                <p className="text-sm text-muted-foreground">
                  Page {detailsPage} of {totalPages} ({filteredRecords.length} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={detailsPage <= 1}
                    onClick={() => setDetailsPage(prev => Math.max(1, prev - 1))}
                    className="rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={detailsPage >= totalPages}
                    onClick={() => setDetailsPage(prev => Math.min(totalPages, prev + 1))}
                    className="rounded-lg"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </Card>
    </div>
  );
}
