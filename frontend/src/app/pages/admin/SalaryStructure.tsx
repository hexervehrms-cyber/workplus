import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useCurrency } from '../../context/CurrencyContext';
import { EmployeeService } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../utils/apiHelper';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Calendar, DollarSign, Loader2 } from 'lucide-react';

interface Employee {
  _id: string;
  userId: { name: string; email: string };
  employeeCode: string;
  department: string;
  designation: string;
  joiningDate: string;
}

interface StructureRow {
  _id: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status?: string;
  baseSalary: number;
  hra: number;
  dearness: number;
  conveyance: number;
  medical: number;
  otherAllowances: number;
  providentFund: number;
  tax: number;
  insurance: number;
  otherDeductions: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  payFrequency: string;
  dailyWage: number;
}

function mapApiStructureToRow(s: Record<string, unknown>): StructureRow {
  const e = (s.earnings as Record<string, unknown>) || {};
  const d = (s.deductions as Record<string, unknown>) || {};
  const otherEarnSum = Array.isArray(e.otherEarnings)
    ? (e.otherEarnings as { amount?: number }[]).reduce(
        (acc, x) => acc + (Number(x?.amount) || 0),
        0
      )
    : 0;
  const otherDedSum = Array.isArray(d.otherDeductions)
    ? (d.otherDeductions as { amount?: number }[]).reduce(
        (acc, x) => acc + (Number(x?.amount) || 0),
        0
      )
    : 0;
  const gross = Number(s.grossEarnings) || 0;
  const totDed = Number(s.totalDeductions) || 0;
  const net = Number(s.netSalary) || 0;
  return {
    _id: String(s._id),
    effectiveFrom: String(s.effectiveFrom),
    effectiveTo: s.effectiveTo ? String(s.effectiveTo) : undefined,
    status: s.status ? String(s.status) : undefined,
    baseSalary: Number(e.basic) || 0,
    hra: Number(e.hra) || 0,
    dearness: Number(e.bonus) || 0,
    conveyance: Number(e.travel) || 0,
    medical: Number(e.medicalExpenses) || 0,
    otherAllowances:
      otherEarnSum + (Number(e.incentives) || 0) + (Number(e.commission) || 0),
    providentFund: Number(d.providentFund) || 0,
    tax: (Number(d.incomeTax) || 0) + (Number(d.professionalTax) || 0),
    insurance: Number(d.employeeStateInsurance) || 0,
    otherDeductions: otherDedSum,
    grossSalary: gross,
    totalDeductions: totDed,
    netSalary: net,
    payFrequency: 'monthly',
    dailyWage: gross > 0 ? Math.round((gross / 22) * 100) / 100 : 0
  };
}

