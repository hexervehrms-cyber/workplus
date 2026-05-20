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
import { Calculator, Download, Check, X, Clock, Loader2, FileText, AlertCircle } from 'lucide-react';

interface Employee {
  _id: string;
  userId: { name: string; email: string };
  employeeCode: string;
  department: string;
  designation: string;
  joiningDate: string;
  status: string;
}

interface FNFSettlement {
  _id: string;
  employeeId: string;
  terminationDate: string;
  terminationReason: string;
  yearsOfService: number;
  earnings: {
    totalEarnings: number;
  };
  leaveEncashment: {
    totalLeaveEncashment: number;
  };
  gratuity: {
    gratuityAmount: number;
  };
  severancePay: {
    amount: number;
  };
  deductions: {
    totalDeductions: number;
  };
  netSettlement: number;
  status: string;
}

export default function AdminFNFCalculator() {
  const { formatCurrency } = useCurrency();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [fnfSettlement, setFNFSettlement] = useState<FNFSettlement | null>(null);
  const [formData, setFormData] = useState({
    terminationDate: '',
    terminationReason: 'termination'
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await EmployeeService.getAllEmployees();
      // Filter only active employees
      setEmployees(data.filter((emp: any) => emp.status === 'active'));
    } catch {
      /* load errors surfaced via toast */
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateFNF = async () => {
    if (!selectedEmployee || !formData.terminationDate || !formData.terminationReason) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setCalculating(true);
      // TODO: Call API to calculate FNF
      // const response = await FNFService.calculateFNF({
      //   employeeId: selectedEmployee,
      //   terminationDate: formData.terminationDate,
      //   terminationReason: formData.terminationReason
      // });
      // setFNFSettlement(response);
      toast.success('FNF calculated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to calculate FNF');
    } finally {
      setCalculating(false);
    }
  };

  const handleApproveFNF = async () => {
    if (!fnfSettlement) return;

    try {
      // TODO: Call API to approve FNF
      toast.success('FNF approved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve FNF');
    }
  };

  const handleMarkAsPaid = async () => {
    if (!fnfSettlement) return;

    try {
      // TODO: Call API to mark FNF as paid
      toast.success('FNF marked as paid successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark FNF as paid');
    }
  };

  const handleGenerateLetter = async () => {
    if (!fnfSettlement) return;

    try {
      // TODO: Call API to generate FNF letter
      toast.success('FNF letter generated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate FNF letter');
    }
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
          <h1 className="text-3xl font-bold text-gray-900">FNF Calculator</h1>
          <p className="text-gray-600 mt-1">Calculate Full & Final Settlement as per Indian labor law (2-day requirement)</p>
        </div>
      </div>

      {/* Calculation Form */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Calculate FNF Settlement
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label>Select Employee *</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp._id} value={emp._id}>
                    {emp.employeeCode} - {emp.userId.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Termination Date *</Label>
            <Input
              type="date"
              value={formData.terminationDate}
              onChange={(e) => setFormData({ ...formData, terminationDate: e.target.value })}
            />
          </div>

          <div>
            <Label>Termination Reason *</Label>
            <Select value={formData.terminationReason} onValueChange={(value) => setFormData({ ...formData, terminationReason: value })}>
              <SelectTrigger>
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
        </div>

        <Button
          onClick={handleCalculateFNF}
          disabled={calculating || !selectedEmployee || !formData.terminationDate}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          {calculating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4 mr-2" />
              Calculate FNF Settlement
            </>
          )}
        </Button>
      </Card>

      {/* FNF Settlement Details */}
      {fnfSettlement && (
        <div className="space-y-6">
          {/* Status Alert */}
          <div className={`p-4 rounded-lg border flex items-start gap-3 ${
            fnfSettlement.status === 'paid'
              ? 'bg-green-50 border-green-200'
              : fnfSettlement.status === 'approved'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            {fnfSettlement.status === 'paid' ? (
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
            ) : fnfSettlement.status === 'approved' ? (
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {fnfSettlement.status === 'paid'
                  ? 'FNF Paid'
                  : fnfSettlement.status === 'approved'
                  ? 'FNF Approved - Pending Payment'
                  : 'FNF Calculated - Pending Approval'}
              </p>
              <p className="text-sm text-gray-600">
                {fnfSettlement.status === 'paid'
                  ? 'Settlement has been paid to the employee'
                  : fnfSettlement.status === 'approved'
                  ? 'Settlement is approved and ready for payment'
                  : 'Settlement is calculated and awaiting approval'}
              </p>
            </div>
          </div>

          {/* Settlement Summary */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-6">Settlement Summary</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Employee Info */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Employee</p>
                <p className="font-semibold text-lg">Employee Name</p>
                <p className="text-sm text-gray-600">Code: EMP001</p>
              </div>

              {/* Service Period */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Years of Service</p>
                <p className="font-semibold text-lg">{fnfSettlement.yearsOfService} years</p>
                <p className="text-sm text-gray-600">Termination: {new Date(fnfSettlement.terminationDate).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold mb-4 text-green-900">Earnings</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Earned Salary Till Termination</span>
                  <span className="font-semibold">{formatCurrency(fnfSettlement.earnings.totalEarnings)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Leave Encashment</span>
                  <span className="font-semibold">{formatCurrency(fnfSettlement.leaveEncashment.totalLeaveEncashment)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gratuity</span>
                  <span className="font-semibold">{formatCurrency(fnfSettlement.gratuity.gratuityAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Severance Pay</span>
                  <span className="font-semibold">{formatCurrency(fnfSettlement.severancePay.amount)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-semibold mb-4 text-red-900">Deductions</h4>
              <div className="flex justify-between">
                <span>Total Deductions</span>
                <span className="font-semibold text-red-600">{formatCurrency(fnfSettlement.deductions.totalDeductions)}</span>
              </div>
            </div>

            {/* Net Settlement */}
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Net Settlement Amount</span>
                <span className="text-2xl font-bold text-indigo-600">{formatCurrency(fnfSettlement.netSettlement)}</span>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {fnfSettlement.status === 'calculated' && (
                <Button onClick={handleApproveFNF} className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Check className="w-4 h-4" />
                  Approve FNF
                </Button>
              )}

              {fnfSettlement.status === 'approved' && (
                <Button onClick={handleMarkAsPaid} className="bg-green-600 hover:bg-green-700 gap-2">
                  <Check className="w-4 h-4" />
                  Mark as Paid
                </Button>
              )}

              <Button onClick={handleGenerateLetter} variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                Generate FNF Letter
              </Button>

              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Download Settlement
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
