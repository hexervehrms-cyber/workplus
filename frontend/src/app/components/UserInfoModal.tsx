import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { apiClient } from '../utils/api';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Briefcase, 
  Building2, 
  FileText, 
  Download, 
  Eye,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Camera,
  IdCard,
  Users,
  Award,
  BookOpen,
  FolderOpen,
  Search,
  Filter,
  Loader2
} from 'lucide-react';

interface UserInfoModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

interface Document {
  id: string;
  title: string;
  type: string;
  category: string;
  status: string;
  createdAt: string;
  documentUrl: string;
  fileName: string;
  fileSize: string;
  downloadCount: number;
}

interface OnboardingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  avatar: string;
  employeeId: string;
  joiningDate: string;
  department: string;
  designation: string;
  employmentType: string;
  workLocation: string;
  submittedAt: string;
  status: string;
}

const UserInfoModal: React.FC<UserInfoModalProps> = ({ user, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'documents' | 'onboarding'>('info');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    if (isOpen && user) {
      loadUserData();
    }
  }, [isOpen, user]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Fetch documents from API
      const docsResponse = await apiClient.get<any[]>(`/documents/${user.id}`);
      if (docsResponse.data && Array.isArray(docsResponse.data)) {
        setDocuments(docsResponse.data);
      } else {
        setDocuments([]);
      }

      // Fetch employee data for onboarding info
      try {
        const employeeResponse = await apiClient.get<any>(`/employees/user/${user.id}`);
        if (employeeResponse.data) {
          const emp = employeeResponse.data;
          setOnboardingData({
            firstName: user?.name?.split(' ')[0] || '',
            lastName: user?.name?.split(' ')[1] || '',
            email: user?.email || '',
            phone: emp.phone || 'N/A',
            dateOfBirth: emp.dateOfBirth || '',
            gender: emp.gender || 'N/A',
            address: emp.address || 'N/A',
            avatar: user?.avatar || '',
            employeeId: emp.employeeCode || emp._id,
            joiningDate: emp.joiningDate || '',
            department: emp.department || 'N/A',
            designation: emp.designation || 'N/A',
            employmentType: emp.employmentType || 'Full-time',
            workLocation: emp.workLocation || 'N/A',
            submittedAt: emp.createdAt || '',
            status: 'completed'
          });
        }
      } catch {
        // If employee data not found, use basic user data
        setOnboardingData({
          firstName: user?.name?.split(' ')[0] || '',
          lastName: user?.name?.split(' ')[1] || '',
          email: user?.email || '',
          phone: 'N/A',
          dateOfBirth: '',
          gender: 'N/A',
          address: 'N/A',
          avatar: user?.avatar || '',
          employeeId: user?.id || '',
          joiningDate: '',
          department: 'N/A',
          designation: 'N/A',
          employmentType: 'Full-time',
          workLocation: 'N/A',
          submittedAt: '',
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (document: Document) => {
    // In production, download actual file
    console.log('Downloading document:', document);
    alert(`Downloading ${document.fileName}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'super admin':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'manager':
        return 'bg-green-100 text-green-800';
      case 'employee':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const documentCategories = [...new Set(documents.map(doc => doc.category))];

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <div className="flex items-center gap-2">
                <Badge className={getRoleColor(user.role)}>
                  {user.role}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-6 border-b border-border">
          <Button
            variant={activeTab === 'info' ? 'default' : 'outline'}
            onClick={() => setActiveTab('info')}
            className="rounded-xl"
          >
            <User className="w-4 h-4 mr-2" />
            User Information
          </Button>
          <Button
            variant={activeTab === 'documents' ? 'default' : 'outline'}
            onClick={() => setActiveTab('documents')}
            className="rounded-xl"
          >
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </Button>
          <Button
            variant={activeTab === 'onboarding' ? 'default' : 'outline'}
            onClick={() => setActiveTab('onboarding')}
            className="rounded-xl"
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Onboarding Data
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* User Information Tab */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 rounded-xl">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Basic Information
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Full Name</span>
                          <span className="font-medium">{user.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-medium">{user.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Role</span>
                          <Badge className={getRoleColor(user.role)}>
                            {user.role}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Organization</span>
                          <span className="font-medium">{user.organization}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <Badge className={user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {user.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 rounded-xl">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Briefcase className="w-5 h-5" />
                        Professional Information
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Employee ID</span>
                          <span className="font-medium">{onboardingData?.employeeId || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Department</span>
                          <span className="font-medium">{onboardingData?.department || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Designation</span>
                          <span className="font-medium">{onboardingData?.designation || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Employment Type</span>
                          <span className="font-medium">{onboardingData?.employmentType || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Work Location</span>
                          <span className="font-medium">{onboardingData?.workLocation || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Joining Date</span>
                          <span className="font-medium">{onboardingData?.joiningDate ? formatDate(onboardingData.joiningDate) : '—'}</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Contact Information */}
                  <Card className="p-6 rounded-xl">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Contact Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-medium">{onboardingData?.phone || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date of Birth</span>
                          <span className="font-medium">{onboardingData?.dateOfBirth ? formatDate(onboardingData.dateOfBirth) : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gender</span>
                          <span className="font-medium">{onboardingData?.gender || '—'}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Address</span>
                          <span className="font-medium">{onboardingData?.address || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-6">
                  {/* Search and Filter */}
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
                      />
                    </div>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-4 py-2 border rounded-xl bg-background"
                    >
                      <option value="all">All Categories</option>
                      {documentCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Documents List */}
                  <div className="space-y-3">
                    {filteredDocuments.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h4 className="font-medium text-muted-foreground">No documents found</h4>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm || filterCategory !== 'all'
                            ? 'Try adjusting your search or filter criteria'
                            : 'No documents available for this user'}
                        </p>
                      </div>
                    ) : (
                      filteredDocuments.map((document) => (
                        <Card key={document.id} className="p-4 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm">{document.title}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {document.type}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{document.category}</span>
                                  <span>·</span>
                                  <span>{document.fileSize}</span>
                                  <span>·</span>
                                  <span>{document.downloadCount} downloads</span>
                                  <span>·</span>
                                  <span>{formatDate(document.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => handleDownload(document)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Onboarding Data Tab */}
              {activeTab === 'onboarding' && onboardingData && (
                <div className="space-y-6">
                  {/* Onboarding Status */}
                  <Card className="p-6 rounded-xl">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Onboarding Status
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium">Completed</span>
                      </div>
                      <span className="text-muted-foreground">
                        Submitted on {formatDate(onboardingData.submittedAt)}
                      </span>
                    </div>
                  </Card>

                  {/* Onboarding Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 rounded-xl">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Personal Details
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">First Name</span>
                          <span className="font-medium">{onboardingData.firstName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Name</span>
                          <span className="font-medium">{onboardingData.lastName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-medium">{onboardingData.phone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date of Birth</span>
                          <span className="font-medium">{formatDate(onboardingData.dateOfBirth)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gender</span>
                          <span className="font-medium">{onboardingData.gender}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Address</span>
                          <span className="font-medium">{onboardingData.address}</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 rounded-xl">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Briefcase className="w-5 h-5" />
                        Employment Details
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Employee ID</span>
                          <span className="font-medium">{onboardingData.employeeId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Joining Date</span>
                          <span className="font-medium">{formatDate(onboardingData.joiningDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Department</span>
                          <span className="font-medium">{onboardingData.department}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Designation</span>
                          <span className="font-medium">{onboardingData.designation}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Employment Type</span>
                          <span className="font-medium">{onboardingData.employmentType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Work Location</span>
                          <span className="font-medium">{onboardingData.workLocation}</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default UserInfoModal;
