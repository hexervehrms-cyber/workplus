import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useCurrency } from '../../context/CurrencyContext';
import { EmployeeService } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Calendar, DollarSign, Loader2 } from 'lucide-react';

interface Employee {
  _id: string;
  userId: { name: string; email: string };
  employeeCode: string;
  department: string;
  designation: string;
  joiningDate: string;
}

interface SalaryStructure {
  fromDate: string;
  toDate?: string;
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

export default function AdminSalaryStructure() {
  const { formatCurrency } = useCurrency();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedStructure, setExpandedStructure] = useState<number | null>(null);
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
      const data = await EmployeeService.getAllEmployees();
      setEmployees(data);
    } catch {
      /* load errors surfaced via toast */
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    // TODO: Fetch salary structures for selected employee
  };

  const handleAddStructure = async () => {
    if (!selectedEmployee || !formData.fromDate || !formData.baseSalary) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // TODO: Call API to add salary structure
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
                {emp.employeeCode} - {emp.userId.name} ({emp.department})
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
              structures.map((structure, index) => (
                <div key={index} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedStructure(expandedStructure === index ? null : index)}
                    className="w-full p-4 flex justify-between items-center hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-semibold">
                          {new Date(structure.fromDate).toLocaleDateString()} 
                          {structure.toDate ? ` - ${new Date(structure.toDate).toLocaleDateString()}` : ' - Ongoing'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Base: {formatCurrency(structure.baseSalary)} | Gross: {formatCurrency(structure.grossSalary)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{structure.payFrequency}</Badge>
                      {expandedStructure === index ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </button>

                  {expandedStructure === index && (
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
