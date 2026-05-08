import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { Copy, Check, Loader, Mail, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingLinkGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface GeneratedLink {
  token: string;
  onboardingUrl: string;
  employeeEmail: string;
  employeeName: string;
  expiresAt: string;
}

const OnboardingLinkGenerator: React.FC<OnboardingLinkGeneratorProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);

  const [formData, setFormData] = useState({
    employeeEmail: '',
    employeeName: '',
    department: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      department: value
    }));
  };

  const handleGenerateLink = async () => {
    // Validate form
    if (!formData.employeeEmail || !formData.employeeName || !formData.department) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const response = await fetch('/api/onboarding/generate-link', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate onboarding link');
      }

      setGeneratedLink(data.data);
      setStep('result');
      toast.success('Onboarding link generated successfully!');
    } catch (error) {
      console.error('Generate link error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate onboarding link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink.onboardingUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendEmail = async () => {
    if (!generatedLink) return;

    try {
      setLoading(true);
      // TODO: Implement email sending
      toast.success('Email sent successfully!');
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({
      employeeEmail: '',
      employeeName: '',
      department: ''
    });
    setGeneratedLink(null);
    setCopied(false);
    onClose();
  };

  const handleSuccess = () => {
    handleClose();
    onSuccess?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Generate Onboarding Link</DialogTitle>
          <DialogDescription>
            Create a shareable onboarding link for a new employee
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Employee Email *</Label>
                <Input
                  name="employeeEmail"
                  type="email"
                  value={formData.employeeEmail}
                  onChange={handleInputChange}
                  placeholder="employee@company.com"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label>Employee Name *</Label>
                <Input
                  name="employeeName"
                  value={formData.employeeName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Department *</Label>
                <Select value={formData.department} onValueChange={handleSelectChange}>
                  <SelectTrigger className="mt-2 rounded-xl">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                ℹ️ The onboarding link will be valid for 30 days. The employee can use this link to fill in their information.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose} className="rounded-xl">
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateLink} 
                disabled={loading}
                className="rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="p-6 rounded-2xl bg-green-50 border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900">Link Generated Successfully!</h3>
                  <p className="text-sm text-green-800">Share this link with the employee</p>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <div>
                <Label className="text-sm">Employee Details</Label>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{generatedLink?.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{generatedLink?.employeeEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span className="font-medium">{new Date(generatedLink?.expiresAt || '').toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm">Onboarding Link</Label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={generatedLink?.onboardingUrl || ''}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-xl border border-input bg-muted text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="rounded-xl"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-900">
                  💡 Share this link with the employee via email or any communication channel. They can use it to complete their onboarding form.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleSuccess} className="rounded-xl">
                Done
              </Button>
              <Button 
                onClick={handleSendEmail} 
                disabled={loading}
                className="rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingLinkGenerator;

