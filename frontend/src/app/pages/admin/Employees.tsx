import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useIsMounted } from '../../hooks/useIsMounted';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PasswordInput } from '../../components/PasswordInput';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Users, Plus, Search, Edit, Trash2, Mail, Phone, X, 
  FileText, Loader2, Briefcase, Calendar, DollarSign, IndianRupee, Link as LinkIcon, Key
} from 'lucide-react';
import { EmployeeService } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useDepartments } from '../../hooks/useDepartments';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';
import { useCurrency } from '../../context/CurrencyContext';
import OnboardingLinkGenerator from '../../components/OnboardingLinkGenerator';
import { apiPost } from '../../utils/apiHelper';

interface Employee {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    isActive: boolean;
  };
  employeeCode: string;
  designation: string;
  department: string;
  baseSalary: number;
  phone: string;
  status: string;
  joiningDate: string;
  createdViaOnboarding?: boolean;
}

// Predefined roles
const EMPTY_FORM_DATA = {
  name: '',
  email: '',
  password: '',
  designation: '',
  department: '',
  baseSalary: '',
  hourlyRate: '',
  dailyRate: '',
  salaryCalculationType: 'fixed',
  phone: '',
  role: 'employee',
  shiftStartTime: '09:00',
  shiftEndTime: '18:00',
  lateThreshold: '0',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  aadharNumber: '',
  panNumber: '',
  bankAccount: '',
  ifscCode: '',
  employeeCode: '',
  joiningDate: ''
};

const PREDEFINED_ROLES = [
  { id: 'recruiter', name: 'Recruiter' },
  { id: 'accountant', name: 'Accountant' },
  { id: 'manager', name: 'Manager' },
  { id: 'sales', name: 'Sales' },
  { id: 'associate', name: 'Associate' },
  { id: 'employee', name: 'Employee' }
];

