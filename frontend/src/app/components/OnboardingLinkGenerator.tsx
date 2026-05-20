import React, { useState, useEffect } from 'react';
import { useDepartments } from '../hooks/useDepartments';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { Copy, Check, Loader, Mail, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { toast } from '../utils/portalToast';
import { apiClient } from '../utils/api';
import { apiPost } from '../utils/apiHelper';

const ONBOARDING_EMAIL_TIMEOUT_MS = 90_000;

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
  const { departmentNames, loading: deptLoading, error: deptError, reload: reloadDepartments } =
    useDepartments({ enabled: isOpen, seedIfEmpty: true });

  const [step, setStep] = useState<'form' | 'result'>('form');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);

  const [formData, setFormData] = useState({
    employeeEmail: '',
    employeeName: '',
    department: ''
  });

  const departmentOptions =
    departmentNames.length > 0 ? departmentNames : ['General'];

  useEffect(() => {
    if (!isOpen) return;
    void reloadDepartments();
  }, [isOpen, reloadDepartments]);

  useEffect(() => {
    if (!isOpen || deptLoading || !formData.department) return;
    const options = departmentNames.length > 0 ? departmentNames : ['General'];
    if (!options.includes(formData.department)) {
      setFormData((prev) => ({ ...prev, department: '' }));
    }
  }, [isOpen, deptLoading, departmentNames, formData.department]);

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
    const department = formData.department || departmentOptions[0] || 'General';
    if (!formData.employeeEmail || !formData.employeeName) {
      toast.error('Please fill in employee email and name');
      return;
    }

    try {
      setLoading(true);

      const data = await apiClient.post<GeneratedLink>('/onboarding/generate-link', {
        ...formData,
        department,
      });

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to generate onboarding link');
      }

      if (!data.data?.token) {
        throw new Error('Invalid response: missing token or onboarding URL');
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
    if (!generatedLink?.token) {
      toast.error('Missing onboarding token — generate the link again');
      return;
    }

    try {
      setLoading(true);

      const data = await apiPost<{ success?: boolean; message?: string; code?: string }>(
        'onboarding/send-email',
        {
          token: generatedLink.token,
          employeeEmail: generatedLink.employeeEmail,
          employeeName: generatedLink.employeeName,
          onboardingUrl: generatedLink.onboardingUrl,
        },
        { timeoutMs: ONBOARDING_EMAIL_TIMEOUT_MS }
      );

      if (data?.success === false) {
        throw new Error(data?.message || 'Failed to send email');
      }

      toast.success(
        data?.message || `Onboarding email sent to ${generatedLink.employeeEmail}`
      );
      handleSuccess();
    } catch (error) {
      console.error('Send email error:', error);
      const err = error as Error & { code?: string };
      let msg = err instanceof Error ? err.message : 'Failed to send email';
      if (err.code === 'SMTP_NOT_CONFIGURED') {
        msg =
          'Email is not configured on the server. Set SMTP_HOST, SMTP_USER, and SMTP_PASS for hr@hexerve.com in Render or Admin → Notification Settings.';
      } else if (err.code === 'EMAIL_RATE_LIMIT') {
        msg = 'Too many emails sent recently. Wait a few minutes and try again.';
      } else if (err.code === 'SMTP_CIRCUIT_OPEN') {
        msg = 'Email service is temporarily busy. Wait a minute and try again.';
      } else if (msg.includes('timed out')) {
        msg =
          'Email is taking longer than expected. The message may still be sent — check the candidate inbox or try again.';
      }
      toast.error(msg);
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
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
                <div className="flex items-center justify-between">
                  <Label>Department *</Label>
                  {deptError && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => void reloadDepartments()}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
                <Select
                  value={formData.department || undefined}
                  onValueChange={handleSelectChange}
                  disabled={deptLoading}
                >
                  <SelectTrigger className="mt-2 rounded-xl">
                    <SelectValue
                      placeholder={deptLoading ? 'Loading departments…' : 'Select department'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {deptLoading ? (
                      <SelectItem value="_loading" disabled>
                        Loading departments…
                      </SelectItem>
                    ) : (
                      departmentOptions.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {deptError && (
                  <p className="text-xs text-destructive mt-1">{deptError}</p>
                )}
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
                disabled={loading || deptLoading}
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
              <Button variant="outline" onClick={handleSuccess} className="rounded-xl" disabled={loading}>
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
