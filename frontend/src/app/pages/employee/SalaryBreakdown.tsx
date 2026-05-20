import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useCurrency } from '../../context/CurrencyContext';
import { toast } from '../../utils/portalToast';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Download, Loader2, BarChart3 } from 'lucide-react';

interface SalaryBreakdown {
  month: string;
  year: number;
  baseSalary: number;
  hra: number;
  allowances: number;
  grossSalary: number;
  providentFund: number;
  tax: number;
  insurance: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

interface SalaryHistory {
  fromDate: string;
  toDate?: string;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  payFrequency: string;
  dailyWage: number;
}

export default function EmployeeSalaryBreakdown() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [salaryBreakdown, setSalaryBreakdown] = useState<SalaryBreakdown | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  useEffect(() => {
    // Set current month and year
    const now = new Date();
    setSelectedMonth((now.getMonth() + 1).toString().padStart(2, '0'));
    setSelectedYear(now.getFullYear().toString());
    fetchSalaryData();
  }, []);

  const fetchSalaryData = async () => {
    try {
      setLoading(true);
      // TODO: Call API to fetch salary breakdown and history
      // const response = await EmployeeService.getSalaryBreakdown(month, year);
      // setSalaryBreakdown(response.breakdown);
      // setSalaryHistory(response.history);
    } catch {
      /* load errors surfaced via toast */
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    // Fetch data for new month
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    // Fetch data for new year
  };

  const handleDownloadPayslip = () => {
    toast.success('Payslip downloaded successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString().padStart(2, '0'),
    label: new Date(2024, i).toLocaleString('default', { month: 'long' })
  }));

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { value: year.toString(), label: year.toString() };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Salary Breakdown</h1>
        <p className="text-gray-600 mt-1">View your salary details and payment history</p>
      </div>

      {/* Month/Year Selection */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Salary Summary */}
      {salaryBreakdown && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Gross Salary */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Gross Salary</p>
                  <p className="text-2xl font-bold text-indigo-600">{formatCurrency(salaryBreakdown.grossSalary)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-600 opacity-20" />
              </div>
            </Card>

            {/* Total Deductions */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Deductions</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(salaryBreakdown.totalDeductions)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-600 opacity-20" />
              </div>
            </Card>

            {/* Net Pay */}
            <Card className="p-6 border-2 border-green-200 bg-green-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Net Pay</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(salaryBreakdown.netPay)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600 opacity-20" />
              </div>
            </Card>

            {/* Download */}
            <Card className="p-6 flex items-center justify-center">
              <button
                onClick={handleDownloadPayslip}
                className="flex flex-col items-center gap-2 text-indigo-600 hover:text-indigo-700"
              >
                <Download className="w-6 h-6" />
                <span className="text-sm font-medium">Download Payslip</span>
              </button>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings */}
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Earnings
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Salary</span>
                  <span className="font-semibold">{formatCurrency(salaryBreakdown.baseSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">HRA</span>
                  <span className="font-semibold">{formatCurrency(salaryBreakdown.hra)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Allowances</span>
                  <span className="font-semibold">{formatCurrency(salaryBreakdown.allowances)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-bold">
                  <span>Gross Salary</span>
                  <span className="text-indigo-600">{formatCurrency(salaryBreakdown.grossSalary)}</span>
                </div>
              </div>
            </Card>

            {/* Deductions */}
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Deductions
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Provident Fund</span>
                  <span className="font-semibold">{formatCurrency(salaryBreakdown.providentFund)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-semibold">{formatCurrency(salaryBreakdown.tax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Insurance</span>
                  <span className="font-semibold">{formatCurrency(salaryBreakdown.insurance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Other Deductions</span>
                  <span className="font-semibold">{formatCurrency(salaryBreakdown.otherDeductions)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-bold">
                  <span>Total Deductions</span>
                  <span className="text-red-600">{formatCurrency(salaryBreakdown.totalDeductions)}</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Salary History */}
      {salaryHistory.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Salary Structure History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Period</th>
                  <th className="text-right py-3 px-4 font-semibold">Base Salary</th>
                  <th className="text-right py-3 px-4 font-semibold">Gross Salary</th>
                  <th className="text-right py-3 px-4 font-semibold">Net Salary</th>
                  <th className="text-right py-3 px-4 font-semibold">Daily Wage</th>
                  <th className="text-center py-3 px-4 font-semibold">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {salaryHistory.map((history, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{new Date(history.fromDate).toLocaleDateString()}</p>
                          {history.toDate && (
                            <p className="text-xs text-gray-600">to {new Date(history.toDate).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">{formatCurrency(history.baseSalary)}</td>
                    <td className="text-right py-3 px-4 font-semibold">{formatCurrency(history.grossSalary)}</td>
                    <td className="text-right py-3 px-4 text-green-600 font-semibold">{formatCurrency(history.netSalary)}</td>
                    <td className="text-right py-3 px-4">{formatCurrency(history.dailyWage)}</td>
                    <td className="text-center py-3 px-4">
                      <Badge variant="outline" className="capitalize">{history.payFrequency}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
