import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Calendar,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2,
  User
} from 'lucide-react';

interface Document {
  id: string;
  employeeId: string;
  documentType: string;
  organizationId: string;
  createdBy: string;
  documentData: any;
  generatedAt: string;
  status: string;
  documentUrl: string;
  fileName: string;
}

const EmployeeDocuments: React.FC<{ employeeId?: string }> = ({ employeeId = 'EMP001' }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const documentTypes = [
    'Letter of Intent',
    'Offer Letter',
    'Appointment Letter',
    'Appraisal Letter',
    'Salary Slips',
    'Warning Letter',
    'Corrective Action Plan (CAP)'
  ];

  useEffect(() => {
    loadDocuments();
  }, [employeeId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/employee/${employeeId}`);
      const data = await response.json();
      
      // Validate response and ensure data is an array
      const documentsArray = Array.isArray(data?.data) ? data.data : [];
      setDocuments(documentsArray);
    } catch (error) {
      console.error('Error loading documents:', error);
      // For demo purposes, add mock documents
      setDocuments([
        {
          id: 'doc_001',
          employeeId,
          documentType: 'Offer Letter',
          organizationId: 'ORG-001',
          createdBy: 'admin',
          documentData: {},
          generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Generated',
          documentUrl: '/documents/offer_letter_EMP001.pdf',
          fileName: 'Offer_Letter_EMP001.pdf'
        },
        {
          id: 'doc_002',
          employeeId,
          documentType: 'Appointment Letter',
          organizationId: 'ORG-001',
          createdBy: 'admin',
          documentData: {},
          generatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Generated',
          documentUrl: '/documents/appointment_letter_EMP001.pdf',
          fileName: 'Appointment_Letter_EMP001.pdf'
        },
        {
          id: 'doc_003',
          employeeId,
          documentType: 'Salary Slips',
          organizationId: 'ORG-001',
          createdBy: 'admin',
          documentData: {},
          generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Generated',
          documentUrl: '/documents/salary_slip_EMP001_Mar2024.pdf',
          fileName: 'Salary_Slip_EMP001_Mar2024.pdf'
        },
        {
          id: 'doc_004',
          employeeId,
          documentType: 'Appraisal Letter',
          organizationId: 'ORG-001',
          createdBy: 'admin',
          documentData: {},
          generatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Generated',
          documentUrl: '/documents/appraisal_letter_EMP001.pdf',
          fileName: 'Appraisal_Letter_EMP001.pdf'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (document: Document) => {
    // In a real implementation, this would download the actual file
    // For demo purposes, we'll show an alert
    alert(`Downloading ${document.fileName}`);
    console.log('Download document:', document);
  };

  const handleView = (document: Document) => {
    // In a real implementation, this would open the document in a new tab
    // For demo purposes, we'll show an alert
    alert(`Viewing ${document.fileName}`);
    console.log('View document:', document);
  };

  // Ensure documents is always an array before filtering
  const safeDocuments = Array.isArray(documents) ? documents : [];
  
  const filteredDocuments = safeDocuments.filter(doc => {
    const matchesSearch = doc.documentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || doc.documentType === filterType;
    return matchesSearch && matchesFilter;
  });

  const getDocumentIcon = (documentType: string) => {
    switch (documentType) {
      case 'Letter of Intent':
      case 'Offer Letter':
      case 'Appointment Letter':
        return 'text-blue-600';
      case 'Appraisal Letter':
        return 'text-green-600';
      case 'Salary Slips':
        return 'text-purple-600';
      case 'Warning Letter':
        return 'text-red-600';
      case 'Corrective Action Plan (CAP)':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">My Submitted Documents</h3>
            <p className="text-sm text-muted-foreground">View and download your submitted employment documents</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {safeDocuments.length} Documents
        </Badge>
      </div>

      {/* Search and Filter */}
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
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border rounded-xl bg-background"
        >
          <option value="all">All Types</option>
          {documentTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="font-medium text-muted-foreground">No documents found</h4>
          <p className="text-sm text-muted-foreground">
            {searchTerm || filterType !== 'all' 
              ? 'Try adjusting your search or filter criteria' 
              : 'Your documents will appear here once generated by HR'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="p-4 rounded-xl border hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center`}>
                    <FileText className={`w-5 h-5 ${getDocumentIcon(document.documentType)}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{document.documentType}</h4>
                      <Badge variant={document.status === 'Generated' ? 'default' : 'secondary'} className="text-xs">
                        {document.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {document.fileName}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(document.generatedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Generated by {document.createdBy}
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {document.organizationId}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => handleView(document)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
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
          ))}
        </div>
      )}

      {/* Document Categories Summary */}
      <div className="mt-6 pt-6 border-t border-border">
        <h4 className="font-medium text-sm mb-3">Document Categories</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {documentTypes.map(type => {
            const count = safeDocuments.filter(doc => doc.documentType === type).length;
            return (
              <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-xs font-medium">{type}</span>
                <Badge variant="outline" className="text-xs">
                  {count}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default EmployeeDocuments;
