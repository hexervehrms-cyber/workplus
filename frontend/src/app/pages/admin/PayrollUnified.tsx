import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, Plus, Settings } from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { apiGet } from '../../utils/apiHelper';
import { useAuth } from '../../context/AuthContext';
import { ensureArray } from '../../utils/safeUi';
import { Suspense, lazy } from 'react';

// Lazy load payroll sub-components
const PayrollCalculation = lazy(() => import('./PayrollCalculation'));
const SalaryStructure = lazy(() => import('./SalaryStructure'));
const SalaryCycle = lazy(() => import('./SalaryCycle'));

interface SalarySlip {
  _id: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  status: string;
  grossEarnings: number;
  totalDeductions?: number;
  netSalary: number;
}

export default function PayrollUnified() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') || 'overview') as string;
  
  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const { user } = useAuth();
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(false);
  const [salarySlipsPageSize] = useState(10);
  const [salarySlipsPage, setSalarySlipsPage] = useState(1);

  const fetchSalarySlips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500', page: '1' });
      if (user?.role === 'super_admin' && user?.orgId) {
        params.set('orgId', user.orgId);
      }
      const data = await apiGet<{ data?: unknown }>(`/salary/slips/all?${params.toString()}`, false);
      setSalarySlips(ensureArray<SalarySlip>(data?.data));
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      toast.error('Failed to load salary slips');
      setSalarySlips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'salary-slips') {
      fetchSalarySlips();
    }
  }, [currentTab, user?.orgId, user?.role]);

  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 border-b border-border pb-4 mb-6">
      {[
        { id: 'overview', label: 'Overview' },
        { id: 'salary-slips', label: 'Salary Slips' },
        { id: 'salary-structure', label: 'Salary Structure' },
        { id: 'payroll-runs', label: 'Payroll Runs' },
        { id: 'settings', label: 'Settings' }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentTab === tab.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'generated':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payroll Management</h1>
        <p className="text-muted-foreground">Manage salary structures, slips, and payroll cycles</p>
      </div>

      {renderTabs()}

      {/* Overview Tab */}
      {currentTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 rounded-xl">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <Button onClick={() => setTab('salary-structure')} variant="outline" size="sm" className="w-full rounded-lg justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Create Salary Structure
              </Button>
              <Button onClick={() => setTab('payroll-runs')} variant="outline" size="sm" className="w-full rounded-lg justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Generate Payroll Run
              </Button>
              <Button onClick={() => setTab('settings')} variant="outline" size="sm" className="w-full rounded-lg justify-start">
                <Settings className="w-4 h-4 mr-2" />
                Salary Cycle Settings
              </Button>
            </div>
          </Card>

          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Payroll Status</h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">Navigate to individual tabs to manage payroll components.</p>
            </div>
          </Card>

          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">View recent payroll updates in the Salary Slips tab.</p>
            </div>
          </Card>
        </div>
      )}

      {/* Salary Slips Tab */}
      {currentTab === 'salary-slips' && (
        <Card className="rounded-xl">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Salary Slips ({salarySlips.length})</h3>
              <Button onClick={() => setTab('overview')} variant="outline" size="sm" className="rounded-lg">
                <Plus className="w-4 h-4 mr-2" />
                Generate Slip
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : salarySlips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No salary slips found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Employee</th>
                        <th className="text-left p-4">Month/Year</th>
                        <th className="text-left p-4">Gross Earnings</th>
                        <th className="text-left p-4">Deductions</th>
                        <th className="text-left p-4">Net Salary</th>
                        <th className="text-left p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salarySlips.slice((salarySlipsPage - 1) * salarySlipsPageSize, salarySlipsPage * salarySlipsPageSize).map((slip) => (
                        <tr key={slip._id} className="border-b hover:bg-accent/50">
                          <td className="p-4">{slip.employeeName}</td>
                          <td className="p-4">{`${slip.month}/${slip.year}`}</td>
                          <td className="p-4">{formatCurrency(slip.grossEarnings)}</td>
                          <td className="p-4">{formatCurrency(slip.totalDeductions || 0)}</td>
                          <td className="p-4 font-semibold">{formatCurrency(slip.netSalary)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(slip.status)}`}>
                              {slip.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {salarySlips.length > salarySlipsPageSize && (
                  <div className="flex items-center justify-between border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {salarySlipsPage} of {Math.ceil(salarySlips.length / salarySlipsPageSize)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={salarySlipsPage <= 1}
                        onClick={() => setSalarySlipsPage(p => Math.max(1, p - 1))}
                        className="rounded-lg"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={salarySlipsPage >= Math.ceil(salarySlips.length / salarySlipsPageSize)}
                        onClick={() => setSalarySlipsPage(p => p + 1)}
                        className="rounded-lg"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Salary Structure Tab */}
      {currentTab === 'salary-structure' && (
        <Suspense fallback={<div className="text-center py-8">Loading salary structures...</div>}>
          <SalaryStructure />
        </Suspense>
      )}

      {/* Payroll Runs Tab */}
      {currentTab === 'payroll-runs' && (
        <Suspense fallback={<div className="text-center py-8">Loading payroll runs...</div>}>
          <PayrollCalculation />
        </Suspense>
      )}

      {/* Settings Tab */}
      {currentTab === 'settings' && (
        <Suspense fallback={<div className="text-center py-8">Loading settings...</div>}>
          <SalaryCycle />
        </Suspense>
      )}
    </div>
  );
}
