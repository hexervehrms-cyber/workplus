import { useState, useEffect } from 'react';
import { Download, Loader, FileText, Calendar, RefreshCw, Eye } from 'lucide-react';
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
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { toast } from '../../utils/portalToast';
import { apiGet, buildApiUrl } from '../../utils/apiHelper';
import { TokenManager } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

interface SalarySlip {
  _id: string;
  month: number;
  year: number;
  status: string;
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
  const url = buildApiUrl(`salary/slip/${slipId}/download`);
  const token = TokenManager.get();
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'text/html,application/pdf,*/*',
    },
  });
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }
  return response.blob();
}

export default function Payroll() {
  const { user } = useAuth();
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewingSlip, setViewingSlip] = useState<SalarySlip | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchEmployeeAndSlips();
  }, [user?.id]);

  const fetchEmployeeAndSlips = async () => {
    try {
      setLoading(true);

      if (!user?.id) {
        console.error('User not authenticated');
        toast.error('User not authenticated');
        return;
      }

      const employeeData = await apiGet(`/employees/user/${user.id}`);

      if (!employeeData.data || !employeeData.data._id) {
        toast.error('Employee record not found');
        return;
      }

      const empId = employeeData.data._id;

      await fetchSalarySlips(empId);
    } catch (error) {
      console.error('Error fetching employee and slips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalarySlips = async (empId: string) => {
    try {
      const data = await apiGet(`/salary/slips/${empId}`);

      if (data.data && Array.isArray(data.data)) {
        setSalarySlips(data.data);
      } else {
        setSalarySlips([]);
      }
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      setSalarySlips([]);
    }
  };

  const handleDownloadSalarySlip = async (slipId: string) => {
    try {
      const blob = await fetchSalarySlipBlob(slipId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary-slip-${slipId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Salary slip downloaded successfully');
    } catch (error) {
      console.error('Error downloading salary slip:', error);
      toast.error('Failed to download salary slip. Please try again.');
    }
  };

  const handleViewSalarySlip = async (slipId: string) => {
    try {
      setPreviewLoading(true);
      const res = await apiGet<{ success?: boolean; data?: SalarySlip }>(
        `/salary/slip/by-id/${slipId}?_t=${Date.now()}`,
        false
      );
      const slip = (res as { data?: SalarySlip })?.data ?? (res as SalarySlip);
      if (!slip?._id) {
        const fromList = salarySlips.find((s) => s._id === slipId);
        if (fromList) {
          setViewingSlip(fromList);
          setPreviewOpen(true);
          return;
        }
        throw new Error('Could not load payslip details');
      }
      setViewingSlip(slip);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error loading payslip preview:', error);
      toast.error('Failed to load payslip preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setViewingSlip(null);
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
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Salary payslip</DialogTitle>
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
          {previewLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : viewingSlip ? (
            <ScrollArea className="flex-1 px-6 max-h-[calc(90vh-10rem)]">
              <div className="space-y-4 pb-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4 bg-muted/40">
                    <p className="text-xs text-muted-foreground">Gross</p>
                    <p className="text-lg font-bold text-foreground">₹{viewingSlip.grossEarnings.toLocaleString()}</p>
                  </Card>
                  <Card className="p-4 bg-muted/40">
                    <p className="text-xs text-muted-foreground">Deductions</p>
                    <p className="text-lg font-bold text-destructive">₹{viewingSlip.totalDeductions.toLocaleString()}</p>
                  </Card>
                  <Card className="p-4 bg-primary/10 border-primary/20">
                    <p className="text-xs text-muted-foreground">Net pay</p>
                    <p className="text-lg font-bold text-primary">₹{viewingSlip.netSalary.toLocaleString()}</p>
                  </Card>
                </div>
                {viewingSlip.attendanceData && (
                  <>
                    <h4 className="font-semibold text-foreground">Attendance</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-muted-foreground">Working days</p>
                        <p className="font-semibold">{viewingSlip.attendanceData.totalWorkingDays}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-muted-foreground">Present</p>
                        <p className="font-semibold text-secondary">{viewingSlip.attendanceData.presentDays}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-muted-foreground">Absent</p>
                        <p className="font-semibold text-destructive">{viewingSlip.attendanceData.absentDays}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-muted-foreground">Leaves</p>
                        <p className="font-semibold">{viewingSlip.attendanceData.leavesTaken}</p>
                      </div>
                    </div>
                  </>
                )}
                <Separator />
                <h4 className="font-semibold text-foreground">Earnings</h4>
                <div className="rounded-lg border border-border overflow-hidden text-sm">
                  {[
                    ['Basic', viewingSlip.earnings?.basic],
                    ['HRA', viewingSlip.earnings?.hra],
                    ['Medical', viewingSlip.earnings?.medicalExpenses],
                    ['Travel', viewingSlip.earnings?.travel],
                    ['Incentives', viewingSlip.earnings?.incentives],
                    ['Bonus', viewingSlip.earnings?.bonus],
                  ]
                    .filter(([, v]) => (v ?? 0) > 0)
                    .map(([label, amount]) => (
                      <div key={String(label)} className="flex justify-between px-4 py-2 border-b border-border">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">₹{Number(amount).toLocaleString()}</span>
                      </div>
                    ))}
                  <div className="flex justify-between px-4 py-3 bg-secondary/10 font-semibold">
                    <span>Total earnings</span>
                    <span>₹{viewingSlip.grossEarnings.toLocaleString()}</span>
                  </div>
                </div>
                <h4 className="font-semibold text-foreground">Deductions</h4>
                <div className="rounded-lg border border-border overflow-hidden text-sm">
                  {[
                    ['PF', viewingSlip.deductions?.providentFund],
                    ['ESI', viewingSlip.deductions?.employeeStateInsurance],
                    ['Professional tax', viewingSlip.deductions?.professionalTax],
                    ['Income tax', viewingSlip.deductions?.incomeTax],
                  ]
                    .filter(([, v]) => (v ?? 0) > 0)
                    .map(([label, amount]) => (
                      <div key={String(label)} className="flex justify-between px-4 py-2 border-b border-border">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">₹{Number(amount).toLocaleString()}</span>
                      </div>
                    ))}
                  <div className="flex justify-between px-4 py-3 bg-destructive/10 font-semibold">
                    <span>Total deductions</span>
                    <span>₹{viewingSlip.totalDeductions.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}
          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={closePreview}>Close</Button>
            {viewingSlip && (
              <Button onClick={() => void handleDownloadSalarySlip(viewingSlip._id)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Salary Slips</h1>
          <p className="text-muted-foreground">View and download your salary slips</p>
        </div>
        <Button onClick={() => fetchEmployeeAndSlips()} variant="outline" className="rounded-lg">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
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
                variant="outline"
                onClick={() => void handleViewSalarySlip(currentSlip._id)}
                disabled={previewLoading}
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
            {salarySlips.map((slip) => (
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
                  <Badge variant={slip.status === 'approved' ? 'default' : 'secondary'}>{slip.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleViewSalarySlip(slip._id)}
                    disabled={previewLoading}
                    className="rounded-lg"
                    title="View payslip"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDownloadSalarySlip(slip._id)}
                    className="rounded-lg"
                    title="Download salary slip"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
