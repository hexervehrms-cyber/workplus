import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Plus, Edit2, Download, AlertCircle, Eye } from 'lucide-react';
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
import {
  LeaveRequestService,
  LeaveAllocationService,
  EmployeeService,
  LeaveTypeSettingsService,
  extractApiList,
} from '../../utils/api';
import { clearApiCache, resolveAuthOrgId, resolveOrgIdForApi } from '../../utils/apiHelper';
import { resolveEmployeeMongoId } from '../../utils/resolveEmployeeId';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';
import {
  type LeaveBalanceMap,
  parseBalanceApiResponse,
  getTypeBalance,
} from '../../utils/leaveBalance';

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

const DEFAULT_ENABLED_LEAVE_TYPES: Record<string, boolean> = {
  vacation: true,
  sickLeave: true,
  casualLeave: true,
  earnedLeave: true,
  medicalLeave: true,
  maternityLeave: false,
  paternityLeave: false,
  compensatoryOff: true,
  personal: false,
  emergency: false,
  ncns: false,
  sandwichLeave: false
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sickLeave: 'Sick Leave',
  casualLeave: 'Casual Leave',
  earnedLeave: 'Earned Leave',
  medicalLeave: 'Medical Leave',
  maternityLeave: 'Maternity Leave',
  paternityLeave: 'Paternity Leave',
  compensatoryOff: 'Compensatory Off (Comp Off)',
  personal: 'Personal',
  emergency: 'Emergency',
  ncns: 'NCNS (No Call No Show)',
  sandwichLeave: 'Sandwich Leave',
};

const DEFAULT_LEAVE_TYPE_ORDER = [
  'casualLeave',
  'sickLeave',
  'earnedLeave',
  'personal',
  'emergency',
  'compensatoryOff',
  'maternityLeave',
  'paternityLeave',
  'medicalLeave',
  'ncns',
  'sandwichLeave',
];

function normalizeLeaveRow(raw: Record<string, unknown>): LeaveRequest {
  const id = String(raw._id || raw.id || '');
  return {
    _id: id,
    type: String(raw.type || raw.leaveType || 'Leave'),
    leaveType: String(raw.leaveType || raw.type || 'Leave'),
    startDate: String(raw.startDate || ''),
    endDate: String(raw.endDate || ''),
    reason: String(raw.reason || ''),
    status: String(raw.status || 'pending'),
    days: typeof raw.days === 'number' ? raw.days : undefined,
  };
}

function defaultLeaveTypeLabel(enabled: Record<string, boolean> | null): string {
  if (!enabled) return LEAVE_TYPE_LABELS.casualLeave;
  for (const key of DEFAULT_LEAVE_TYPE_ORDER) {
    if (enabled[key] && LEAVE_TYPE_LABELS[key]) return LEAVE_TYPE_LABELS[key];
  }
  return '';
}

