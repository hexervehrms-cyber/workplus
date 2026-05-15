import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader, Download, Eye, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { apiGet } from '../../utils/apiHelper';

interface KPIData {
  currentAmount: number;
  previousAmount: number;
  effectiveFrom: string;
  effectiveTo?: string;
  perDayAmount: number;
  cycleStartDate: string;
  cycleEndDate: string;
  employeeType: string;
}

interface SalaryHistory {
  month: string;
  salary: number;
  type: string;
}

export default function PayrollDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [employeeType, setEmployeeType] = useState<'intern' | 'employee'>('employee');

  useEffect(() => {
    fetchPayrollData();
  }, []);

  const fetchPayrollData = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/payroll/employee/dashboard');
      setKpiData(data.data.kpiData);
      setSalaryHistory(data.data.salaryHistory);
      setEmployeeType(data.data.employeeType);
    } catch (error) {
      console.error('Error fetching payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground"></p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Payroll Dashboard</h1>
        <p className="text-muted-foreground">View your salary information and payroll history</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Current Salary/Stipend Card */}
        <Card className="p-6 rounded-2xl border-l-4 border-l-primary">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {employeeType === 'intern' ? 'Your Stipend' : 'Your Salary'}
              </p>
              <h3 className="text-2xl font-bold">
                ₹{kpiData?.currentAmount.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>Effective from: {new Date(kpiData?.effectiveFrom || '').toLocaleDateString()}</p>
            {kpiData?.effectiveTo && (
              <p>Until: {new Date(kpiData.effectiveTo).toLocaleDateString()}</p>
            )}
          </div>
        </Card>

        {/* Previous Salary/Stipend Card */}
        {kpiData?.previousAmount > 0 && (
          <Card className="p-6 rounded-2xl border-l-4 border-l-muted">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Previous Amount</p>
                <h3 className="text-2xl font-bold">
                  ₹{kpiData?.previousAmount.toLocaleString()}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Increment: ₹{(kpiData?.currentAmount - kpiData?.previousAmount).toLocaleString()}</p>
              <p>
                Increase: {(
                  ((kpiData?.currentAmount - kpiData?.previousAmount) / kpiData?.previousAmount) *
                  100
                ).toFixed(1)}%
              </p>
            </div>
          </Card>
        )}

        {/* Per Day Salary/Stipend Card */}
        <Card className="p-6 rounded-2xl border-l-4 border-l-green-500">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {employeeType === 'intern' ? 'Per Day Stipend' : 'Per Day Salary'}
              </p>
              <h3 className="text-2xl font-bold">
                ₹{kpiData?.perDayAmount.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>Based on 30-day basis</p>
            <p>Calculated: Monthly / 30 days</p>
          </div>
        </Card>

        {/* Payroll Cycle Card */}
        <Card className="p-6 rounded-2xl border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Payroll Cycle</p>
              <h3 className="text-lg font-bold">
                {new Date(kpiData?.cycleStartDate || '').getDate()} -{' '}
                {new Date(kpiData?.cycleEndDate || '').getDate()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>
              {new Date(kpiData?.cycleStartDate || '').toLocaleDateString()} to{' '}
              {new Date(kpiData?.cycleEndDate || '').toLocaleDateString()}
            </p>
            <p>21st of month to 20th of next month</p>
          </div>
        </Card>
      </div>

      {/* Salary History Chart */}
      <Card className="p-6 rounded-2xl">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Salary History</h3>
          <p className="text-sm text-muted-foreground">Last 12 months salary progression</p>
        </div>
        {salaryHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salaryHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="salary"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
                name="Salary/Stipend"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No salary history available
          </div>
        )}
      </Card>

      {/* Salary Slips Section */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Recent Salary Slips</h3>
            <p className="text-sm text-muted-foreground">Download and view your salary slips</p>
          </div>
          <Button className="rounded-xl">
            <Eye className="w-4 h-4 mr-2" />
            View All Slips
          </Button>
        </div>
        <div className="space-y-3">
          {/* Placeholder for salary slips */}
          <div className="p-4 border border-border rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium">May 2026 Salary Slip</p>
              <p className="text-sm text-muted-foreground">Released on 1st June 2026</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-lg">
                <Eye className="w-4 h-4 mr-2" />
                View
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Employee Type Badge */}
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">Employee Type:</p>
        <Badge variant={employeeType === 'intern' ? 'secondary' : 'default'}>
          {employeeType === 'intern' ? 'Intern' : 'Employee'}
        </Badge>
      </div>
    </div>
  );
}