export default function AdminSalaryStructure() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [structuresLoading, setStructuresLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedStructureId, setExpandedStructureId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fromDate: '',
    baseSalary: '',
    hra: '',
    dearness: '',
    conveyance: '',
    medical: '',
    otherAllowances: '',
    providentFund: '',
    tax: '',
    insurance: '',
    otherDeductions: '',
    payFrequency: 'monthly'
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await EmployeeService.getAllEmployees(user ?? undefined);
      setEmployees(data as Employee[]);
    } catch {
      /* load errors surfaced via toast */
    } finally {
      setLoading(false);
    }
  };

  const loadStructuresForEmployee = useCallback(
    async (employeeId: string) => {
      if (!employeeId || !user) {
        setStructures([]);
        return;
      }
      try {
        setStructuresLoading(true);
        const params = new URLSearchParams({
          page: '1',
          limit: '50',
          status: 'all',
          employeeId
        });
        const oid = user.orgId || user.tenantId;
        if (user.role === 'super_admin') {
          if (!oid || oid === 'system') {
            toast.error('Organization context is required to load salary structures.');
            setStructures([]);
            return;
          }
          params.set('orgId', oid);
        }
        const res = await apiGet(`salary/structures?${params.toString()}`, false);
        const list = Array.isArray(res.data) ? res.data : [];
        setStructures(list.map((row: Record<string, unknown>) => mapApiStructureToRow(row)));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load salary structures';
        toast.error(msg);
        setStructures([]);
      } finally {
        setStructuresLoading(false);
      }
    },
    [user]
  );

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setExpandedStructureId(null);
    void loadStructuresForEmployee(employeeId);
  };

  const handleAddStructure = async () => {
    if (!selectedEmployee || !formData.fromDate || !formData.baseSalary) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const earnings = {
        basic: parseFloat(formData.baseSalary) || 0,
        hra: parseFloat(formData.hra) || 0,
        travel: parseFloat(formData.conveyance) || 0,
        medicalExpenses: parseFloat(formData.medical) || 0,
        bonus: parseFloat(formData.dearness) || 0,
        incentives: 0,
        commission: parseFloat(formData.otherAllowances) || 0
      };
      const otherDedAmt = parseFloat(formData.otherDeductions) || 0;
      const deductions = {
        providentFund: parseFloat(formData.providentFund) || 0,
        incomeTax: parseFloat(formData.tax) || 0,
        employeeStateInsurance: parseFloat(formData.insurance) || 0,
        otherDeductions: otherDedAmt > 0 ? [{ name: 'Other', amount: otherDedAmt }] : []
      };

      await apiPost('salary/structure', {
        employeeId: selectedEmployee,
        employeeType: 'employee',
        effectiveFrom: formData.fromDate,
        earnings,
        deductions
      });
      toast.success('Salary structure added successfully');
      setFormData({
        fromDate: '',
        baseSalary: '',
        hra: '',
        dearness: '',
        conveyance: '',
        medical: '',
        otherAllowances: '',
        providentFund: '',
        tax: '',
        insurance: '',
        otherDeductions: '',
        payFrequency: 'monthly'
      });
      setShowForm(false);
      await loadStructuresForEmployee(selectedEmployee);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add salary structure');
    }
  };

  const calculateGrossSalary = () => {
    const base = parseFloat(formData.baseSalary) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const dearness = parseFloat(formData.dearness) || 0;
    const conveyance = parseFloat(formData.conveyance) || 0;
    const medical = parseFloat(formData.medical) || 0;
    const other = parseFloat(formData.otherAllowances) || 0;
    return base + hra + dearness + conveyance + medical + other;
  };

  const calculateTotalDeductions = () => {
    const pf = parseFloat(formData.providentFund) || 0;
    const tax = parseFloat(formData.tax) || 0;
    const insurance = parseFloat(formData.insurance) || 0;
    const other = parseFloat(formData.otherDeductions) || 0;
    return pf + tax + insurance + other;
  };

  const calculateNetSalary = () => {
    return calculateGrossSalary() - calculateTotalDeductions();
  };

  const calculateDailyWage = () => {
    const gross = calculateGrossSalary();
    const workingDays = 22; // Default working days per month
    return Math.round((gross / workingDays) * 100) / 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Salary Structure Management</h1>
          <p className="text-gray-600 mt-1">Manage variable salary structures with date ranges</p>
        </div>
      </div>

      {/* Employee Selection */}
      <Card className="p-6">
        <Label className="text-base font-semibold mb-4 block">Select Employee</Label>
        <Select value={selectedEmployee} onValueChange={handleEmployeeSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an employee..." />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp._id} value={emp._id}>
                {emp.employeeCode} - {emp.userId?.name || 'Unknown'} ({emp.department || '—'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Salary Structures List */}
      {selectedEmployee && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Salary Structures</h2>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add New Structure
            </Button>
          </div>

          {structuresLoading && (
            <p className="text-sm text-gray-500 mb-4">Loading structures…</p>
          )}

          {/* Add Structure Form */}
          {showForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-4">Add New Salary Structure</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>From Date *</Label>
                  <Input
                    type="date"
                    value={formData.fromDate}
                    onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Pay Frequency</Label>
                  <Select value={formData.payFrequency} onValueChange={(value) => setFormData({ ...formData, payFrequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Base Salary *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                  />
                </div>

                <div>
                  <Label>HRA</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.hra}
                    onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Dearness Allowance</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.dearness}
                    onChange={(e) => setFormData({ ...formData, dearness: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Conveyance</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.conveyance}
                    onChange={(e) => setFormData({ ...formData, conveyance: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Medical Allowance</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.medical}
                    onChange={(e) => setFormData({ ...formData, medical: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Other Allowances</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.otherAllowances}
                    onChange={(e) => setFormData({ ...formData, otherAllowances: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Provident Fund</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.providentFund}
                    onChange={(e) => setFormData({ ...formData, providentFund: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Tax</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.tax}
                    onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Insurance</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.insurance}
                    onChange={(e) => setFormData({ ...formData, insurance: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Other Deductions</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.otherDeductions}
                    onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 bg-white rounded border border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">Gross Salary</p>
                  <p className="text-lg font-bold text-indigo-600">{formatCurrency(calculateGrossSalary())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Deductions</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(calculateTotalDeductions())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Salary</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(calculateNetSalary())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Daily Wage</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(calculateDailyWage())}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={handleAddStructure} className="bg-indigo-600 hover:bg-indigo-700">
                  Save Structure
                </Button>
                <Button onClick={() => setShowForm(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Structures List */}
          <div className="space-y-3">
            {structures.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No salary structures found. Add one to get started.</p>
            ) : (
              structures.map((structure) => (
                <div key={structure._id} className="border border-gray-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStructureId(
                        expandedStructureId === structure._id ? null : structure._id
                      )
                    }
                    className="w-full p-4 flex justify-between items-center hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-semibold">
                          {new Date(structure.effectiveFrom).toLocaleDateString()}
                          {structure.effectiveTo
                            ? ` - ${new Date(structure.effectiveTo).toLocaleDateString()}`
                            : ' - Ongoing'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Base: {formatCurrency(structure.baseSalary)} | Gross:{' '}
                          {formatCurrency(structure.grossSalary)}
                          {structure.status ? ` · ${structure.status}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{structure.payFrequency}</Badge>
                      {expandedStructureId === structure._id ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </button>

                  {expandedStructureId === structure._id && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Base Salary</p>
                          <p className="font-semibold">{formatCurrency(structure.baseSalary)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">HRA</p>
                          <p className="font-semibold">{formatCurrency(structure.hra)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Gross Salary</p>
                          <p className="font-semibold text-indigo-600">{formatCurrency(structure.grossSalary)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Deductions</p>
                          <p className="font-semibold text-red-600">{formatCurrency(structure.totalDeductions)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Net Salary</p>
                          <p className="font-semibold text-green-600">{formatCurrency(structure.netSalary)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Daily Wage</p>
                          <p className="font-semibold text-blue-600">{formatCurrency(structure.dailyWage)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-2">
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2 text-red-600">
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