export default function Employees() {
  const { user } = useAuth();
  const mounted = useIsMounted();
  const navigate = useNavigate();
  const { formatCurrency, selectedCurrency } = useCurrency();
  const { departmentNames, loading: deptOptionsLoading } = useDepartments();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showOnboardingGenerator, setShowOnboardingGenerator] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetEmployee, setPasswordResetEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Listen to real-time employee creation events
  useEffect(() => {
    const handleEmployeeCreated = (data: any) => {
      console.log('👤 Employee created event received:', data);
      // Add new employee to the list
      if (data.employee) {
        setEmployees(prev => [data.employee, ...prev]);
      }
    };

    const handleEmployeeUpdated = (type: string, data: any) => {
      console.log('👤 Employee updated event received:', data);
      if (data) {
        setEmployees(prev => 
          prev.map(emp => emp._id === data._id ? data : emp)
        );
      }
    };

    const handleEmployeeDeleted = (type: string, data: any) => {
      console.log('👤 Employee deleted event received:', data);
      if (data) {
        setEmployees(prev => prev.filter(emp => emp._id !== data._id));
      }
    };

    // Subscribe to real-time events using the correct methods
    const unsubscribeCreated = realTimeSocket.onEmployeeUpdate((type, employee) => {
      if (type === 'created') {
        handleEmployeeCreated({ employee, createdBy: 'admin' });
      } else if (type === 'updated') {
        handleEmployeeUpdated(type, employee);
      } else if (type === 'deleted') {
        handleEmployeeDeleted(type, employee);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeCreated();
    };
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await EmployeeService.getAllEmployees(
        user
          ? {
              role: user.role,
              orgId: user.orgId,
              tenantId: user.tenantId,
            }
          : undefined
      );
      if (mounted.current) setEmployees(data);
    } catch (err: unknown) {
      if (mounted.current) {
        toast.error('Failed to load employees');
      }
      console.error('Error loading employees:', err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    // Validate form data
    if (!formData.name.trim()) {
      toast.error('Please enter employee name');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter employee email');
      return;
    }
    if (!formData.password.trim()) {
      toast.error('Please enter employee password');
      return;
    }
    if (!formData.department.trim()) {
      toast.error('Please select department');
      return;
    }
    if (!formData.designation.trim()) {
      toast.error('Please enter designation');
      return;
    }

    try {
      setSubmitting(true);
      const response = await EmployeeService.createEmployee({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        designation: formData.designation.trim(),
        department: formData.department.trim(),
        baseSalary: parseFloat(formData.baseSalary) || 0,
        phone: formData.phone.trim(),
        role: formData.role,
        employeeCode: formData.employeeCode.trim() || undefined,
        joiningDate: formData.joiningDate || undefined
      });
      
      console.log('Employee created response:', response);
      
      // Add employee to list immediately for instant UI update
      if (response && response.employee) {
        setEmployees(prev => [response.employee, ...prev]);
      }
      
      toast.success('Employee created successfully');
      setShowAddForm(false);
      setFormData(EMPTY_FORM_DATA);
    } catch (err: any) {
      console.error('Error creating employee:', err);
      toast.error(err.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = async () => {
    if (!editingEmployee) return;
    
    // Validate form data
    if (!formData.name.trim()) {
      toast.error('Please enter employee name');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Please enter employee email');
      return;
    }
    if (!formData.department.trim()) {
      toast.error('Please select department');
      return;
    }
    if (!formData.designation.trim()) {
      toast.error('Please enter designation');
      return;
    }

    try {
      setSubmitting(true);
      const response = await EmployeeService.updateEmployee(editingEmployee._id, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        designation: formData.designation.trim(),
        department: formData.department.trim(),
        baseSalary: parseFloat(formData.baseSalary) || 0,
        hourlyRate: parseFloat(formData.hourlyRate) || 0,
        dailyRate: parseFloat(formData.dailyRate) || 0,
        salaryCalculationType: formData.salaryCalculationType,
        phone: formData.phone.trim(),
        shiftTiming: {
          startTime: formData.shiftStartTime,
          endTime: formData.shiftEndTime,
          lateThreshold: parseInt(formData.lateThreshold) || 0,
          workingDays: formData.workingDays
        },
        aadharNumber: formData.aadharNumber.trim(),
        panNumber: formData.panNumber.trim(),
        bankAccount: formData.bankAccount.trim(),
        ifscCode: formData.ifscCode.trim(),
        employeeCode: formData.employeeCode.trim() || undefined,
        joiningDate: formData.joiningDate ? new Date(formData.joiningDate).toISOString() : undefined
      });
      
      console.log('Employee updated response:', response);
      
      // Update employee in list immediately
      setEmployees(prev => 
        prev.map(emp => emp._id === editingEmployee._id ? {
          ...emp,
          userId: {
            ...emp.userId,
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase()
          },
          designation: formData.designation.trim(),
          department: formData.department.trim(),
          baseSalary: parseFloat(formData.baseSalary) || 0,
          phone: formData.phone.trim(),
          employeeCode: formData.employeeCode.trim(),
          joiningDate: formData.joiningDate || emp.joiningDate
        } : emp)
      );
      
      toast.success('Employee updated successfully');
      setShowEditForm(false);
      setEditingEmployee(null);
      setFormData(EMPTY_FORM_DATA);
    } catch (err: any) {
      console.error('Error updating employee:', err);
      toast.error(err.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployeeId) return;
    try {
      setSubmitting(true);
      await EmployeeService.deleteEmployee(deletingEmployeeId);
      
      // Remove employee from list immediately
      setEmployees(prev => prev.filter(emp => emp._id !== deletingEmployeeId));
      
      toast.success('Employee deleted successfully');
      setShowDeleteConfirm(false);
      setDeletingEmployeeId(null);
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      toast.error(err.message || 'Failed to delete employee');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    const shiftTiming = (employee as any)?.shiftTiming || {};
    setFormData({
      name: employee.userId?.name || '',
      email: employee.userId?.email || '',
      password: '',
      designation: employee.designation || '',
      department: employee.department || '',
      baseSalary: employee.baseSalary?.toString() || '',
      hourlyRate: (employee as any)?.hourlyRate?.toString() || '',
      dailyRate: (employee as any)?.dailyRate?.toString() || '',
      salaryCalculationType: (employee as any)?.salaryCalculationType || 'fixed',
      phone: employee.phone || '',
      role: 'employee',
      shiftStartTime: shiftTiming.startTime || '09:00',
      shiftEndTime: shiftTiming.endTime || '18:00',
      lateThreshold: shiftTiming.lateThreshold?.toString() || '0',
      workingDays: shiftTiming.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      aadharNumber: (employee as any)?.aadharNumber || '',
      panNumber: (employee as any)?.panNumber || '',
      bankAccount: (employee as any)?.bankAccount || '',
      ifscCode: (employee as any)?.ifscCode || '',
      employeeCode: employee.employeeCode || '',
      joiningDate: employee.joiningDate
        ? new Date(employee.joiningDate).toISOString().split('T')[0]
        : ''
    });
    setShowEditForm(true);
  };

  const openPasswordResetModal = (employee: Employee) => {
    setPasswordResetEmployee(employee);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordReset(true);
  };

  const handlePasswordReset = async () => {
    if (!passwordResetEmployee) return;

    // Validate passwords
    if (!newPassword.trim()) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      
      await apiPost(`/employees/${passwordResetEmployee._id}/reset-password`, { newPassword });

      toast.success('Password reset successfully');
      setShowPasswordReset(false);
      setPasswordResetEmployee(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error resetting password:', err);
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmployeeClick = (employeeId: string) => {
    navigate(`/admin/employees/${employeeId}/correspondence`);
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    const name = (emp.userId?.name || '').toLowerCase();
    const email = (emp.userId?.email || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    return name.includes(q) || email.includes(q) || dept.includes(q);
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Add Employee Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add New Employee</h2>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="employee@company.com"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Password</Label>
                <PasswordInput
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Enter password"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={formData.department || undefined}
                    onValueChange={(v) => setFormData({ ...formData, department: v })}
                    disabled={deptOptionsLoading}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentNames.length === 0 ? (
                        <SelectItem value="General">General</SelectItem>
                      ) : (
                        departmentNames.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g. Software Engineer"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base Salary</Label>
                  <Input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({...formData, baseSalary: e.target.value})}
                    placeholder="Enter salary"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_ROLES.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex-1" disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleAddEmployee} className="flex-1" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Employee
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && passwordResetEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <Button variant="ghost" onClick={() => setShowPasswordReset(false)} disabled={submitting}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Employee:</strong> {passwordResetEmployee.userId?.name || 'Unknown'}
                </p>
                <p className="text-sm text-blue-900">
                  <strong>Email:</strong> {passwordResetEmployee.userId.email}
                </p>
              </div>
              <div>
                <Label>New Password</Label>
                <PasswordInput
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-1"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 6 characters
                </p>
              </div>
              <div>
                <Label>Confirm Password</Label>
                <PasswordInput
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1"
                  disabled={submitting}
                />
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-900">
                  ⚠️ The employee will need to use this new password to log in.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowPasswordReset(false)}
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordReset}
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditForm && editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Employee</h2>
              <Button variant="ghost" onClick={() => setShowEditForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="employee@company.com"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Official Information
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Synced to the employee&apos;s My Profile → Official Information (read-only for employees)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Employee ID</Label>
                    <Input
                      value={formData.employeeCode}
                      onChange={(e) => setFormData({...formData, employeeCode: e.target.value})}
                      placeholder="e.g. EMP001"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Joining Date</Label>
                    <Input
                      type="date"
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({...formData, joiningDate: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select
                      value={formData.department || undefined}
                      onValueChange={(v) => setFormData({ ...formData, department: v })}
                      disabled={deptOptionsLoading}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentNames.length === 0 ? (
                          <SelectItem value="General">General</SelectItem>
                        ) : (
                          departmentNames.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Designation</Label>
                    <Input
                      value={formData.designation}
                      onChange={(e) => setFormData({...formData, designation: e.target.value})}
                      placeholder="e.g. Software Engineer"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base Salary</Label>
                  <Input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({...formData, baseSalary: e.target.value})}
                    placeholder="Enter salary"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_ROLES.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Salary Calculation Type</Label>
                <Select value={formData.salaryCalculationType} onValueChange={(value) => setFormData({...formData, salaryCalculationType: value})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select calculation type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Salary</SelectItem>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                    <SelectItem value="daily">Daily Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.salaryCalculationType === 'hourly' && (
                <div>
                  <Label>Hourly Rate (₹)</Label>
                  <Input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({...formData, hourlyRate: e.target.value})}
                    placeholder="e.g. 500"
                    className="mt-1"
                  />
                </div>
              )}
              {formData.salaryCalculationType === 'daily' && (
                <div>
                  <Label>Daily Rate (₹)</Label>
                  <Input
                    type="number"
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({...formData, dailyRate: e.target.value})}
                    placeholder="e.g. 5000"
                    className="mt-1"
                  />
                </div>
              )}
              
              {/* Shift Timing Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-sm mb-4">Shift Timing Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Shift Start Time</Label>
                    <Input
                      type="time"
                      value={formData.shiftStartTime}
                      onChange={(e) => setFormData({...formData, shiftStartTime: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Shift End Time</Label>
                    <Input
                      type="time"
                      value={formData.shiftEndTime}
                      onChange={(e) => setFormData({...formData, shiftEndTime: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <Label>Late Threshold (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.lateThreshold}
                    onChange={(e) => setFormData({...formData, lateThreshold: e.target.value})}
                    placeholder="e.g. 5 (grace period)"
                    className="mt-1"
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Grace period in minutes after shift start time before marking as late
                  </p>
                </div>
                
                <div className="mt-4">
                  <Label>Working Days</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <label key={day} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.workingDays.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                workingDays: [...formData.workingDays, day]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                workingDays: formData.workingDays.filter(d => d !== day)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Financial Information Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-sm mb-4">Financial Information (HR Only)</h3>
                <p className="text-xs text-muted-foreground mb-4">These fields are visible to employees as read-only</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Aadhar Card Number</Label>
                    <Input
                      value={formData.aadharNumber}
                      onChange={(e) => setFormData({...formData, aadharNumber: e.target.value})}
                      placeholder="12-digit Aadhar number"
                      className="mt-1"
                      maxLength={12}
                    />
                  </div>
                  <div>
                    <Label>PAN Card Number</Label>
                    <Input
                      value={formData.panNumber}
                      onChange={(e) => setFormData({...formData, panNumber: e.target.value})}
                      placeholder="10-character PAN"
                      className="mt-1"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label>Bank Account Number</Label>
                    <Input
                      value={formData.bankAccount}
                      onChange={(e) => setFormData({...formData, bankAccount: e.target.value})}
                      placeholder="Bank account number"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>IFSC Code</Label>
                    <Input
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({...formData, ifscCode: e.target.value})}
                      placeholder="11-character IFSC code"
                      className="mt-1"
                      maxLength={11}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEditForm(false)} className="flex-1" disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleEditEmployee} className="flex-1" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Update Employee
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Delete Employee</h2>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete this employee? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteEmployee} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Employee
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage organization employees</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={() => setShowOnboardingGenerator(true)}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Generate Onboarding Link
          </Button>
          <Button className="rounded-xl" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee) => {
          if (!employee.userId) return null;
          return (
          <Card 
            key={employee._id} 
            className="p-6 rounded-xl cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 group"
            onClick={() => handleEmployeeClick(employee._id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-primary">
                  {(employee.userId?.name || 'U')
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {employee.createdViaOnboarding && (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <LinkIcon className="w-3 h-3 mr-1" />
                    Onboarding
                  </Badge>
                )}
                <Badge variant={employee.userId.isActive ? 'default' : 'secondary'}>
                  {employee.userId.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            
            <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
              {employee.userId?.name || employee.userId?.email || 'Unknown'}
              <span className="ml-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Click to view correspondence →
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mb-3">{employee.designation}</p>
            
            <div className="space-y-2 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span>{employee.department || 'No Department'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{employee.userId.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{employee.phone || 'No Phone'}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>Salary: {formatCurrency(employee.baseSalary || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Joined: {employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(employee);
                }}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openPasswordResetModal(employee);
                }}
              >
                <Key className="w-4 h-4 mr-1" />
                Reset Password
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingEmployeeId(employee._id);
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </Card>
          );
        })}
      </div>

      {filteredEmployees.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No employees found</h3>
          <p className="text-muted-foreground">Add your first employee to get started</p>
        </div>
      )}

      {/* Onboarding Link Generator Modal */}
      <OnboardingLinkGenerator 
        isOpen={showOnboardingGenerator}
        onClose={() => setShowOnboardingGenerator(false)}
        onSuccess={() => {
          setShowOnboardingGenerator(false);
          fetchEmployees();
        }}
      />
    </div>
  );
}
