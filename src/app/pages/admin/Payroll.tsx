import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useCurrency } from '../../context/CurrencyContext';
import { EmployeeService, AdvanceLoanService } from '../../utils/api';
import { toast } from 'sonner';
import { DollarSign, Plus, Search, TrendingUp, TrendingDown, Clock, User, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';

interface Employee {
  _id: string;
  userId: { name: string; email: string };
  department: string;
  baseSalary: number;
}

interface AdvanceLoan {
  _id: string;
  employeeId: string;
  employeeName: string;
  type: 'advance' | 'loan';
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  monthlyDeduction: number;
  totalInstallments: number;
  paidInstallments: number;
}

export default function AdminPayroll() {
  const { formatCurrency } = useCurrency();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advancesLoans, setAdvancesLoans] = useState<AdvanceLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'advance' as 'advance' | 'loan',
    amount: '',
    reason: '',
    installmentAmount: '',
    totalInstallments: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empData, alData] = await Promise.all([
        EmployeeService.getAllEmployees(),
        AdvanceLoanService.getAllAdvancesLoans()
      ]);
      setEmployees(empData);
      setAdvancesLoans(alData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await AdvanceLoanService.createAdvanceLoan({
        employeeId: formData.employeeId,
        type: formData.type,
        amount: parseFloat(formData.amount),
        reason: formData.reason,
        installmentAmount: parseFloat(formData.installmentAmount),
        totalInstallments: parseInt(formData.totalInstallments),
        monthlyDeduction: parseFloat(formData.installmentAmount)
      });
      toast.success('Request submitted successfully');
      setShowAddForm(false);
      setFormData({ employeeId: '', type: 'advance', amount: '', reason: '', installmentAmount: '', totalInstallments: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await AdvanceLoanService.approveAdvanceLoan(id);
      toast.success('Request approved');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await AdvanceLoanService.rejectAdvanceLoan(id, 'Rejected by admin');
      toast.success('Request rejected');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject');
    }
  };

  const filteredData = advancesLoans.filter(item => 
    item.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAdvances = advancesLoans
    .filter(item => item.type === 'advance' && item.status === 'approved')
    .reduce((sum, item) => sum + item.amount, 0);
  
  const totalLoans = advancesLoans
    .filter(item => item.type === 'loan' && item.status === 'approved')
    .reduce((sum, item) => sum + item.amount, 0);
  
  const pendingCount = advancesLoans.filter(item => item.status === 'pending').length;
  
  const monthlyDeductions = advancesLoans
    .filter(item => item.status === 'approved' && item.monthlyDeduction)
    .reduce((sum, item) => sum + (item.monthlyDeduction || 0), 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Payroll Management</h1>
          <p className="text-muted-foreground">Manage salary advances and loans</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Add Advance/Loan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Advances</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAdvances)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Loans</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalLoans)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Monthly Deductions</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(monthlyDeductions)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4">Add New Advance/Loan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Employee</Label>
              <Select value={formData.employeeId} onValueChange={(v) => setFormData({...formData, employeeId: v})}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.userId.name} - {emp.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v: 'advance' | 'loan') => setFormData({...formData, type: v})}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">Salary Advance</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input 
                type="number" 
                className="mt-2"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label>Monthly Installment</Label>
              <Input 
                type="number" 
                className="mt-2"
                value={formData.installmentAmount}
                onChange={(e) => setFormData({...formData, installmentAmount: e.target.value})}
                placeholder="Enter installment amount"
              />
            </div>
            <div>
              <Label>Total Installments</Label>
              <Input 
                type="number" 
                className="mt-2"
                value={formData.totalInstallments}
                onChange={(e) => setFormData({...formData, totalInstallments: e.target.value})}
                placeholder="Number of installments"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input 
                className="mt-2"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Enter reason"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Submit Request</Button>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by employee name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Advances and Loans</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-4 text-left font-medium">Employee</th>
                <th className="p-4 text-left font-medium">Type</th>
                <th className="p-4 text-left font-medium">Amount</th>
                <th className="p-4 text-left font-medium">Monthly</th>
                <th className="p-4 text-left font-medium">Progress</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item._id} className="border-b border-border">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{item.employeeName}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={item.type === 'advance' ? 'default' : 'secondary'}>
                      {item.type === 'advance' ? 'Advance' : 'Loan'}
                    </Badge>
                  </td>
                  <td className="p-4 font-semibold">{formatCurrency(item.amount)}</td>
                  <td className="p-4">{formatCurrency(item.monthlyDeduction || 0)}</td>
                  <td className="p-4">
                    {item.totalInstallments > 0 && (
                      <span className="text-sm">{item.paidInstallments}/{item.totalInstallments} paid</span>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge 
                      variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'outline'}
                      className={item.status === 'approved' ? 'bg-green-100 text-green-800' : item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {item.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApprove(item._id)} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(item._id)}>
                          <AlertCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
