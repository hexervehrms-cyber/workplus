import { useState, useEffect } from 'react';
import { useRef } from 'react';
import { Download, Loader, FileText, Calendar, RefreshCw, Eye, Upload, FileSpreadsheet } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { toast } from '../../utils/portalToast';
import { apiFetchBlob, apiGet, apiUpload } from '../../utils/apiHelper';
import { normalizeSalarySlip } from '../../utils/salarySlip';
import { useAuth } from '../../context/AuthContext';

interface SalarySlip {
  _id: string;
  month: number;
  year: number;
  status: string;
  source?: string;
  uploadFileName?: string;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  attendanceData: {
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    leavesTaken: number;
  };
  earnings: {
    basic: number;
    hra: number;
    medicalExpenses: number;
    travel: number;
    internetCharges: number;
    nightShiftAllowance: number;
    incentives: number;
    bonus: number;
    commission: number;
    otherEarnings: Array<{ name: string; amount: number }>;
  };
  deductions: {
    providentFund: number;
    employeeStateInsurance: number;
    professionalTax: number;
    incomeTax: number;
    leaveDeduction: number;
    otherDeductions: Array<{ name: string; amount: number }>;
  };
}

async function fetchSalarySlipBlob(slipId: string): Promise<Blob> {
  return apiFetchBlob(`salary/slip/${slipId}/download`, {
    headers: { Accept: 'text/html,application/pdf,*/*' },
  });
}

