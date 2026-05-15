import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from '../../utils/portalToast';
import { Plus, Edit2, Trash2, Calendar, Settings, Loader2, Check } from 'lucide-react';

interface SalaryCycle {
  _id: string;
  name: string;
  description?: string;
  cycleStartDate: number;
  cycleEndDate: number;
  salaryPaymentDate: number;
  holdDays: number;
  workingDaysPerWeek: number;
  workingDaysPerMonth: number;
  isActive: boolean;
  createdAt: string;
}

export default function AdminSalaryCycle() {
  const [cycles, setCycles] = useState<SalaryCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cycleStartDate: '1',
    cycleEndDate: '30',
    salaryPaymentDate: '1',
    holdDays: '0',
    workingDaysPerWeek: '5',
    workingDaysPerMonth: '22',
    leavePolicy: {
      paidLeavePerMonth: '2',
      sickLeavePerMonth: '1',
      casualLeavePerMonth: '1',
      leaveEncashmentRate: '1'
    },
    bonusPolicy: {
      annualBonus: '0',
      bonusMonth: '12',
      bonusEligibilityMonths: '6'
    },
    fnfPolicy: {
      gratuityEligibilityYears: '5',
      gratuityRate: '15',
      severancePayDays: '0',
      fnfCalculationDays: '2'
    }
  });

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      // TODO: Call API to fetch salary cycles
      setCycles([]);
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCycle = async () => {
    if (!formData.name || !formData.cycleStartDate || !formData.cycleEndDate || !formData.salaryPaymentDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // TODO: Call API to save salary cycle
      toast.success(editingId ? 'Salary cycle updated successfully' : 'Salary cycle created successfully');
      setFormData({
        name: '',
        description: '',
        cycleStartDate: '1',
        cycleEndDate: '30',
        salaryPaymentDate: '1',
        holdDays: '0',
        workingDaysPerWeek: '5',
        workingDaysPerMonth: '22',
        leavePolicy: {
          paidLeavePerMonth: '2',
          sickLeavePerMonth: '1',
          casualLeavePerMonth: '1',
          leaveEncashmentRate: '1'
        },
        bonusPolicy: {
          annualBonus: '0',
          bonusMonth: '12',
          bonusEligibilityMonths: '6'
        },
        fnfPolicy: {
          gratuityEligibilityYears: '5',
          gratuityRate: '15',
          severancePayDays: '0',
          fnfCalculationDays: '2'
        }
      });
      setShowForm(false);
      setEditingId(null);
      fetchCycles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save salary cycle');
    }
  };

  const handleEdit = (cycle: SalaryCycle) => {
    setEditingId(cycle._id);
    setFormData({
      name: cycle.name,
      description: cycle.description || '',
      cycleStartDate: cycle.cycleStartDate.toString(),
      cycleEndDate: cycle.cycleEndDate.toString(),
      salaryPaymentDate: cycle.salaryPaymentDate.toString(),
      holdDays: cycle.holdDays.toString(),
      workingDaysPerWeek: cycle.workingDaysPerWeek.toString(),
      workingDaysPerMonth: cycle.workingDaysPerMonth.toString(),
      leavePolicy: {
        paidLeavePerMonth: '2',
        sickLeavePerMonth: '1',
        casualLeavePerMonth: '1',
        leaveEncashmentRate: '1'
      },
      bonusPolicy: {
        annualBonus: '0',
        bonusMonth: '12',
        bonusEligibilityMonths: '6'
      },
      fnfPolicy: {
        gratuityEligibilityYears: '5',
        gratuityRate: '15',
        severancePayDays: '0',
        fnfCalculationDays: '2'
      }
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this salary cycle?')) return;

    try {
      // TODO: Call API to delete salary cycle
      toast.success('Salary cycle deleted successfully');
      fetchCycles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete salary cycle');
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
          <h1 className="text-3xl font-bold text-gray-900">Salary Cycle Configuration</h1>
          <p className="text-gray-600 mt-1">Configure salary cycles, leave policies, and FNF settings</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); }} className="gap-2">
          <Plus className="w-4 h-4" />
          New Salary Cycle
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">{editingId ? 'Edit' : 'Create'} Salary Cycle</h2>

          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Cycle Name *</Label>
                  <Input
                    placeholder="e.g., Standard Monthly Cycle"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Salary Cycle Dates */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Salary Cycle Dates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Cycle Start Date (Day of Month) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.cycleStartDate}
                    onChange={(e) => setFormData({ ...formData, cycleStartDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cycle End Date (Day of Month) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.cycleEndDate}
                    onChange={(e) => setFormData({ ...formData, cycleEndDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Salary Payment Date (Day of Month) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.salaryPaymentDate}
                    onChange={(e) => setFormData({ ...formData, salaryPaymentDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hold Days</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.holdDays}
                    onChange={(e) => setFormData({ ...formData, holdDays: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Example: Cycle 21st to 20th, Payment on 1st with 10 days hold
              </p>
            </div>

            {/* Working Days */}
            <div>
              <h3 className="font-semibold mb-4">Working Days Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Working Days Per Week</Label>
                  <Select value={formData.workingDaysPerWeek} onValueChange={(value) => setFormData({ ...formData, workingDaysPerWeek: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Days (Mon-Fri)</SelectItem>
                      <SelectItem value="6">6 Days (Mon-Sat)</SelectItem>
                      <SelectItem value="7">7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Working Days Per Month</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.workingDaysPerMonth}
                    onChange={(e) => setFormData({ ...formData, workingDaysPerMonth: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Leave Policy */}
            <div>
              <h3 className="font-semibold mb-4">Leave Policy</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Paid Leave Per Month</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.leavePolicy.paidLeavePerMonth}
                    onChange={(e) => setFormData({
                      ...formData,
                      leavePolicy: { ...formData.leavePolicy, paidLeavePerMonth: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>Sick Leave Per Month</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.leavePolicy.sickLeavePerMonth}
                    onChange={(e) => setFormData({
                      ...formData,
                      leavePolicy: { ...formData.leavePolicy, sickLeavePerMonth: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>Casual Leave Per Month</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.leavePolicy.casualLeavePerMonth}
                    onChange={(e) => setFormData({
                      ...formData,
                      leavePolicy: { ...formData.leavePolicy, casualLeavePerMonth: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>Leave Encashment Rate</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.leavePolicy.leaveEncashmentRate}
                    onChange={(e) => setFormData({
                      ...formData,
                      leavePolicy: { ...formData.leavePolicy, leaveEncashmentRate: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Bonus Policy */}
            <div>
              <h3 className="font-semibold mb-4">Bonus Policy</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Annual Bonus Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.bonusPolicy.annualBonus}
                    onChange={(e) => setFormData({
                      ...formData,
                      bonusPolicy: { ...formData.bonusPolicy, annualBonus: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>Bonus Month</Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.bonusPolicy.bonusMonth}
                    onChange={(e) => setFormData({
                      ...formData,
                      bonusPolicy: { ...formData.bonusPolicy, bonusMonth: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>Bonus Eligibility (Months)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.bonusPolicy.bonusEligibilityMonths}
                    onChange={(e) => setFormData({
                      ...formData,
                      bonusPolicy: { ...formData.bonusPolicy, bonusEligibilityMonths: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* FNF Policy */}
            <div>
              <h3 className="font-semibold mb-4">FNF (Full & Final Settlement) Policy</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Gratuity Eligibility (Years)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.fnfPolicy.gratuityEligibilityYears}
                    onChange={(e) => setFormData({
                      ...formData,
                      fnfPolicy: { ...formData.fnfPolicy, gratuityEligibilityYears: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>Gratuity Rate (Days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.fnfPolicy.gratuityRate}
                    onChange={(e) => setFormData({
                      ...formData,
                      fnfPolicy: { ...formData.fnfPolicy, gratuityRate: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>Severance Pay (Days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.fnfPolicy.severancePayDays}
                    onChange={(e) => setFormData({
                      ...formData,
                      fnfPolicy: { ...formData.fnfPolicy, severancePayDays: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label>FNF Calculation Days (Indian Law: 2)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.fnfPolicy.fnfCalculationDays}
                    onChange={(e) => setFormData({
                      ...formData,
                      fnfPolicy: { ...formData.fnfPolicy, fnfCalculationDays: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleSaveCycle} className="bg-indigo-600 hover:bg-indigo-700">
                {editingId ? 'Update Cycle' : 'Create Cycle'}
              </Button>
              <Button onClick={() => { setShowForm(false); setEditingId(null); }} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Cycles List */}
      <div className="grid gap-4">
        {cycles.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No salary cycles configured yet. Create one to get started.</p>
          </Card>
        ) : (
          cycles.map((cycle) => (
            <Card key={cycle._id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{cycle.name}</h3>
                    {cycle.isActive && <Badge className="bg-green-100 text-green-800">Active</Badge>}
                  </div>
                  {cycle.description && <p className="text-gray-600 mb-3">{cycle.description}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Cycle Period</p>
                      <p className="font-semibold">{cycle.cycleStartDate}th - {cycle.cycleEndDate}th</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Payment Date</p>
                      <p className="font-semibold">{cycle.salaryPaymentDate}th of month</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Working Days/Month</p>
                      <p className="font-semibold">{cycle.workingDaysPerMonth}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Hold Days</p>
                      <p className="font-semibold">{cycle.holdDays}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(cycle)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(cycle._id)} className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
