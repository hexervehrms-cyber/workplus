import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Plus, Edit2, Download, Trash2 } from 'lucide-react';
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

export default function Leave() {
  const { user } = useAuth();
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [enabledLeaveTypes, setEnabledLeaveTypes] = useState<any>(null);
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
    isShortLeave: false
  });

  // Fetch leave requests and balance
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Fetch leave requests
        const leaveResponse = await LeaveRequestService.getLeaveRequestsByUserId(user.id);
        console.log('Leave requests response:', leaveResponse);
        
        if (leaveResponse.success && leaveResponse.data) {
          // Handle both array and paginated response
          const leaveData = Array.isArray(leaveResponse.data) ? leaveResponse.data : leaveResponse.data.data || [];
          setLeaveHistory(leaveData);
        }

        // Fetch leave balance from allocation
        let employeeId = user.employeeId;
        
        // If employeeId is not set, try to fetch it from the employee service
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
          }
        }
        
        if (employeeId) {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          
          console.log('Fetching balance for:', {
            employeeId,
            year,
            month
          });
          
          const balanceResponse = await LeaveAllocationService.getEmployeeBalance(employeeId, year, month);
          console.log('Balance response:', balanceResponse);
          
          if (balanceResponse.success && balanceResponse.data) {
            setLeaveBalance(balanceResponse.data);
          }
        } else {
          console.warn('No employeeId available to fetch balance');
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
          }
        } catch (error) {
          console.error('Error fetching enabled leave types:', error);
          // Set default enabled types if fetch fails
          setEnabledLeaveTypes({
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
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Calculate leave balance - only show enabled leave types (excluding vacation)
  const allLeaveBalanceCards = [
    { 
      type: 'Sick Leave', 
      key: 'sickLeave',
      total: leaveBalance?.sickLeave?.allocated || 0, 
      used: leaveBalance?.sickLeave?.used || 0, 
      pending: leaveBalance?.sickLeave?.pending || 0,
      color: 'bg-secondary' 
    },
    { 
      type: 'Casual Leave', 
      key: 'casualLeave',
      total: leaveBalance?.casualLeave?.allocated || 0, 
      used: leaveBalance?.casualLeave?.used || 0, 
      pending: leaveBalance?.casualLeave?.pending || 0,
      color: 'bg-accent' 
    },
    { 
      type: 'Earned Leave', 
      key: 'earnedLeave',
      total: leaveBalance?.earnedLeave?.allocated || 0, 
      used: leaveBalance?.earnedLeave?.used || 0, 
      pending: leaveBalance?.earnedLeave?.pending || 0,
      color: 'bg-yellow-500' 
    },
    { 
      type: 'Medical Leave', 
      key: 'medicalLeave',
      total: leaveBalance?.medicalLeave?.allocated || 0, 
      used: leaveBalance?.medicalLeave?.used || 0, 
      pending: leaveBalance?.medicalLeave?.pending || 0,
      color: 'bg-red-500' 
    },
    { 
      type: 'Maternity Leave', 
      key: 'maternityLeave',
      total: leaveBalance?.maternityLeave?.allocated || 0, 
      used: leaveBalance?.maternityLeave?.used || 0, 
      pending: leaveBalance?.maternityLeave?.pending || 0,
      color: 'bg-pink-500' 
    },
    { 
      type: 'Paternity Leave', 
      key: 'paternityLeave',
      total: leaveBalance?.paternityLeave?.allocated || 0, 
      used: leaveBalance?.paternityLeave?.used || 0, 
      pending: leaveBalance?.paternityLeave?.pending || 0,
      color: 'bg-blue-500' 
    },
    { 
      type: 'Compensatory Off', 
      key: 'compensatoryOff',
      total: leaveBalance?.compensatoryOff?.allocated || 0, 
      used: leaveBalance?.compensatoryOff?.used || 0, 
      pending: leaveBalance?.compensatoryOff?.pending || 0,
      color: 'bg-green-500' 
    },
    { 
      type: 'Personal', 
      key: 'personal',
      total: leaveBalance?.personal?.allocated || 0, 
      used: leaveBalance?.personal?.used || 0, 
      pending: leaveBalance?.personal?.pending || 0,
      color: 'bg-purple-500' 
    },
    { 
      type: 'Emergency', 
      key: 'emergency',
      total: leaveBalance?.emergency?.allocated || 0, 
      used: leaveBalance?.emergency?.used || 0, 
      pending: leaveBalance?.emergency?.pending || 0,
      color: 'bg-orange-500' 
    },
    { 
      type: 'NCNS', 
      key: 'ncns',
      total: leaveBalance?.ncns?.allocated || 0, 
      used: leaveBalance?.ncns?.used || 0, 
      pending: leaveBalance?.ncns?.pending || 0,
      color: 'bg-gray-500' 
    },
    { 
      type: 'Sandwich Leave', 
      key: 'sandwichLeave',
      total: leaveBalance?.sandwichLeave?.allocated || 0, 
      used: leaveBalance?.sandwichLeave?.used || 0, 
      pending: leaveBalance?.sandwichLeave?.pending || 0,
      color: 'bg-indigo-500' 
    },
  ];

  // Filter leave balance cards based on enabled leave types (vacation is excluded)
  const leaveBalanceCards = enabledLeaveTypes 
    ? allLeaveBalanceCards.filter(card => 
        card.key !== 'vacation' && enabledLeaveTypes[card.key] === true
      )
    : allLeaveBalanceCards.filter(card => card.key !== 'vacation');

  leaveBalanceCards.forEach(leave => {
    leave['remaining'] = leave.total - leave.used - leave.pending;
  });

  // Submit or update leave request
  const handleSubmitLeave = async () => {
    if (!user?.id || !formData.type || !formData.startDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate short leave
    if (formData.isShortLeave) {
      if (!formData.startTime || !formData.endTime) {
        toast.error('Please select start and end times for short leave');
        return;
      }
      // For short leave, end date should be same as start date or not required
      if (!formData.endDate) {
        setFormData(prev => ({ ...prev, endDate: prev.startDate }));
      }
    } else {
      if (!formData.endDate) {
        toast.error('Please select end date');
        return;
      }
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
      const endDate = new Date(formData.endDate || formData.startDate);

      let days = 0;
      let hours = 0;

      // Calculate days or hours based on leave type
      if (formData.isShortLeave && formData.startTime && formData.endTime) {
        // Parse time strings (HH:MM format)
        const [startHour, startMinute] = formData.startTime.split(':').map(Number);
        const [endHour, endMinute] = formData.endTime.split(':').map(Number);
        
        // Calculate hours
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        const totalMinutes = endMinutes - startMinutes;
        
        if (totalMinutes <= 0) {
          toast.error('End time must be after start time');
          return;
        }
        
        hours = totalMinutes / 60;
        days = hours / 8; // Convert hours to fractional days (assuming 8-hour workday)
        
        console.log('Short leave calculation:', {
          startTime: formData.startTime,
          endTime: formData.endTime,
          hours,
          days
        });
      } else {
        // Calculate number of days for full-day leave
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
        isShortLeave: formData.isShortLeave,
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
        isShortLeave: formData.isShortLeave
      };

      // Add time fields if it's a short leave
      if (formData.isShortLeave) {
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
        
        if (formData.isShortLeave) {
          toast.success(`Short leave request submitted successfully (${hours.toFixed(1)} hours)`);
        } else {
          toast.success('Leave request submitted successfully');
        }
      }
      
      if (response.success) {
        setShowLeaveForm(false);
        setEditingLeaveId(null);
        setFormData({ type: '', startDate: '', endDate: '', startTime: '', endTime: '', reason: '', isShortLeave: false });
        
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
          if (balanceResponse.success && balanceResponse.data) {
            setLeaveBalance(balanceResponse.data);
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
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Leave History</h1>
          <p className="text-muted-foreground">View and manage your leave requests</p>
        </div>
        <Button 
          onClick={() => setShowLeaveForm(true)}
          className="rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Request Leave
        </Button>
      </div>

      {/* Leave Balance KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {leaveBalanceCards.map((leave, index) => (
          <Card key={index} className="p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{leave.type}</h3>
              <div className={`w-3 h-3 rounded-full ${leave.color}`} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{leave.total} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">{leave.used} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium text-yellow-600">{leave.pending} days</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold text-primary">{leave.remaining} days</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Leave History */}
      <Card className="rounded-2xl overflow-hidden shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
        <div className="p-6 border-b border-foreground/10 bg-muted/30">
          <h3 className="font-semibold text-lg text-foreground">Your Leave Requests</h3>
          <p className="text-sm text-muted-foreground mt-1">All your leave requests and their status</p>
        </div>
        <div className="p-6 space-y-4">
          {leaveHistory && leaveHistory.length > 0 ? (
            leaveHistory.map((leave) => (
              <div key={leave._id} className="p-4 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-foreground/10 hover:border-foreground/20 hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-foreground">{leave.leaveType || leave.type || 'Leave'}</h4>
                      {(leave as any).isShortLeave && (
                        <Badge variant="outline" className="rounded-lg text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Short Leave
                        </Badge>
                      )}
                      <Badge
                        variant={
                          leave.status === 'approved' ? 'default' :
                          leave.status === 'pending' ? 'secondary' :
                          'destructive'
                        }
                        className="rounded-lg"
                      >
                        {leave.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {leave.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {leave.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                        {leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{leave.reason}</p>
                  </div>
                  <span className="text-sm font-bold text-primary ml-4">
                    {(leave as any).isShortLeave && (leave as any).hours 
                      ? `${(leave as any).hours.toFixed(1)} hrs` 
                      : `${leave.days || 1} days`}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-3 border-t border-foreground/10 mb-3">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4 text-primary/60" />
                    <span>{new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {(leave as any).isShortLeave && (leave as any).startTime && (leave as any).endTime ? (
                    <>
                      <span className="text-foreground/40">•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-primary/60" />
                        <span>{(leave as any).startTime} - {(leave as any).endTime}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground/40">→</span>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4 text-primary/60" />
                        <span>{new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 pt-3 border-t border-foreground/10">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg flex-1"
                    onClick={() => {
                      // Edit functionality - populate form with leave data
                      setEditingLeaveId(leave._id);
                      setFormData({
                        type: leave.leaveType || leave.type || '',
                        startDate: new Date(leave.startDate).toISOString().split('T')[0],
                        endDate: new Date(leave.endDate).toISOString().split('T')[0],
                        startTime: (leave as any).startTime || '',
                        endTime: (leave as any).endTime || '',
                        reason: leave.reason || '',
                        isShortLeave: (leave as any).isShortLeave || false
                      });
                      setShowLeaveForm(true);
                    }}
                    disabled={leave.status !== 'pending'}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg flex-1"
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
                      toast.success('Leave request downloaded');
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-lg flex-1"
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
                          
                          toast.success('Leave request deleted and leaves restored');
                          
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
                            if (balanceResponse.success && balanceResponse.data) {
                              setLeaveBalance(balanceResponse.data);
                            }
                          }
                        } catch (error) {
                          console.error('Error deleting leave request:', error);
                          toast.error('Failed to delete leave request');
                        }
                      }
                    }}
                    disabled={leave.status !== 'pending'}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No leave requests yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Click the "Request Leave" button to submit your first leave request</p>
            </div>
          )}
        </div>
      </Card>

      {/* Leave Form Dialog */}
      <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">Request Leave</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Submit a new leave request
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

            {/* Short Leave Toggle */}
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-muted/30 border border-foreground/10">
              <input
                type="checkbox"
                id="shortLeave"
                checked={formData.isShortLeave}
                onChange={(e) => {
                  const isShort = e.target.checked;
                  setFormData({
                    ...formData, 
                    isShortLeave: isShort,
                    endDate: isShort ? formData.startDate : formData.endDate
                  });
                }}
                className="w-4 h-4 rounded border-foreground/20 text-primary focus:ring-2 focus:ring-primary/20"
              />
              <Label htmlFor="shortLeave" className="text-sm font-medium text-foreground cursor-pointer">
                Short Leave (Hourly)
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-foreground">
                  {formData.isShortLeave ? 'Date' : 'From Date'}
                </Label>
                <Input 
                  type="date" 
                  className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  value={formData.startDate}
                  onChange={(e) => {
                    const newStartDate = e.target.value;
                    setFormData({
                      ...formData, 
                      startDate: newStartDate,
                      endDate: formData.isShortLeave ? newStartDate : formData.endDate
                    });
                  }}
                />
              </div>
              {!formData.isShortLeave && (
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

            {/* Time Pickers for Short Leave */}
            {formData.isShortLeave && (
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
                  setFormData({ type: '', startDate: '', endDate: '', startTime: '', endTime: '', reason: '', isShortLeave: false });
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
    </div>
  );
}