export default function Payroll() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employeeMongoId, setEmployeeMongoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewingSlip, setViewingSlip] = useState<SalarySlip | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchEmployeeAndSlips();
  }, [user?.userId, user?.id]);

  const fetchEmployeeAndSlips = async () => {
    try {
      setLoading(true);

      const authUserId = user?.userId || user?.id;
      if (!authUserId) {
        toast.error('User not authenticated');
        return;
      }

      const employeeData = await apiGet<{
        success?: boolean;
        data?: { _id?: string };
      }>(`/employees/user/${authUserId}`, false);
      const employeeRecord =
        (employeeData as { data?: { _id?: string } })?.data?.data ||
        (employeeData as { data?: { _id?: string } })?.data ||
        employeeData;

      if (!employeeRecord || !(employeeRecord as { _id?: string })._id) {
        toast.error('Employee record not found');
        return;
      }

      const empId = (employeeRecord as { _id: string })._id;
      setEmployeeMongoId(empId);

      await fetchSalarySlips(empId);
    } catch (error) {
      console.error('Error fetching employee and slips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalarySlips = async (empId: string) => {
    try {
      const data = await apiGet(`/salary/slips/${empId}`, false);

      // Normalize response: handle data.data, data, or array directly
      let rows: unknown[] = [];
      if (Array.isArray(data?.data)) {
        rows = data.data;
      } else if (Array.isArray(data)) {
        rows = data;
      } else if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).records)) {
        rows = (data as Record<string, unknown>).records as unknown[];
      } else if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).slips)) {
        rows = (data as Record<string, unknown>).slips as unknown[];
      }

      setSalarySlips(rows.map((row) => normalizeSalarySlip(row as Record<string, unknown>)) as SalarySlip);
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      setSalarySlips([]);
    }
  };

  const handleDownloadSalarySlip = async (slipId: string) => {
    const slip = findSlipById(slipId);
    
    // Block download for pending uploaded slips
    if (slip && slip.status === 'pending_approval') {
      toast.info('Download will be available after admin approves this payslip.');
      return;
    }

    try {
      const fallbackName = slip 
        ? `salary-slip-${slip.month}-${slip.year}.html`
        : `salary-slip-${slipId}.html`;
      
      const blob = await fetchSalarySlipBlob(slipId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Salary slip downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading salary slip:', error);
      if (error?.status === 403) {
        toast.error('You do not have permission to download this payslip.');
      } else if (error?.status === 404) {
        toast.error('Payslip not found.');
      } else {
        toast.error('Failed to download salary slip. Please try again.');
      }
    }
  };

  const findSlipById = (slipId: string): SalarySlip | undefined => {
    const fromList = salarySlips.find((s) => s._id === slipId);
    if (fromList) return fromList;
    if (currentSlip?._id === slipId) return currentSlip;
    return undefined;
  };

  const handleViewSalarySlip = async (slipId: string) => {
    const slip = findSlipById(slipId);
    if (!slip) {
      toast.error('Payslip not found for this period');
      return;
    }

    // Block preview for pending uploaded slips
    if (slip.status === 'pending_approval') {
      toast.info('This payslip is pending admin approval. Preview will be available after approval.');
      return;
    }

    setViewingSlip(slip);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const blob = await fetchSalarySlipBlob(slipId);
      
      // Ensure blob has correct MIME type for HTML rendering
      const htmlBlob = blob.type ? blob : new Blob([blob], { type: 'text/html; charset=utf-8' });
      const objectUrl = URL.createObjectURL(htmlBlob);
      setPreviewUrl(objectUrl);
    } catch (error: any) {
      console.error('Error loading payslip preview:', error);
      if (error?.status === 403) {
        toast.error('You do not have permission to view this payslip.');
      } else if (error?.status === 404) {
        toast.error('Payslip not found.');
      } else {
        toast.error('Failed to load payslip preview. It may not be available yet.');
      }
      setPreviewOpen(false);
      setViewingSlip(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setViewingSlip(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiFetchBlob('salary/slip/upload/template');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payslip-upload-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleExportSlips = async () => {
    if (!employeeMongoId) {
      toast.error('Employee profile not loaded');
      return;
    }
    try {
      const blob = await apiFetchBlob(`salary/slip/export/${employeeMongoId}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-salary-slips-${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Salary slips exported');
    } catch {
      toast.error('Failed to export salary slips');
    }
  };

  const handleUploadPayslip = async (file: File) => {
    if (!employeeMongoId) {
      toast.error('Employee profile not loaded');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('month', String(selectedMonth));
      form.append('year', String(selectedYear));
      const res = await apiUpload<{ success?: boolean; message?: string; data?: Record<string, unknown> }>(
        'salary/slip/employee-upload',
        form
      );
      // Check for error response format
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error((res as any).message || 'Upload failed');
      }
      // Show message from API or default message
      const successMessage = (res as any)?.message || 'Payslip uploaded — waiting for admin approval';
      toast.success(successMessage);
      
      // Refetch salary slips to show the uploaded payslip in pending state
      // Note: Employee will only see approved/released slips, but the upload message confirms it was received
      await fetchSalarySlips(employeeMongoId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload payslip');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentSlip = salarySlips.find(
    (slip) => slip.month === selectedMonth && slip.year === selectedYear
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Dialog open={previewOpen} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Salary payslip preview</DialogTitle>
            {viewingSlip && (
              <DialogDescription>
                {new Date(viewingSlip.year, viewingSlip.month - 1).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · {viewingSlip.status}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto px-4 py-2 min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center h-[500px]">
                <Loader className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : previewUrl ? (
              <iframe
                title="Salary slip preview"
                src={previewUrl}
                className="w-full h-[78vh] rounded-lg border border-border bg-white"
                style={{ minWidth: '900px' }}
              />
            ) : null}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={closePreview}>Close</Button>
            {viewingSlip && (
              <Button onClick={() => void handleDownloadSalarySlip(viewingSlip._id)}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Salary Slips</h1>
          <p className="text-muted-foreground">View, upload, and download your salary slips</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => void handleDownloadTemplate()}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Template
          </Button>
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => void handleExportSlips()}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUploadPayslip(f);
            }}
          />
          <Button
            type="button"
            className="rounded-lg"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import / Upload
          </Button>
          <Button onClick={() => fetchEmployeeAndSlips()} variant="outline" className="rounded-lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="text-sm font-medium">Month</label>
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val, 10))}>
              <SelectTrigger className="rounded-lg mt-2 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <SelectItem key={month} value={month.toString()}>
                    {new Date(2024, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Year</label>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val, 10))}>
              <SelectTrigger className="rounded-lg mt-2 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {currentSlip ? (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          {currentSlip.status === 'pending_approval' && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-4 rounded-lg bg-amber-500/10 px-3 py-2">
              Uploaded payslip is pending admin approval
              {currentSlip.uploadFileName ? ` (${currentSlip.uploadFileName})` : ''}.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Gross Earnings</p>
              <p className="text-2xl font-bold">₹{currentSlip.grossEarnings.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Deductions</p>
              <p className="text-2xl font-bold text-destructive">₹{currentSlip.totalDeductions.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Salary</p>
              <p className="text-2xl font-bold text-primary">₹{currentSlip.netSalary.toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleViewSalarySlip(currentSlip._id)}
                className="rounded-lg"
              >
                <Eye className="w-4 h-4 mr-2" />
                View payslip
              </Button>
              <Button onClick={() => void handleDownloadSalarySlip(currentSlip._id)} className="rounded-lg">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No salary slip available for{' '}
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Please check with HR or try another month.
          </p>
        </Card>
      )}

      {currentSlip && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Attendance Summary</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Working Days</p>
                <p className="text-2xl font-bold">{currentSlip.attendanceData.totalWorkingDays}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Present Days</p>
                <p className="text-2xl font-bold text-green-600">{currentSlip.attendanceData.presentDays}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Absent Days</p>
                <p className="text-2xl font-bold text-red-600">{currentSlip.attendanceData.absentDays}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Leaves Taken</p>
                <p className="text-2xl font-bold text-orange-600">{currentSlip.attendanceData.leavesTaken}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Earnings Breakdown</h3>
            <div className="space-y-2">
              {currentSlip.earnings.basic > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Basic Salary</span>
                  <span className="font-medium">₹{currentSlip.earnings.basic.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.hra > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>House Rent Allowance (HRA)</span>
                  <span className="font-medium">₹{currentSlip.earnings.hra.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.medicalExpenses > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Medical Expenses</span>
                  <span className="font-medium">₹{currentSlip.earnings.medicalExpenses.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.travel > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Travel Allowance</span>
                  <span className="font-medium">₹{currentSlip.earnings.travel.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.internetCharges > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Internet Charges</span>
                  <span className="font-medium">₹{currentSlip.earnings.internetCharges.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.nightShiftAllowance > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Night Shift Allowance</span>
                  <span className="font-medium">₹{currentSlip.earnings.nightShiftAllowance.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.incentives > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Incentives</span>
                  <span className="font-medium">₹{currentSlip.earnings.incentives.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.bonus > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Bonus</span>
                  <span className="font-medium">₹{currentSlip.earnings.bonus.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.commission > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Commission</span>
                  <span className="font-medium">₹{currentSlip.earnings.commission.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.earnings.otherEarnings &&
                currentSlip.earnings.otherEarnings.map((earning, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b">
                    <span>{earning.name}</span>
                    <span className="font-medium">₹{earning.amount.toLocaleString()}</span>
                  </div>
                ))}
              <div className="flex justify-between py-2 font-bold text-lg bg-green-50 dark:bg-green-950/30 px-2 rounded text-foreground">
                <span>Total Earnings</span>
                <span>₹{currentSlip.grossEarnings.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Deductions Breakdown</h3>
            <div className="space-y-2">
              {currentSlip.deductions.providentFund > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Provident Fund (PF)</span>
                  <span className="font-medium">₹{currentSlip.deductions.providentFund.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.deductions.employeeStateInsurance > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Employee State Insurance (ESI)</span>
                  <span className="font-medium">₹{currentSlip.deductions.employeeStateInsurance.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.deductions.professionalTax > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Professional Tax</span>
                  <span className="font-medium">₹{currentSlip.deductions.professionalTax.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.deductions.incomeTax > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Income Tax</span>
                  <span className="font-medium">₹{currentSlip.deductions.incomeTax.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.deductions.leaveDeduction > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span>Leave Deduction</span>
                  <span className="font-medium">₹{currentSlip.deductions.leaveDeduction.toLocaleString()}</span>
                </div>
              )}
              {currentSlip.deductions.otherDeductions &&
                currentSlip.deductions.otherDeductions.map((deduction, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b">
                    <span>{deduction.name}</span>
                    <span className="font-medium">₹{deduction.amount.toLocaleString()}</span>
                  </div>
                ))}
              <div className="flex justify-between py-2 font-bold text-lg bg-red-50 dark:bg-red-950/30 px-2 rounded text-foreground">
                <span>Total Deductions</span>
                <span>₹{currentSlip.totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-r from-primary/20 to-primary/10">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">NET SALARY</span>
              <span className="text-3xl font-bold text-primary">₹{currentSlip.netSalary.toLocaleString()}</span>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Salary Slip History</h3>
        {salarySlips.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No salary slips available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {salarySlips.map((slip) => {
              const isPending = slip.status === 'pending_approval';
              const statusBadgeVariant = isPending 
                ? 'outline' 
                : slip.status === 'approved' 
                  ? 'default' 
                  : 'secondary';
              const statusDisplay = isPending ? 'Pending Approval' : slip.status;
              
              return (
                <div
                  key={slip._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {new Date(slip.year, slip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-muted-foreground">Net: ₹{slip.netSalary.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant={statusBadgeVariant}>{statusDisplay}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleViewSalarySlip(slip._id)}
                      className="rounded-lg"
                      disabled={isPending}
                      title={isPending ? 'Pending approval - view disabled' : 'View payslip'}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDownloadSalarySlip(slip._id)}
                      className="rounded-lg"
                      disabled={isPending}
                      title={isPending ? 'Pending approval - download disabled' : 'Download salary slip'}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
