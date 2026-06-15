import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { LeaveRequestService, extractApiList } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Suspense, lazy } from 'react';

// Lazy load leave sub-components
const HolidayCalendar = lazy(() => import('./HolidayCalendar'));
const LeaveAllocation = lazy(() => import('./LeaveAllocation'));
const LeaveSettings = lazy(() => import('./LeaveSettings'));

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
}

export default function LeaveManagementUnified() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') || 'requests') as string;
  
  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (currentTab === 'requests') {
      fetchLeaveRequests();
      const unsub = realTimeSocket.onLeaveUpdate(() => {
        void fetchLeaveRequests();
      });
      return () => unsub();
    }
  }, [currentTab]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
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
        }));
        setLeaveRequests(formattedRequests);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    try {
      setActionLoading(true);
      await LeaveRequestService.approveLeaveRequest(selectedRequest.id);
      toast.success('Leave request approved');
      setShowApproveDialog(false);
      await fetchLeaveRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    try {
      setActionLoading(true);
      await LeaveRequestService.rejectLeaveRequest(selectedRequest.id, rejectionReason);
      toast.success('Leave request rejected');
      setShowRejectDialog(false);
      setRejectionReason('');
      await fetchLeaveRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB');
  };

  const calculateLeaveDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 border-b border-border pb-4 mb-6">
      {[
        { id: 'requests', label: 'Leave Requests' },
        { id: 'calendar', label: 'Holiday Calendar' },
        { id: 'allocation', label: 'Leave Allocation' },
        { id: 'settings', label: 'Leave Settings' }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentTab === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leave Management</h1>
        <p className="text-muted-foreground">Manage employee leave requests, calendars, and policies</p>
      </div>

      {renderTabs()}

      {/* Leave Requests Tab */}
      {currentTab === 'requests' && (
        <div className="space-y-6">
          <Card className="rounded-xl">
            <div className="p-6">
              <h3 className="font-semibold mb-4">Leave Requests ({leaveRequests.length})</h3>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : leaveRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave requests found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Employee</th>
                        <th className="text-left p-4">Type</th>
                        <th className="text-left p-4">Start Date</th>
                        <th className="text-left p-4">End Date</th>
                        <th className="text-left p-4">Days</th>
                        <th className="text-left p-4">Status</th>
                        <th className="text-left p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRequests.map((request) => (
                        <tr key={request._id} className="border-b hover:bg-accent/50">
                          <td className="p-4">
                            <p className="font-medium">{request.employeeName}</p>
                          </td>
                          <td className="p-4">{request.type}</td>
                          <td className="p-4">{formatDate(request.startDate)}</td>
                          <td className="p-4">{formatDate(request.endDate)}</td>
                          <td className="p-4">{calculateLeaveDays(request.startDate, request.endDate)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                              {request.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowViewDialog(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {request.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowApproveDialog(true);
                                    }}
                                  >
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowRejectDialog(true);
                                    }}
                                  >
                                    <XCircle className="w-4 h-4 text-red-600" />
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
            </div>
          </Card>
        </div>
      )}

      {/* Holiday Calendar Tab */}
      {currentTab === 'calendar' && (
        <Suspense fallback={<div className="text-center py-8">Loading holiday calendar...</div>}>
          <HolidayCalendar />
        </Suspense>
      )}

      {/* Leave Allocation Tab */}
      {currentTab === 'allocation' && (
        <Suspense fallback={<div className="text-center py-8">Loading leave allocation...</div>}>
          <LeaveAllocation />
        </Suspense>
      )}

      {/* Leave Settings Tab */}
      {currentTab === 'settings' && (
        <Suspense fallback={<div className="text-center py-8">Loading leave settings...</div>}>
          <LeaveSettings />
        </Suspense>
      )}

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <Label>Employee</Label>
                <p className="text-sm font-medium">{selectedRequest.employeeName}</p>
              </div>
              <div>
                <Label>Leave Type</Label>
                <p className="text-sm font-medium">{selectedRequest.type}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <p className="text-sm font-medium">{formatDate(selectedRequest.startDate)}</p>
                </div>
                <div>
                  <Label>End Date</Label>
                  <p className="text-sm font-medium">{formatDate(selectedRequest.endDate)}</p>
                </div>
              </div>
              <div>
                <Label>Total Days</Label>
                <p className="text-sm font-medium">{calculateLeaveDays(selectedRequest.startDate, selectedRequest.endDate)}</p>
              </div>
              <div>
                <Label>Reason</Label>
                <p className="text-sm font-medium">{selectedRequest.reason}</p>
              </div>
              <div>
                <Label>Status</Label>
                <p className={`text-sm font-medium px-2 py-1 rounded-full w-fit ${getStatusColor(selectedRequest.status)}`}>
                  {selectedRequest.status}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Leave Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <p><strong>Employee:</strong> {selectedRequest.employeeName}</p>
              <p><strong>Period:</strong> {formatDate(selectedRequest.startDate)} to {formatDate(selectedRequest.endDate)}</p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowApproveDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <p><strong>Employee:</strong> {selectedRequest.employeeName}</p>
              <div>
                <Label>Reason for Rejection</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason..."
                  className="mt-2"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
