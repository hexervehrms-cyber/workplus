import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, Search, Filter, Check, X, Clock } from 'lucide-react';
import { Calendar as CalendarComponent } from '../../components/ui/calendar';
import { LeaveRequestService } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { socketService } from '../../utils/socket';

// Error boundary to catch any runtime errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: unknown }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('Admin Leave Requests Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold text-red-600">Something went wrong</h2>
          <p className="mb-4 text-muted-foreground">
            There was an error loading the leave requests page.
          </p>
          <Button onClick={() => window.location.reload()} className="rounded-xl">
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: string;
  status: string;
  appliedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

function LeaveRequestsContent() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showCalendar, setShowCalendar] = useState(true);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const { user } = useAuth();
  const { socketConnected } = useAuth();

  // Fetch leave requests on component mount
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        const requestsData = await LeaveRequestService.getAllLeaveRequests();
        setLeaveRequests(requestsData || []);
      } catch (error) {
        console.error('Failed to fetch leave requests:', error);
      }
    };

    fetchLeaveRequests();
  }, []);

  // Listen for real-time Socket.IO events
  useEffect(() => {
    if (!socketConnected) return;

    socketService.on('leave_created', (data) => {
      console.log('New leave request created:', data);
      setLeaveRequests(prev => [data, ...prev]);
    });

    socketService.on('leave_updated', (data) => {
      console.log('Leave request updated:', data);
      setLeaveRequests(prev => 
        prev.map(request => 
          request.id === data.id ? data : request
        )
      );
    });

    socketService.on('leave_deleted', (data) => {
      console.log('Leave request deleted:', data);
      setLeaveRequests(prev => 
        prev.filter(request => request.id !== data.id)
      );
    });

    // Cleanup on unmount
    return () => {
      socketService.off('leave_created');
      socketService.off('leave_updated');
      socketService.off('leave_deleted');
    };
  }, [socketConnected]);

  const handleBulkApprove = async () => {
    try {
      setLoading(true);
      const approvedRequests = await LeaveRequestService.bulkApproveLeaveRequests(Array.from(selectedRequests));
      if (approvedRequests) {
        setLeaveRequests(prev => 
          prev.map(request => 
            approvedRequests.find(approved => approved.id === request.id) 
              ? approvedRequests.find(approved => approved.id === request.id)!
              : request
          )
        );
        setSelectedRequests(new Set());
        setBulkAction(null);
      }
    } catch (error) {
      console.error('Failed to bulk approve leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = async () => {
    try {
      setLoading(true);
      const rejectedRequests = await LeaveRequestService.bulkRejectLeaveRequests(Array.from(selectedRequests), 'Bulk rejected by admin');
      if (rejectedRequests) {
        setLeaveRequests(prev => 
          prev.map(request => 
            rejectedRequests.find(rejected => rejected.id === request.id) 
              ? rejectedRequests.find(rejected => rejected.id === request.id)!
              : request
          )
        );
        setSelectedRequests(new Set());
        setBulkAction(null);
      }
    } catch (error) {
      console.error('Failed to bulk reject leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setLoading(true);
      const approvedRequest = await LeaveRequestService.approveLeaveRequest(requestId);
      if (approvedRequest) {
        setLeaveRequests(prev => 
          prev.map(request => 
            request.id === requestId 
              ? approvedRequest
              : request
          )
        );
        setSelectedRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(requestId);
          return newSet;
        });
        setBulkAction(null);
      }
    } catch (error) {
      console.error('Failed to approve leave request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setLoading(true);
      const rejectedRequest = await LeaveRequestService.rejectLeaveRequest(requestId, 'Rejected by admin');
      if (rejectedRequest) {
        setLeaveRequests(prev => 
          prev.map(request => 
            request.id === requestId 
              ? rejectedRequest
              : request
          )
        );
        setSelectedRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(requestId);
          return newSet;
        });
        setBulkAction(null);
      }
    } catch (error) {
      console.error('Failed to reject leave request:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const pendingCount = leaveRequests.filter(req => req.status === 'pending').length;
  const approvedCount = leaveRequests.filter(req => req.status === 'approved').length;
  const rejectedCount = leaveRequests.filter(req => req.status === 'rejected').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Requests</h1>
          <p className="text-muted-foreground">Manage employee leave requests</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              className="rounded-xl"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {showCalendar ? 'Hide Calendar' : 'View Calendar'}
            </Button>
            <Button variant="outline" className="rounded-xl">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
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
      </div>

      <div className="flex gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leave requests..."
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-4"
          />
        </div>
      </div>

      {showCalendar ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="rounded-xl p-6 lg:col-span-2">
            <h3 className="mb-4 text-lg font-semibold">Leave Calendar</h3>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-xl"
            />
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </Card>

            <Card className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedCount}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </Card>

            <Card className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <X className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rejectedCount}</p>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left">
                      <input
                        type="checkbox"
                        checked={leaveRequests.length > 0 && selectedRequests.size === leaveRequests.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRequests(new Set(leaveRequests.map(req => req.id)));
                          } else {
                            setSelectedRequests(new Set());
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="p-4 text-left">Employee</th>
                    <th className="p-4 text-left">Leave Type</th>
                    <th className="p-4 text-left">Duration</th>
                    <th className="p-4 text-left">Reason</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((request) => (
                    <tr key={request.id} className="border-b hover:bg-accent/50">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedRequests.has(request.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRequests(prev => new Set(prev).add(request.id));
                            } else {
                              setSelectedRequests(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(request.id);
                                return newSet;
                              });
                            }
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-medium">{request.employeeName.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium">{request.employeeName}</p>
                            <p className="text-sm text-muted-foreground">
                              {request.employeeId}@company.com
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                          {request.type}
                        </span>
                      </td>

                      <td className="p-4">
                        <div>
                          <p className="font-medium">
                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                          </p>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="text-sm">{request.reason}</p>
                      </td>

                      <td className="p-4">
                        <span className={`rounded-full px-2 py-1 text-xs ${
                          request.status === 'approved' 
                            ? 'bg-green-100 text-green-800'
                            : request.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {selectedRequests.has(request.id) ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </Button>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReject(request.id)}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function LeaveRequests() {
  return (
    <ErrorBoundary>
      <LeaveRequestsContent />
    </ErrorBoundary>
  );
}