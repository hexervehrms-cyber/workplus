import { useState, useEffect } from 'react';
import { DollarSign, Download, TrendingUp, TrendingDown, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useCurrency } from '../../context/CurrencyContext';
import { PayrollService, AdvanceLoanService } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

interface Payslip {
  _id: string;
  month: string;
  year: number;
  grossSalary: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  paidDate?: string;
}

interface AdvanceLoan {
  _id: string;
  type: 'advance' | 'loan';
  amount: number;
  reason: string;
  monthlyDeduction: number;
  status: string;
  totalInstallments: number;
  paidInstallments: number;
}

export default function Payroll() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [advancesLoans, setAdvancesLoans] = useState<AdvanceLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [payslipData, alData] = await Promise.all([
        PayrollService.getMyPayslips(),
        AdvanceLoanService.getMyAdvancesLoans()
      ]);
      setPayslips(payslipData);
      setAdvancesLoans(alData.filter((al: AdvanceLoan) => al.status === 'approved'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch payroll data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate current month salary
  const currentPayslip = payslips[0];
  const gross = currentPayslip?.grossSalary || 0;
  const totalDeductions = currentPayslip?.totalDeductions || 0;
  const advanceLoanDeductions = advancesLoans.reduce((sum, al) => sum + (al.monthlyDeduction || 0), 0);
  const net = gross - totalDeductions;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Payroll</h1>
          <p className="text-muted-foreground">View your salary and payslips</p>
        </div>
      </div>

      {/* Current Salary */}
      <Card className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg text-muted-foreground mb-2">Current Month Net Pay</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{formatCurrency(net)}</span>
              <Badge className="bg-secondary text-secondary-foreground">Net Pay</Badge>
            </div>
          </div>
          <div className="w-20 h-20 rounded-xl bg-primary/20 flex items-center justify-center">
            <DollarSign className="w-10 h-10 text-primary" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-background/50 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Gross Salary</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(gross)}</p>
          </div>
          <div className="p-4 rounded-xl bg-background/50 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Total Deductions</p>
            <p className="text-xl font-bold text-destructive">-{formatCurrency(totalDeductions)}</p>
          </div>
          <div className="p-4 rounded-xl bg-background/50 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Take Home</p>
            <p className="text-xl font-bold text-secondary">{formatCurrency(net)}</p>
          </div>
        </div>
      </Card>

      {/* Advance/Loan Deductions */}
      {advancesLoans.length > 0 && (
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Advance/Loan Deductions
          </h3>
          <div className="space-y-3">
            {advancesLoans.map((al) => (
              <div key={al._id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{al.type === 'advance' ? 'Salary Advance' : 'Loan'} - {al.reason}</p>
                  <p className="text-sm text-muted-foreground">
                    {al.paidInstallments}/{al.totalInstallments} installments paid
                  </p>
                </div>
                <span className="font-semibold text-orange-500">-{formatCurrency(al.monthlyDeduction)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Payslip History */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Payslip History</h3>
          <p className="text-sm text-muted-foreground">Download your previous payslips</p>
        </div>
        <div className="divide-y divide-border">
          {payslips.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payslips found</p>
            </div>
          ) : (
            payslips.map((slip) => (
              <div key={slip._id} className="p-6 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{slip.month} {slip.year}</h4>
                      <p className="text-sm text-muted-foreground">
                        {slip.status === 'paid' ? `Paid on ${slip.paidDate ? new Date(slip.paidDate).toLocaleDateString() : 'N/A'}` : 'Pending'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Gross</p>
                      <p className="font-semibold">{formatCurrency(slip.grossSalary)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Deductions</p>
                      <p className="font-semibold text-destructive">-{formatCurrency(slip.totalDeductions)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Net Pay</p>
                      <p className="font-bold text-primary text-lg">{formatCurrency(slip.netPay)}</p>
                    </div>
                    <Badge variant={slip.status === 'paid' ? 'default' : 'outline'}>
                      {slip.status}
                    </Badge>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
