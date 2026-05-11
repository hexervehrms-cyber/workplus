import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Upload, 
  Calendar, 
  User, 
  Building2,
  Search,
  Filter,
  Plus,
  Eye,
  Send,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  Phone,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPut } from '../../utils/apiHelper';

interface Employee {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    isActive: boolean;
  };
  employeeCode: string;
  designation: string;
  department: string;
  baseSalary: number;
  phone: string;
  status: string;
  joiningDate: string;
}

interface Document {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'submitted' | 'issued';
  status: 'pending' | 'approved' | 'rejected' | 'acknowledged';
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  submittedBy?: string;
  issuedBy?: string;
  acknowledgmentRequired?: boolean;
  acknowledgedAt?: string;
  notes?: string;
}

const documentCategories = [
  'HR Policies',
  'Employee Handbook', 
  'Company Policies',
  'Training Materials',
  'Forms & Templates',
  'Company Announcements',
  'Benefits Information',
  'Safety Guidelines',
  'IT Policies',
  'Financial Documents',
  'Legal Documents',
  'Warning Letter',
  'CAP (Corrective Action Plan)',
  'Suspension',
  'Bench',
  'Self Training Period',
  'Personal Documents',
  'Certificates',
  'Other'
];

export default function EmployeeCorrespondence() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueFormData, setIssueFormData] = useState({
    title: '',
    description: '',
    category: '',
    acknowledgmentRequired: false,
    notes: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
      fetchDocuments();
    }
  }, [employeeId]);

  const fetchEmployeeData = async () => {
    try {
      const data = await apiGet(`/employees/${employeeId}`);
      console.log('Employee data received:', data); // Debug log
      
      // Handle different response structures
      let employeeData = data.employee || data.data || data;
      
      // If the employee data doesn't have userId structure, create it
      if (employeeData && !employeeData.userId && employeeData.name) {
        employeeData = {
          ...employeeData,
          userId: {
            _id: employeeData._id,
            name: employeeData.name,
            email: employeeData.email,
            isActive: employeeData.isActive !== false
          }
        };
      }
      
      setEmployee(employeeData);
    } catch (error) {
      console.error('Error fetching employee:', error);
      toast.error('Error loading employee data');
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      // Fetch both submitted and issued documents for this employee
      const [submittedData, issuedData] = await Promise.all([
        apiGet(`/documents/employee/${employeeId}`).catch(err => {
          console.warn('Failed to fetch submitted documents:', err);
          return { data: [] };
        }),
        apiGet(`/documents/issued/${employeeId}`).catch(err => {
          console.warn('Failed to fetch issued documents:', err);
          return { data: [] };
        })
      ]);

      console.log('Submitted docs:', submittedData);
      console.log('Issued docs:', issuedData);

      // Combine and format documents
      const allDocuments: Document[] = [
        ...(submittedData.data || submittedData || []).map((doc: any) => ({
          ...doc,
          type: 'submitted' as const,
          status: doc.status || 'pending'
        })),
        ...(issuedData.data || issuedData || []).map((doc: any) => ({
          ...doc,
          type: 'issued' as const,
          status: doc.acknowledgedAt ? 'acknowledged' : 'pending'
        }))
      ];

      // Sort by creation date (newest first)
      allDocuments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setDocuments(allDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Error loading documents');
      setDocuments([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleIssueDocument = async () => {
    if (!issueFormData.title || !issueFormData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('title', issueFormData.title);
      formData.append('description', issueFormData.description);
      formData.append('category', issueFormData.category);
      formData.append('targetEmployeeId', employeeId!);
      formData.append('acknowledgmentRequired', issueFormData.acknowledgmentRequired.toString());
      formData.append('notes', issueFormData.notes);
      
      if (selectedFile) {
        formData.append('document', selectedFile);
      }

      const data = await apiPost('/documents/issue', formData);

      if (data.success) {
        toast.success('Document issued successfully');
        setShowIssueForm(false);
        setIssueFormData({
          title: '',
          description: '',
          category: '',
          acknowledgmentRequired: false,
          notes: ''
        });
        setSelectedFile(null);
        fetchDocuments();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to issue document');
      }
    } catch (error) {
      console.error('Error issuing document:', error);
      toast.error('Error issuing document');
    }
  };

  const handleDownload = (document: Document) => {
    if (document.fileUrl) {
      window.open(document.fileUrl, '_blank');
    } else {
      toast.error('No file available for download');
    }
  };

  const getStatusBadge = (status: string, type: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
      acknowledged: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    return type === 'submitted' ? (
      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
        <Upload className="w-4 h-4 text-blue-600" />
      </div>
    ) : (
      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
        <Send className="w-4 h-4 text-green-600" />
      </div>
    );
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    const matchesType = filterType === 'all' || doc.type === filterType;
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground"></p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Employee not found</h3>
        <p className="text-muted-foreground">The requested employee could not be found.</p>
        <Button onClick={() => navigate('/admin/employees')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/admin/employees')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Employee Correspondence</h1>
            <p className="text-muted-foreground">Document history and communication</p>
          </div>
        </div>
        <Button onClick={() => setShowIssueForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Issue Document
        </Button>
      </div>

      {/* Employee Info Card */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-xl font-medium text-primary">
              {employee.userId?.name ? 
                employee.userId.name.split(' ').map(n => n[0]).join('').toUpperCase() :
                employee.name ? 
                employee.name.split(' ').map(n => n[0]).join('').toUpperCase() :
                'N/A'
              }
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-semibold">
                {employee.userId?.name || employee.name || 'Unknown Employee'}
              </h2>
              <Badge variant={(employee.userId?.isActive ?? employee.isActive) ? 'default' : 'secondary'}>
                {(employee.userId?.isActive ?? employee.isActive) ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{employee.userId?.email || employee.email || 'No Email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{employee.phone || 'No Phone'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span>{employee.designation || 'No Designation'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>{employee.department || 'No Department'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>ID: {employee.employeeCode || employee._id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Joined: {employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="submitted">Submitted by Employee</SelectItem>
              <SelectItem value="issued">Issued by Company</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {documentCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Documents Timeline */}
      <div className="space-y-4">
        {filteredDocuments.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No documents found</h3>
            <p className="text-muted-foreground">
              {searchTerm || filterCategory !== 'all' || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'No documents have been exchanged with this employee yet'}
            </p>
          </Card>
        ) : (
          filteredDocuments.map((document) => (
            <Card key={document.id} className="p-6">
              <div className="flex items-start gap-4">
                {getTypeIcon(document.type)}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{document.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {document.type === 'submitted' ? 'Submitted by Employee' : 'Issued by Company'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(document.status, document.type)}
                      <Badge variant="outline">{document.category}</Badge>
                    </div>
                  </div>
                  
                  {document.description && (
                    <p className="text-muted-foreground mb-3">{document.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                    </div>
                    {document.fileName && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{document.fileName}</span>
                      </div>
                    )}
                    {document.fileSize && (
                      <span>{document.fileSize}</span>
                    )}
                  </div>

                  {document.notes && (
                    <div className="p-3 bg-muted/50 rounded-lg mb-3">
                      <p className="text-sm"><strong>Notes:</strong> {document.notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {document.fileUrl && (
                      <Button variant="outline" size="sm" onClick={() => handleDownload(document)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Issue Document Modal */}
      {showIssueForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                Issue Document to {employee.userId?.name || employee.name || 'Employee'}
              </h3>
              <Button variant="ghost" onClick={() => setShowIssueForm(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Document Title *</label>
                  <Input
                    value={issueFormData.title}
                    onChange={(e) => setIssueFormData({...issueFormData, title: e.target.value})}
                    placeholder="Enter document title"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category *</label>
                  <Select value={issueFormData.category} onValueChange={(value) => setIssueFormData({...issueFormData, category: value})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={issueFormData.description}
                  onChange={(e) => setIssueFormData({...issueFormData, description: e.target.value})}
                  placeholder="Enter document description"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Attach File</label>
                <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      {selectedFile ? selectedFile.name : 'Click to upload file'}
                    </p>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, TXT, JPG, PNG (Max 10MB)</p>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={issueFormData.notes}
                  onChange={(e) => setIssueFormData({...issueFormData, notes: e.target.value})}
                  placeholder="Add any additional notes or instructions"
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="acknowledgment-required"
                  checked={issueFormData.acknowledgmentRequired}
                  onChange={(e) => setIssueFormData({...issueFormData, acknowledgmentRequired: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="acknowledgment-required" className="text-sm">
                  Require employee acknowledgment
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowIssueForm(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleIssueDocument} className="flex-1">
                <Send className="w-4 h-4 mr-2" />
                Issue Document
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}