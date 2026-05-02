import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import DocumentReader from './DocumentReader';
import DigitalDocumentGenerator from './DigitalDocumentGenerator';
import DocumentTracking from './DocumentTracking';
import { apiClient } from '../utils/api';
import { toast } from 'sonner';
import { 
  FileText, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  Upload,
  Trash2,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2,
  Users,
  FolderOpen,
  File,
  TrendingUp
} from 'lucide-react';

interface CompanyDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  content?: string;
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
}

const CompanyDocs: React.FC<{ isAdmin?: boolean; isSuperAdmin?: boolean }> = ({ 
  isAdmin = false, 
  isSuperAdmin = false 
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'manage' | 'generate' | 'tracking'>('view');
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    isPublic: true
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [showDocumentReader, setShowDocumentReader] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<CompanyDocument | null>(null);
  const [acknowledgments, setAcknowledgments] = useState<Record<string, any>>({});
  const [employeeId] = useState('EMP001'); // In real app, this would come from auth context
  const [employeeName] = useState('John Doe'); // In real app, this would come from auth context

  const categories = [
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
    'Other'
  ];

  useEffect(() => {
    loadDocuments();
  }, [organizationId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      
      // Fetch documents from API
      const response = await apiClient.get<any[]>('/company-documents');
      
      if (response.data && Array.isArray(response.data)) {
        setDocuments(response.data);
      } else {
        setDocuments([]);
      }
      
      if (!isAdmin && !isSuperAdmin) {
        loadAcknowledgments();
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      // If API fails, show empty state
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAcknowledgments = async () => {
    try {
      // In production, fetch from API
      // const response = await fetch(`/api/document-acknowledgments/employee/${employeeId}`);
      // const data = await response.json();
      
      // For demo purposes, use mock data
      const mockAcknowledgments = {
        'doc_001': {
          id: 'ack_001',
          documentId: 'doc_001',
          employeeId,
          employeeName,
          acknowledgedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Completed'
        }
      };
      setAcknowledgments(mockAcknowledgments);
    } catch (error) {
      console.error('Error loading acknowledgments:', error);
    }
  };

  const handleReadDocument = (document: CompanyDocument) => {
    setSelectedDocument(document);
    setShowDocumentReader(true);
  };

  const handleAcknowledgmentSubmit = async (documentId: string, accepted: boolean, ipAddress: string) => {
    try {
      // In production, submit to API
      const response = await fetch('/api/document-acknowledgments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          employeeId,
          employeeName,
          organizationId: organizationId || 'ORG-001',
          acknowledgedAt: new Date().toISOString(),
          ipAddress: ipAddress
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update acknowledgments state
        setAcknowledgments(prev => ({
          ...prev,
          [documentId]: data.acknowledgment
        }));
        
        // Reload documents to update download count
        loadDocuments();
        
        console.log('Acknowledgment submitted:', data);
      } else {
        console.error('Error submitting acknowledgment:', data.message);
      }
    } catch (error) {
      console.error('Error submitting acknowledgment:', error);
      // Still show success for demo purposes
      setAcknowledgments(prev => ({
        ...prev,
        [documentId]: {
          id: `ack_${Date.now()}`,
          documentId,
          employeeId,
          employeeName,
          acknowledgedAt: new Date().toISOString(),
          status: 'Completed'
        }
      }));
    }
  };

  const handleDocumentGenerated = (newDocument: CompanyDocument) => {
    // Add the new document to the list
    setDocuments(prev => [newDocument, ...prev]);
    
    // Switch to view tab to show the new document
    setActiveTab('view');
  };

  const handleUpload = async () => {
    if (!formData.title || !formData.category || !selectedFile) {
      setError('Please fill in all required fields and select a file');
      return;
    }

    if (isSuperAdmin && !organizationId) {
      setError('Organization ID is required for super admin');
      return;
    }

    setError('');
    
    // In production, upload to API
    const newDocument: CompanyDocument = {
      id: `doc_${Date.now()}`,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      organizationId: organizationId || 'ORG-001',
      createdBy: isSuperAdmin ? 'super_admin' : 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Draft',
      documentUrl: `/documents/${selectedFile.name}`,
      fileName: selectedFile.name,
      fileSize: `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`,
      downloadCount: 0,
      isPublic: formData.isPublic
    };

    setDocuments(prev => [newDocument, ...prev]);
    setShowUploadForm(false);
    setFormData({ title: '', description: '', category: '', isPublic: true });
    setSelectedFile(null);
    
    alert('Document uploaded successfully!');
  };

  const handleDownload = (document: CompanyDocument) => {
    // In production, download actual file
    alert(`Downloading ${document.fileName}`);
    console.log('Download document:', document);
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    alert('Document deleted successfully');
  };

  const handleStatusChange = async (documentId: string, newStatus: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId 
        ? { ...doc, status: newStatus as 'Published' | 'Draft' | 'Archived', updatedAt: new Date().toISOString() }
        : doc
    ));
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'HR Policies':
      case 'Employee Handbook':
        return 'text-blue-600';
      case 'Company Policies':
      case 'Legal Documents':
        return 'text-purple-600';
      case 'Training Materials':
        return 'text-green-600';
      case 'IT Policies':
        return 'text-orange-600';
      case 'Benefits Information':
        return 'text-pink-600';
      case 'Safety Guidelines':
        return 'text-red-600';
      case 'Financial Documents':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return <Badge className="bg-green-100 text-green-800">Published</Badge>;
      case 'Draft':
        return <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>;
      case 'Archived':
        return <Badge className="bg-gray-100 text-gray-800">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
    <>
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Company Documents</h3>
              <p className="text-sm text-muted-foreground">
                {isAdmin || isSuperAdmin ? 'Manage company-wide documents' : 'Access company documents and resources'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {documents.length} Documents
          </Badge>
        </div>

      {/* Tabs for Admin */}
      {(isAdmin || isSuperAdmin) && (
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'view' ? 'default' : 'outline'}
            onClick={() => setActiveTab('view')}
            className="rounded-xl"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Documents
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'default' : 'outline'}
            onClick={() => setActiveTab('manage')}
            className="rounded-xl"
          >
            <Edit className="w-4 h-4 mr-2" />
            Manage Documents
          </Button>
          <Button
            variant={activeTab === 'generate' ? 'default' : 'outline'}
            onClick={() => setActiveTab('generate')}
            className="rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Document
          </Button>
          <Button
            variant={activeTab === 'tracking' ? 'default' : 'outline'}
            onClick={() => setActiveTab('tracking')}
            className="rounded-xl"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Tracking & Reminders
          </Button>
        </div>
      )}

      {/* Organization ID for Super Admin */}
      {isSuperAdmin && (
        <div className="mb-6">
          <Label>Organization ID</Label>
          <Input
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="Enter organization ID (e.g., ORG-001)"
            className="mt-2 rounded-xl"
          />
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (isAdmin || isSuperAdmin) && (
        <div className="space-y-6">
          {/* Upload Form */}
          {showUploadForm ? (
            <Card className="p-6 rounded-xl border-2 border-dashed border-primary/30">
              <h4 className="font-semibold mb-4">Upload New Document</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Document Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="Enter document title"
                      className="mt-2 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label>Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                      <SelectTrigger className="mt-2 rounded-xl">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter document description"
                    className="mt-2 rounded-xl"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Document File *</Label>
                  <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="doc-upload"
                    />
                    <label htmlFor="doc-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        {selectedFile ? selectedFile.name : 'Click to upload document'}
                      </p>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX, TXT (Max 10MB)</p>
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-public"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
                    className="rounded"
                  />
                  <Label htmlFor="is-public" className="text-sm">Make this document public to all employees</Label>
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleUpload} className="rounded-xl">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                  <Button variant="outline" onClick={() => setShowUploadForm(false)} className="rounded-xl">
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Button onClick={() => setShowUploadForm(true)} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Upload New Document
            </Button>
          )}
        </div>
      )}

      {/* Generate Tab */}
      {activeTab === 'generate' && (isAdmin || isSuperAdmin) && (
        <DigitalDocumentGenerator
          organizationId={organizationId || 'ORG-001'}
          createdBy={isSuperAdmin ? 'super_admin' : 'admin'}
          onDocumentGenerated={handleDocumentGenerated}
        />
      )}

      {/* Tracking Tab */}
      {activeTab === 'tracking' && (isAdmin || isSuperAdmin) && (
        <DocumentTracking
          organizationId={organizationId || 'ORG-001'}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
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
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {(isAdmin || isSuperAdmin) && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-xl bg-background"
          >
            <option value="all">All Status</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Archived</option>
          </select>
        )}
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="font-medium text-muted-foreground">No documents found</h4>
          <p className="text-sm text-muted-foreground">
            {searchTerm || filterCategory !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'No documents have been uploaded yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="p-4 rounded-xl border hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center`}>
                    <FileText className={`w-5 h-5 ${getCategoryIcon(document.category)}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{document.title}</h4>
                      {getStatusBadge(document.status)}
                      {!document.isPublic && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          Restricted
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {document.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        {document.category}
                      </div>
                      <div className="flex items-center gap-1">
                        <File className="w-3 h-3" />
                        {document.fileSize}
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {document.downloadCount} downloads
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(document.updatedAt)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Show acknowledgment status for employees */}
                  {!isAdmin && !isSuperAdmin && (
                    <>
                      {acknowledgments[document.id] ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Acknowledged
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleReadDocument(document)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => handleDownload(document)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  
                  {(isAdmin || isSuperAdmin) && (
                    <>
                      <select
                        value={document.status}
                        onChange={(e) => handleStatusChange(document.id, e.target.value)}
                        className="px-2 py-1 text-xs border rounded"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Published">Published</option>
                        <option value="Archived">Archived</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(document.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Categories Summary */}
      <div className="mt-6 pt-6 border-t border-border">
        <h4 className="font-medium text-sm mb-3">Document Categories</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map(category => {
            const count = documents.filter(doc => doc.category === category).length;
            return (
              <div key={category} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-xs font-medium">{category}</span>
                <Badge variant="outline" className="text-xs">
                  {count}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </Card>

      {/* Document Reader Modal */}
      <DocumentReader
        document={selectedDocument}
        isOpen={showDocumentReader}
        onClose={() => setShowDocumentReader(false)}
        onSubmit={handleAcknowledgmentSubmit}
        employeeId={employeeId}
      />
    </>
  );
};

export default CompanyDocs;
