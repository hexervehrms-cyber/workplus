import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import {
  DollarSign, Plus, Search, Loader2, X, Calculator, Download, Eye, Trash2, CheckCircle, Clock
} from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { apiGet, apiPost, apiPut, appendOrgIdParam, resolveAuthOrgId } from '../../utils/apiHelper';
import { useAuth } from '../../context/AuthContext';

interface PayrollCalculationRecord {
  _id: string;
  employeeId: {
    _id: string;
    employeeCode: string;
    designation: string;
    department: string;
  };
  userId: {
    name: string;
    email: string;
  };
  baseSalary: number;
  perDaySalary: number;
  fromDate: string;
  toDate: string;
  workingDays: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  createdAt: string;
}

interface Employee {
  _id: string;
  employeeCode: string;
  userId: { name: string; email: string };
  designation: string;
  department: string;
  baseSalary: number;
  joiningDate: string;
}

export default function PayrollCalculation() {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<PayrollCalculationRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCalculateForm, setShowCalculateForm] = useState(false);
  const [showFNFCalculator, setShowFNFCalculator] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState({
    employeeId: '',
    fromDate: '',
    toDate: '',
    baseSalary: '',
    bonus: '',
    incentive: '',
    advance: '',
    loan: '',
    notes: ''
  });

  const [fnfData, setFnfData] = useState({
    employeeId: '',
    terminationDate: '',
    terminationReason: 'resignation',
    fnfResult: null as Record<string, unknown> | null
  });

  useEffect(() => {
    void fetchPayrolls();
    void fetchEmployees();
  }, [user?.orgId, user?.tenantId, user?.role]);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '200' });
      if (user?.role === 'super_admin') {
        const oid = resolveAuthOrgId(user);
        if (!oid) {
          toast.error('Select an organization before loading payroll runs.');
          setPayrolls([]);
          return;
        }
        params.set('orgId', oid);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiGet(`/payroll/runs${qs}`, false);
      setPayrolls(Array.isArray(data.data) ? data.data : []);
    } catch (error: unknown) {
      console.error('Error fetching payrolls:', error);
      const msg = error instanceof Error ? error.message : 'Failed to load payroll runs';
      toast.error(msg);
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await apiGet(appendOrgIdParam('/employees?limit=500&simple=true', user), false);
      const list = Array.isArray(data.data) ? data.data : data.data?.employees;
      setEmployees(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  };

  const handleCalculatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.fromDate) {
      toast.error('Please select an employee and a period start date');
      return;
    }

    try {
      setSubmitting(true);

      const data = await apiPost('/payroll/calculate', {
        employeeId: formData.employeeId,
        fromDate: formData.fromDate,
        toDate: formData.toDate || undefined,
        bonus: formData.bonus ? Number(formData.bonus) : undefined,
        incentive: formData.incentive ? Number(formData.incentive) : undefined,
        advance: formData.advance ? Number(formData.advance) : undefined,
        loan: formData.loan ? Number(formData.loan) : undefined,
        notes: formData.notes || undefined
      });

      if (!data.success) throw new Error(data.message || 'Failed to calculate payroll');

      await fetchPayrolls();
      setShowCalculateForm(false);
      setFormData({
        employeeId: '',
        fromDate: '',
        toDate: '',
        baseSalary: '',
        bonus: '',
        incentive: '',
        advance: '',
        loan: '',
        notes: ''
      });
      toast.success('Payroll calculated successfully');
    } catch (error: any) {
      console.error('Error calculating payroll:', error);
      toast.error(error.message || 'Failed to calculate payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCalculateFNF = async () => {
    if (!fnfData.employeeId || !fnfData.terminationDate) {
      toast.error('Please select an employee and termination date');
      return;
    }

    const orgId = user?.orgId || user?.tenantId;
    if (!orgId || orgId === 'system') {
      toast.error('Organization context is required');
      return;
    }

    try {
      setSubmitting(true);

      const data = await apiPost('fnf/calculate', {
        employeeId: fnfData.employeeId,
        terminationDate: fnfData.terminationDate,
        terminationReason: fnfData.terminationReason,
        orgId
      });

      if (data.success && data.data) {
        setFnfData((prev) => ({ ...prev, fnfResult: data.data as Record<string, unknown> }));
        toast.success(data.message || 'FNF calculated successfully');
      } else {
        toast.error(data.message || 'FNF calculation failed');
      }
    } catch (error: unknown) {
      console.error('Error calculating FNF:', error);
      const msg = error instanceof Error ? error.message : 'Failed to calculate FNF';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovePayroll = async (payrollId: string) => {
    try {
      await apiPut(`/payroll/${payrollId}/approve`, {});
      await fetchPayrolls();
      toast.success('Payroll approved');
    } catch (error: unknown) {
      console.error('Error approving payroll:', error);
      toast.error('Failed to approve payroll');
    }
  };

  const handleMarkPaid = async (payrollId: string) => {
    try {
      await apiPut(`/payroll/${payrollId}/mark-paid`, {});
      await fetchPayrolls();
      toast.success('Payroll marked as paid');
    } catch (error: unknown) {
      console.error('Error marking as paid:', error);
      toast.error('Failed to mark as paid');
    }
  };

  const filteredPayrolls = payrolls.filter((payroll) => {
    const code =
      typeof payroll.employeeId === 'object' && payroll.employeeId
        ? payroll.employeeId.employeeCode || ''
        : '';
    const matchesSearch =
      (payroll.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || payroll.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'calculated':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'paid':
      case 'released':
        return 'bg-emerald-100 text-emerald-800';
      case 'locked':
        return 'bg-amber-100 text-amber-900';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground mt-1">Calculate and manage employee payroll</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowFNFCalculator(true)} variant="outline" className="rounded-lg">
            <Calculator className="w-4 h-4 mr-2" />
            FNF Calculator
          </Button>
          <Button onClick={() => setShowCalculateForm(true)} className="rounded-lg">
            <Plus className="w-4 h-4 mr-2" />
            Calculate Payroll
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="calculated">Calculated</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Payroll Table */}
      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Employee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Period</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Working Days</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Gross Salary</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Deductions</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Net Salary</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No payroll records found</p>
                  </td>
                </tr>
              ) : (
                filteredPayrolls.map((payroll) => (
                  <tr key={payroll._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p className="font-medium">{payroll.userId?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeof payroll.employeeId === 'object'
                            ? payroll.employeeId?.employeeCode
                            : '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(payroll.fromDate).toLocaleDateString()} - {new Date(payroll.toDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {payroll.workingDays}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      ₹{Number(payroll.totalEarnings ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      ₹{Number(payroll.totalDeductions ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      ₹{Number(payroll.netSalary ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge className={`${getStatusColor(payroll.status)} border-0`}>
                        {payroll.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="p-1 hover:bg-muted rounded"
                          title="View"
                          onClick={() => {
                            toast.info(
                              `${payroll.userId?.name || 'Employee'} · ${new Date(payroll.fromDate).toLocaleDateString()}–${new Date(payroll.toDate).toLocaleDateString()} · Net ₹${Number(payroll.netSalary ?? 0).toLocaleString('en-IN')} (${payroll.status})`
                            );
                          }}
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {payroll.status === 'calculated' && (
                          <button
                            onClick={() => handleApprovePayroll(payroll._id)}
                            className="p-1 hover:bg-muted rounded"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        {payroll.status === 'approved' && (
                          <button
                            onClick={() => handleMarkPaid(payroll._id)}
                            className="p-1 hover:bg-muted rounded"
                            title="Mark Paid"
                          >
                            <Clock className="w-4 h-4 text-blue-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Calculate Payroll Modal */}
      {showCalculateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl rounded-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Calculate Payroll</h2>
                <button onClick={() => setShowCalculateForm(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCalculatePayroll} className="space-y-4">
                <div>
                  <Label>Employee *</Label>
                  <Select value={formData.employeeId} onValueChange={(value) => {
                    const emp = employees.find(e => e._id === value);
                    setFormData({
                      ...formData,
                      employeeId: value,
                      baseSalary: emp?.baseSalary != null ? String(emp.baseSalary) : ''
                    });
                  }}>
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp._id} value={emp._id}>
                          {emp.userId?.name || 'Unknown'} - {emp.employeeCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>From Date *</Label>
                    <Input
                      type="date"
                      value={formData.fromDate}
                      onChange={(e) => setFormData({...formData, fromDate: e.target.value})}
                      className="mt-1 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <Label>To Date (optional)</Label>
                    <Input
                      type="date"
                      value={formData.toDate}
                      onChange={(e) => setFormData({...formData, toDate: e.target.value})}
                      className="mt-1 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <Label>Base Salary (reference only)</Label>
                  <Input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({...formData, baseSalary: e.target.value})}
                    placeholder="0"
                    className="mt-1 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bonus</Label>
                    <Input
                      type="number"
                      value={formData.bonus}
                      onChange={(e) => setFormData({...formData, bonus: e.target.value})}
                      placeholder="0"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>Incentive</Label>
                    <Input
                      type="number"
                      value={formData.incentive}
                      onChange={(e) => setFormData({...formData, incentive: e.target.value})}
                      placeholder="0"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Advance Salary</Label>
                    <Input
                      type="number"
                      value={formData.advance}
                      onChange={(e) => setFormData({...formData, advance: e.target.value})}
                      placeholder="0"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>Loan Deduction</Label>
                    <Input
                      type="number"
                      value={formData.loan}
                      onChange={(e) => setFormData({...formData, loan: e.target.value})}
                      placeholder="0"
                      className="mt-1 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Add any notes..."
                    className="mt-1 rounded-lg"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCalculateForm(false)}
                    className="flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" />
                        Calculate
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* FNF Calculator Modal */}
      {showFNFCalculator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl rounded-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">FNF Calculator</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowFNFCalculator(false);
                    setFnfData({
                      employeeId: '',
                      terminationDate: '',
                      terminationReason: 'resignation',
                      fnfResult: null
                    });
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Select Employee *</Label>
                  <Select
                    value={fnfData.employeeId}
                    onValueChange={(value) => setFnfData({ ...fnfData, employeeId: value })}
                  >
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp._id} value={emp._id}>
                          {emp.userId?.name ?? '—'} - {emp.employeeCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Termination date *</Label>
                  <Input
                    type="date"
                    className="mt-1 rounded-lg"
                    value={fnfData.terminationDate}
                    onChange={(e) =>
                      setFnfData({ ...fnfData, terminationDate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Termination reason *</Label>
                  <Select
                    value={fnfData.terminationReason}
                    onValueChange={(value) =>
                      setFnfData({ ...fnfData, terminationReason: value })
                    }
                  >
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resignation">Resignation</SelectItem>
                      <SelectItem value="termination">Termination</SelectItem>
                      <SelectItem value="retirement">Retirement</SelectItem>
                      <SelectItem value="death">Death</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleCalculateFNF}
                  disabled={submitting || !fnfData.employeeId || !fnfData.terminationDate}
                  className="w-full rounded-lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Calculate FNF
                    </>
                  )}
                </Button>

                {fnfData.fnfResult && (
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold">FNF settlement</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Status</span>
                        <span className="font-medium">
                          {String(fnfData.fnfResult.status ?? '—')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total earnings (incl. components)</span>
                        <span className="font-medium">
                          ₹
                          {Number(fnfData.fnfResult.totalEarnings ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total deductions</span>
                        <span className="font-medium">
                          ₹
                          {Number(fnfData.fnfResult.totalDeductions ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Leave encashment</span>
                        <span className="font-medium">
                          ₹
                          {Number(
                            (fnfData.fnfResult.leaveEncashment as { totalLeaveEncashment?: number })
                              ?.totalLeaveEncashment ?? 0
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Net settlement</span>
                        <span className="text-green-600">
                          ₹{Number(fnfData.fnfResult.netSettlement ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <Button type="button" variant="outline" className="w-full rounded-lg mt-4">
                      <Download className="w-4 h-4 mr-2" />
                      FNF letter (not available yet)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
