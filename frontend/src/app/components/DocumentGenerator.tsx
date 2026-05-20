import React, { useState, useEffect, useCallback } from 'react';
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
  User,
  Trash2,
  Eye,
  Clock,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { buildApiUrl, getBearerToken } from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';
import { toast } from '../utils/portalToast';
import { downloadCompanyGeneratedDocument } from '../utils/documentFile';

interface DocumentTemplate {
  template: string;
  requiredFields: string[];
  description: string;
}

/** Built-in templates — backend has no /documents/templates; generation uses /documents/digital-generate */
const DOCUMENT_TEMPLATES: Record<string, DocumentTemplate> = {
  'Offer Letter': {
    template: 'offer',
    description: 'Employment offer with role and compensation',
    requiredFields: ['position', 'department', 'startDate', 'salary'],
  },
  'Warning Letter': {
    template: 'warning',
    description: 'Formal warning for conduct or performance',
    requiredFields: ['warningType', 'incident', 'deadline'],
  },
  'Experience Letter': {
    template: 'experience',
    description: 'Summary of tenure and achievements',
    requiredFields: ['achievements', 'recommendations'],
  },
  'Salary Certificate': {
    template: 'salary_cert',
    description: 'Salary breakdown for a period',
    requiredFields: ['month', 'year', 'basicSalary', 'allowances', 'deductions'],
  },
};

interface GeneratedDocumentRow {
  id: string;
  mongoId: string;
  targetUserId: string;
  documentType: string;
  organizationId: string;
  generatedAt: string;
  status: string;
  title: string;
}

interface EmployeeOption {
  id: string;
  userId: string;
  name: string;
  email: string;
  department: string;
  position: string;
}

