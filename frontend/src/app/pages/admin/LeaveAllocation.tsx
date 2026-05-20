import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, Loader2, Plus, Edit2, Trash2, Download } from 'lucide-react';
import { LeaveAllocationService, EmployeeService } from '../../utils/api';
import { parseBalanceApiResponse, sumRemainingDays } from '../../utils/leaveBalance';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../utils/portalToast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { resolveAuthOrgId } from '../../utils/apiHelper';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface LeaveAllocationRecord {
  _id: string;
  employeeId: {
    _id: string;
    employeeCode: string;
    name: string;
    department: string;
    userId?: { name?: string };
  };
  year: number;
  month: number;
  allocations: {
    vacation: number;
    sickLeave: number;
    casualLeave: number;
    maternityLeave: number;
    paternityLeave: number;
    compensatoryOff: number;
    personal: number;
    emergency: number;
    ncns: number;
    sandwichLeave: number;
  };
  status: string;
  allocatedDate: string;
}

interface Employee {
  _id: string;
  employeeCode: string;
  name: string;
  department: string;
}

const TABLE_LEAVE_KEYS = [
  'vacation',
  'sickLeave',
  'casualLeave',
  'compensatoryOff',
  'personal',
  'emergency',
] as const;

function getAllocationTotal(allocations: LeaveAllocationRecord['allocations'] | undefined): number {
  if (!allocations) return 0;
  return LEAVE_TYPES.reduce(
    (sum, { key }) => sum + (Number((allocations as Record<string, number>)[key]) || 0),
    0
  );
}

function defaultAllocationForm(): Record<string, number> {
  return LEAVE_TYPES.reduce(
    (acc, { key }) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<string, number>
  );
}

const LEAVE_TYPES = [
  { key: 'vacation', label: 'Vacation' },
  { key: 'sickLeave', label: 'Sick Leave' },
  { key: 'casualLeave', label: 'Casual Leave' },
  { key: 'earnedLeave', label: 'Earned Leave' },
  { key: 'medicalLeave', label: 'Medical Leave' },
  { key: 'maternityLeave', label: 'Maternity Leave' },
  { key: 'paternityLeave', label: 'Paternity Leave' },
  { key: 'compensatoryOff', label: 'Compensatory Off' },
  { key: 'personal', label: 'Personal' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'ncns', label: 'NCNS' },
  { key: 'sandwichLeave', label: 'Sandwich Leave' }
];

