import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  User,
  Building2,
  Trash2,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

interface DocumentTemplate {
  template: string;
  requiredFields: string[];
  description: string;
}

interface GeneratedDocument {
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

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
}

const DocumentGenerator: React.FC<{ isSuperAdmin?: boolean }> = ({ isSuperAdmin = false }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'view'>('generate');
  const [templates, setTemplates] = useState<Record<string, DocumentTemplate>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadEmployees();
    if (isSuperAdmin && organizationId) {
      loadDocuments();
    }
  }, [isSuperAdmin, organizationId]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/documents/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load document templates');
    }
  };

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      } else {
        setError('Failed to load employees');
      }
    } catch (err) {
      console.error('Error loading employees:', err);
      setError('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const response = await fetch(`/api/documents/organization/${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setGeneratedDocuments(data);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleTemplateSelect = (templateType: string) => {
    setSelectedTemplate(templateType);
    setFormData({});
    setError('');
  };

  const handleGenerateDocument = async () => {
    if (!selectedEmployee || !selectedTemplate) {
      setError('Please select an employee and document type');
      return;
    }

    if (isSuperAdmin && !organizationId) {
      setError('Organization ID is required for super admin');
      return;
    }

    // Validate required fields
    const template = templates[selectedTemplate];
    if (template) {
      const missingFields = template.requiredFields.filter(field => !formData[field]);
      if (missingFields.length > 0) {
        setError(`Missing required fields: ${missingFields.join(', ')}`);
        return;
      }
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          documentType: selectedTemplate,
          organizationId: organizationId || 'ORG-001',
          createdBy: isSuperAdmin ? 'super_admin' : 'admin',
          documentData: formData
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Reset form
        setSelectedTemplate('');
        setSelectedEmployee('');
        setFormData({});
        
        // Reload documents
        if (isSuperAdmin && organizationId) {
          const docsResponse = await fetch(`/api/documents/organization/${organizationId}`);
          const docs = await docsResponse.json();
          setGeneratedDocuments(docs);
        }

        // Show success message
        alert('Document generated successfully!');
      } else {
        setError(data.message || 'Failed to generate document');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setGeneratedDocuments(prev => prev.filter(doc => doc.id !== documentId));
      } else {
        alert('Failed to delete document');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    }
  };

  const renderFormField = (fieldName: string) => {
    const fieldLabel = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    
    switch (fieldName) {
      case 'position':
      case 'department':
      case 'employmentType':
      case 'warningType':
        return (
          <div key={fieldName}>
            <Label>{fieldLabel}</Label>
            <Select value={formData[fieldName]} onValueChange={(value) => setFormData({...formData, [fieldName]: value})}>
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder={`Select ${fieldLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {fieldName === 'position' && ['Senior Developer', 'Manager', 'Executive', 'Specialist'].map(pos => (
                  <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                ))}
                {fieldName === 'department' && ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'].map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
                {fieldName === 'employmentType' && ['Full-time', 'Part-time', 'Contract', 'Intern'].map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
                {fieldName === 'warningType' && ['Performance', 'Conduct', 'Attendance', 'Policy Violation'].map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      
      case 'startDate':
      case 'deadline':
      case 'month':
      case 'year':
        return (
          <div key={fieldName}>
            <Label>{fieldLabel}</Label>
            <Input
              type={fieldName === 'month' || fieldName === 'year' ? 'text' : 'date'}
              value={formData[fieldName]}
              onChange={(e) => setFormData({...formData, [fieldName]: e.target.value})}
              placeholder={`Enter ${fieldLabel.toLowerCase()}`}
              className="mt-2 rounded-xl"
            />
          </div>
        );
      
      case 'salary':
      case 'basicSalary':
        return (
          <div key={fieldName}>
            <Label>{fieldLabel}</Label>
            <Input
              type="number"
              value={formData[fieldName]}
              onChange={(e) => setFormData({...formData, [fieldName]: e.target.value})}
              placeholder={`Enter ${fieldLabel.toLowerCase()}`}
              className="mt-2 rounded-xl"
            />
          </div>
        );
      
      case 'achievements':
      case 'recommendations':
      case 'incident':
      case 'improvementPlan':
      case 'issues':
      case 'actionItems':
      case 'expectedOutcomes':
      case 'benefits':
      case 'allowances':
      case 'deductions':
        return (
          <div key={fieldName}>
            <Label>{fieldLabel}</Label>
            <Textarea
              value={formData[fieldName]}
              onChange={(e) => setFormData({...formData, [fieldName]: e.target.value})}
              placeholder={`Enter ${fieldLabel.toLowerCase()}`}
              className="mt-2 rounded-xl"
              rows={3}
            />
          </div>
        );
      
      default:
        return (
          <div key={fieldName}>
            <Label>{fieldLabel}</Label>
            <Input
              value={formData[fieldName]}
              onChange={(e) => setFormData({...formData, [fieldName]: e.target.value})}
              placeholder={`Enter ${fieldLabel.toLowerCase()}`}
              className="mt-2 rounded-xl"
            />
          </div>
        );
    }
  };

  return (
    <Card className="p-6 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Document Generator</h3>
          <p className="text-sm text-muted-foreground">Generate and manage employee documents</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'generate' ? 'default' : 'outline'}
          onClick={() => setActiveTab('generate')}
          className="rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Document
        </Button>
        <Button
          variant={activeTab === 'view' ? 'default' : 'outline'}
          onClick={() => setActiveTab('view')}
          className="rounded-xl"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Documents
        </Button>
      </div>

      {activeTab === 'generate' && (
        <div className="space-y-6">
          {/* Organization ID for Super Admin */}
          {isSuperAdmin && (
            <div>
              <Label>Organization ID *</Label>
              <Input
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="Enter organization ID (e.g., ORG-001)"
                className="mt-2 rounded-xl"
              />
            </div>
          )}

          {/* Employee Selection */}
          <div>
            <Label>Select Employee *</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={loadingEmployees}>
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Select an employee"} />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No employees found</div>
                ) : (
                  employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">{employee.position} - {employee.department}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Document Type Selection */}
          <div>
            <Label>Document Type *</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(templates).map(([type, template]) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <div>
                        <div className="font-medium">{type}</div>
                        <div className="text-xs text-muted-foreground">{template.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Form Fields */}
          {selectedTemplate && templates[selectedTemplate] && (
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Document Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates[selectedTemplate].requiredFields.map(renderFormField)}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerateDocument}
            disabled={isGenerating || !selectedEmployee || !selectedTemplate}
            className="rounded-xl w-full"
          >
            {isGenerating ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Generating Document...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate Document
              </>
            )}
          </Button>
        </div>
      )}

      {activeTab === 'view' && (
        <div className="space-y-4">
          {generatedDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium text-muted-foreground">No documents generated yet</h4>
              <p className="text-sm text-muted-foreground">Generate your first document to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generatedDocuments.map((document) => (
                <Card key={document.id} className="p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{document.documentType}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="w-3 h-3" />
                          {employees.find(emp => emp.id === document.employeeId)?.name || 'Unknown Employee'}
                          <span>·</span>
                          <Calendar className="w-3 h-3" />
                          {new Date(document.generatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={document.status === 'Generated' ? 'default' : 'secondary'}>
                        {document.status}
                      </Badge>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteDocument(document.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default DocumentGenerator;
