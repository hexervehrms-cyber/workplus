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
  Plus, 
  Users,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
  User,
  Edit3
} from 'lucide-react';
import { buildApiUrl, getBearerToken } from '../utils/apiHelper';

interface DigitalDocumentGeneratorProps {
  organizationId: string;
  createdBy: string;
  onDocumentGenerated: (document: any) => void;
}

const DigitalDocumentGenerator: React.FC<DigitalDocumentGeneratorProps> = ({
  organizationId,
  createdBy,
  onDocumentGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    category: 'Company Policies',
    assignTo: 'all', // 'all' or specific user
    targetUsers: [] as string[],
    requiresAcknowledgment: true
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
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
    'Other'
  ];

  const handleGenerateDocument = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    if (formData.assignTo === 'specific' && formData.targetUsers.length === 0) {
      setError('Please select at least one user when assigning to specific users');
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccess('');

    try {
      const token = getBearerToken();
      
      const response = await fetch(buildApiUrl('/documents/digital-generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          content: formData.content,
          category: formData.category,
          organizationId,
          createdBy,
          assignTo: formData.assignTo,
          targetUsers: formData.targetUsers,
          requiresAcknowledgment: formData.requiresAcknowledgment
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Document generation response:', data);
        setSuccess('Digital document generated successfully!');
        // Extract the document from the nested response structure
        const generatedDocument = data.data?.document || data.document;
        console.log('Generated document:', generatedDocument);
        onDocumentGenerated(generatedDocument);
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          content: '',
          category: 'Company Policies',
          assignTo: 'all',
          targetUsers: [],
          requiresAcknowledgment: true
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Failed to generate document');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      targetUsers: prev.targetUsers.includes(userId)
        ? prev.targetUsers.filter(id => id !== userId)
        : [...prev.targetUsers, userId]
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
          <p className="text-sm text-muted-foreground">Create custom documents for employees to read and acknowledge</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Document Title */}
        <div>
          <Label>Document Title *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            placeholder="Enter document title (e.g., New Policy Announcement)"
            className="mt-2 rounded-xl"
          />
        </div>

        {/* Description */}
        <div>
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Brief description of the document"
            className="mt-2 rounded-xl"
            rows={3}
          />
        </div>

        {/* Category */}
        <div>
          <Label>Category</Label>
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

        {/* Document Content */}
        <div>
          <Label>Document Content *</Label>
          <Textarea
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            placeholder="Write the full document content here. You can use markdown formatting for better readability."
            className="mt-2 rounded-xl"
            rows={12}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tip: You can use markdown formatting (## for headings, ** for bold, etc.)
          </p>
        </div>

        {/* Assignment Options */}
        <div>
          <Label>Assign To</Label>
          <Select value={formData.assignTo} onValueChange={(value) => setFormData({...formData, assignTo: value})}>
            <SelectTrigger className="mt-2 rounded-xl">
              <SelectValue placeholder="Select assignment option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              <SelectItem value="specific">Specific Employees</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User Selection (when assigning to specific users) */}
        {formData.assignTo === 'specific' && (
          <div>
            <Label>Select Employees</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-xl p-3">
              {loadingEmployees ? (
                <div className="text-center py-4 text-muted-foreground">Loading employees...</div>
              ) : employees.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No employees found</div>
              ) : (
                employees.map(employee => (
                  <label key={employee.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.targetUsers.includes(employee.id)}
                      onChange={() => handleUserToggle(employee.id)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{employee.name}</div>
                      <div className="text-xs text-muted-foreground">{employee.email} · {employee.department}</div>
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

        {/* Acknowledgment Requirement */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="requires-acknowledgment"
            checked={formData.requiresAcknowledgment}
            onChange={(e) => setFormData({...formData, requiresAcknowledgment: e.target.checked})}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="requires-acknowledgment" className="text-sm">
            Require employee acknowledgment
          </Label>
        </div>

        {/* Error and Success Messages */}
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

        {/* Generate Button */}
        <Button
          onClick={handleGenerateDocument}
          disabled={isGenerating || !formData.title.trim() || !formData.content.trim()}
          className="rounded-xl w-full"
        >
          {isGenerating ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Generating Document...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Generate Digital Document
            </>
          )}
        </Button>

        {/* Preview Section */}
        {formData.title && formData.content && (
          <div className="border-t pt-6">
            <h4 className="font-medium text-sm mb-3">Preview</h4>
            <div className="bg-muted/30 rounded-xl p-4">
              <h5 className="font-semibold text-lg mb-2">{formData.title}</h5>
              {formData.description && (
                <p className="text-sm text-muted-foreground mb-3">{formData.description}</p>
              )}
              <div className="text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                {formData.content.substring(0, 500)}
                {formData.content.length > 500 && '...'}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DigitalDocumentGenerator;