const DocumentGenerator: React.FC<{ isSuperAdmin?: boolean }> = ({ isSuperAdmin = false }) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'generate' | 'view'>('generate');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [organizationIdInput, setOrganizationIdInput] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocumentRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const effectiveOrgId = isSuperAdmin
    ? organizationIdInput.trim()
    : String(user?.orgId || user?.tenantId || '').trim();

  const loadEmployees = useCallback(async () => {
    if (isSuperAdmin && !effectiveOrgId) {
      setEmployees([]);
      setLoadingEmployees(false);
      return;
    }
    try {
      setLoadingEmployees(true);
      const token = getBearerToken();
      const params = new URLSearchParams();
      params.set('limit', '500');
      params.set('simple', 'true');
      if (isSuperAdmin && effectiveOrgId) {
        params.set('orgId', effectiveOrgId);
      }
      const response = await fetch(buildApiUrl(`/employees?${params.toString()}`), {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        setEmployees([]);
        return;
      }
      const json = await response.json();
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      const mapped: EmployeeOption[] = (list as Record<string, unknown>[])
        .map((emp) => {
          const userId = String(
            (emp.userId as { _id?: string })?._id || emp.userId || ''
          );
          if (!userId) return null;
          return {
            id: String(emp._id || ''),
            userId,
            name: String(
              (emp.userId as { name?: string })?.name ||
                `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
                'Employee'
            ),
            email: String((emp.userId as { email?: string })?.email || emp.email || ''),
            department: String(emp.department || ''),
            position: String(emp.designation || emp.position || ''),
          };
        })
        .filter(Boolean) as EmployeeOption[];
      setEmployees(mapped);
    } catch (err) {
      console.error('Error loading employees:', err);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, [isSuperAdmin, effectiveOrgId]);

  const loadDocuments = useCallback(async () => {
    if (!effectiveOrgId) return;
    try {
      setLoadingDocuments(true);
      const token = getBearerToken();
      const response = await fetch(
        buildApiUrl(`/documents/organization/${encodeURIComponent(effectiveOrgId)}`),
        {
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!response.ok) {
        setGeneratedDocuments([]);
        return;
      }
      const json = await response.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      setGeneratedDocuments(
        rows.map((d: Record<string, unknown>) => {
          const customId = typeof d.id === 'string' && d.id ? String(d.id) : '';
          const mongoId = String(d._id || '');
          return {
            id: customId || mongoId,
            mongoId,
            targetUserId: Array.isArray(d.targetUsers) && d.targetUsers[0] ? String(d.targetUsers[0]) : '',
            documentType: String(d.documentType || d.category || 'Document'),
            organizationId: String(d.organizationId || effectiveOrgId),
            generatedAt: String(d.createdAt || d.updatedAt || new Date().toISOString()),
            status: String(d.status || 'generated'),
            title: String(d.title || d.documentType || 'Document'),
          };
        })
      );
    } catch (err) {
      console.error('Error loading documents:', err);
      setGeneratedDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (activeTab === 'view' && effectiveOrgId) {
      void loadDocuments();
    }
  }, [activeTab, effectiveOrgId, loadDocuments]);

  const handleTemplateSelect = (templateType: string) => {
    setSelectedTemplate(templateType);
    setFormData({});
    setError('');
  };

  const buildContentFromForm = (): string => {
    const lines = Object.entries(formData)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `${k}: ${v}`);
    return lines.join('\n') || '(No additional details)';
  };

  const handleGenerateDocument = async () => {
    if (!selectedUserId || !selectedTemplate) {
      setError('Please select an employee and document type');
      return;
    }

    if (!effectiveOrgId) {
      setError(
        isSuperAdmin
          ? 'Tenant organization id is required (copy from Organizations → Tenant ID)'
          : 'Your account has no organization context'
      );
      return;
    }

    const template = DOCUMENT_TEMPLATES[selectedTemplate];
    if (template) {
      const missing = template.requiredFields.filter((field) => !formData[field]?.trim());
      if (missing.length > 0) {
        setError(`Missing required fields: ${missing.join(', ')}`);
        return;
      }
    }

    const employee = employees.find((e) => e.userId === selectedUserId);
    const title = `${selectedTemplate} — ${employee?.name || 'Employee'}`;

    setIsGenerating(true);
    setError('');

    try {
      const token = getBearerToken();
      const response = await fetch(buildApiUrl('/documents/digital-generate'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          description: template?.description || selectedTemplate,
          content: buildContentFromForm(),
          category: selectedTemplate,
          organizationId: effectiveOrgId,
          assignTo: 'specific',
          targetUsers: [selectedUserId],
          requiresAcknowledgment: true,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError((data as { message?: string }).message || 'Failed to generate document');
        return;
      }

      setSelectedTemplate('');
      setSelectedUserId('');
      setFormData({});
      toast.success('Document generated successfully');
      if (effectiveOrgId) await loadDocuments();
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteDocument = async (customId: string) => {
    if (!customId || !confirm('Delete this generated document?')) return;

    try {
      const token = getBearerToken();
      const response = await fetch(
        buildApiUrl(`/documents/generated/${encodeURIComponent(customId)}`),
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (response.ok) {
        setGeneratedDocuments((prev) => prev.filter((d) => d.id !== customId));
        toast.success('Document deleted');
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error((data as { message?: string }).message || 'Failed to delete document');
      }
    } catch (err) {
      toast.error('Network error');
      console.error(err);
    }
  };

  const renderFormField = (fieldName: string) => {
    const fieldLabel = fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());

    switch (fieldName) {
      case 'position':
      case 'department':
      case 'employmentType':
      case 'warningType':
        return (
          <div key={fieldName}>
            <Label>{fieldLabel}</Label>
            <Select
              value={formData[fieldName]}
              onValueChange={(value) => setFormData({ ...formData, [fieldName]: value })}
            >
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder={`Select ${fieldLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {fieldName === 'position' &&
                  ['Senior Developer', 'Manager', 'Executive', 'Specialist'].map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos}
                    </SelectItem>
                  ))}
                {fieldName === 'department' &&
                  ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'].map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                {fieldName === 'employmentType' &&
                  ['Full-time', 'Part-time', 'Contract', 'Intern'].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                {fieldName === 'warningType' &&
                  ['Performance', 'Conduct', 'Attendance', 'Policy Violation'].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
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
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
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
          <p className="text-sm text-muted-foreground">Generate and assign documents via digital generate</p>
        </div>
      </div>

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
          {isSuperAdmin && (
            <div>
              <Label>Tenant organization ID *</Label>
              <Input
                value={organizationIdInput}
                onChange={(e) => setOrganizationIdInput(e.target.value)}
                placeholder="Paste tenant id from Organizations (copy button on each card)"
                className="mt-2 rounded-xl font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Use the MongoDB id shown as &quot;Tenant ID (for APIs)&quot; on the organization card, not the display
                code (for example ORG-…). Employees load after this id is entered.
              </p>
            </div>
          )}

          <div>
            <Label>Select Employee *</Label>
            <Select
              key={isSuperAdmin ? effectiveOrgId || 'no-org' : 'tenant'}
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={loadingEmployees}
            >
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder={loadingEmployees ? 'Loading employees...' : 'Select an employee'} />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No employees found</div>
                ) : (
                  employees.map((employee) => (
                    <SelectItem key={employee.userId} value={employee.userId}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {employee.position} — {employee.department}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Document Type *</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TEMPLATES).map(([type, template]) => (
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

          {selectedTemplate && DOCUMENT_TEMPLATES[selectedTemplate] && (
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Document Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DOCUMENT_TEMPLATES[selectedTemplate].requiredFields.map(renderFormField)}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <Button
            onClick={() => void handleGenerateDocument()}
            disabled={isGenerating || !selectedUserId || !selectedTemplate}
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
          {!effectiveOrgId ? (
            <p className="text-sm text-muted-foreground">
              {isSuperAdmin
                ? 'Enter the tenant organization id (from Organizations) to list generated documents for that org.'
                : 'No organization context.'}
            </p>
          ) : loadingDocuments ? (
            <p className="text-sm text-muted-foreground">Loading documents…</p>
          ) : generatedDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium text-muted-foreground">No documents found</h4>
              <p className="text-sm text-muted-foreground">Generate a document or check the organization ID</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generatedDocuments.map((document) => (
                <Card key={document.mongoId || document.id} className="p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{document.title}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="w-3 h-3" />
                          {employees.find((emp) => emp.userId === document.targetUserId)?.name || 'Employee'}
                          <span>·</span>
                          <Calendar className="w-3 h-3" />
                          {new Date(document.generatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{document.status}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              await downloadCompanyGeneratedDocument(
                                document.mongoId || document.id,
                                `${document.title}.pdf`
                              );
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : 'Download not available (document may have no file yet)'
                              );
                            }
                          })();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-red-600 hover:text-red-700"
                        type="button"
                        onClick={() => void handleDeleteDocument(document.mongoId || document.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
          }
        </div>
      )}
    </Card>
  );
};

export default DocumentGenerator;
