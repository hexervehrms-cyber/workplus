import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  Edit3,
} from 'lucide-react';
import { apiGet, apiPost } from '../utils/apiHelper';
import { useAuth } from '../context/AuthContext';

interface DigitalDocumentGeneratorProps {
  organizationId: string;
  createdBy: string;
  onDocumentGenerated: (document: any) => void;
}

interface EmployeeOption {
  id: string;
  userId: string;
  name: string;
  email: string;
  department: string;
}

const DigitalDocumentGenerator: React.FC<DigitalDocumentGeneratorProps> = ({
  organizationId,
  createdBy,
  onDocumentGenerated,
}) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    category: 'Company Policies',
    assignTo: 'all',
    targetUsers: [] as string[],
    requiresAcknowledgment: true,
  });

  const effectiveOrgId =
    organizationId || user?.orgId || user?.tenantId || '';

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const json = await apiGet<{ data?: unknown[] }>(
        'employees?limit=500&simple=true',
        false
      );
      const list = Array.isArray(json?.data) ? json.data : [];
      const mapped: EmployeeOption[] = list
        .map((emp: any) => {
          const userId = String(emp.userId?._id || emp.userId || '');
          if (!userId) return null;
          return {
            id: String(emp._id),
            userId,
            name: emp.userId?.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee',
            email: emp.userId?.email || '',
            department: emp.department || '',
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
  };

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
    'Warning Letter',
    'CAP (Corrective Action Plan)',
    'Suspension',
    'Bench',
    'Self Training Period',
    'Other',
  ];

  const handleGenerateDocument = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    if (!effectiveOrgId) {
      setError('Organization is not loaded yet. Please wait and try again.');
      return;
    }

    if (formData.assignTo === 'specific' && formData.targetUsers.length === 0) {
      setError('Please select at least one employee when assigning to specific employees');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiPost<{
        success?: boolean;
        data?: { document?: unknown };
        document?: unknown;
      }>('documents/digital-generate', {
        title: formData.title,
        description: formData.description,
        content: formData.content,
        category: formData.category,
        organizationId: effectiveOrgId,
        createdBy,
        assignTo: formData.assignTo,
        targetUsers: formData.targetUsers,
        requiresAcknowledgment: formData.requiresAcknowledgment,
      });

      if (data?.success !== false) {
        const assignLabel =
          formData.assignTo === 'all'
            ? 'all employees'
            : `${formData.targetUsers.length} employee(s)`;
        setSuccess(`Document sent to ${assignLabel} successfully!`);
        const generatedDocument = data.data?.document || data.document;
        if (generatedDocument) onDocumentGenerated(generatedDocument);

        setFormData({
          title: '',
          description: '',
          content: '',
          category: 'Company Policies',
          assignTo: 'all',
          targetUsers: [],
          requiresAcknowledgment: true,
        });

        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(data.message || 'Failed to generate document');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      targetUsers: prev.targetUsers.includes(userId)
        ? prev.targetUsers.filter((id) => id !== userId)
        : [...prev.targetUsers, userId],
    }));
  };

  return (
    <Card className="p-6 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Edit3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Generate Digital Document</h3>
          <p className="text-sm text-muted-foreground">
            Create documents for employees to read and acknowledge — all categories support &quot;All Employees&quot;
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <Label>Document Title *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter document title"
            className="mt-2 rounded-xl"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description"
            className="mt-2 rounded-xl"
            rows={3}
          />
        </div>

        <div>
          <Label>Category</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger className="mt-2 rounded-xl">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Document Content *</Label>
          <Textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Write the full document content here"
            className="mt-2 rounded-xl"
            rows={12}
          />
        </div>

        <div>
          <Label>Assign To</Label>
          <Select
            value={formData.assignTo}
            onValueChange={(value) =>
              setFormData({ ...formData, assignTo: value, targetUsers: value === 'all' ? [] : formData.targetUsers })
            }
          >
            <SelectTrigger className="mt-2 rounded-xl">
              <SelectValue placeholder="Select assignment option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              <SelectItem value="specific">Specific Employees</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.assignTo === 'specific' && (
          <div>
            <Label>Select Employees</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-xl p-3">
              {loadingEmployees ? (
                <div className="text-center py-4 text-muted-foreground">Loading employees...</div>
              ) : employees.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No employees found</div>
              ) : (
                employees.map((employee) => (
                  <label
                    key={employee.userId}
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={formData.targetUsers.includes(employee.userId)}
                      onChange={() => handleUserToggle(employee.userId)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{employee.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {employee.email}
                        {employee.department ? ` · ${employee.department}` : ''}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.targetUsers.length} employee{formData.targetUsers.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="requires-acknowledgment"
            checked={formData.requiresAcknowledgment}
            onChange={(e) => setFormData({ ...formData, requiresAcknowledgment: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="requires-acknowledgment" className="text-sm">
            Require employee acknowledgment
          </Label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">{success}</span>
          </div>
        )}

        <Button
          onClick={handleGenerateDocument}
          disabled={isGenerating || !formData.title.trim() || !formData.content.trim() || !effectiveOrgId}
          className="rounded-xl w-full"
        >
          {isGenerating ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Sending document...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {formData.assignTo === 'all' ? 'Send to All Employees' : 'Send to Selected Employees'}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

export default DigitalDocumentGenerator;
