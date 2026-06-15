import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, Loader2, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react';
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

interface BulkActionResult {
  successful: number;
  failed: number;
  errors: string[];
}

export default function LeaveRequests() {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);

  // Bulk action states
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
  const [showBulkRejectConfirm, setShowBulkRejectConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkActionResult, setBulkActionResult] = useState<BulkActionResult | null>(null);
  const [showBulkResult, setShowBulkResult] = useState(false);

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
      
      // Optimistic update: update local state without full refetch
      setLeaveRequests(prev => prev.map(req => 
        req._id === selectedRequest._id 
          ? { ...req, status: 'approved' }
          : req
      ));
      
      toast.success('Leave request approved successfully');
      setShowApproveDialog(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Failed to approve leave request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve leave request');
      // On error, refetch to get latest state
      fetchLeaveRequests();
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
      
      // Optimistic update: update local state without full refetch
      setLeaveRequests(prev => prev.map(req => 
        req._id === selectedRequest._id 
          ? { ...req, status: 'rejected' }
          : req
      ));
      
      toast.success('Leave request rejected successfully');
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Failed to reject leave request:', error);
      toast.error('Failed to reject leave request');
      // On error, refetch to get latest state
      fetchLeaveRequests();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = (requestId: string) => {
    setDeletingRequestId(requestId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingRequestId) return;

    try {
      setActionLoading(true);
      await LeaveRequestService.deleteLeaveRequest(deletingRequestId);
      
      // Optimistic update: remove from local state
      setLeaveRequests(prev => prev.filter(req => req._id !== deletingRequestId));
      
      toast.success('Leave request deleted successfully');
      setShowDeleteConfirm(false);
      setDeletingRequestId(null);
    } catch (error) {
      console.error('Failed to delete leave request:', error);
      toast.error('Failed to delete leave request');
      // On error, refetch to get latest state
      fetchLeaveRequests();
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelectRequest = (requestId: string) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const toggleSelectAllPending = () => {
    const pendingRequests = leaveRequests.filter(req => req.status === 'pending');
    if (selectedRequests.size === pendingRequests.length && pendingRequests.length > 0) {
      // Deselect all
      setSelectedRequests(new Set());
    } else {
      // Select all pending
      setSelectedRequests(new Set(pendingRequests.map(req => req._id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.size === 0) {
      toast.error('Please select leave requests to approve');
      return;
    }

    try {
      setBulkActionLoading(true);
      const requestIds = Array.from(selectedRequests);
      const result = await LeaveRequestService.bulkApproveLeaveRequests(requestIds);
      
      // Optimistic update: update local state
      setLeaveRequests(prev => prev.map(req =>
        requestIds.includes(req._id) && req.status === 'pending'
          ? { ...req, status: 'approved' }
          : req
      ));
      
      setBulkActionResult({
        successful: result?.modifiedCount || requestIds.length,
        failed: 0,
        errors: []
      });
      setShowBulkResult(true);
      setSelectedRequests(new Set());
      setShowBulkApproveConfirm(false);
      
      toast.success(`${requestIds.length} leave requests approved successfully`);
    } catch (error) {
      console.error('Failed to bulk approve:', error);
      const errorMsg = error instanceof Error ? error.message : 'Bulk approval failed';
      setBulkActionResult({
        successful: 0,
        failed: selectedRequests.size,
        errors: [errorMsg]
      });
      setShowBulkResult(true);
      toast.error(errorMsg);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRequests.size === 0) {
      toast.error('Please select leave requests to reject');
      return;
    }

    if (!bulkRejectionReason.trim()) {
      toast.error('Please provide a rejection reason for bulk rejection');
      return;
    }

    try {
      setBulkActionLoading(true);
      const requestIds = Array.from(selectedRequests);
      const result = await LeaveRequestService.bulkRejectLeaveRequests(requestIds, bulkRejectionReason);
      
      // Optimistic update: update local state
      setLeaveRequests(prev => prev.map(req =>
        requestIds.includes(req._id) && req.status === 'pending'
          ? { ...req, status: 'rejected' }
          : req
      ));
      
      setBulkActionResult({
        successful: result?.modifiedCount || requestIds.length,
        failed: 0,
        errors: []
      });
      setShowBulkResult(true);
      setSelectedRequests(new Set());
      setBulkRejectionReason('');
      setShowBulkRejectConfirm(false);
      
      toast.success(`${requestIds.length} leave requests rejected successfully`);
    } catch (error) {
      console.error('Failed to bulk reject:', error);
      const errorMsg = error instanceof Error ? error.message : 'Bulk rejection failed';
      setBulkActionResult({
        successful: 0,
        failed: selectedRequests.size,
        errors: [errorMsg]
      });
      setShowBulkResult(true);
      toast.error(errorMsg);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRequests.size === 0) {
      toast.error('Please select leave requests to delete');
      return;
    }

    try {
      setBulkActionLoading(true);
      const requestIds = Array.from(selectedRequests);
      
      // CRITICAL: Call bulkDelete service, NOT bulkReject
      // Bug fix: Ensure endpoint is /leave-requests/bulk-delete, NOT /leave-requests/bulk-reject
      const result = await LeaveRequestService.bulkDeleteLeaveRequests(requestIds);
      
      if (!result) {
        throw new Error('No response from server');
      }
      
      // Optimistic update: remove deleted requests from local state
      // Only filter out requests that were actually deleted
      setLeaveRequests(prev => prev.filter(req => !requestIds.includes(req._id)));
      
      setBulkActionResult({
        successful: result?.deletedCount || requestIds.length,
        failed: 0,
        errors: []
      });
      setShowBulkResult(true);
      setSelectedRequests(new Set());
      setShowBulkDeleteConfirm(false);
      
      toast.success(`${requestIds.length} leave request(s) deleted successfully`);
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      const errorMsg = error instanceof Error ? error.message : 'Bulk deletion failed';
      setBulkActionResult({
        successful: 0,
        failed: selectedRequests.size,
        errors: [errorMsg]
      });
      setShowBulkResult(true);
      toast.error(errorMsg);
      
      // On error, refetch to ensure UI is in sync with server state
      await fetchLeaveRequests();
    } finally {
      setBulkActionLoading(false);
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

      {/* Bulk Action Bar */}
      {selectedRequests.size > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="text-sm font-medium text-blue-900">
            {selectedRequests.size} leave request{selectedRequests.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => setShowBulkApproveConfirm(true)}
              disabled={bulkActionLoading}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Bulk Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => setShowBulkRejectConfirm(true)}
              disabled={bulkActionLoading}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Bulk Reject
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-lg"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkActionLoading}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Bulk Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg"
              onClick={() => setSelectedRequests(new Set())}
              disabled={bulkActionLoading}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

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
                  <th className="p-4 text-left w-12">
                    <input
                      type="checkbox"
                      checked={
                        leaveRequests.filter(req => req.status === 'pending').length > 0 &&
                        selectedRequests.size === leaveRequests.filter(req => req.status === 'pending').length
                      }
                      onChange={toggleSelectAllPending}
                      className="w-4 h-4 rounded border-gray-300"
                      title="Select all pending requests"
                    />
                  </th>
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
                    <td className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedRequests.has(request._id)}
                        onChange={() => toggleSelectRequest(request._id)}
                        disabled={!isPending(request.status)}
                        className="w-4 h-4 rounded border-gray-300 disabled:opacity-50"
                        title={isPending(request.status) ? 'Select for bulk actions' : 'Can only select pending requests'}
                      />
                    </td>
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
                        {(() => {
                          const s = String(request.status || 'pending');
                          return s.charAt(0).toUpperCase() + s.slice(1);
                        })()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowViewDialog(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {isPending(request.status) && (
                          <>
                            <Button
                              type="button"
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
                              type="button"
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
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteConfirm(request._id)}
                              disabled={actionLoading}
                              title="Delete this pending leave request"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
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

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Leave Request Details</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Full request information
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-2 py-2 text-sm">
              <p>
                <span className="font-medium">Employee:</span> {selectedRequest.employeeName}
              </p>
              <p>
                <span className="font-medium">Type:</span>{' '}
                {selectedRequest.type || selectedRequest.leaveType}
              </p>
              <p>
                <span className="font-medium">Period:</span>{' '}
                {new Date(selectedRequest.startDate).toLocaleDateString()} –{' '}
                {new Date(selectedRequest.endDate).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium">Status:</span>{' '}
                {String(selectedRequest.status || 'pending')}
              </p>
              <p>
                <span className="font-medium">Reason:</span> {selectedRequest.reason || '—'}
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => setShowViewDialog(false)}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">Delete Leave Request</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this pending leave request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletingRequestId(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={confirmDelete}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Approve Confirmation Dialog */}
      <Dialog open={showBulkApproveConfirm} onOpenChange={setShowBulkApproveConfirm}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Approve Leave Requests</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to approve {selectedRequests.size} leave request{selectedRequests.size !== 1 ? 's' : ''}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-48 overflow-y-auto text-sm">
            {Array.from(selectedRequests).map(requestId => {
              const req = leaveRequests.find(r => r._id === requestId);
              return req ? (
                <div key={requestId} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{req.employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {req.type} • {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()}
                  </p>
                </div>
              ) : null;
            })}
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowBulkApproveConfirm(false)}
              disabled={bulkActionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700"
              onClick={handleBulkApprove}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve All
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Confirmation Dialog */}
      <Dialog open={showBulkRejectConfirm} onOpenChange={setShowBulkRejectConfirm}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Reject Leave Requests</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Provide a reason for rejecting {selectedRequests.size} leave request{selectedRequests.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Rejection Reason</Label>
              <Textarea
                className="rounded-xl mt-2 border-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none"
                placeholder="Enter reason for bulk rejection..."
                rows={3}
                value={bulkRejectionReason}
                onChange={(e) => setBulkRejectionReason(e.target.value)}
              />
            </div>
            <div className="max-h-32 overflow-y-auto text-sm bg-gray-50 p-2 rounded">
              {Array.from(selectedRequests).map(requestId => {
                const req = leaveRequests.find(r => r._id === requestId);
                return req ? (
                  <div key={requestId} className="text-xs py-1">
                    <span className="font-medium">{req.employeeName}</span> - {req.type}
                  </div>
                ) : null;
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => {
                setShowBulkRejectConfirm(false);
                setBulkRejectionReason('');
              }}
              disabled={bulkActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={handleBulkReject}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject All
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">Bulk Delete Leave Requests</DialogTitle>
            <DialogDescription className="text-red-700">
              Are you sure you want to delete {selectedRequests.size} leave request{selectedRequests.size !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto text-sm bg-red-50 p-3 rounded">
            {Array.from(selectedRequests).map(requestId => {
              const req = leaveRequests.find(r => r._id === requestId);
              return req ? (
                <div key={requestId} className="text-xs py-1">
                  <span className="font-medium">{req.employeeName}</span> - {req.type} ({new Date(req.startDate).toLocaleDateString()})
                </div>
              ) : null;
            })}
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowBulkDeleteConfirm(false)}
              disabled={bulkActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Result Dialog */}
      <Dialog open={showBulkResult} onOpenChange={setShowBulkResult}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Action Summary</DialogTitle>
          </DialogHeader>
          {bulkActionResult && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-medium">Successful</p>
                  <p className="text-2xl font-bold text-green-700">{bulkActionResult.successful}</p>
                </div>
                {bulkActionResult.failed > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-600 font-medium">Failed</p>
                    <p className="text-2xl font-bold text-red-700">{bulkActionResult.failed}</p>
                  </div>
                )}
              </div>
              {bulkActionResult.errors.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs text-red-600 font-medium mb-2">Errors</p>
                  <div className="space-y-1">
                    {bulkActionResult.errors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-700">{error}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Button
            className="w-full rounded-xl"
            onClick={() => setShowBulkResult(false)}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
