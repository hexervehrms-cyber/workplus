import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

  // 3D Parallax Tilt State
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [glowOpacity, setGlowOpacity] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Water/Glass tile state for individual day cells
  const [cellTilt, setCellTilt] = useState<{ [key: string]: { x: number; y: number } }>({});

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Add CSS animations for floating effect
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes floatingGlass {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-2px); }
      }
      
      .floating-glass-tile {
        animation: floatingGlass 5s ease-in-out infinite;
      }
      
      .floating-glass-tile:nth-child(1) { animation-delay: 0s; }
      .floating-glass-tile:nth-child(2) { animation-delay: 0.3s; }
      .floating-glass-tile:nth-child(3) { animation-delay: 0.6s; }
      .floating-glass-tile:nth-child(4) { animation-delay: 0.9s; }
      .floating-glass-tile:nth-child(5) { animation-delay: 1.2s; }
      .floating-glass-tile:nth-child(6) { animation-delay: 1.5s; }
      .floating-glass-tile:nth-child(7) { animation-delay: 1.8s; }
      .floating-glass-tile:nth-child(8) { animation-delay: 2.1s; }
      .floating-glass-tile:nth-child(9) { animation-delay: 2.4s; }
      .floating-glass-tile:nth-child(10) { animation-delay: 2.7s; }
      .floating-glass-tile:nth-child(11) { animation-delay: 3s; }
      .floating-glass-tile:nth-child(12) { animation-delay: 3.3s; }
      .floating-glass-tile:nth-child(13) { animation-delay: 3.6s; }
      .floating-glass-tile:nth-child(14) { animation-delay: 3.9s; }
      .floating-glass-tile:nth-child(15) { animation-delay: 4.2s; }
      .floating-glass-tile:nth-child(16) { animation-delay: 4.5s; }
      .floating-glass-tile:nth-child(17) { animation-delay: 4.8s; }
      .floating-glass-tile:nth-child(18) { animation-delay: 5.1s; }
      .floating-glass-tile:nth-child(19) { animation-delay: 5.4s; }
      .floating-glass-tile:nth-child(20) { animation-delay: 5.7s; }
      .floating-glass-tile:nth-child(21) { animation-delay: 0.1s; }
      .floating-glass-tile:nth-child(22) { animation-delay: 0.4s; }
      .floating-glass-tile:nth-child(23) { animation-delay: 0.7s; }
      .floating-glass-tile:nth-child(24) { animation-delay: 1s; }
      .floating-glass-tile:nth-child(25) { animation-delay: 1.3s; }
      .floating-glass-tile:nth-child(26) { animation-delay: 1.6s; }
      .floating-glass-tile:nth-child(27) { animation-delay: 1.9s; }
      .floating-glass-tile:nth-child(28) { animation-delay: 2.2s; }
      .floating-glass-tile:nth-child(29) { animation-delay: 2.5s; }
      .floating-glass-tile:nth-child(30) { animation-delay: 2.8s; }
      .floating-glass-tile:nth-child(31) { animation-delay: 3.1s; }
      .floating-glass-tile:nth-child(32) { animation-delay: 3.4s; }
      .floating-glass-tile:nth-child(33) { animation-delay: 3.7s; }
      .floating-glass-tile:nth-child(34) { animation-delay: 4s; }
      .floating-glass-tile:nth-child(35) { animation-delay: 4.3s; }
      .floating-glass-tile:nth-child(36) { animation-delay: 4.6s; }
      .floating-glass-tile:nth-child(37) { animation-delay: 4.9s; }
      .floating-glass-tile:nth-child(38) { animation-delay: 5.2s; }
      .floating-glass-tile:nth-child(39) { animation-delay: 5.5s; }
      .floating-glass-tile:nth-child(40) { animation-delay: 5.8s; }
      .floating-glass-tile:nth-child(41) { animation-delay: 0.2s; }
      .floating-glass-tile:nth-child(42) { animation-delay: 0.5s; }
      
      @media (prefers-reduced-motion: reduce) {
        .floating-glass-tile {
          animation: none !important;
          transform: translateY(0) !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const authUserId = user?.userId || user?.id || '';

  // 3D Parallax Tilt Handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion.current || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const rotateX = (mouseY / (rect.height / 2)) * -4;
    const rotateY = (mouseX / (rect.width / 2)) * 4;

    setTiltX(rotateX);
    setTiltY(rotateY);
    setGlowOpacity(1);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!prefersReducedMotion.current) {
      setTiltX(0);
      setTiltY(0);
      setGlowOpacity(0);
    }
  }, []);

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
      <Card 
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="p-6 rounded-2xl shadow-lg border-0 bg-gradient-to-br from-background to-muted/20 overflow-visible flex flex-col w-full h-full"
        style={{
          perspective: '1000px',
          transform: prefersReducedMotion.current 
            ? undefined 
            : `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${1 + Math.abs(tiltX + tiltY) * 0.001})`,
          transition: tiltX === 0 && tiltY === 0 ? 'transform 0.6s cubic-bezier(0.23, 1, 0.320, 1)' : 'transform 0.05s linear',
          willChange: 'transform',
        }}
      >
        {/* Glow overlay for 3D effect */}
        {!prefersReducedMotion.current && (
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 transition-opacity duration-300"
            style={{
              background: `radial-gradient(ellipse at ${50 + (tiltY / 4) * 10}% ${50 + (tiltX / 4) * 10}%, rgba(16, 185, 129, 0.15) 0%, transparent 70%)`,
              opacity: glowOpacity * 0.3,
            }}
          />
        )}
        <div className="space-y-5 flex-1 flex flex-col min-w-0 w-full h-full relative z-10">
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
          <div className="w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-background overflow-visible shadow-sm flex-1 flex flex-col min-h-0 relative isolate" style={{ perspective: '1100px' }}>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-0 bg-muted/30 border-b border-slate-300/80 dark:border-slate-700/80">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                <div 
                  key={day} 
                  className={`text-center text-xs font-semibold text-foreground/80 p-3 h-10 flex items-center justify-center ${
                    (idx + 1) % 7 !== 0 ? 'border-r border-slate-300/80 dark:border-slate-700/80' : ''
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-0 bg-background flex-1 overflow-visible relative">
              {calendarDays.map((day, _index) => {
                const isLastColumn = (_index + 1) % 7 === 0;
                const isLastRow = _index >= calendarDays.length - 7;
                
                if (!day) {
                  return (
                    <div 
                      key={_index} 
                      className={`min-h-[92px] sm:min-h-[104px] xl:min-h-[112px] bg-muted/10 ${
                        !isLastColumn ? 'border-r border-slate-300/80 dark:border-slate-700/80' : ''
                      } ${!isLastRow ? 'border-b border-slate-300/80 dark:border-slate-700/80' : ''}`} 
                    />
                  );
                }

                const weekend = isWeekend(day);
                const holiday = isHoliday(day);
                const leave = hasLeave(day);
                const leaveStatus = getLeaveStatus(day);
                const holidayInfo = getHolidayForDay(day);
                const isAvailableDate = !weekend && !holiday && !leave;
                const tooltipText = holiday && holidayInfo 
                  ? holidayInfo.name 
                  : leave 
                  ? `${(leaveStatus?.charAt(0) ?? '').toUpperCase()}${leaveStatus?.slice(1) ?? ''} Leave`
                  : isAvailableDate
                  ? 'Click to request leave'
                  : undefined;

                return (
                  <div
  key={formatLocalDateString(day)}
  className={`min-h-[76px] sm:min-h-[92px] xl:min-h-[104px] group/cell overflow-visible relative p-[5px] ${
    !isLastColumn ? 'border-r border-slate-300/80 dark:border-slate-700/80' : ''
  } ${!isLastRow ? 'border-b border-slate-300/80 dark:border-slate-700/80' : ''}`}
>
                    <motion.button
                      type="button"
                      onClick={() => isAvailableDate && openLeaveForm(day)}
                      disabled={!isAvailableDate}
                      aria-label={tooltipText}
                      whileHover={isAvailableDate && !prefersReducedMotion.current ? { 
                        y: -6, 
                        scale: 1.04, 
                        rotateX: 6, 
                        rotateY: -6, 
                        z: 40 
                      } : undefined}
                      whileTap={isAvailableDate && !prefersReducedMotion.current ? { 
                        y: -2, 
                        scale: 0.98, 
                        rotateX: 0, 
                        rotateY: 0, 
                        z: 12 
                      } : undefined}
                      transition={{ type: "spring", stiffness: 350, damping: 28, mass: 0.35, restDelta: 0.001, restSpeed: 0.001 }}
                      className={`
                        w-full h-full relative group/tile flex flex-col items-center justify-center rounded-xl border overflow-hidden transform-gpu will-change-transform [transform-style:preserve-3d] [backface-visibility:hidden] font-medium text-xs
                        transition-all duration-300 ease-out
                        ${weekend ? 'bg-red-500/15 dark:bg-red-600/15 border-red-300/40 dark:border-red-700/40 text-red-700 dark:text-red-200 cursor-not-allowed backdrop-blur-sm shadow-inner' : ''}
                        ${holiday ? 'bg-emerald-500/15 dark:bg-emerald-600/15 border-emerald-300/40 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-200 cursor-not-allowed backdrop-blur-sm shadow-inner' : ''}
                        ${leave && leaveStatus === 'approved' ? 'bg-blue-500/15 dark:bg-blue-600/15 border-blue-300/40 dark:border-blue-700/40 text-blue-700 dark:text-blue-200 backdrop-blur-sm shadow-sm cursor-default' : ''}
                        ${leave && leaveStatus === 'pending' ? 'bg-yellow-500/15 dark:bg-yellow-600/15 border-yellow-300/40 dark:border-yellow-700/40 text-yellow-700 dark:text-yellow-200 backdrop-blur-sm shadow-sm cursor-default' : ''}
                        ${leave && leaveStatus === 'rejected' ? 'bg-red-500/15 dark:bg-red-600/15 border-red-300/40 dark:border-red-700/40 text-red-700 dark:text-red-200 backdrop-blur-sm shadow-sm cursor-default' : ''}
                        ${isAvailableDate ? `
                          floating-glass-tile
                          bg-white/35 dark:bg-slate-400/20
                          border-white/45 dark:border-slate-300/40
                          text-foreground 
                          cursor-pointer 
                          backdrop-blur-md
                          shadow-lg shadow-white/10
                          hover:bg-white/50 dark:hover:bg-slate-400/30
                          hover:border-white/60 dark:hover:border-slate-300/60
                          hover:shadow-[0_20px_60px_rgba(16,185,129,0.2),_0_0_40px_rgba(255,255,255,0.15)]
                          hover:brightness-110
                          dark:hover:shadow-[0_20px_60px_rgba(16,185,129,0.15),_0_0_40px_rgba(148,163,184,0.1)]
                        ` : ''}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60
                      `}
                    >
                      {/* Premium water/glass shine overlay */}
                      {isAvailableDate && (
                        <>
                          {/* Top-left water shine gradient */}
                          <span 
                            aria-hidden="true" 
                            className="pointer-events-none absolute inset-0 opacity-0 group-hover/tile:opacity-100 transition-opacity duration-200 bg-gradient-to-br from-white/60 via-white/20 to-transparent rounded-xl" 
                          />
                          
                          {/* Subtle inner border highlight */}
                          <span 
                            aria-hidden="true" 
                            className="pointer-events-none absolute inset-0 rounded-xl border border-white/50 dark:border-white/20 opacity-50 group-hover/tile:opacity-80 transition-opacity duration-200" 
                          />
                          
                          {/* Water-like top light reflection */}
                          <span 
                            aria-hidden="true" 
                            className="pointer-events-none absolute top-1 left-2 right-2 h-1 rounded-full opacity-0 group-hover/tile:opacity-80 transition-opacity duration-200 bg-gradient-to-r from-transparent via-white/70 to-transparent blur-sm" 
                          />
                          
                          {/* Soft bottom glow for floating effect */}
                          <span 
                            aria-hidden="true" 
                            className="pointer-events-none absolute -bottom-3 left-2 right-2 h-6 rounded-full opacity-0 blur-lg group-hover/tile:opacity-60 transition-opacity duration-300 bg-gradient-to-t from-white/30 to-transparent dark:from-emerald-400/20" 
                          />
                        </>
                      )}
                      
                      <span className="block relative z-10 text-base font-semibold">{day.getDate()}</span>
                      
                      {/* Status indicators */}
                      <div className="mt-1 flex gap-1 relative z-10">
                        {leave && (
                          <motion.div 
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              leaveStatus === 'approved' ? 'bg-blue-500' :
                              leaveStatus === 'pending' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            layoutId={`leave-indicator-${formatLocalDateString(day)}`}
                          />
                        )}
                        
                        {holiday && (
                          <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend - Compact and premium */}
          <div className="mt-4 p-4 bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl border border-border/50 flex-shrink-0">
            <h4 className="text-xs font-semibold text-foreground/80 mb-3 uppercase tracking-wide">Status Legend</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80 flex-shrink-0 shadow-sm" />
                <span className="text-xs text-muted-foreground truncate">Weekend</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500/80 flex-shrink-0 shadow-sm" />
                <span className="text-xs text-muted-foreground truncate">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500/80 flex-shrink-0 shadow-sm" />
                <span className="text-xs text-muted-foreground truncate">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500/80 flex-shrink-0 shadow-sm" />
                <span className="text-xs text-muted-foreground truncate">Pending</span>
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