export default function Leave() {
  const { user } = useAuth();
  const authUserId = user?.userId || user?.id ? String(user.userId || user.id) : '';
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceMap>({});
  const [hasLeaveAllocation, setHasLeaveAllocation] = useState(false);
  const [viewingLeave, setViewingLeave] = useState<LeaveRequest | null>(null);
  const [enabledLeaveTypes, setEnabledLeaveTypes] = useState<Record<string, boolean> | null>(null);
  const [balanceKpiVisibility, setBalanceKpiVisibility] = useState<Record<string, boolean> | null>(null);
  const [leaveKpiReady, setLeaveKpiReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [formData, setFormData] = useState({
    type: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    reason: '',
    leaveDuration: 'full' as 'full' | 'first_half' | 'second_half' | 'hourly'
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!authUserId) return;
      
      try {
        setLoading(true);
        setLeaveKpiReady(false);
        
        // Clear any cached data to force fresh fetch
        console.log('🔄 [LEAVE] Fetching fresh leave data...');
        
        // Fetch leave requests
        const leaveResponse = await LeaveRequestService.getLeaveRequestsByUserId(authUserId);
        const leaveData = extractApiList(leaveResponse).map((row) =>
          normalizeLeaveRow(row as Record<string, unknown>)
        );
        setLeaveHistory(leaveData);

        // Fetch leave balance from allocation
        let employeeId = user?.employeeId;
        
        // If employeeId is not set, try to fetch it from the employee service
        if (!employeeId) {
          console.log('⚠️ [LEAVE] employeeId not found in user context, fetching from backend...');
          try {
            const employeeResponse = await EmployeeService.getEmployeeByUserId(authUserId);
            if (employeeResponse && employeeResponse._id) {
              employeeId = employeeResponse._id;
              console.log('✅ [LEAVE] Employee ID fetched:', employeeId);
            }
          } catch (error) {
            console.error('❌ [LEAVE] Error fetching employee:', error);
          }
        } else {
          console.log('✅ [LEAVE] Using employeeId from user context:', employeeId);
        }
        
        if (employeeId) {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          
          console.log('📊 [LEAVE] Fetching balance for:', {
            employeeId,
            year,
            month
          });
          
          const balanceResponse = await LeaveAllocationService.getEmployeeBalance(employeeId, year, month);
          console.log('📊 [LEAVE] Balance response:', balanceResponse);
          
          if (balanceResponse.success) {
            const parsed = parseBalanceApiResponse(balanceResponse);
            setLeaveBalance(parsed.balances);
            setHasLeaveAllocation(parsed.hasAllocation);
            console.log('✅ [LEAVE] Leave balance loaded:', parsed);
          } else {
            console.warn('⚠️ [LEAVE] No balance data returned from API');
            console.warn('⚠️ [LEAVE] This employee may not have leave allocations set up');
          }
        } else {
          console.error('❌ [LEAVE] No employeeId available to fetch balance');
          console.error('❌ [LEAVE] User object:', user);
        }

        // Fetch enabled leave types
        const orgId = resolveAuthOrgId(user);
        if (!orgId) {
          console.warn('[LEAVE] Organization context missing — skipping leave type settings');
        } else {
        try {
          const enabledTypesResponse = await LeaveTypeSettingsService.getEnabledLeaveTypes(orgId);
          if (enabledTypesResponse.success && enabledTypesResponse.data) {
            setEnabledLeaveTypes(enabledTypesResponse.data.settings);
            setBalanceKpiVisibility(enabledTypesResponse.data.balanceKpiVisibility ?? null);
          } else {
            setEnabledLeaveTypes({ ...DEFAULT_ENABLED_LEAVE_TYPES });
            setBalanceKpiVisibility(null);
          }
        } catch (error) {
          console.error('Error fetching enabled leave types:', error);
          setEnabledLeaveTypes({ ...DEFAULT_ENABLED_LEAVE_TYPES });
          setBalanceKpiVisibility(null);
        }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLeaveKpiReady(true);
        setLoading(false);
      }
    };

    fetchData();
  }, [authUserId, user?.employeeId]);

  useEffect(() => {
    const refetchLeaves = () => {
      if (!authUserId) return;
      void LeaveRequestService.getLeaveRequestsByUserId(authUserId).then((leaveResponse) => {
        const list = extractApiList(leaveResponse).map((row) =>
          normalizeLeaveRow(row as Record<string, unknown>)
        );
        setLeaveHistory(list);
      }).catch(() => {});
    };
    const unsub = realTimeSocket.onLeaveUpdate(refetchLeaves);
    return () => unsub();
  }, [authUserId]);

  useEffect(() => {
    const refreshBalances = async () => {
      if (!authUserId || document.visibilityState !== 'visible') return;
      let employeeId = user?.employeeId;
      if (!employeeId) {
        try {
          const emp = await EmployeeService.getEmployeeByUserId(authUserId);
          employeeId = emp?._id;
        } catch {
          return;
        }
      }
      if (!employeeId) return;
      const now = new Date();
      const balanceResponse = await LeaveAllocationService.getEmployeeBalance(
        employeeId,
        now.getFullYear(),
        now.getMonth() + 1
      );
      if (balanceResponse.success) {
        const parsed = parseBalanceApiResponse(balanceResponse);
        setLeaveBalance(parsed.balances);
        setHasLeaveAllocation(parsed.hasAllocation);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshBalances();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authUserId, user?.employeeId]);

  const leaveBalanceCards = useMemo(() => {
    const cardDefs: Array<{ type: string; key: string; color: string }> = [
      { type: 'Sick Leave', key: 'sickLeave', color: 'bg-secondary' },
      { type: 'Casual Leave', key: 'casualLeave', color: 'bg-accent' },
      { type: 'Earned Leave', key: 'earnedLeave', color: 'bg-yellow-500' },
      { type: 'Maternity Leave', key: 'maternityLeave', color: 'bg-pink-500' },
      { type: 'Paternity Leave', key: 'paternityLeave', color: 'bg-blue-500' },
      { type: 'Compensatory Off', key: 'compensatoryOff', color: 'bg-green-500' },
      { type: 'Personal', key: 'personal', color: 'bg-purple-500' },
      { type: 'Emergency', key: 'emergency', color: 'bg-orange-500' },
      { type: 'NCNS', key: 'ncns', color: 'bg-gray-500' },
      { type: 'Sandwich Leave', key: 'sandwichLeave', color: 'bg-indigo-500' },
    ];

    const all = cardDefs.map((def) => {
      const b = getTypeBalance(leaveBalance, def.key);
      return {
        ...def,
        total: b.total,
        used: b.used,
        pending: b.pending,
        remaining: b.remaining,
      };
    });

    if (!leaveKpiReady || !enabledLeaveTypes) return [];

    return all.filter((card) => {
      if (card.key === 'vacation' || card.key === 'medicalLeave') return false;
      if (enabledLeaveTypes[card.key] !== true) return false;
      if (balanceKpiVisibility && balanceKpiVisibility[card.key] === false) return false;
      return true;
    });
  }, [leaveBalance, enabledLeaveTypes, balanceKpiVisibility, leaveKpiReady]);

  // Submit or update leave request
  const handleSubmitLeave = async () => {
    if (submittingLeave) return;

    if (!authUserId || !formData.type || !formData.startDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const isHourly = formData.leaveDuration === 'hourly';
    const isHalf = formData.leaveDuration === 'first_half' || formData.leaveDuration === 'second_half';

    if (isHourly) {
      if (!formData.startTime || !formData.endTime) {
        toast.error('Please select start and end times for hourly leave');
        return;
      }
    }

    if (!isHourly && !isHalf && !formData.endDate) {
      toast.error('Please select end date');
      return;
    }

    setSubmittingLeave(true);
    try {
      const employeeId = await resolveEmployeeMongoId(user);

      if (!employeeId) {
        toast.error('Employee profile not found. Please contact HR.');
        return;
      }

      const orgId = await resolveOrgIdForApi(user);
      if (!orgId) {
        toast.error('Organization not set on your account. Please sign out and sign in again, or contact HR.');
        return;
      }

      const submitUserId = String(user?.userId || user?.id || authUserId);

      const startDate = new Date(formData.startDate);
      const endDate =
        isHalf || isHourly ? new Date(formData.startDate) : new Date(formData.endDate || formData.startDate);

      let days = 0;
      let hours = 0;

      if (isHourly && formData.startTime && formData.endTime) {
        const [startHour, startMinute] = formData.startTime.split(':').map(Number);
        const [endHour, endMinute] = formData.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        const totalMinutes = endMinutes - startMinutes;

        if (totalMinutes <= 0) {
          toast.error('End time must be after start time');
          return;
        }

        hours = totalMinutes / 60;
        days = hours / 8;
      } else if (isHalf) {
        days = 0.5;
      } else {
        days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      // Map leave type to balance key
      const leaveTypeMap: { [key: string]: string } = {
        'Vacation': 'vacation',
        'Sick Leave': 'sickLeave',
        'Casual Leave': 'casualLeave',
        'Earned Leave': 'earnedLeave',
        'Medical Leave': 'medicalLeave',
        'Maternity Leave': 'maternityLeave',
        'Paternity Leave': 'paternityLeave',
        'Compensatory Off': 'compensatoryOff',
        'Personal': 'personal',
        'Emergency': 'emergency',
        'NCNS': 'ncns',
        'Sandwich Leave': 'sandwichLeave'
      };

      const leaveTypeKey = leaveTypeMap[formData.type];
      const balance = leaveTypeKey ? leaveBalance?.[leaveTypeKey] : undefined;

      // Only block when HR allocated days for this type and remaining is insufficient
      const remaining = balance?.remaining ?? 0;
      const allocatedTotal = balance?.total ?? 0;
      if (
        !editingLeaveId &&
        hasLeaveAllocation &&
        balance &&
        allocatedTotal > 0 &&
        remaining < days
      ) {
        toast.error(
          `Insufficient ${formData.type} balance. Available: ${remaining} day(s), requested: ${days.toFixed(2)} day(s).`
        );
        return;
      }

      // Prepare leave data with time information
      const leaveData: any = {
        userId: submitUserId,
        employeeId: employeeId,
        leaveType: formData.type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: formData.reason,
        orgId: orgId,
        leaveDuration: formData.leaveDuration,
        isHalfDay: isHalf,
        halfDaySession:
          formData.leaveDuration === 'first_half'
            ? 'first_half'
            : formData.leaveDuration === 'second_half'
              ? 'second_half'
              : 'none',
        isHourlyLeave: isHourly,
        isShortLeave: isHourly
      };

      if (isHourly) {
        leaveData.startTime = formData.startTime;
        leaveData.endTime = formData.endTime;
        leaveData.hours = hours;
      }

      let response;
      if (editingLeaveId) {
        response = await LeaveRequestService.updateLeaveRequest(editingLeaveId, leaveData);
      } else {
        response = await LeaveRequestService.createLeaveRequest(leaveData);
      }

      const createdRaw =
        (response as { data?: { leaveRequest?: Record<string, unknown> } })?.data?.leaveRequest ||
        (response as { data?: Record<string, unknown> })?.data;

      if (response?.success !== false) {
        clearApiCache();
        if (editingLeaveId) {
          toast.success('Leave request updated successfully');
        } else if (isHourly) {
          toast.success(`Hourly leave submitted successfully (${hours.toFixed(1)} hours)`);
        } else {
          toast.success('Leave request submitted successfully');
        }
        setShowLeaveForm(false);
        setEditingLeaveId(null);
        setFormData({
          type: '',
          startDate: '',
          endDate: '',
          startTime: '',
          endTime: '',
          reason: '',
          leaveDuration: 'full'
        });

        if (!editingLeaveId && createdRaw && (createdRaw._id || createdRaw.id)) {
          setLeaveHistory((prev) => [normalizeLeaveRow(createdRaw), ...prev]);
        }

        try {
          const updatedLeaves = await LeaveRequestService.getLeaveRequestsByUserId(submitUserId);
          const list = extractApiList(updatedLeaves).map((row) =>
            normalizeLeaveRow(row as Record<string, unknown>)
          );
          if (list.length > 0) {
            setLeaveHistory(list);
          }
        } catch (refreshErr) {
          console.warn('[LEAVE] List refresh after submit failed:', refreshErr);
        }

        // Refresh balance
        let refreshEmployeeId = user?.employeeId;
        if (!refreshEmployeeId) {
          try {
            const employeeResponse = await EmployeeService.getEmployeeByUserId(authUserId);
            if (employeeResponse && employeeResponse._id) {
              refreshEmployeeId = employeeResponse._id;
            }
          } catch (error) {
            console.error('Error fetching employee:', error);
          }
        }
        
        if (refreshEmployeeId) {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          
          const balanceResponse = await LeaveAllocationService.getEmployeeBalance(refreshEmployeeId, year, month);
          if (balanceResponse.success) {
            const parsed = parseBalanceApiResponse(balanceResponse);
            setLeaveBalance(parsed.balances);
            setHasLeaveAllocation(parsed.hasAllocation);
          }
        }
      } else {
        toast.error(response?.message || 'Failed to save leave request');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to submit leave request';
      toast.error(message.includes('Organization') ? message : message || 'Failed to submit leave request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
      {/* Page Header - Mobile optimized */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">Leave History</h1>
          <p className="text-sm sm:text-base text-muted-foreground">View and manage your leave requests</p>
        </div>
        <Button 
          onClick={() => {
            const defaultType = defaultLeaveTypeLabel(enabledLeaveTypes);
            setFormData((prev) => ({
              ...prev,
              type: prev.type || defaultType,
            }));
            setShowLeaveForm(true);
          }}
          className="w-full sm:w-auto rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Request Leave
        </Button>
      </div>

      {/* Leave Balance KPI Cards - Optimized for mobile */}
      {loading || !leaveKpiReady ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="p-4 sm:p-6 rounded-2xl animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {!hasLeaveAllocation && leaveBalanceCards.length > 0 && leaveBalanceCards.every((card) => card.total === 0) && (
            <Card className="p-4 sm:p-6 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm text-yellow-900 dark:text-yellow-100">No Leave Allocations Found</h3>
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                    Your leave balances haven't been set up yet. Please contact your HR administrator to allocate your leave days.
                  </p>
                </div>
              </div>
            </Card>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {leaveBalanceCards.map((leave) => (
          <Card key={leave.key} className="p-4 sm:p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="font-semibold text-sm sm:text-base">{leave.type}</h3>
              <div className={`w-3 h-3 rounded-full ${leave.color}`} />
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{leave.total} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">{leave.used} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium text-yellow-600">{leave.pending} days</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold text-primary">{leave.remaining} days</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
        </>
      )}

      {/* Leave History */}
      <Card className="rounded-2xl overflow-hidden shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
        <div className="p-4 sm:p-6 border-b border-foreground/10 bg-muted/30">
          <h3 className="font-semibold text-base sm:text-lg text-foreground">Your Leave Requests</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">All your leave requests and their status</p>
        </div>
        <div className="p-4 sm:p-6">
          {leaveHistory && leaveHistory.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/10 bg-muted/20">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Leave Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Reason</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Start Date</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">End Date</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Days</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">Status</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const start = (currentPage - 1) * pageSize;
                      const end = start + pageSize;
                      const paginatedLeaves = leaveHistory.slice(start, end);
                      
                      return paginatedLeaves.map((leave, idx) => (
                        <tr 
                          key={leave._id} 
                          className={`border-b border-foreground/5 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{leave.leaveType || leave.type || 'Leave'}</span>
                              {((leave as any).isHourlyLeave || (leave as any).isShortLeave) && (
                                <Badge variant="outline" className="text-xs py-0"><Clock className="w-3 h-3" /></Badge>
                              )}
                              {((leave as any).isHalfDay && (leave as any).halfDaySession === 'first_half') && (
                                <Badge variant="outline" className="text-xs py-0">1st half</Badge>
                              )}
                              {((leave as any).isHalfDay && (leave as any).halfDaySession === 'second_half') && (
                                <Badge variant="outline" className="text-xs py-0">2nd half</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs text-muted-foreground truncate">{leave.reason}</td>
                          <td className="py-3 px-4 text-center">{new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                          <td className="py-3 px-4 text-center">{new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                          <td className="py-3 px-4 text-center font-semibold">
                            {((leave as any).isHourlyLeave || (leave as any).isShortLeave) && (leave as any).hours 
                              ? `${(leave as any).hours.toFixed(1)} h` 
                              : `${leave.days || (((leave as any).isHalfDay) ? 0.5 : 1)}`}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant={
                                leave.status === 'approved' ? 'default' :
                                leave.status === 'pending' ? 'secondary' :
                                'destructive'
                              }
                              className="text-xs"
                            >
                              {leave.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {leave.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                              {leave.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                              {leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                type="button"
                                title="View details"
                                onClick={() => setViewingLeave(leave)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title={leave.status !== 'pending' ? 'Can only edit pending requests' : 'Edit request'}
                                onClick={() => {
                                  setEditingLeaveId(leave._id);
                                  setFormData({
                                    type: leave.leaveType || leave.type || '',
                                    startDate: new Date(leave.startDate).toISOString().split('T')[0],
                                    endDate: new Date(leave.endDate).toISOString().split('T')[0],
                                    startTime: (leave as any).startTime || '',
                                    endTime: (leave as any).endTime || '',
                                    reason: leave.reason || '',
                                    leaveDuration: (() => {
                                      const l = leave as any;
                                      if (l.isHourlyLeave || l.isShortLeave) return 'hourly' as const;
                                      if (l.isHalfDay && l.halfDaySession === 'first_half') return 'first_half' as const;
                                      if (l.isHalfDay && l.halfDaySession === 'second_half') return 'second_half' as const;
                                      return 'full' as const;
                                    })()
                                  });
                                  setShowLeaveForm(true);
                                }}
                                disabled={leave.status !== 'pending'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Download"
                                onClick={() => {
                                  const leaveData = `Leave Request Details\n\nType: ${leave.leaveType || leave.type}\nStatus: ${leave.status}\nFrom: ${new Date(leave.startDate).toLocaleDateString()}\nTo: ${new Date(leave.endDate).toLocaleDateString()}\nDays: ${leave.days || 1}\nReason: ${leave.reason}`;
                                  const blob = new Blob([leaveData], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `leave-request-${new Date(leave.startDate).toISOString().split('T')[0]}.txt`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {(() => {
                  const start = (currentPage - 1) * pageSize;
                  const end = start + pageSize;
                  const paginatedLeaves = leaveHistory.slice(start, end);
                  
                  return paginatedLeaves.map((leave) => (
                    <div key={leave._id} className="p-4 rounded-xl bg-muted/20 border border-foreground/10 hover:border-foreground/20 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">{leave.leaveType || leave.type || 'Leave'}</h4>
                            {((leave as any).isHourlyLeave || (leave as any).isShortLeave) && (
                              <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Hourly</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{leave.reason}</p>
                        </div>
                        <Badge
                          variant={
                            leave.status === 'approved' ? 'default' :
                            leave.status === 'pending' ? 'secondary' :
                            'destructive'
                          }
                          className="text-xs flex-shrink-0"
                        >
                          {leave.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {leave.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {leave.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                          {leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3 py-2 border-y border-foreground/10">
                        <div className="flex justify-between mb-1">
                          <span>{new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <span className="font-semibold text-primary">
                            {((leave as any).isHourlyLeave || (leave as any).isShortLeave) && (leave as any).hours 
                              ? `${(leave as any).hours.toFixed(1)} hrs` 
                              : `${leave.days || (((leave as any).isHalfDay) ? 0.5 : 1)} days`}
                          </span>
                          <span>{new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs" onClick={() => setViewingLeave(leave)}>
                          <Eye className="w-3 h-3 mr-1" />View
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" disabled={leave.status !== 'pending'} onClick={() => {
                          setEditingLeaveId(leave._id);
                          setFormData({
                            type: leave.leaveType || leave.type || '',
                            startDate: new Date(leave.startDate).toISOString().split('T')[0],
                            endDate: new Date(leave.endDate).toISOString().split('T')[0],
                            startTime: (leave as any).startTime || '',
                            endTime: (leave as any).endTime || '',
                            reason: leave.reason || '',
                            leaveDuration: (() => {
                              const l = leave as any;
                              if (l.isHourlyLeave || l.isShortLeave) return 'hourly' as const;
                              if (l.isHalfDay && l.halfDaySession === 'first_half') return 'first_half' as const;
                              if (l.isHalfDay && l.halfDaySession === 'second_half') return 'second_half' as const;
                              return 'full' as const;
                            })()
                          });
                          setShowLeaveForm(true);
                        }}>
                          <Edit2 className="w-3 h-3 mr-1" />Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-10 p-0" onClick={() => {
                          const leaveData = `Leave Request Details\n\nType: ${leave.leaveType || leave.type}\nStatus: ${leave.status}\nFrom: ${new Date(leave.startDate).toLocaleDateString()}\nTo: ${new Date(leave.endDate).toLocaleDateString()}\nDays: ${leave.days || 1}\nReason: ${leave.reason}`;
                          const blob = new Blob([leaveData], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `leave-request-${new Date(leave.startDate).toISOString().split('T')[0]}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Pagination Controls */}
              {(() => {
                const totalPages = Math.ceil(leaveHistory.length / pageSize);
                const start = (currentPage - 1) * pageSize + 1;
                const end = Math.min(currentPage * pageSize, leaveHistory.length);
                
                return (
                  <div className="pt-6 border-t border-foreground/10">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Showing <span className="font-semibold text-foreground">{start}</span> to <span className="font-semibold text-foreground">{end}</span> of <span className="font-semibold text-foreground">{leaveHistory.length}</span> requests
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <Button
                              key={page}
                              size="sm"
                              variant={page === currentPage ? 'default' : 'outline'}
                              className={`h-8 w-8 p-0 text-xs ${page === currentPage ? '' : ''}`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="text-center py-8">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No leave requests yet</p>
              <p className="text-xs text-muted-foreground mt-1">Submit your first leave request to see it here</p>
            </div>
          )}
        </div>
      </Card>

      {/* Leave Form Dialog - Mobile optimized */}
      <Dialog
        open={showLeaveForm}
        onOpenChange={(open) => {
          setShowLeaveForm(open);
          if (!open) setEditingLeaveId(null);
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg rounded-2xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl font-bold">Request Leave</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Submit a new leave request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-5">
            <div>
              <Label className="text-sm font-medium text-foreground">Leave Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                <SelectTrigger className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-foreground/20">
                  {enabledLeaveTypes && Object.entries(enabledLeaveTypes).map(([key, enabled]) => {
                    if (!enabled || key === 'vacation') return null;
                    const label = LEAVE_TYPE_LABELS[key];
                    if (!label) return null;
                    return (
                      <SelectItem key={key} value={label} className="rounded-lg">
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Duration</Label>
              <Select
                value={formData.leaveDuration}
                onValueChange={(value: 'full' | 'first_half' | 'second_half' | 'hourly') => {
                  const isHourly = value === 'hourly';
                  const isHalf = value === 'first_half' || value === 'second_half';
                  setFormData({
                    ...formData,
                    leaveDuration: value,
                    endDate: isHourly || isHalf ? formData.startDate : formData.endDate
                  });
                }}
              >
                <SelectTrigger className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-foreground/20">
                  <SelectItem value="full" className="rounded-lg">Full day</SelectItem>
                  <SelectItem value="first_half" className="rounded-lg">First half</SelectItem>
                  <SelectItem value="second_half" className="rounded-lg">Second half</SelectItem>
                  <SelectItem value="hourly" className="rounded-lg">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-foreground">
                  {formData.leaveDuration === 'hourly' || formData.leaveDuration === 'first_half' || formData.leaveDuration === 'second_half'
                    ? 'Date'
                    : 'From Date'}
                </Label>
                <Input 
                  type="date" 
                  className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  value={formData.startDate}
                  onChange={(e) => {
                    const newStartDate = e.target.value;
                    const syncEnd =
                      formData.leaveDuration === 'hourly' ||
                      formData.leaveDuration === 'first_half' ||
                      formData.leaveDuration === 'second_half';
                    setFormData({
                      ...formData, 
                      startDate: newStartDate,
                      endDate: syncEnd ? newStartDate : formData.endDate
                    });
                  }}
                />
              </div>
              {formData.leaveDuration === 'full' && (
                <div>
                  <Label className="text-sm font-medium text-foreground">To Date</Label>
                  <Input 
                    type="date" 
                    className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              )}
            </div>

            {/* Time pickers for hourly leave */}
            {formData.leaveDuration === 'hourly' && (
              <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <div>
                  <Label className="text-sm font-medium text-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Start Time
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
                    <Clock className="w-3 h-3" />
                    End Time
                  </Label>
                  <Input 
                    type="time" 
                    className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  />
                </div>
                {formData.startTime && formData.endTime && (
                  <div className="col-span-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      Duration: {(() => {
                        const [startHour, startMinute] = formData.startTime.split(':').map(Number);
                        const [endHour, endMinute] = formData.endTime.split(':').map(Number);
                        const startMinutes = startHour * 60 + startMinute;
                        const endMinutes = endHour * 60 + endMinute;
                        const totalMinutes = endMinutes - startMinutes;
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;
                        return totalMinutes > 0 ? `${hours}h ${minutes}m` : 'Invalid time range';
                      })()}
                    </p>
                  </div>
                )}
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
                  setEditingLeaveId(null);
                  setFormData({
                    type: '',
                    startDate: '',
                    endDate: '',
                    startTime: '',
                    endTime: '',
                    reason: '',
                    leaveDuration: 'full'
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submittingLeave}
                className="flex-1 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60"
                onClick={() => void handleSubmitLeave()}
              >
                {submittingLeave
                  ? 'Submitting…'
                  : editingLeaveId
                    ? 'Save Changes'
                    : 'Submit Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingLeave} onOpenChange={(open) => !open && setViewingLeave(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Leave request details</DialogTitle>
            <DialogDescription>Full details for your leave application</DialogDescription>
          </DialogHeader>
          {viewingLeave && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{viewingLeave.leaveType || viewingLeave.type}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={viewingLeave.status === 'approved' ? 'default' : viewingLeave.status === 'pending' ? 'secondary' : 'destructive'}>
                  {viewingLeave.status}
                </Badge>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">From</span>
                <span>{new Date(viewingLeave.startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">To</span>
                <span>{new Date(viewingLeave.endDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Duration</span>
                <span>
                  {viewingLeave.days
                    ? `${viewingLeave.days} day(s)`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Reason</span>
                <p className="rounded-lg bg-muted/50 p-3">{viewingLeave.reason}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
