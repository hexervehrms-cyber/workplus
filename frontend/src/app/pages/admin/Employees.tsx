import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { 
  Users, Plus, Search, Edit, Trash2, Mail, Phone, X, 
  FileText, Loader2, Briefcase, Calendar, DollarSign, IndianRupee
} from 'lucide-react';
import { EmployeeService } from '../../utils/api';
import { toast } from 'sonner';
import realTimeSocket from '../../utils/realTimeSocket';
import { useCurrency } from '../../context/CurrencyContext';

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
}

export default function Employees() {
  const { formatCurrency, selectedCurrency } = useCurrency();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    designation: '',
    department: '',
    baseSalary: '',
    phone: ''
  });

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
        toast.success('New employee added by ' + (data.createdBy || 'admin'));
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
      const data = await EmployeeService.getAllEmployees();
      setEmployees(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
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
        phone: formData.phone.trim()
      });
      
      console.log('Employee created response:', response);
      
      // Add employee to list immediately for instant UI update
      if (response && response.employee) {
        setEmployees(prev => [response.employee, ...prev]);
      }
      
      toast.success('Employee created successfully');
      setShowAddForm(false);
      setFormData({ name: '', email: '', password: '', designation: '', department: '', baseSalary: '', phone: '' });
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
        phone: formData.phone.trim()
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
          phone: formData.phone.trim()
        } : emp)
      );
      
      toast.success('Employee updated successfully');
      setShowEditForm(false);
      setEditingEmployee(null);
      setFormData({ name: '', email: '', password: '', designation: '', department: '', baseSalary: '', phone: '' });
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
    setFormData({
      name: employee.userId.name,
      email: employee.userId.email,
      password: '',
      designation: employee.designation || '',
      department: employee.department || '',
      baseSalary: employee.baseSalary?.toString() || '',
      phone: employee.phone || ''
    });
    setShowEditForm(true);
  };

  const filteredEmployees = employees.filter(emp => {
    if (!emp.userId) return false;
    return emp.userId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.userId.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase());
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
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Enter password"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    placeholder="e.g. Engineering"
                    className="mt-1"
                  />
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

      {/* Edit Employee Modal */}
      {showEditForm && editingEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    placeholder="e.g. Engineering"
                    className="mt-1"
                  />
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
            onClick={() => window.location.href = '/admin/employee-onboarding'}
          >
            <FileText className="w-4 h-4 mr-2" />
            Onboarding
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
          <Card key={employee._id} className="p-6 rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-primary">
                  {employee.userId.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </span>
              </div>
              <Badge variant={employee.userId.isActive ? 'default' : 'secondary'}>
                {employee.userId.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            <h3 className="font-semibold text-lg mb-1">{employee.userId.name}</h3>
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
                onClick={() => openEditModal(employee)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 text-destructive hover:bg-destructive/10"
                onClick={() => {
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
    </div>
  );
}
