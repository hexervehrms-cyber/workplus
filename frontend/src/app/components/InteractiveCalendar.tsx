import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { LeaveRequestService, extractApiList } from '../utils/api';
import {
  buildAndSubmitLeaveRequest,
  formatLocalDateString,
  isLeaveApiSuccess,
} from '../utils/leaveSubmit';
import {
  apiGetSafe,
  appendOrgIdParam,
  holidaysStorageKey,
  resolveAuthOrgId,
} from '../utils/apiHelper';
import realTimeSocket from '../utils/realTimeSocket';
import { useAuth } from '../context/AuthContext';
import { toast } from '../utils/portalToast';

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

export default function InteractiveCalendar() {
  const { user } = useAuth();
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    isHourlyLeave: false,
    reason: ''
  });

  const authUserId = user?.userId || user?.id || '';

  const loadHolidays = useCallback(async () => {
    const year = new Date().getFullYear();
    const holidayRes = await apiGetSafe<{ success?: boolean; data?: Holiday[] }>(
      appendOrgIdParam(`holidays?year=${year}&limit=500`, user, resolveAuthOrgId(user)),
      false
    );
    if (holidayRes.ok && holidayRes.data?.success && Array.isArray(holidayRes.data.data)) {
      setHolidays(holidayRes.data.data);
      const hKey = holidaysStorageKey(authUserId, user?.orgId || user?.tenantId);
      try {
        localStorage.setItem(hKey, JSON.stringify(holidayRes.data.data));
      } catch {
        /* ignore */
      }
      return;
    }
    const hKey = holidaysStorageKey(authUserId, user?.orgId || user?.tenantId);
    try {
      const cached = localStorage.getItem(hKey);
      if (cached) setHolidays(JSON.parse(cached));
    } catch {
      /* ignore */
    }
  }, [authUserId, user]);

  const loadLeaveHistory = useCallback(async () => {
    if (!authUserId) return;
    const leaveResponse = await LeaveRequestService.getLeaveRequestsByUserId(authUserId);
    setLeaveHistory(extractApiList<LeaveRequest>(leaveResponse));
  }, [authUserId]);

  // Fetch leave requests and holidays
  useEffect(() => {
    if (!authUserId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        await Promise.all([loadLeaveHistory(), loadHolidays()]);
      } catch (error) {
        console.error('Error fetching calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [authUserId, loadLeaveHistory, loadHolidays]);

  useEffect(() => {
    const refreshHolidays = () => void loadHolidays();
    realTimeSocket.on('holiday:update', refreshHolidays);
    const unsubLeave = realTimeSocket.onLeaveUpdate(() => void loadLeaveHistory());
    return () => {
      realTimeSocket.off('holiday:update', refreshHolidays);
      unsubLeave();
    };
  }, [loadHolidays, loadLeaveHistory]);

  // Get days in month - helper function that returns days array
  const getDaysInMonth = (date: Date): Array<Date | null> => {
    const year = date.getFullYear();
    const month = date.getMonth();

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<Date | null> = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  };

  // Memoize calendar days array to prevent unnecessary recalculations
  const calendarDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

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

  // Check if day has leave - use normalized date strings for accurate comparison
  const hasLeave = (day: Date) => {
    const dayStr = normalizeDate(day);
    return leaveHistory.some(leave => {
      const startStr = normalizeDate(leave.startDate);
      const endStr = normalizeDate(leave.endDate);
      return dayStr >= startStr && dayStr <= endStr;
    });
  };

  // Get leave status for day - use normalized date strings for accurate comparison
  const getLeaveStatus = (day: Date) => {
    const dayStr = normalizeDate(day);
    const leave = leaveHistory.find(leave => {
      const startStr = normalizeDate(leave.startDate);
      const endStr = normalizeDate(leave.endDate);
      return dayStr >= startStr && dayStr <= endStr;
    });
    return leave?.status;
  };

  // Open leave form
  const openLeaveForm = (day: Date) => {
    const dateStr = formatLocalDateString(day);
    setSelectedDate(dateStr);
    setFormData({
      type: '',
      startDate: dateStr,
      endDate: dateStr,
      startTime: '09:00',
      endTime: '10:00',
      isHourlyLeave: false,
      reason: ''
    });
    setShowLeaveForm(true);
  };

  // Submit leave request
  const handleSubmitLeave = async () => {
    try {
      setSubmittingLeave(true);
      const result = await buildAndSubmitLeaveRequest(user, {
        type: formData.type,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        isHourlyLeave: formData.isHourlyLeave,
        leaveDuration: formData.isHourlyLeave ? 'hourly' : 'full',
        startTime: formData.startTime,
        endTime: formData.endTime,
      });

      if (!result.ok) {
        let msg = result.error || 'Failed to submit leave request';
        if (msg.toLowerCase().includes('route not found')) {
          msg = 'Leave API unavailable — redeploy backend or sign in again.';
        }
        toast.error(msg);
        return;
      }

      const response = result.response;
      const autoApproved =
        isLeaveApiSuccess(response) &&
        !!(
          (response as { data?: { autoApproved?: boolean; leaveRequest?: { autoApproved?: boolean } } })
            ?.data?.autoApproved ||
          (response as { data?: { leaveRequest?: { autoApproved?: boolean } } })?.data?.leaveRequest
            ?.autoApproved
        );
      toast.success(
        autoApproved
          ? 'Leave request was auto-approved by policy'
          : 'Leave request submitted — pending admin approval'
      );
      setShowLeaveForm(false);
      setFormData({
        type: '',
        startDate: '',
        endDate: '',
        startTime: '09:00',
        endTime: '10:00',
        isHourlyLeave: false,
        reason: '',
      });
      await loadLeaveHistory();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit leave request'
      );
    } finally {
      setSubmittingLeave(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Card>
    );
  }

  return (
    <>
      {/* Interactive Calendar */}
      <Card className="p-6 rounded-2xl shadow-lg border-0 bg-gradient-to-br from-background to-muted/20 overflow-visible flex flex-col w-full">
        <div className="space-y-6 flex-1 flex flex-col min-w-0 w-full">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-1 bg-muted/20 rounded-xl border border-foreground/10 flex-shrink-0">
            <h3 className="font-semibold text-lg text-foreground ml-4">Apply Leave</h3>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="rounded-lg hover:bg-primary/10 hover:text-primary transition-colors duration-200 h-9 w-9 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="rounded-lg hover:bg-primary/10 hover:text-primary transition-colors duration-200 h-9 w-9 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Month/Year Display */}
          <div className="text-center flex-shrink-0">
            <h2 className="text-xl font-bold text-foreground">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Click on any available day to request leave
            </p>
          </div>

          {/* Calendar Grid Wrapper - Unified header + body */}
          <div className="w-full rounded-xl border border-foreground/20 bg-background overflow-visible shadow-sm">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-0 bg-muted/30 border-b border-foreground/10">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                <div 
                  key={day} 
                  className={`text-center text-xs font-semibold text-foreground/80 p-3 h-10 flex items-center justify-center ${
                    (idx + 1) % 7 !== 0 ? 'border-r border-foreground/10' : ''
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-0 bg-background">
              {calendarDays.map((day, _index) => {
                const isLastColumn = (_index + 1) % 7 === 0;
                const isLastRow = _index >= calendarDays.length - 7;
                
                if (!day) {
                  return (
                    <div 
                      key={_index} 
                      className={`min-h-[56px] sm:min-h-[64px] xl:min-h-[68px] bg-muted/20 ${
                        !isLastColumn ? 'border-r border-foreground/10' : ''
                      } ${!isLastRow ? 'border-b border-foreground/10' : ''}`} 
                    />
                  );
                }

                const weekend = isWeekend(day);
                const holiday = isHoliday(day);
                const leave = hasLeave(day);
                const leaveStatus = getLeaveStatus(day);
                const holidayInfo = getHolidayForDay(day);
                const tooltipText = holiday && holidayInfo 
                  ? holidayInfo.name 
                  : leave 
                  ? `${(leaveStatus?.charAt(0) ?? '').toUpperCase()}${leaveStatus?.slice(1) ?? ''} Leave`
                  : !weekend && !holiday && !leave 
                  ? 'Click to request leave'
                  : undefined;

                return (
                  <div
  key={formatLocalDateString(day)}
  className={`min-h-[64px] sm:min-h-[72px] xl:min-h-[78px] group overflow-visible ${
    !isLastColumn ? 'border-r border-foreground/10' : ''
  } ${!isLastRow ? 'border-b border-foreground/10' : ''}`}
>
                    <motion.button
                      type="button"
                      onClick={() => !weekend && !holiday && openLeaveForm(day)}
                      disabled={weekend || holiday}
                      title={tooltipText}
                      whileHover={!weekend && !holiday ? { y: -8, scale: 1.04 } : {}}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className={`
                        w-full h-full p-2 text-xs font-medium transition-all duration-200 flex flex-col items-center justify-center relative
                        ${weekend ? 'dark:bg-red-950 dark:text-red-200 bg-red-50 text-red-700 cursor-not-allowed font-semibold' : ''}
                        ${holiday ? 'dark:bg-green-950 dark:text-green-200 bg-green-50 text-green-700 cursor-not-allowed font-semibold' : ''}
                        ${leave && leaveStatus === 'approved' ? 'dark:bg-blue-950 dark:text-blue-200 bg-blue-50 text-blue-700 font-semibold' : ''}
                        ${leave && leaveStatus === 'pending' ? 'dark:bg-yellow-950 dark:text-yellow-200 bg-yellow-50 text-yellow-700 font-semibold' : ''}
                        ${leave && leaveStatus === 'rejected' ? 'dark:bg-red-950 dark:text-red-200 bg-red-50 text-red-700 font-semibold' : ''}
                        ${!weekend && !holiday && !leave ? 'dark:text-foreground dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground cursor-pointer bg-slate-50 hover:bg-primary/5 hover:ring-1 hover:ring-inset hover:ring-primary/30 hover:border-green-300 hover:shadow-[0_18px_45px_rgba(34,197,94,0.22)] dark:hover:border-green-700 dark:hover:bg-green-950/30' : ''}
                        focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30
                      `}
                    >
                      <span className="block">{day.getDate()}</span>
                      
                      {/* Status indicators */}
                      <div className="mt-1 flex gap-1">
                        {leave && (
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            leaveStatus === 'approved' ? 'bg-primary' :
                            leaveStatus === 'pending' ? 'bg-yellow-500' :
                            'bg-destructive'
                          }`} />
                        )}
                        
                        {holiday && (
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        )}
                      </div>
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-foreground/10 flex-shrink-0">
            <h4 className="text-sm font-medium text-foreground mb-3">Legend</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>
                <span className="text-xs text-muted-foreground">Weekend</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <span className="text-xs text-muted-foreground">Holiday</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Approved Leave</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-yellow-100 border border-yellow-200 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                </div>
                <span className="text-xs text-muted-foreground">Pending Leave</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Leave Form Dialog */}
      <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">Request Leave</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedDate && `Submit a new leave request for ${new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-medium text-foreground">Leave Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                <SelectTrigger className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-foreground/20">
                  <SelectItem value="Vacation" className="rounded-lg">Vacation</SelectItem>
                  <SelectItem value="Sick Leave" className="rounded-lg">Sick Leave</SelectItem>
                  <SelectItem value="Casual Leave" className="rounded-lg">Casual Leave</SelectItem>
                  <SelectItem value="Maternity Leave" className="rounded-lg">Maternity Leave</SelectItem>
                  <SelectItem value="Paternity Leave" className="rounded-lg">Paternity Leave</SelectItem>
                  <SelectItem value="Compensatory Off" className="rounded-lg">Compensatory Off (Comp Off)</SelectItem>
                  <SelectItem value="Personal" className="rounded-lg">Personal</SelectItem>
                  <SelectItem value="Emergency" className="rounded-lg">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-foreground/10 mb-2">
              <input 
                type="checkbox" 
                id="hourlyLeave"
                checked={formData.isHourlyLeave}
                onChange={(e) => setFormData({...formData, isHourlyLeave: e.target.checked})}
                className="w-4 h-4 rounded border-foreground/30 cursor-pointer"
              />
              <Label htmlFor="hourlyLeave" className="text-sm font-medium text-foreground cursor-pointer">
                Hourly Leave (1-2 hours)
              </Label>
            </div>
            {formData.isHourlyLeave ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Date</Label>
                    <Input 
                      type="date" 
                      className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value, endDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      From
                    </Label>
                    <Input 
                      type="time" 
                      className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      value={formData.startTime}
                      onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      To
                    </Label>
                    <Input 
                      type="time" 
                      className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      value={formData.endTime}
                      onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">From Date</Label>
                  <Input 
                    type="date" 
                    className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">To Date</Label>
                  <Input 
                    type="date" 
                    className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-foreground">Reason</Label>
              <Textarea 
                className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none" 
                placeholder="Enter reason for leave..." 
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl border-foreground/20 hover:bg-muted/50 transition-all duration-200" 
                onClick={() => {
                  setShowLeaveForm(false);
                  setFormData({ type: '', startDate: '', endDate: '', startTime: '09:00', endTime: '10:00', isHourlyLeave: false, reason: '' });
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                className="flex-1 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl" 
                onClick={handleSubmitLeave}
                disabled={submittingLeave}
              >
                {submittingLeave ? 'Submitting…' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}