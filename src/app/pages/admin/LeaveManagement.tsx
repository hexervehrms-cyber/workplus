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
  Filter
} from 'lucide-react';

interface LeaveRequest {
  id: string;
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

  // Mock data - in real app, this would come from API
  useEffect(() => {
    // Simulate receiving leave requests from employees
    const mockRequests: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        startDate: '2024-04-20',
        endDate: '2024-04-22',
        reason: 'Family function',
        type: 'casual',
        status: 'pending',
        appliedAt: '2024-04-19T10:30:00Z'
      },
      {
        id: '2',
        employeeId: 'EMP-002',
        employeeName: 'Jane Smith',
        startDate: '2024-04-18',
        endDate: '2024-04-19',
        reason: 'Medical appointment',
        type: 'sick',
        status: 'approved',
        appliedAt: '2024-04-17T14:20:00Z',
        approvedAt: '2024-04-18T09:15:00Z',
        approvedBy: 'Admin User'
      },
      {
        id: '3',
        employeeId: 'EMP-003',
        employeeName: 'Mike Johnson',
        startDate: '2024-04-25',
        endDate: '2024-04-26',
        reason: 'Personal work',
        type: 'emergency',
        status: 'pending',
        appliedAt: '2024-04-19T11:45:00Z'
      }
    ];
    setLeaveRequests(mockRequests);
  }, []);

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

  const handleApprove = (requestId: string) => {
    setLeaveRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { 
              ...req, 
              status: 'approved', 
              approvedAt: new Date().toISOString(),
              approvedBy: 'Admin User'
            }
          : req
      )
    );
  };

  const handleReject = (requestId: string, rejectionReason: string) => {
    setLeaveRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { 
              ...req, 
              status: 'rejected', 
              rejectedAt: new Date().toISOString(),
              rejectedBy: 'Admin User',
              rejectionReason
            }
          : req
      )
    );
  };

  const handleBulkApprove = () => {
    setLeaveRequests(prev => 
      prev.map(req => 
        selectedRequests.has(req.id) 
          ? { 
              ...req, 
              status: 'approved', 
              approvedAt: new Date().toISOString(),
              approvedBy: 'Admin User'
            }
          : req
      )
    );
    setSelectedRequests(new Set());
    setBulkAction(null);
  };

  const handleBulkReject = () => {
    setLeaveRequests(prev => 
      prev.map(req => 
        selectedRequests.has(req.id) 
          ? { 
              ...req, 
              status: 'rejected', 
              rejectedAt: new Date().toISOString(),
              rejectedBy: 'Admin User',
              rejectionReason: 'Bulk rejected'
            }
          : req
      )
    );
    setSelectedRequests(new Set());
    setBulkAction(null);
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
                      <div>
                        <p className="font-medium">{request.employeeName}</p>
                        <p className="text-sm text-muted-foreground">{request.employeeId}</p>
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
                            {selectedRequests.size > 0 && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (selectedRequests.has(request.id)) {
                                    handleApprove(request.id);
                                  }
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setSelectedRequest(request)}
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
                  onClick={() => {
                    handleReject(selectedRequest.id, selectedRequest.rejectionReason || '');
                    setSelectedRequest(null);
                  }}
                  disabled={!selectedRequest.rejectionReason?.trim()}
                >
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