export default function LeaveAllocation() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<LeaveAllocationRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<LeaveAllocationRecord | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [formData, setFormData] = useState({
    vacation: 0,
    sickLeave: 0,
    casualLeave: 0,
    earnedLeave: 0,
    medicalLeave: 0,
    maternityLeave: 0,
    paternityLeave: 0,
    compensatoryOff: 0,
    personal: 0,
    emergency: 0,
    ncns: 0,
    sandwichLeave: 0
  });
  const [yearlyFormData, setYearlyFormData] = useState({
    casualLeave: 0,
    earnedLeave: 0,
    medicalLeave: 0
  });
  const [showYearlyForm, setShowYearlyForm] = useState(false);
  const [selectedEmployeesForYearly, setSelectedEmployeesForYearly] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [availableByEmployee, setAvailableByEmployee] = useState<Record<string, number>>({});

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch employees
      const employeesResponse = await EmployeeService.getAllEmployees(user ?? undefined);
      console.log('Employees response:', employeesResponse);
      
      const employeesData = Array.isArray(employeesResponse) ? employeesResponse : [];
      
      console.log('Employees data:', employeesData);
      
      if (employeesData.length > 0) {
        // Map employees to ensure we have the right structure
        const mappedEmployees = employeesData.map((emp: {
          _id: string;
          name?: string;
          employeeCode?: string;
          department?: string;
          designation?: string;
          userId?: { name?: string };
        }) => ({
          _id: emp._id,
          name: emp.userId?.name || emp.name || 'Unknown',
          employeeCode: emp.employeeCode ?? '',
          department: emp.department ?? '',
          designation: emp.designation
        }));
        console.log('Mapped employees:', mappedEmployees);
        setEmployees(mappedEmployees);
      } else {
        console.warn('No employees found');
        setEmployees([]);
      }

      const orgId = resolveAuthOrgId(user);
      if (!orgId) {
        toast.error('Organization context is required.');
        setAllocations([]);
        return;
      }

      const allocationsData = await LeaveAllocationService.getOrganizationAllocations(
        orgId,
        selectedYear,
        selectedMonth > 0 ? selectedMonth : null
      );

      const rows: LeaveAllocationRecord[] = Array.isArray(allocationsData)
        ? allocationsData
        : [];
      setAllocations(rows);

      const balanceMonth = selectedMonth > 0 ? selectedMonth : new Date().getMonth() + 1;
      const balanceMap: Record<string, number> = {};
      await Promise.all(
        rows.map(async (row) => {
          const empId = row.employeeId?._id;
          if (!empId) return;
          try {
            const balanceRes = await LeaveAllocationService.getEmployeeBalance(
              empId,
              selectedYear,
              balanceMonth
            );
            if (balanceRes?.success) {
              const parsed = parseBalanceApiResponse(balanceRes);
              balanceMap[empId] = sumRemainingDays(parsed.balances);
            }
          } catch {
            /* non-fatal */
          }
        })
      );
      setAvailableByEmployee(balanceMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (allocation?: LeaveAllocationRecord) => {
    if (allocation) {
      setSelectedAllocation(allocation);
      setSelectedEmployee(allocation.employeeId?._id || '');
      setSelectedEmployees([]);
      setIsMultiSelectMode(false);
      setFormData({
        ...defaultAllocationForm(),
        ...(allocation.allocations as Partial<typeof formData>),
      } as typeof formData);
    } else {
      setSelectedAllocation(null);
      setSelectedEmployee('');
      setSelectedEmployees([]);
      setIsMultiSelectMode(false);
      setFormData({
        vacation: 0,
        sickLeave: 0,
        casualLeave: 0,
        earnedLeave: 0,
        medicalLeave: 0,
        maternityLeave: 0,
        paternityLeave: 0,
        compensatoryOff: 0,
        personal: 0,
        emergency: 0,
        ncns: 0,
        sandwichLeave: 0
      });
    }
    setShowForm(true);
  };

  const handleSaveAllocation = async () => {
    if (!selectedEmployee && selectedEmployees.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    try {
      setActionLoading(true);
      
      const orgId = resolveAuthOrgId(user);
      if (!orgId) {
        toast.error('Organization context is required.');
        return;
      }
      
      console.log('Saving allocation:', {
        employeeId: selectedEmployee,
        selectedEmployees,
        userId: user?.userId || user?.id,
        orgId: orgId,
        year: selectedYear,
        month: selectedMonth,
        allocations: formData
      });

      if (selectedAllocation) {
        // Update existing (single employee only)
        const response = await LeaveAllocationService.updateAllocation(selectedAllocation._id, {
          allocations: formData
        });
        console.log('Update response:', response);
        toast.success('Leave allocation updated successfully');
      } else if (isMultiSelectMode && selectedEmployees.length > 0) {
        // Bulk allocate to multiple employees
        const response = await LeaveAllocationService.bulkAllocate(
          orgId,
          selectedYear,
          selectedMonth,
          selectedEmployees,
          formData,
          user?.userId || user?.id || ''
        );
        console.log('Bulk allocate response:', response);
        toast.success(`Leave allocation created for ${selectedEmployees.length} employees`);
      } else if (selectedEmployee) {
        // Create new for single employee
        const response = await LeaveAllocationService.createAllocation({
          employeeId: selectedEmployee,
          userId: user?.userId || user?.id,
          orgId: orgId,
          year: selectedYear,
          month: selectedMonth,
          allocations: formData
        });
        console.log('Create response:', response);
        toast.success('Leave allocation created successfully');
      }

      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error('Error saving allocation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save allocation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAllocation = async (allocationId: string) => {
    if (!confirm('Are you sure you want to delete this allocation?')) return;

    try {
      await LeaveAllocationService.deleteAllocation(allocationId);
      toast.success('Allocation deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting allocation:', error);
      toast.error('Failed to delete allocation');
    }
  };

  const handleYearlyAllocation = async () => {
    if (selectedEmployeesForYearly.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    try {
      setActionLoading(true);
      
      const orgId = resolveAuthOrgId(user);
      if (!orgId) {
        toast.error('Organization context is required.');
        return;
      }

      const response = await LeaveAllocationService.yearlyAllocate(
        orgId,
        selectedYear,
        selectedEmployeesForYearly,
        yearlyFormData.casualLeave,
        yearlyFormData.earnedLeave,
        yearlyFormData.medicalLeave,
        user?.userId || user?.id || ''
      );

      toast.success(`Yearly leaves allocated to ${selectedEmployeesForYearly.length} employees`);
      setShowYearlyForm(false);
      setSelectedEmployeesForYearly([]);
      setYearlyFormData({
        casualLeave: 0,
        earnedLeave: 0,
        medicalLeave: 0
      });
      fetchData();
    } catch (error) {
      console.error('Error allocating yearly leaves:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to allocate yearly leaves');
    } finally {
      setActionLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Allocation</h1>
          <p className="text-muted-foreground">Manage employee leave kitty</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowYearlyForm(true)}
            className="rounded-xl bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yearly Allocation
          </Button>
          <Button 
            onClick={() => handleOpenForm()}
            className="rounded-xl bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Allocation
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm font-medium">Year</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="rounded-xl mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {[2024, 2025, 2026].map(year => (
                  <SelectItem key={year} value={year.toString()} className="rounded-lg">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Month</Label>
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="rounded-xl mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="0" className="rounded-lg">
                  All months
                </SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <SelectItem key={month} value={month.toString()} className="rounded-lg">
                    {getMonthName(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Allocations Table */}
      <Card className="p-6 rounded-xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <p></p>
          </div>
        ) : allocations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">
              No allocations found for {selectedMonth > 0 ? `${getMonthName(selectedMonth)} ` : ''}{selectedYear}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-4 text-left">Employee</th>
                  {selectedMonth === 0 ? <th className="p-4 text-left">Month</th> : null}
                  <th className="p-4 text-left">Department</th>
                  <th className="p-4 text-center">Vacation</th>
                  <th className="p-4 text-center">Sick</th>
                  <th className="p-4 text-center">Casual</th>
                  <th className="p-4 text-center">Comp Off</th>
                  <th className="p-4 text-center">Personal</th>
                  <th className="p-4 text-center">Emergency</th>
                  <th className="p-4 text-center font-semibold" title="Sum of all leave types allocated this month">
                    Allocated
                  </th>
                  <th className="p-4 text-center font-semibold" title="Available balance (same as employee dashboard)">
                    Available
                  </th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((allocation) => (
                  <tr key={allocation._id} className="border-b hover:bg-accent/50">
                    <td className="p-4 font-medium">
                      {allocation.employeeId?.userId?.name || 
                       allocation.employeeId?.name || 
                       allocation.employeeId?.employeeCode ||
                       'Unknown'}
                    </td>
                    {selectedMonth === 0 ? (
                      <td className="p-4 text-sm text-muted-foreground">
                        {getMonthName(allocation.month)} {allocation.year}
                      </td>
                    ) : null}
                    <td className="p-4 text-sm text-muted-foreground">
                      {allocation.employeeId?.department || '-'}
                    </td>
                    <td className="p-4 text-center">{allocation.allocations?.vacation ?? 0}</td>
                    <td className="p-4 text-center">{allocation.allocations?.sickLeave ?? 0}</td>
                    <td className="p-4 text-center">{allocation.allocations?.casualLeave ?? 0}</td>
                    <td className="p-4 text-center">{allocation.allocations?.compensatoryOff ?? 0}</td>
                    <td className="p-4 text-center">{allocation.allocations?.personal ?? 0}</td>
                    <td className="p-4 text-center">{allocation.allocations?.emergency ?? 0}</td>
                    <td className="p-4 text-center font-semibold">
                      {getAllocationTotal(allocation.allocations)}
                    </td>
                    <td className="p-4 text-center font-semibold text-primary">
                      {availableByEmployee[allocation.employeeId?._id] ?? '—'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => handleOpenForm(allocation)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-lg"
                          onClick={() => handleDeleteAllocation(allocation._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Allocation Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="flex max-h-[min(90vh,820px)] w-[min(calc(100vw-2rem),42rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl sm:max-w-none">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle className="text-xl font-bold">
              {selectedAllocation ? 'Edit Leave Allocation' : 'Add Leave Allocation'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {getMonthName(selectedMonth)} {selectedYear}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {/* Multi-select Toggle */}
            {!selectedAllocation && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <input
                  type="checkbox"
                  id="multiSelectToggle"
                  checked={isMultiSelectMode}
                  onChange={(e) => {
                    setIsMultiSelectMode(e.target.checked);
                    setSelectedEmployee('');
                    setSelectedEmployees([]);
                  }}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="multiSelectToggle" className="text-sm font-medium cursor-pointer flex-1">
                  Allocate to Multiple Employees
                </label>
              </div>
            )}

            {/* Employee Selection */}
            {!isMultiSelectMode ? (
              <div>
                <Label className="text-sm font-medium text-foreground">Employee</Label>
                <Select 
                  value={selectedEmployee} 
                  onValueChange={setSelectedEmployee}
                  disabled={!!selectedAllocation}
                >
                  <SelectTrigger className="rounded-xl mt-2 border-foreground/20">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-foreground/20">
                    {employees.map(emp => (
                      <SelectItem key={emp._id} value={emp._id} className="rounded-lg">
                        {emp.name}{emp.employeeCode ? ` (${emp.employeeCode})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-sm font-medium text-foreground">Select Employees</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border border-foreground/20 rounded-xl p-3 space-y-2 bg-muted/30">
                  {employees.map(emp => (
                    <label key={emp._id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(emp._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees([...selectedEmployees, emp._id]);
                          } else {
                            setSelectedEmployees(selectedEmployees.filter(id => id !== emp._id));
                          }
                        }}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                      <span className="text-sm">{emp.name}{emp.employeeCode ? ` (${emp.employeeCode})` : ''}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedEmployees.length} employee(s) selected
                </p>
              </div>
            )}

            {/* Leave Allocations Grid */}
            <div className="grid grid-cols-2 gap-4">
              {LEAVE_TYPES.map(leave => (
                <div key={leave.key}>
                  <Label className="text-sm font-medium text-foreground">{leave.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    className="rounded-xl mt-2 border-foreground/20"
                    value={formData[leave.key as keyof typeof formData]}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Handle empty string, convert to 0
                      const numValue = value === '' ? 0 : parseFloat(value);
                      // Ensure we don't get NaN
                      const finalValue = isNaN(numValue) ? 0 : numValue;
                      setFormData({
                        ...formData,
                        [leave.key]: finalValue
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 gap-3 border-t px-6 py-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-foreground/20"
              onClick={() => setShowForm(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
              onClick={handleSaveAllocation}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Allocation'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Yearly Allocation Dialog */}
      <Dialog open={showYearlyForm} onOpenChange={setShowYearlyForm}>
        <DialogContent className="max-w-2xl rounded-2xl border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">
              Allocate Yearly Leaves
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Allocate Casual, Earned, and Medical leaves for {selectedYear}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Employee Selection (Multi-select) */}
            <div>
              <Label className="text-sm font-medium text-foreground">Select Employees</Label>
              <div className="mt-2 max-h-48 overflow-y-auto border border-foreground/20 rounded-xl p-3 space-y-2">
                {employees.map(emp => (
                  <label key={emp._id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedEmployeesForYearly.includes(emp._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployeesForYearly([...selectedEmployeesForYearly, emp._id]);
                        } else {
                          setSelectedEmployeesForYearly(selectedEmployeesForYearly.filter(id => id !== emp._id));
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">{emp.name}{emp.employeeCode ? ` (${emp.employeeCode})` : ''}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedEmployeesForYearly.length} employee(s) selected
              </p>
            </div>

            {/* Yearly Leave Allocations */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-foreground">Casual Leave</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  className="rounded-xl mt-2 border-foreground/20"
                  value={yearlyFormData.casualLeave}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value === '' ? 0 : parseFloat(value);
                    const finalValue = isNaN(numValue) ? 0 : numValue;
                    setYearlyFormData({
                      ...yearlyFormData,
                      casualLeave: finalValue
                    });
                  }}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground">Earned Leave</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  className="rounded-xl mt-2 border-foreground/20"
                  value={yearlyFormData.earnedLeave}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value === '' ? 0 : parseFloat(value);
                    const finalValue = isNaN(numValue) ? 0 : numValue;
                    setYearlyFormData({
                      ...yearlyFormData,
                      earnedLeave: finalValue
                    });
                  }}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground">Medical Leave</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  className="rounded-xl mt-2 border-foreground/20"
                  value={yearlyFormData.medicalLeave}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value === '' ? 0 : parseFloat(value);
                    const finalValue = isNaN(numValue) ? 0 : numValue;
                    setYearlyFormData({
                      ...yearlyFormData,
                      medicalLeave: finalValue
                    });
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-foreground/20"
                onClick={() => {
                  setShowYearlyForm(false);
                  setSelectedEmployeesForYearly([]);
                  setYearlyFormData({
                    casualLeave: 0,
                    earnedLeave: 0,
                    medicalLeave: 0
                  });
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl bg-green-600 hover:bg-green-700"
                onClick={handleYearlyAllocation}
                disabled={actionLoading || selectedEmployeesForYearly.length === 0}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Allocating...
                  </>
                ) : (
                  'Allocate Yearly Leaves'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
