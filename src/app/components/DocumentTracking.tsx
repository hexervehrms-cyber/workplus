import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Send,
  FileText,
  Bell,
  Search,
  Filter,
  Calendar,
  Mail,
  MessageSquare,
  User,
  TrendingUp,
  Eye,
  Download
} from 'lucide-react';

interface Document {
  id: string;
  title: string;
  description: string;
  category: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'Published' | 'Draft' | 'Archived';
  documentUrl: string;
  fileName: string;
  fileSize: string;
  downloadCount: number;
  isPublic: boolean;
  assignTo: 'all' | 'specific';
  targetUsers: string[];
  requiresAcknowledgment: boolean;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
}

interface Acknowledgment {
  id: string;
  documentId: string;
  employeeId: string;
  employeeName: string;
  organizationId: string;
  acknowledgedAt: string;
  status: 'Completed' | 'Pending';
  ipAddress: string;
  userAgent: string;
}

interface DocumentTrackingProps {
  organizationId: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

const DocumentTracking: React.FC<DocumentTrackingProps> = ({
  organizationId,
  isAdmin = false,
  isSuperAdmin = false
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<Acknowledgment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [sendingReminders, setSendingReminders] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch documents
      const docsResponse = await fetch('/api/company-documents');
      const docsData = docsResponse.ok ? await docsResponse.json() : [];
      
      // Fetch employees
      const empsResponse = await fetch('/api/employees');
      const empsData = empsResponse.ok ? await empsResponse.json() : [];
      
      // Fetch acknowledgments
      const acksResponse = await fetch('/api/document-acknowledgments/all');
      const acksData = acksResponse.ok ? await acksResponse.json() : [];
      
      setDocuments(docsData);
      setEmployees(empsData);
      setAcknowledgments(acksData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentStats = (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return { total: 0, completed: 0, pending: 0 };

    let targetEmployees = mockEmployees;
    
    // If document is assigned to specific users, filter them
    if (doc.assignTo === 'specific' && doc.targetUsers.length > 0) {
      targetEmployees = mockEmployees.filter(emp => doc.targetUsers.includes(emp.id));
    }

    const completedCount = acknowledgments.filter(ack => 
      ack.documentId === documentId && ack.status === 'Completed'
    ).length;

    return {
      total: targetEmployees.length,
      completed: completedCount,
      pending: targetEmployees.length - completedCount
    };
  };

  const getEmployeeStatus = (documentId: string, employeeId: string) => {
    const acknowledgment = acknowledgments.find(ack => 
      ack.documentId === documentId && ack.employeeId === employeeId
    );
    return acknowledgment ? 'completed' : 'pending';
  };

  const sendReminder = async (documentId: string, employeeId?: string) => {
    try {
      setSendingReminders(prev => [...prev, employeeId || 'all']);
      
      const response = await fetch('/api/document-acknowledgments/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, employeeId, organizationId })
      });
      
      if (response.ok) {
        const employee = employeeId ? employees.find(emp => emp.id === employeeId) : null;
        const doc = documents.find(d => d.id === documentId);
        
        setSuccessMessage(`Reminder sent${employee ? ` to ${employee.name}` : ' to all employees'} for "${doc?.title}"`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError('Failed to send reminder');
        setTimeout(() => setError(''), 3000);
      }
      
    } catch (error) {
      console.error('Error sending reminder:', error);
      setError('Failed to send reminder');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSendingReminders(prev => prev.filter(id => id !== (employeeId || 'all')));
    }
  };

  const filteredEmployees = employees.filter(employee => {
    if (!selectedDocument) return false;
    
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const status = getEmployeeStatus(selectedDocument, employee.id);
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Document Tracking & Reminders</h3>
          <p className="text-sm text-muted-foreground">Track acknowledgments and send reminders to employees</p>
        </div>
      </div>

      {/* Document Selection */}
      <div className="mb-6">
        <Label>Select Document</Label>
        <Select value={selectedDocument} onValueChange={setSelectedDocument}>
          <SelectTrigger className="mt-2 rounded-xl">
            <SelectValue placeholder="Choose a document to track" />
          </SelectTrigger>
          <SelectContent>
            {documents.filter(doc => doc.requiresAcknowledgment).map(doc => {
              const stats = getDocumentStats(doc.id);
              return (
                <SelectItem key={doc.id} value={doc.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{doc.title}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-600">{stats.completed} completed</span>
                      <span className="text-orange-600">{stats.pending} pending</span>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedDocument && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {(() => {
              const stats = getDocumentStats(selectedDocument);
              const doc = documents.find(d => d.id === selectedDocument);
              return (
                <>
                  <Card className="p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Employees</p>
                        <p className="text-xl font-bold">{stats.total}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="text-xl font-bold text-green-600">{stats.completed}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pending</p>
                        <p className="text-xl font-bold text-orange-600">{stats.pending}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                        <p className="text-xl font-bold text-purple-600">
                          {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  </Card>
                </>
              );
            })()}
          </div>

          {/* Send Bulk Reminder */}
          <div className="mb-6 p-4 bg-muted/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Send Reminder to All</h4>
                <p className="text-sm text-muted-foreground">
                  Send reminder email to all employees who haven't acknowledged this document
                </p>
              </div>
              <Button
                onClick={() => sendReminder(selectedDocument)}
                disabled={sendingReminders.includes('all')}
                className="rounded-xl"
              >
                {sendingReminders.includes('all') ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send to All
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border rounded-xl bg-background"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Employee List */}
          <div className="space-y-3">
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="font-medium text-muted-foreground">No employees found</h4>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'No employees assigned to this document'}
                </p>
              </div>
            ) : (
              filteredEmployees.map(employee => {
                const status = getEmployeeStatus(selectedDocument, employee.id);
                const acknowledgment = acknowledgments.find(ack => 
                  ack.documentId === selectedDocument && ack.employeeId === employee.id
                );
                
                return (
                  <Card key={employee.id} className="p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{employee.name}</h4>
                            {status === 'completed' ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Completed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{employee.email}</span>
                            <span>·</span>
                            <span>{employee.department}</span>
                            <span>·</span>
                            <span>{employee.position}</span>
                          </div>
                          {acknowledgment && (
                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                              <div>Acknowledged on {formatDate(acknowledgment.acknowledgedAt)}</div>
                              <div>IP Address: {acknowledgment.ipAddress}</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'completed' ? (
                          <Button variant="outline" size="sm" className="rounded-xl">
                            <Eye className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => sendReminder(selectedDocument, employee.id)}
                            disabled={sendingReminders.includes(employee.id)}
                          >
                            {sendingReminders.includes(employee.id) ? (
                              <Clock className="w-4 h-4 animate-spin" />
                            ) : (
                              <Bell className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Success and Error Messages */}
      {successMessage && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-xl p-4 max-w-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">{successMessage}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-xl p-4 max-w-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DocumentTracking;
