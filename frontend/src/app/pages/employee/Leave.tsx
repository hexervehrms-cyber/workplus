import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Plus, Edit2, Download, Trash2, AlertCircle, Eye } from 'lucide-react';
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
import { LeaveRequestService, LeaveAllocationService, EmployeeService, LeaveTypeSettingsService } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
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

export default function Leave() {
  const { user } = useAuth();
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceMap>({});
  const [hasLeaveAllocation, setHasLeaveAllocation] = useState(false);
  const [viewingLeave, setViewingLeave] = useState<LeaveRequest | null>(null);
  const [enabledLeaveTypes, setEnabledLeaveTypes] = useState<Record<string, boolean> | null>(null);
  const [balanceKpiVisibility, setBalanceKpiVisibility] = useState<Record<string, boolean> | null>(null);
  const [leaveKpiReady, setLeaveKpiReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
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
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setLeaveKpiReady(false);
        
        // Clear any cached data to force fresh fetch
        console.log('🔄 [LEAVE] Fetching fresh leave data...');
        
        // Fetch leave requests
        const leaveResponse = await LeaveRequestService.getLeaveRequestsByUserId(user.id);
        console.log('📊 [LEAVE] Leave requests response:', leaveResponse);
        
        if (leaveResponse.success && leaveResponse.data) {
          // Handle both array and paginated response
          const leaveData = Array.isArray(leaveResponse.data) ? leaveResponse.data : leaveResponse.data.data || [];
          setLeaveHistory(leaveData);
          console.log('✅ [LEAVE] Loaded', leaveData.length, 'leave requests');
        }

        // Fetch leave balance from allocation
        let employeeId = user.employeeId;
        
        // If employeeId is not set, try to fetch it from the employee service
        if (!employeeId) {
          console.log('⚠️ [LEAVE] employeeId not found in user context, fetching from backend...');
          try {
            const employeeResponse = await EmployeeService.getEmployeeByUserId(user.id);
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
        let orgId = user?.orgId || user?.tenantId;
        if (!orgId) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              orgId = parsedUser.orgId || parsedUser.tenantId || 'system';
            } catch (e) {
              orgId = 'system';
            }
          } else {
            orgId = 'system';
          }
        }

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
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLeaveKpiReady(true);
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const refreshBalances = async () => {
      if (!user?.id || document.visibilityState !== 'visible') return;
      let employeeId = user.employeeId;
      if (!employeeId) {
        try {
          const emp = await EmployeeService.getEmployeeByUserId(user.id);
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
  }, [user?.id, user?.employeeId]);

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
    console.log('🔵 handleSubmitLeave called');
    console.log('📊 Form data:', formData);
    console.log('👤 User:', user);
    
    if (!user?.id || !formData.type || !formData.startDate || !formData.reason) {
      console.error('❌ Validation failed:', {
        userId: !!user?.id,
        type: !!formData.type,
        startDate: !!formData.startDate,
        reason: !!formData.reason
      });
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

    try {
      let employeeId = user.employeeId;
      
      // If employeeId is not set, try to fetch it
      if (!employeeId) {
        console.log('employeeId not found in user context, fetching from backend...');
        try {
          const employeeResponse = await EmployeeService.getEmployeeByUserId(user.id);
          if (employeeResponse && employeeResponse._id) {
            employeeId = employeeResponse._id;
            console.log('Employee ID fetched:', employeeId);
          }
        } catch (error) {
          console.error('Error fetching employee:', error);
          toast.error('Could not find employee record');
          return;
        }
      }
      
      if (!employeeId) {
        toast.error('Employee ID not found');
        return;
      }
      
      const orgId = user.orgId || 'system';

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
      const balance = leaveBalance?.[leaveTypeKey];
      
      console.log('Leave submission validation:', {
        leaveType: formData.type,
        leaveTypeKey,
        balance,
        daysRequested: days,
        hoursRequested: hours,
        leaveDuration: formData.leaveDuration,
        isEditing: !!editingLeaveId
      });

      // For new requests, check if there's enough balance
      // For editing, skip the balance check since leaves are already deducted
      if (!editingLeaveId && (!balance || balance.available < days)) {
        toast.error(`Insufficient ${formData.type} balance. Available: ${balance?.available || 0} days, Requested: ${days.toFixed(2)} days`);
        return;
      }

      // Prepare leave data with time information
      const leaveData: any = {
        userId: user.id,
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
        // Update existing leave request
        response = await LeaveRequestService.updateLeaveRequest(editingLeaveId, leaveData);
        toast.success('Leave request updated successfully');
      } else {
        // Create new leave request
        response = await LeaveRequestService.createLeaveRequest(leaveData);
        
        if (response.success) {
          // Deduct leaves from allocation only for new requests
          await LeaveAllocationService.deductLeaves(employeeId, formData.type, days, response.data?.leaveRequest?._id);
        }
        
        if (isHourly) {
          toast.success(`Hourly leave submitted successfully (${hours.toFixed(1)} hours)`);
        } else {
          toast.success('Leave request submitted successfully');
        }
      }
      
      if (response.success) {
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
        
        const updatedLeaves = await LeaveRequestService.getLeaveRequestsByUserId(user.id);
        if (updatedLeaves.success && updatedLeaves.data) {
          // Handle both array and paginated response
          const leaveData = Array.isArray(updatedLeaves.data) ? updatedLeaves.data : updatedLeaves.data.data || [];
          setLeaveHistory(leaveData);
        }

        // Refresh balance
        let refreshEmployeeId = user.employeeId;
        if (!refreshEmployeeId) {
          try {
            const employeeResponse = await EmployeeService.getEmployeeByUserId(user.id);
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
        toast.error(response.message || 'Failed to save leave request');
      }
    } catch (error) {
      console.error('Error saving leave request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit leave request');
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
            console.log('🔵 Request Leave button clicked');
            console.log('📊 Current showLeaveForm state:', showLeaveForm);
            setShowLeaveForm(true);
            console.log('✅ showLeaveForm set to true');
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
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          {leaveHistory && leaveHistory.length > 0 ? (
            leaveHistory.map((leave) => (
              <div key={leave._id} className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-foreground/10 hover:border-foreground/20 hover:shadow-md transition-all duration-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 sm:gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">{leave.leaveType || leave.type || 'Leave'}</h4>
                      {((leave as any).isHourlyLeave || (leave as any).isShortLeave) && (
                        <Badge variant="outline" className="rounded-lg text-xs flex-shrink-0">
                          <Clock className="w-3 h-3 mr-1" />
                          Hourly
                        </Badge>
                      )}
                      {((leave as any).isHalfDay && (leave as any).halfDaySession === 'first_half') && (
                        <Badge variant="outline" className="rounded-lg text-xs flex-shrink-0">First half</Badge>
                      )}
                      {((leave as any).isHalfDay && (leave as any).halfDaySession === 'second_half') && (
                        <Badge variant="outline" className="rounded-lg text-xs flex-shrink-0">Second half</Badge>
                      )}
                      <Badge
                        variant={
                          leave.status === 'approved' ? 'default' :
                          leave.status === 'pending' ? 'secondary' :
                          'destructive'
                        }
                        className="rounded-lg text-xs flex-shrink-0"
                      >
                        {leave.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {leave.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {leave.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                        {leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{leave.reason}</p>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-primary flex-shrink-0">
                    {((leave as any).isHourlyLeave || (leave as any).isShortLeave) && (leave as any).hours 
                      ? `${(leave as any).hours.toFixed(1)} hrs` 
                      : `${leave.days || (((leave as any).isHalfDay) ? 0.5 : 1)} days`}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground pt-3 border-t border-foreground/10 mb-3">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4 text-primary/60 flex-shrink-0" />
                    <span>{new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {((leave as any).isHourlyLeave || (leave as any).isShortLeave) && (leave as any).startTime && (leave as any).endTime ? (
                    <>
                      <span className="text-foreground/40 hidden sm:inline">•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-primary/60 flex-shrink-0" />
                        <span>{(leave as any).startTime} - {(leave as any).endTime}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground/40 hidden sm:inline">→</span>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4 text-primary/60 flex-shrink-0" />
                        <span>{new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-foreground/10">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-lg flex-1 text-xs sm:text-sm"
                    type="button"
                    onClick={() => setViewingLeave(leave)}
                  >
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg flex-1 text-xs sm:text-sm"
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
                    <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg flex-1 text-xs sm:text-sm"
                    onClick={() => {
                      // Download functionality - generate PDF or download as file
                      const leaveData = `
Leave Request Details
=====================
Type: ${leave.leaveType || leave.type}
Status: ${leave.status}
From: ${new Date(leave.startDate).toLocaleDateString()}
To: ${new Date(leave.endDate).toLocaleDateString()}
Days: ${leave.days || 1}
Reason: ${leave.reason}
                      `;
                      const element = document.createElement('a');
                      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(leaveData));
                      element.setAttribute('download', `leave-request-${leave._id}.txt`);
                      element.style.display = 'none';
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                      // toast.success('Leave request downloaded');
                    }}
                  >
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-lg flex-1 text-xs sm:text-sm"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this leave request?')) {
                        try {
                          // Calculate days to restore
                          const startDate = new Date(leave.startDate);
                          const endDate = new Date(leave.endDate);
                          const daysToRestore = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          
                          // Get employeeId
                          let employeeId = user.employeeId;
                          if (!employeeId) {
                            const employeeResponse = await EmployeeService.getEmployeeByUserId(user.id);
                            if (employeeResponse && employeeResponse._id) {
                              employeeId = employeeResponse._id;
                            }
                          }
                          
                          // Delete the leave request
                          await LeaveRequestService.deleteLeaveRequest(leave._id);
                          
                          // Restore leaves to allocation (only if pending)
                          if (leave.status === 'pending' && employeeId) {
                            await LeaveAllocationService.restoreLeaves(employeeId, leave.leaveType || leave.type, daysToRestore, leave._id);
                          }
                          
                          // toast.success('Leave request deleted and leaves restored');
                          
                          // Refresh leave history
                          const updatedLeaves = await LeaveRequestService.getLeaveRequestsByUserId(user.id);
                          if (updatedLeaves.success && updatedLeaves.data) {
                            const leaveData = Array.isArray(updatedLeaves.data) ? updatedLeaves.data : updatedLeaves.data.data || [];
                            setLeaveHistory(leaveData);
                          }
                          
                          // Refresh balance
                          if (employeeId) {
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = now.getMonth() + 1;
                            
                            const balanceResponse = await LeaveAllocationService.getEmployeeBalance(employeeId, year, month);
                            if (balanceResponse.success) {
                              const parsed = parseBalanceApiResponse(balanceResponse);
                              setLeaveBalance(parsed.balances);
                              setHasLeaveAllocation(parsed.hasAllocation);
                            }
                          }
                        } catch (error) {
                          console.error('Error deleting leave request:', error);
                          // toast.error('Failed to delete leave request');
                        }
                      }
                    }}
                    disabled={leave.status !== 'pending'}
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 sm:py-12">
              <CalendarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mx-auto mb-2 sm:mb-3" />
              <p className="text-muted-foreground font-medium text-sm sm:text-base">No leave requests yet</p>
              <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">Click the "Request Leave" button to submit your first leave request</p>
            </div>
          )}
        </div>
      </Card>

      {/* Leave Form Dialog - Mobile optimized */}
      <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
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
                    if (!enabled || key === 'vacation') return null; // Exclude vacation
                    
                    const leaveTypeLabels: { [key: string]: string } = {
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
                      sandwichLeave: 'Sandwich Leave'
                    };
                    
                    return (
                      <SelectItem key={key} value={leaveTypeLabels[key]} className="rounded-lg">
                        {leaveTypeLabels[key]}
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
                className="flex-1 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl" 
                onClick={handleSubmitLeave}
              >
                {editingLeaveId ? 'Save Changes' : 'Submit Request'}
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
