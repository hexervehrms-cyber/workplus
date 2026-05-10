import { useState, useEffect } from 'react';
import { Download, Loader, FileText, Calendar } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { apiGet, buildFileUrl } from '../../utils/apiHelper';

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

export default function Payroll() {
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedSlip, setExpandedSlip] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployeeAndSlips();
  }, []);

  const fetchEmployeeAndSlips = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId');

      // First, get the employee record to get employeeId
      const employeeData = await apiGet(`/employees/user/${userId}`);
      const empId = employeeData.data._id;
      setEmployeeId(empId);

      // Now fetch salary slips using employeeId
      await fetchSalarySlips(empId);
    } catch (error) {
      console.error('Error fetching employee and slips:', error);
      toast.error('Failed to load salary information');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalarySlips = async (empId: string) => {
    try {
      const data = await apiGet(`/salary/slips/${empId}`);
      console.log('📊 [PAYROLL] Salary slips fetched:', data);
      setSalarySlips(data.data || []);
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      toast.error('Failed to load salary slips');
    }
  };

  const handleDownloadSalarySlip = async (slipId: string) => {
    try {
      const fileUrl = buildFileUrl(`/salary/slip/${slipId}/download`);
      
      const response = await fetch(fileUrl);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary-slip-${slipId}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Salary slip downloaded');
      } else {
        toast.error('Failed to download salary slip');
      }
    } catch (error) {
      console.error('Error downloading salary slip:', error);
      toast.error('Failed to download salary slip');
    }
  };

  const currentSlip = salarySlips.find(
    slip => slip.month === selectedMonth && slip.year === selectedYear
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
      <div>
        <h1 className="text-3xl font-bold">My Salary Slips</h1>
        <p className="text-muted-foreground">View and download your salary slips</p>
      </div>

      {/* Month/Year Selector */}
      <Card className="p-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="text-sm font-medium">Month</label>
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
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
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
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

      {/* Current Month Salary Summary */}
      {currentSlip ? (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="grid grid-cols-4 gap-4">
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
            <div className="flex items-end justify-end">
              <Button
                onClick={() => handleDownloadSalarySlip(currentSlip._id)}
                className="rounded-lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No salary slip available for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </Card>
      )}

      {/* Salary Slip Details */}
      {currentSlip && (
        <div className="space-y-4">
          {/* Attendance Summary */}
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

          {/* Earnings Breakdown */}
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
              {currentSlip.earnings.otherEarnings && currentSlip.earnings.otherEarnings.map((earning, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b">
                  <span>{earning.name}</span>
                  <span className="font-medium">₹{earning.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold text-lg bg-green-50 px-2 rounded">
                <span>Total Earnings</span>
                <span>₹{currentSlip.grossEarnings.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* Deductions Breakdown */}
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
              {currentSlip.deductions.otherDeductions && currentSlip.deductions.otherDeductions.map((deduction, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b">
                  <span>{deduction.name}</span>
                  <span className="font-medium">₹{deduction.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold text-lg bg-red-50 px-2 rounded">
                <span>Total Deductions</span>
                <span>₹{currentSlip.totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* Net Salary */}
          <Card className="p-6 bg-gradient-to-r from-primary/20 to-primary/10">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">NET SALARY</span>
              <span className="text-3xl font-bold text-primary">₹{currentSlip.netSalary.toLocaleString()}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Salary Slip History */}
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
              <div key={slip._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {new Date(slip.year, slip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-muted-foreground">Net: ₹{slip.netSalary.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={slip.status === 'approved' ? 'default' : 'secondary'}>
                    {slip.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadSalarySlip(slip._id)}
                    className="rounded-lg"
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
