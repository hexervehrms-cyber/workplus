import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Copy, Share2, Link, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface GeneratedLink {
  token: string;
  shareableLink: string;
  expiresAt: string;
  employeeEmail: string;
  employeeName: string;
}

const OnboardingLinkGenerator: React.FC<{ isSuperAdmin?: boolean }> = ({ isSuperAdmin = false }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    employeeName: '',
    employeeEmail: '',
    department: '',
    organizationName: '',
    organizationId: ''
  });

  const departments = [
    'Engineering',
    'Marketing',
    'Sales',
    'Human Resources',
    'Finance',
    'Operations',
    'Design',
    'Product',
    'Analytics',
    'General'
  ];

  const handleGenerateLink = async () => {
    if (!formData.employeeName || !formData.employeeEmail) {
      setError('Employee name and email are required');
      return;
    }
    
    if (isSuperAdmin && (!formData.organizationName || !formData.organizationId)) {
      setError('Organization name and ID are required for super admin');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeName: formData.employeeName,
          employeeEmail: formData.employeeEmail,
          department: formData.department || 'General',
          organizationName: isSuperAdmin ? formData.organizationName : undefined,
          organizationId: isSuperAdmin ? formData.organizationId : undefined,
          createdBy: isSuperAdmin ? 'super_admin' : 'admin' // In real app, this would be the current admin user
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedLink(data);
        setFormData({ employeeName: '', employeeEmail: '', department: '', organizationName: '', organizationId: '' });
      } else {
        setError(data.message || 'Failed to generate link');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink?.shareableLink) {
      try {
        await navigator.clipboard.writeText(generatedLink.shareableLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = generatedLink.shareableLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleShareLink = async () => {
    if (generatedLink?.shareableLink) {
      try {
        await navigator.share({
          title: 'Employee Onboarding Form',
          text: `Please complete your onboarding form: ${generatedLink.shareableLink}`,
          url: generatedLink.shareableLink,
        });
      } catch (err) {
        // Fallback to copying link if share API is not available
        handleCopyLink();
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="p-6 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Generate Onboarding Link</h3>
          <p className="text-sm text-muted-foreground">Create a shareable link for employee onboarding</p>
        </div>
      </div>

      {!generatedLink ? (
        <div className="space-y-4">
          {isSuperAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Organization Name *</Label>
                <Input
                  value={formData.organizationName}
                  onChange={(e) => setFormData({...formData, organizationName: e.target.value})}
                  placeholder="Enter organization name"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Organization ID *</Label>
                <Input
                  value={formData.organizationId}
                  onChange={(e) => setFormData({...formData, organizationId: e.target.value})}
                  placeholder="Enter organization ID (e.g., ORG-001)"
                  className="mt-2 rounded-xl"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Employee Name *</Label>
              <Input
                value={formData.employeeName}
                onChange={(e) => setFormData({...formData, employeeName: e.target.value})}
                placeholder="Enter employee full name"
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label>Employee Email *</Label>
              <Input
                type="email"
                value={formData.employeeEmail}
                onChange={(e) => setFormData({...formData, employeeEmail: e.target.value})}
                placeholder="employee@company.com"
                className="mt-2 rounded-xl"
              />
            </div>
          </div>

          <div>
            <Label>Department</Label>
            <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})}>
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <Button 
            onClick={handleGenerateLink}
            disabled={isGenerating}
            className="rounded-xl w-full"
          >
            {isGenerating ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Generating Link...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Generate Onboarding Link
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">Link Generated Successfully!</span>
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <p><strong>Employee:</strong> {generatedLink.employeeName}</p>
              <p><strong>Email:</strong> {generatedLink.employeeEmail}</p>
              <p><strong>Expires:</strong> {formatDate(generatedLink.expiresAt)}</p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Shareable Link</Label>
            <div className="mt-2 flex gap-2">
              <Input
                value={generatedLink.shareableLink}
                readOnly
                className="rounded-xl bg-muted"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="rounded-xl"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareLink}
                className="rounded-xl"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Next Steps:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Share this link with the employee via email or messaging</li>
                  <li>The employee can access the onboarding form directly</li>
                  <li>Link expires in 7 days for security</li>
                  <li>You can track the onboarding progress from the dashboard</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setGeneratedLink(null)}
            className="rounded-xl w-full"
          >
            Generate Another Link
          </Button>
        </div>
      )}
    </Card>
  );
};

export default OnboardingLinkGenerator;
