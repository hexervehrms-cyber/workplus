import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar, 
  Heart, 
  Briefcase, 
  Home, 
  Plane, 
  Coffee, 
  AlertCircle,
  Bell,
  Filter,
  Loader2
} from 'lucide-react';
import { LeaveRequestService } from '../../utils/api';
import { toast } from 'sonner';

interface LeaveRequest {
  _id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: 'sick' | 'casual' | 'annual' | 'maternity' | 'paternity' | 'emergency';
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

const LeaveManagement: React.FC = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Fetch leave requests from API
  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const data = await LeaveRequestService.getAllLeaveRequests();
      setLeaveRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  // Listen for new leave requests (in real app, this would be WebSocket or polling)
  useEffect(() => {
    const handleNewLeaveRequest = (event: Event) => {
      const customEvent = event as CustomEvent;
      const newRequest = customEvent.detail as LeaveRequest;
      setLeaveRequests(prev => [newRequest, ...prev]);
      setShowNotification(true);
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => setShowNotification(false), 5000);
    };

    window.addEventListener('newLeaveRequest', handleNewLeaveRequest);
    return () => window.removeEventListener('newLeaveRequest', handleNewLeaveRequest);
  }, []);

  const handleApprove = async (requestId: string) => {
    try {
      setProcessing(requestId);
      await LeaveRequestService.approveLeaveRequest(requestId);
      toast.success('Leave request approved');
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve leave request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string, rejectionReason: string) => {
    try {
      setProcessing(requestId);
      await LeaveRequestService.rejectLeaveRequest(requestId, rejectionReason);
      toast.success('Leave request rejected');
      setSelectedRequest(null);
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject leave request');
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    try {
      const ids = Array.from(selectedRequests);
      await LeaveRequestService.bulkApproveLeaveRequests(ids);
      toast.success(`${ids.length} leave requests approved`);
      setSelectedRequests(new Set());
      setBulkAction(null);
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error('Failed to approve leave requests');
    }
  };

  const handleBulkReject = async () => {
    try {
      const ids = Array.from(selectedRequests);
      await LeaveRequestService.bulkRejectLeaveRequests(ids, 'Bulk rejected');
      toast.success(`${ids.length} leave requests rejected`);
      setSelectedRequests(new Set());
      setBulkAction(null);
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error('Failed to reject leave requests');
    }
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequests = filter === 'all' 
    ? leaveRequests 
    : leaveRequests.filter(req => req.status === filter);

  const pendingCount = leaveRequests.filter(req => req.status === 'pending').length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <Bell className="w-5 h-5" />
          <div>
            <p className="font-medium">New Leave Request Received!</p>
            <p className="text-sm">Employee has applied for leave</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowNotification(false)}
            className="text-white hover:bg-green-600"
          >
            ×
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Leave Management</h1>
          <p className="text-muted-foreground">Review and manage employee leave requests</p>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {pendingCount} Pending
            </Badge>
          )}
          <Button>
            <Bell className="w-4 h-4 mr-2" />
            Notify All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status === 'pending' && pendingCount > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedRequests.size > 0 && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setBulkAction('approve')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approve Selected ({selectedRequests.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkAction('reject')}
                >
                  Reject Selected ({selectedRequests.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Leave Requests Table */}
      <Card className="rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedRequests.size === filteredRequests.length && filteredRequests.every(req => selectedRequests.has(req.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRequests(new Set(filteredRequests.map(req => req.id)));
                      } else {
                        setSelectedRequests(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-4 font-medium">Employee</th>
                <th className="text-left p-4 font-medium">Type</th>
                <th className="text-left p-4 font-medium">Duration</th>
                <th className="text-left p-4 font-medium">Reason</th>
                <th className="text-left p-4 font-medium">Applied</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => {
                const LeaveTypeInfo = getLeaveTypeInfo(request.type);
                const startDate = new Date(request.startDate);
                const endDate = new Date(request.endDate);
                const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                
                return (
                  <tr key={request._id} className="border-b hover:bg-accent/50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedRequests.has(request._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRequests(prev => new Set(prev).add(request._id));
                          } else {
                            setSelectedRequests(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(request._id);
                              return newSet;
                            });
                          }
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{request.employeeName || 'Employee'}</p>
                        <p className="text-sm text-muted-foreground">{request.employeeId?._id || request.employeeId || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <LeaveTypeInfo.icon className="w-4 h-4" />
                        <Badge className={LeaveTypeInfo.color}>
                          {LeaveTypeInfo.label}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <p>{startDate.toLocaleDateString()}</p>
                        <p className="text-muted-foreground">to {endDate.toLocaleDateString()}</p>
                        <p className="font-medium">{duration} day{duration > 1 ? 's' : ''}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm max-w-xs truncate" title={request.reason}>
                        {request.reason}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">
                        {new Date(request.appliedAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="p-4">
                      <Badge className={getStatusColor(request.status)}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {request.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request._id)}
                              disabled={processing === request._id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {processing === request._id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setSelectedRequest(request)}
                              disabled={processing === request._id}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {request.status === 'approved' && (
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Approved by {request.approvedBy}</span>
                          </div>
                        )}
                        {request.status === 'rejected' && (
                          <div className="flex items-center gap-2 text-sm text-red-600">
                            <XCircle className="w-4 h-4" />
                            <span>Rejected by {request.rejectedBy}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Rejection Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Leave Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="font-medium">Employee: {selectedRequest.employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  Leave Period: {selectedRequest.startDate} to {selectedRequest.endDate}
                </p>
                <p className="text-sm text-muted-foreground">
                  Reason: {selectedRequest.reason}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Rejection Reason</label>
                <textarea
                  className="w-full p-2 border rounded-lg min-h-[100px]"
                  placeholder="Enter reason for rejection..."
                  onChange={(e) => setSelectedRequest({...selectedRequest, rejectionReason: e.target.value})}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedRequest._id, selectedRequest.rejectionReason || '')}
                  disabled={!selectedRequest.rejectionReason?.trim() || processing === selectedRequest._id}
                >
                  {processing === selectedRequest._id ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : null}
                  Reject Request
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default LeaveManagement;
