import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Home,
  Briefcase,
  Heart,
  Plane,
  Coffee,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: 'sick' | 'casual' | 'annual' | 'maternity' | 'paternity' | 'emergency';
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'government' | 'company' | 'weekend';
}

const LeaveCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    type: 'casual' as const
  });

  // Check if year is leap year
  const isLeapYear = (year: number) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  };

  // Get Saturdays that are off based on leap year logic
  const getOffSaturdays = (year: number, month: number) => {
    const isLeap = isLeapYear(year);
    const saturdays: number[] = [];
    
    // Get all Saturdays in the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      if (date.getDay() === 6) { // Saturday
        saturdays.push(day);
      }
    }
    
    // In leap year: 2nd and 4th Saturdays are off
    // In regular year: 1st and 3rd Saturdays are off
    const offSaturdays = isLeap 
      ? [saturdays[1], saturdays[3]] // 2nd and 4th (0-indexed)
      : [saturdays[0], saturdays[2]]; // 1st and 3rd (0-indexed)
    
    return offSaturdays.filter(Boolean);
  };

  // Generate holidays for the current month
  const generateHolidays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const offSaturdays = getOffSaturdays(year, month);
    
    const newHolidays: Holiday[] = [];
    
    // Add all Sundays as weekend offs
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      if (date.getDay() === 0) { // Sunday
        newHolidays.push({
          id: `sunday-${year}-${month}-${day}`,
          date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          name: 'Sunday',
          type: 'weekend'
        });
      }
    }
    
    // Add weekend offs for Saturdays
    offSaturdays.forEach(saturday => {
      newHolidays.push({
        id: `saturday-${year}-${month}-${saturday}`,
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(saturday).padStart(2, '0')}`,
        name: 'Saturday Off',
        type: 'weekend'
      });
    });
    
    // Add government holidays (example dates - should be configurable)
    const govHolidays = [
      { date: `${year}-01-01`, name: 'New Year\'s Day' },
      { date: `${year}-01-26`, name: 'Republic Day' },
      { date: `${year}-08-15`, name: 'Independence Day' },
      { date: `${year}-10-02`, name: 'Gandhi Jayanti' },
      { date: `${year}-12-25`, name: 'Christmas' },
    ];
    
    govHolidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      if (holidayDate.getMonth() === month) {
        newHolidays.push({
          id: `gov-${holiday.date}`,
          date: holiday.date,
          name: holiday.name,
          type: 'government'
        });
      }
    });
    
    setHolidays(newHolidays);
  };

  // Get days in month
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startingDayOfWeek = firstDay.getDay();
    // Convert Sunday (0) to 6, so Monday becomes 0
    startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  // Check if a date is a holiday
  const isHoliday = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.find(h => h.date === dateStr);
  };

  // Check if a date has leave request
  const hasLeaveRequest = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaveRequests.find(lr => 
      lr.startDate <= dateStr && lr.endDate >= dateStr
    );
  };

  // Handle leave request submission
  const handleLeaveRequest = () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      return;
    }
    
    const newRequest: LeaveRequest = {
      id: Date.now().toString(),
      employeeId: 'EMP-001', // Should come from auth context
      employeeName: 'John Doe', // Should come from auth context
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      reason: leaveForm.reason,
      type: leaveForm.type,
      status: 'pending',
      appliedAt: new Date().toISOString()
    };
    
    setLeaveRequests([...leaveRequests, newRequest]);
    
    // Notify admin via custom event (in real app, this would be an API call)
    const event = new CustomEvent('newLeaveRequest', { detail: newRequest });
    window.dispatchEvent(event);
    
    // Reset form
    setLeaveForm({
      startDate: '',
      endDate: '',
      reason: '',
      type: 'casual'
    });
    setIsLeaveDialogOpen(false);
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Get leave type icon and color
  const getLeaveTypeInfo = (type: string) => {
    const types = {
      sick: { icon: Heart, color: 'bg-red-100 text-red-800', label: 'Sick Leave' },
      casual: { icon: Coffee, color: 'bg-blue-100 text-blue-800', label: 'Casual Leave' },
      annual: { icon: Briefcase, color: 'bg-green-100 text-green-800', label: 'Annual Leave' },
      maternity: { icon: Home, color: 'bg-purple-100 text-purple-800', label: 'Maternity Leave' },
      paternity: { icon: Home, color: 'bg-indigo-100 text-indigo-800', label: 'Paternity Leave' },
      emergency: { icon: AlertCircle, color: 'bg-orange-100 text-orange-800', label: 'Emergency Leave' }
    };
    return types[type as keyof typeof types] || types.casual;
  };

  useEffect(() => {
    generateHolidays();
  }, [currentDate]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = getDaysInMonth();

  return (
    <Card className="p-6 rounded-2xl">
      <div className="space-y-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-bold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-lg">
                <Calendar className="w-4 h-4 mr-2" />
                Apply Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="leave-type">Leave Type</Label>
                  <Select value={leaveForm.type} onValueChange={(value) => setLeaveForm({...leaveForm, type: value as any})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="annual">Annual Leave</SelectItem>
                      <SelectItem value="maternity">Maternity Leave</SelectItem>
                      <SelectItem value="paternity">Paternity Leave</SelectItem>
                      <SelectItem value="emergency">Emergency Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <input
                    type="date"
                    id="start-date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({...leaveForm, startDate: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <input
                    type="date"
                    id="end-date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({...leaveForm, endDate: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})}
                    placeholder="Enter reason for leave..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleLeaveRequest} className="flex-1">
                    Submit Request
                  </Button>
                  <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            const holiday = day ? isHoliday(day) : null;
            const leaveRequest = day ? hasLeaveRequest(day) : null;
            const isToday = day === new Date().getDate() && 
                          currentDate.getMonth() === new Date().getMonth() && 
                          currentDate.getFullYear() === new Date().getFullYear();
            
            return (
              <div
                key={index}
                className={`
                  min-h-[80px] p-2 border rounded-lg cursor-pointer transition-colors
                  ${!day ? 'bg-muted/20' : 'hover:bg-accent/50'}
                  ${isToday ? 'ring-2 ring-primary' : ''}
                  ${holiday ? 'bg-red-50 border-red-200' : ''}
                  ${leaveRequest ? 'bg-blue-50 border-blue-200' : ''}
                `}
                onClick={() => day && setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              >
                {day && (
                  <>
                    <div className="text-sm font-medium">{day}</div>
                    {holiday && (
                      <div className="mt-1">
                        <Badge variant="destructive" className="text-xs">
                          {holiday.type === 'weekend' ? 'Weekend' : holiday.name}
                        </Badge>
                      </div>
                    )}
                    {leaveRequest && (
                      <div className="mt-1">
                        <Badge variant="default" className="text-xs">
                          {getLeaveTypeInfo(leaveRequest.type).label}
                        </Badge>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span>Government Holiday</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span>Sunday (Weekend)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span>Saturday Off</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
            <span>Leave Applied</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LeaveCalendar;
