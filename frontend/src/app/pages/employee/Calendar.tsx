import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { LeaveRequestService } from '../../utils/api';
import {
  apiDelete,
  apiGet,
  apiPost,
  appendOrgIdParam,
  getBearerToken,
  holidaysStorageKey,
  resolveAuthOrgId,
} from '../../utils/apiHelper';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';

interface LeaveRequest {
  _id: string;
  type: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  days?: number;
}

interface Holiday {
  _id?: string;
  id?: string;
  date: string;
  name: string;
  description?: string;
}

export default function Calendar() {
  const { user } = useAuth();
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [formData, setFormData] = useState({
    type: '',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [holidayForm, setHolidayForm] = useState({
    date: '',
    name: '',
    description: ''
  });

  // Fetch leave requests and holidays
  useEffect(() => {
    const fetchData = async () => {
      const authUserId = user?.userId || user?.id;
      if (!authUserId) return;
      
      try {
        setLoading(true);
        
        // Fetch leave requests
        const leaveResponse = await LeaveRequestService.getLeaveRequestsByUserId(authUserId);
        if (leaveResponse.success && leaveResponse.data) {
          setLeaveHistory(leaveResponse.data);
        }

        // Fetch holidays with proper error handling
        const token = getBearerToken();
        if (!token) {
          console.warn('No auth token found for holiday fetch');
          return;
        }

        const holidayYear = new Date().getFullYear();
        const holidayData = await apiGet<{ success?: boolean; data?: unknown[] }>(
          appendOrgIdParam(`holidays?year=${holidayYear}&limit=500`, user, resolveAuthOrgId(user)),
          false
        );
        if (holidayData?.success && Array.isArray(holidayData.data)) {
          console.log('✅ Loaded holidays:', holidayData.data.length, 'holidays');
          setHolidays(holidayData.data);
          const hKey = holidaysStorageKey(user?.id, user?.orgId || user?.tenantId);
          localStorage.setItem(hKey, JSON.stringify(holidayData.data));
        } else {
          console.warn('Holiday fetch returned no data');
          // Try to use cached holidays
          const hKey = holidaysStorageKey(user?.id, user?.orgId || user?.tenantId);
          const cachedHolidays = localStorage.getItem(hKey);
          if (cachedHolidays) {
            try {
              const parsed = JSON.parse(cachedHolidays);
              console.log('📦 Using cached holidays:', parsed.length);
              setHolidays(parsed);
            } catch (e) {
              console.warn('Failed to parse cached holidays');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Listen for real-time holiday updates via Socket.IO (sync subscribe so cleanup always runs)
  useEffect(() => {
    const refreshHolidays = async () => {
      try {
        const token = getBearerToken();
        if (!token) return;

        const holidayYear = new Date().getFullYear();
        const holidayData = await apiGet<{ success?: boolean; data?: unknown[] }>(
          appendOrgIdParam(`holidays?year=${holidayYear}&limit=500`, user, resolveAuthOrgId(user)),
          false
        );
        if (holidayData?.success && Array.isArray(holidayData.data)) {
          setHolidays(holidayData.data);
          const hKey = holidaysStorageKey(user?.id, user?.orgId || user?.tenantId);
          localStorage.setItem(hKey, JSON.stringify(holidayData.data));
        }
      } catch (error) {
        console.error('Error refreshing holidays:', error);
      }
    };

    const unsubscribe = realTimeSocket.on('holiday:update', refreshHolidays);
    return () => {
      unsubscribe();
    };
  }, []);

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  // Check if day is a weekend (1st/3rd Saturday or Sunday)
  const isWeekend = (day: Date) => {
    const dayOfWeek = day.getDay();
    
    // Sunday is always weekend
    if (dayOfWeek === 0) return true;
    
    // Saturday - check if 1st or 3rd
    if (dayOfWeek === 6) {
      const dateOfMonth = day.getDate();
      const saturdayCount = Math.ceil(dateOfMonth / 7);
      return saturdayCount === 1 || saturdayCount === 3;
    }
    
    return false;
  };

  // Normalize date to YYYY-MM-DD format (local timezone)
  const normalizeDate = (date: Date | string): string => {
    let d: Date;
    if (typeof date === 'string') {
      // If it's already a string, parse it
      d = new Date(date);
    } else {
      d = date;
    }
    
    // Use local date components to avoid timezone issues
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if day is a holiday
  const isHoliday = (day: Date) => {
    const dateStr = normalizeDate(day);
    return holidays.some(h => {
      const holidayDate = normalizeDate(h.date);
      return holidayDate === dateStr;
    });
  };

  // Get holiday for a day
  const getHolidayForDay = (day: Date) => {
    const dateStr = normalizeDate(day);
    return holidays.find(h => {
      const holidayDate = normalizeDate(h.date);
      return holidayDate === dateStr;
    });
  };

  // Check if day has leave
  const hasLeave = (day: Date) => {
    return leaveHistory.some(leave => {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      return day >= startDate && day <= endDate;
    });
  };

  // Get leave status for day
  const getLeaveStatus = (day: Date) => {
    const leave = leaveHistory.find(leave => {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      return day >= startDate && day <= endDate;
    });
    return leave?.status;
  };

  // Open leave form
  const openLeaveForm = (day: Date) => {
    const dateStr = day.toISOString().split('T')[0];
    setSelectedDate(dateStr);
    setFormData({
      type: '',
      startDate: dateStr,
      endDate: dateStr,
      reason: ''
    });
    setShowLeaveForm(true);
  };

  // Submit leave request
  const handleSubmitLeave = async () => {
    const authUserId = String(user?.userId || user?.id || '');
    if (!authUserId || !formData.type || !formData.startDate || !formData.endDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { resolveEmployeeMongoId } = await import('../../utils/resolveEmployeeId');
      const employeeId = await resolveEmployeeMongoId(user);
      if (!employeeId) {
        toast.error('Employee profile not found. Please contact HR.');
        return;
      }
      const orgId = resolveAuthOrgId(user);
      if (!orgId) {
        toast.error('Organization not set on your account. Please sign out and sign in again.');
        return;
      }

      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      const leaveData = {
        userId: authUserId,
        employeeId: employeeId,
        leaveType: formData.type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: formData.reason,
        orgId: orgId,
      };

      const response = await LeaveRequestService.createLeaveRequest(leaveData);

      if (response?.success) {
        toast.success('Leave request submitted successfully');
        setShowLeaveForm(false);
        setFormData({ type: '', startDate: '', endDate: '', reason: '' });
        
        const updatedLeaves = await LeaveRequestService.getLeaveRequestsByUserId(authUserId);
        if (updatedLeaves.success && updatedLeaves.data) {
          const raw = updatedLeaves.data as LeaveRequest[] | { data?: LeaveRequest[] };
          setLeaveHistory(Array.isArray(raw) ? raw : raw.data ?? []);
        }
      } else {
        toast.error(response?.message || 'Failed to submit leave request');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      const msg = error instanceof Error ? error.message : 'Failed to submit leave request';
      toast.error(
        msg.toLowerCase().includes('route not found')
          ? 'Leave API unavailable — redeploy backend or sign in again.'
          : msg
      );
    }
  };

  // Add holiday
  const handleAddHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) {
      toast.error('Please fill in date and holiday name');
      return;
    }

    try {
      const orgId = resolveAuthOrgId(user);
      if (!orgId) {
        toast.error('Organization context is required to add holidays');
        return;
      }
      await apiPost(appendOrgIdParam('holidays', user, orgId), {
        orgId,
        date: holidayForm.date,
        name: holidayForm.name,
        description: holidayForm.description,
        type: 'public',
      });

      toast.success('Holiday added successfully');
      setShowHolidayForm(false);
      setHolidayForm({ date: '', name: '', description: '' });

      const holidayYear = holidayForm.date
        ? new Date(holidayForm.date).getFullYear()
        : new Date().getFullYear();
      const holidayData = await apiGet<{ success?: boolean; data?: unknown[] }>(
        appendOrgIdParam(`holidays?year=${holidayYear}&limit=500`, user, orgId),
        false
      );
      if (holidayData?.success && Array.isArray(holidayData.data)) {
        setHolidays(holidayData.data);
      }
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  // Delete holiday
  const handleDeleteHoliday = async (holidayId: string) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;

    try {
      await apiDelete(`holidays/${holidayId}`);
      toast.success('Holiday deleted successfully');
      setHolidays(holidays.filter((h) => (h._id || h.id) !== holidayId));
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Calendar</h1>
          <p className="text-muted-foreground">Click on any day to apply for leave</p>
        </div>
      </div>

      {/* Calendar and Holiday Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Calendar */}
        <Card className="p-6 rounded-2xl lg:col-span-2">
          <div className="space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Apply Leave</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Month/Year Display */}
            <div className="text-center font-semibold">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-0 border border-foreground/40 rounded-lg overflow-hidden bg-muted/50">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                <div 
                  key={day} 
                  className={`text-center text-xs font-semibold text-foreground p-3 border-r border-foreground/40 ${
                    index === 6 ? 'border-r-0' : ''
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-0 border border-foreground/40 rounded-lg overflow-hidden">
              {getDaysInMonth(currentMonth).map((day, index) => {
                if (!day) {
                  return (
                    <div key={index} className="aspect-square p-1 bg-muted/30 border-r border-b border-foreground/40 last:border-r-0" />
                  );
                }

                const weekend = isWeekend(day);
                const holiday = isHoliday(day);
                const leave = hasLeave(day);
                const leaveStatus = getLeaveStatus(day);
                const isLastInRow = (index + 1) % 7 === 0;
                const isLastRow = index >= getDaysInMonth(currentMonth).length - 7;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => !weekend && !holiday && openLeaveForm(day)}
                    disabled={weekend || holiday}
                    title={
                      weekend ? 'Weekend' :
                      holiday ? `Holiday: ${getHolidayForDay(day)?.name}` :
                      'Click to apply leave'
                    }
                    className={`
                      w-full aspect-square p-1 text-xs font-medium transition-all border-r border-b border-foreground/40
                      ${isLastInRow ? 'border-r-0' : ''}
                      ${isLastRow ? 'border-b-0' : ''}
                      ${weekend ? 'bg-red-100 text-red-800 cursor-not-allowed' : ''}
                      ${holiday ? 'bg-green-100 text-green-800 cursor-not-allowed' : ''}
                      ${leave && leaveStatus === 'approved' ? 'bg-primary text-primary-foreground' : ''}
                      ${leave && leaveStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${leave && leaveStatus === 'rejected' ? 'bg-destructive/20 text-destructive' : ''}
                      ${!weekend && !holiday && !leave ? 'text-foreground hover:bg-accent/30 cursor-pointer bg-background' : ''}
                    `}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-2 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-xs text-muted-foreground">Weekend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-muted-foreground">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Approved Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-xs text-muted-foreground">Pending Leave</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Holiday Calendar */}
        <Card className="rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Holidays</h3>
              <p className="text-sm text-muted-foreground">Company holidays</p>
            </div>
            {(user?.role === 'hr' || user?.role === 'admin') && (
              <Button
                size="sm"
                onClick={() => setShowHolidayForm(true)}
                className="rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            )}
          </div>
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {holidays && holidays.length > 0 ? (
              holidays.map((holiday) => (
                <div key={holiday._id || holiday.id} className="p-3 rounded-lg border border-green-200 flex items-center justify-between" style={{ backgroundColor: '#F0FDF4' }}>
                  <div>
                    <p className="font-medium text-sm">{holiday.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {holiday.description && (
                      <p className="text-xs text-muted-foreground mt-1">{holiday.description}</p>
                    )}
                  </div>
                  {(user?.role === 'hr' || user?.role === 'admin') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteHoliday(holiday._id || holiday.id || '')}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No holidays added yet</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Leave Form Dialog */}
      <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              {selectedDate && `Submit a new leave request for ${new Date(selectedDate).toLocaleDateString()}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Leave Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                <SelectTrigger className="rounded-xl mt-2">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vacation">Vacation</SelectItem>
                  <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                  <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                  <SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
                  <SelectItem value="Paternity Leave">Paternity Leave</SelectItem>
                  <SelectItem value="Compensatory Off">Compensatory Off (Comp Off)</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Date</Label>
                <Input 
                  type="date" 
                  className="rounded-xl mt-2"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Input 
                  type="date" 
                  className="rounded-xl mt-2"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea 
                className="rounded-xl mt-2" 
                placeholder="Enter reason for leave..." 
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl" 
                onClick={() => {
                  setShowLeaveForm(false);
                  setFormData({ type: '', startDate: '', endDate: '', reason: '' });
                }}
              >
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleSubmitLeave}>
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Holiday Form Dialog */}
      {(user?.role === 'hr' || user?.role === 'admin') && (
        <Dialog open={showHolidayForm} onOpenChange={setShowHolidayForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Holiday</DialogTitle>
              <DialogDescription>Add a new company holiday</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input 
                  type="date" 
                  className="rounded-xl mt-2"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({...holidayForm, date: e.target.value})}
                />
              </div>
              <div>
                <Label>Holiday Name</Label>
                <Input 
                  type="text" 
                  className="rounded-xl mt-2"
                  placeholder="e.g., Diwali, Christmas"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})}
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea 
                  className="rounded-xl mt-2" 
                  placeholder="Add description..." 
                  rows={2}
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({...holidayForm, description: e.target.value})}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl" 
                  onClick={() => {
                    setShowHolidayForm(false);
                    setHolidayForm({ date: '', name: '', description: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl" onClick={handleAddHoliday}>
                  Add Holiday
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
