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
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut } from '../../utils/apiHelper';

interface PayrollCalculation {
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
  const [payrolls, setPayrolls] = useState<PayrollCalculation[]>([]);
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
    fnfResult: null as any
  });

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
  }, []);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/payroll');
      setPayrolls(data.data || []);
    } catch (error: any) {
      console.error('Error fetching payrolls:', error);
      toast.error('Failed to load payrolls');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await apiGet('/employees');
      setEmployees(data.data?.employees || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCalculatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.fromDate || !formData.toDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const data = await apiPost('/payroll/calculate', {
        employeeId: formData.employeeId,
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        baseSalary: parseFloat(formData.baseSalary),
        components: {},
        deductions: {
          advance: parseFloat(formData.advance) || 0,
          loan: parseFloat(formData.loan) || 0
        },
        earnings: {
          bonus: parseFloat(formData.bonus) || 0,
          incentive: parseFloat(formData.incentive) || 0
        },
        notes: formData.notes
      });

      if (!data.success) throw new Error('Failed to calculate payroll');

      setPayrolls([data.data, ...payrolls]);
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
    if (!fnfData.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setSubmitting(true);

      const data = await apiGet(`/payroll/fnf/calculate/${fnfData.employeeId}`);
      setFnfData({ ...fnfData, fnfResult: data.data });
      toast.success('FNF calculated successfully');
    } catch (error: any) {
      console.error('Error calculating FNF:', error);
      toast.error(error.message || 'Failed to calculate FNF');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovePayroll = async (payrollId: string) => {
    try {
      const data = await apiPut(`/payroll/${payrollId}/approve`, {});
      setPayrolls(payrolls.map(p => p._id === payrollId ? data.data : p));
      toast.success('Payroll approved');
    } catch (error: any) {
      console.error('Error approving payroll:', error);
      toast.error('Failed to approve payroll');
    }
  };

  const handleMarkPaid = async (payrollId: string) => {
    try {
      const data = await apiPut(`/payroll/${payrollId}/mark-paid`, {});
      setPayrolls(payrolls.map(p => p._id === payrollId ? data.data : p));
      toast.success('Payroll marked as paid');
    } catch (error: any) {
      console.error('Error marking as paid:', error);
      toast.error('Failed to mark as paid');
    }
  };

  const filteredPayrolls = payrolls.filter(payroll => {
    const matchesSearch = 
      payroll.userId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payroll.employeeId.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
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
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelled':
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
                        <p className="font-medium">{payroll.userId.name}</p>
                        <p className="text-xs text-muted-foreground">{payroll.employeeId.employeeCode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(payroll.fromDate).toLocaleDateString()} - {new Date(payroll.toDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {payroll.workingDays}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      ₹{payroll.totalEarnings.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      ₹{payroll.totalDeductions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      ₹{payroll.netSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge className={`${getStatusColor(payroll.status)} border-0`}>
                        {payroll.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button className="p-1 hover:bg-muted rounded" title="View">
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
                      baseSalary: emp?.baseSalary.toString() || ''
                    });
                  }}>
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp._id} value={emp._id}>
                          {emp.userId.name} - {emp.employeeCode}
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
                    <Label>To Date *</Label>
                    <Input
                      type="date"
                      value={formData.toDate}
                      onChange={(e) => setFormData({...formData, toDate: e.target.value})}
                      className="mt-1 rounded-lg"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Base Salary *</Label>
                  <Input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({...formData, baseSalary: e.target.value})}
                    placeholder="0"
                    className="mt-1 rounded-lg"
                    required
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
                <button onClick={() => {
                  setShowFNFCalculator(false);
                  setFnfData({ employeeId: '', fnfResult: null });
                }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Select Employee *</Label>
                  <Select value={fnfData.employeeId} onValueChange={(value) => setFnfData({...fnfData, employeeId: value})}>
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp._id} value={emp._id}>
                          {emp.userId.name} - {emp.employeeCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleCalculateFNF}
                  disabled={submitting || !fnfData.employeeId}
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
                    <h3 className="font-semibold">FNF Settlement Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Earnings:</span>
                        <span className="font-medium">₹{fnfData.fnfResult.totalEarnings.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Deductions:</span>
                        <span className="font-medium">₹{fnfData.fnfResult.totalDeductions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Salary:</span>
                        <span className="font-medium">₹{fnfData.fnfResult.totalNetSalary.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pending Leaves:</span>
                        <span className="font-medium">{fnfData.fnfResult.pendingLeaves}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Leave Encashment:</span>
                        <span className="font-medium">₹{fnfData.fnfResult.leaveEncashment.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total FNF Amount:</span>
                        <span className="text-green-600">₹{fnfData.fnfResult.fnfAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <Button className="w-full rounded-lg mt-4">
                      <Download className="w-4 h-4 mr-2" />
                      Generate FNF Letter
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
