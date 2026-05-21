import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { LeaveRequestService, extractApiList } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

interface LeaveRequest {
  _id: string;
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: string;
  leaveType?: string;
  status: string;
  appliedAt: string;
  createdAt?: string;
  isHourlyLeave?: boolean;
  startTime?: string;
  endTime?: string;
}

export default function LeaveRequests() {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchLeaveRequests();
    const unsub = realTimeSocket.onLeaveUpdate(() => {
      void fetchLeaveRequests();
    });
    return () => unsub();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const requestsData = await LeaveRequestService.getAllLeaveRequests();
      const list = extractApiList(requestsData as { data?: unknown });

      if (list.length > 0) {
        const formattedRequests = list.map((req: any) => ({
          _id: req._id || req.id,
          id: req._id || req.id,
          employeeId: req.employeeId?._id || req.employeeId,
          employeeName: req.userId?.name || req.employeeName || 'Unknown',
          startDate: req.startDate,
          endDate: req.endDate,
          reason: req.reason || '',
          type: req.type || req.leaveType || 'Leave',
          leaveType: req.leaveType || req.type || 'Leave',
          status: req.status || 'pending',
          appliedAt: req.createdAt,
          createdAt: req.createdAt,
          isHourlyLeave: req.isHourlyLeave || false,
          startTime: req.startTime,
          endTime: req.endTime
        }));
        setLeaveRequests(formattedRequests);
      } else {
        setLeaveRequests([]);
      }
    } catch (error) {
      console.error('Failed to fetch leave requests:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      setError(errorMessage);
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest || !user) return;
    const approverId = user.userId || user.id;
    if (!approverId) return;

    try {
      setActionLoading(true);
      const res = await LeaveRequestService.approveLeaveRequest(selectedRequest._id, {
        approvedBy: approverId
      });
      if (res && (res as { success?: boolean }).success === false) {
        throw new Error((res as { message?: string }).message || 'Approval failed');
      }
      toast.success('Leave request approved successfully');
      setShowApproveDialog(false);
      setSelectedRequest(null);
      fetchLeaveRequests();
    } catch (error) {
      console.error('Failed to approve leave request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !user) return;
    const rejectorId = user.userId || user.id;
    if (!rejectorId) return;

    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      await LeaveRequestService.rejectLeaveRequest(selectedRequest._id, {
        rejectedBy: rejectorId,
        rejectionReason
      });
      toast.success('Leave request rejected successfully');
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchLeaveRequests();
    } catch (error) {
      console.error('Failed to reject leave request:', error);
      toast.error('Failed to reject leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-800';
    if (status === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const calculateHours = (request: LeaveRequest) => {
    if (!request.isHourlyLeave || !request.startTime || !request.endTime) {
      return null;
    }

    try {
      const [startHour, startMin] = request.startTime.split(':').map(Number);
      const [endHour, endMin] = request.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      const totalMinutes = endMinutes - startMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${hours}h`;
    } catch (error) {
      return null;
    }
  };

  const isPending = (status: string) => status === 'pending';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leave Requests</h1>
        <p className="text-muted-foreground">Manage employee leave requests</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error Loading Leave Requests</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchLeaveRequests();
              }}
              className="text-red-600 hover:text-red-700 text-sm font-medium mt-2 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <Card className="p-6 rounded-xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <p></p>
          </div>
        ) : leaveRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">No leave requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-4 text-left">Employee</th>
                  <th className="p-4 text-left">Leave Type</th>
                  <th className="p-4 text-left">Start Date</th>
                  <th className="p-4 text-left">End Date</th>
                  <th className="p-4 text-left">Hours</th>
                  <th className="p-4 text-left">Reason</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.id} className="border-b hover:bg-accent/50">
                    <td className="p-4 font-medium">{request.employeeName || 'Unknown'}</td>
                    <td className="p-4">{request.type || request.leaveType || 'Leave'}</td>
                    <td className="p-4">
                      {request.startDate ? new Date(request.startDate).toLocaleDateString() : 'N/A'}
                      {request.isHourlyLeave && request.startTime && (
                        <div className="text-xs text-muted-foreground">{request.startTime}</div>
                      )}
                    </td>
                    <td className="p-4">
                      {request.endDate ? new Date(request.endDate).toLocaleDateString() : 'N/A'}
                      {request.isHourlyLeave && request.endTime && (
                        <div className="text-xs text-muted-foreground">{request.endTime}</div>
                      )}
                    </td>
                    <td className="p-4">
                      {request.isHourlyLeave ? (
                        <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                          {calculateHours(request) || '-'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Full Day</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">{request.reason}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4">
                      {isPending(request.status) ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="rounded-lg bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowApproveDialog(true);
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-lg"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowRejectDialog(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Approve Leave Request</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to approve this leave request?
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Employee: <span className="text-foreground">{selectedRequest.employeeName}</span></p>
                <p className="text-sm font-medium">Leave Type: <span className="text-foreground">{selectedRequest.type || selectedRequest.leaveType}</span></p>
                <p className="text-sm font-medium">Period: <span className="text-foreground">{new Date(selectedRequest.startDate).toLocaleDateString()} - {new Date(selectedRequest.endDate).toLocaleDateString()}</span></p>
                {selectedRequest.isHourlyLeave && selectedRequest.startTime && selectedRequest.endTime && (
                  <>
                    <p className="text-sm font-medium">Time: <span className="text-foreground">{selectedRequest.startTime} - {selectedRequest.endTime}</span></p>
                    <p className="text-sm font-medium">Duration: <span className="text-foreground">{calculateHours(selectedRequest)}</span></p>
                  </>
                )}
                <p className="text-sm font-medium">Reason: <span className="text-foreground">{selectedRequest.reason}</span></p>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowApproveDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Reject Leave Request</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Please provide a reason for rejecting this leave request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Employee: <span className="text-foreground">{selectedRequest.employeeName}</span></p>
                <p className="text-sm font-medium">Leave Type: <span className="text-foreground">{selectedRequest.type || selectedRequest.leaveType}</span></p>
                <p className="text-sm font-medium">Period: <span className="text-foreground">{new Date(selectedRequest.startDate).toLocaleDateString()} - {new Date(selectedRequest.endDate).toLocaleDateString()}</span></p>
                {selectedRequest.isHourlyLeave && selectedRequest.startTime && selectedRequest.endTime && (
                  <>
                    <p className="text-sm font-medium">Time: <span className="text-foreground">{selectedRequest.startTime} - {selectedRequest.endTime}</span></p>
                    <p className="text-sm font-medium">Duration: <span className="text-foreground">{calculateHours(selectedRequest)}</span></p>
                  </>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground">Rejection Reason</Label>
                <Textarea
                  className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none"
                  placeholder="Enter reason for rejection..."
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
