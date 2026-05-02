import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Calendar } from '../../components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

interface LeaveRequest {
  _id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

export default function Leave() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    type: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Fetch leave requests from API
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const response = await LeaveRequestService.getLeaveRequestsByUserId(user.id);
        if (response.success && response.data) {
          setLeaveHistory(response.data);
        }
      } catch (error) {
        console.error('Error fetching leave requests:', error);
        toast.error('Failed to load leave requests');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveRequests();
  }, [user]);

  // Calculate leave balance from real data
  const leaveBalance = [
    { type: 'Vacation', total: 20, used: leaveHistory.filter(l => l.type === 'Vacation' && l.status === 'approved').length, remaining: 20 - leaveHistory.filter(l => l.type === 'Vacation' && l.status === 'approved').length, color: 'bg-primary' },
    { type: 'Sick Leave', total: 12, used: leaveHistory.filter(l => l.type === 'Sick Leave' && l.status === 'approved').length, remaining: 12 - leaveHistory.filter(l => l.type === 'Sick Leave' && l.status === 'approved').length, color: 'bg-secondary' },
    { type: 'Personal', total: 8, used: leaveHistory.filter(l => l.type === 'Personal' && l.status === 'approved').length, remaining: 8 - leaveHistory.filter(l => l.type === 'Personal' && l.status === 'approved').length, color: 'bg-accent' },
    { type: 'Emergency', total: 5, used: leaveHistory.filter(l => l.type === 'Emergency' && l.status === 'approved').length, remaining: 5 - leaveHistory.filter(l => l.type === 'Emergency' && l.status === 'approved').length, color: 'bg-destructive' },
  ];

  // Handle leave request submission
  const handleSubmitLeave = async () => {
    if (!user?.id || !formData.type || !formData.startDate || !formData.endDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const leaveData = {
        userId: user.id,
        employeeName: user.name,
        type: formData.type,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        orgId: 'system'
      };

      const response = await LeaveRequestService.createLeaveRequest(leaveData);
      
      if (response.success) {
        toast.success('Leave request submitted successfully');
        setOpen(false);
        setFormData({ type: '', startDate: '', endDate: '', reason: '' });
        
        // Refresh leave requests
        const updatedLeaves = await LeaveRequestService.getLeaveRequestsByUserId(user.id);
        if (updatedLeaves.success && updatedLeaves.data) {
          setLeaveHistory(updatedLeaves.data);
        }
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error('Failed to submit leave request');
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Leave Management</h1>
          <p className="text-muted-foreground">Manage your leave requests and balance</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
              <DialogDescription>Submit a new leave request</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Leave Type</Label>
                <Select onValueChange={(value) => setFormData({...formData, type: value})}>
                  <SelectTrigger className="rounded-xl mt-2">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vacation">Vacation</SelectItem>
                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
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
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl" onClick={handleSubmitLeave}>
                  Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {leaveBalance.map((leave, index) => (
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
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold text-primary">{leave.remaining} days</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Calendar and History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Leave Calendar</h3>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-xl"
          />
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-sm text-muted-foreground">Rejected</span>
            </div>
          </div>
        </Card>

        {/* Leave History */}
        <Card className="lg:col-span-2 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-lg">Leave History</h3>
            <p className="text-sm text-muted-foreground">Your leave request history</p>
          </div>
          <div className="p-6 space-y-4">
            {leaveHistory.map((leave) => (
              <div key={leave.id} className="p-4 rounded-xl bg-accent/50 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{leave.type}</h4>
                      <Badge
                        variant={
                          leave.status === 'Approved' ? 'default' :
                          leave.status === 'Pending' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {leave.status === 'Approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {leave.status === 'Pending' && <Clock className="w-3 h-3 mr-1" />}
                        {leave.status === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                        {leave.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{leave.reason}</p>
                  </div>
                  <span className="text-sm font-medium text-primary">{leave.days} days</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{leave.from}</span>
                  </div>
                  <span>to</span>
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{leave.to}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
