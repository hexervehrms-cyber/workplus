import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Shield, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface RoleInfo {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

// Permission categories for display
const PERMISSION_CATEGORIES = {
  EMPLOYEE: {
    name: 'Employee Management',
    permissions: [
      { id: 'VIEW_EMPLOYEES', name: 'View Employees', description: 'View employee list and details' },
      { id: 'ADD_EMPLOYEES', name: 'Add Employees', description: 'Add new employees' },
      { id: 'EDIT_EMPLOYEES', name: 'Edit Employees', description: 'Edit employee information' },
      { id: 'DELETE_EMPLOYEES', name: 'Delete Employees', description: 'Delete employees' },
    ]
  },
  SALARY: {
    name: 'Salary Management',
    permissions: [
      { id: 'VIEW_SALARY', name: 'View Salary', description: 'View salary information' },
      { id: 'EDIT_SALARY', name: 'Edit Salary', description: 'Edit salary information' },
      { id: 'MANAGE_PAYROLL', name: 'Manage Payroll', description: 'Manage payroll processing' },
      { id: 'MANAGE_TAXES', name: 'Manage Taxes', description: 'Manage tax calculations' },
    ]
  },
  LEAVES: {
    name: 'Leave Management',
    permissions: [
      { id: 'VIEW_LEAVES', name: 'View Leaves', description: 'View leave requests' },
      { id: 'ADD_LEAVES', name: 'Add Leaves', description: 'Add leave requests' },
      { id: 'EDIT_LEAVES', name: 'Edit Leaves', description: 'Edit leave requests' },
      { id: 'APPROVE_LEAVES', name: 'Approve Leaves', description: 'Approve or reject leave requests' },
    ]
  },
  EXPENSES: {
    name: 'Expense Management',
    permissions: [
      { id: 'VIEW_EXPENSES', name: 'View Expenses', description: 'View expense reports' },
      { id: 'ADD_EXPENSES', name: 'Add Expenses', description: 'Submit expense reports' },
      { id: 'EDIT_EXPENSES', name: 'Edit Expenses', description: 'Edit expense reports' },
      { id: 'DELETE_EXPENSES', name: 'Delete Expenses', description: 'Delete expense reports' },
      { id: 'APPROVE_EXPENSES', name: 'Approve Expenses', description: 'Approve or reject expenses' },
    ]
  },
  ATTENDANCE: {
    name: 'Attendance Management',
    permissions: [
      { id: 'VIEW_ATTENDANCE', name: 'View Attendance', description: 'View attendance records' },
      { id: 'EDIT_ATTENDANCE', name: 'Edit Attendance', description: 'Edit attendance records' },
      { id: 'APPROVE_ATTENDANCE', name: 'Approve Attendance', description: 'Approve attendance' },
      { id: 'DELETE_ATTENDANCE', name: 'Delete Attendance', description: 'Delete attendance records' },
    ]
  },
};

// Predefined roles with permissions
const PREDEFINED_ROLES: Record<string, RoleInfo> = {
  recruiter: {
    id: 'recruiter',
    name: 'Recruiter',
    description: 'Handles recruitment and employee management',
    permissions: [
      { id: 'VIEW_EMPLOYEES', name: 'View Employees', description: 'View employee list and details' },
      { id: 'ADD_EMPLOYEES', name: 'Add Employees', description: 'Add new employees' },
      { id: 'EDIT_EMPLOYEES', name: 'Edit Employees', description: 'Edit employee information' },
      { id: 'DELETE_EMPLOYEES', name: 'Delete Employees', description: 'Delete employees' },
      { id: 'VIEW_SALARY', name: 'View Salary', description: 'View salary information' },
      { id: 'EDIT_SALARY', name: 'Edit Salary', description: 'Edit salary information' },
      { id: 'VIEW_LEAVES', name: 'View Leaves', description: 'View leave requests' },
      { id: 'ADD_LEAVES', name: 'Add Leaves', description: 'Add leave requests' },
      { id: 'EDIT_LEAVES', name: 'Edit Leaves', description: 'Edit leave requests' },
      { id: 'VIEW_EXPENSES', name: 'View Expenses', description: 'View expense reports' },
      { id: 'ADD_EXPENSES', name: 'Add Expenses', description: 'Submit expense reports' },
      { id: 'EDIT_EXPENSES', name: 'Edit Expenses', description: 'Edit expense reports' },
      { id: 'DELETE_EXPENSES', name: 'Delete Expenses', description: 'Delete expense reports' },
      { id: 'VIEW_ATTENDANCE', name: 'View Attendance', description: 'View attendance records' },
      { id: 'EDIT_ATTENDANCE', name: 'Edit Attendance', description: 'Edit attendance records' },
    ]
  },
  accountant: {
    id: 'accountant',
    name: 'Accountant',
    description: 'Handles accounting and financial operations',
    permissions: [
      { id: 'VIEW_EXPENSES', name: 'View Expenses', description: 'View expense reports' },
      { id: 'ADD_EXPENSES', name: 'Add Expenses', description: 'Submit expense reports' },
      { id: 'EDIT_EXPENSES', name: 'Edit Expenses', description: 'Edit expense reports' },
      { id: 'APPROVE_EXPENSES', name: 'Approve Expenses', description: 'Approve or reject expenses' },
      { id: 'VIEW_SALARY', name: 'View Salary', description: 'View salary information' },
      { id: 'EDIT_SALARY', name: 'Edit Salary', description: 'Edit salary information' },
      { id: 'MANAGE_PAYROLL', name: 'Manage Payroll', description: 'Manage payroll processing' },
      { id: 'MANAGE_TAXES', name: 'Manage Taxes', description: 'Manage tax calculations' },
    ]
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    description: 'Manages team and approves requests',
    permissions: [
      { id: 'VIEW_EMPLOYEES', name: 'View Employees', description: 'View employee list and details' },
      { id: 'ADD_EMPLOYEES', name: 'Add Employees', description: 'Add new employees' },
      { id: 'EDIT_EMPLOYEES', name: 'Edit Employees', description: 'Edit employee information' },
      { id: 'VIEW_LEAVES', name: 'View Leaves', description: 'View leave requests' },
      { id: 'APPROVE_LEAVES', name: 'Approve Leaves', description: 'Approve or reject leave requests' },
      { id: 'VIEW_EXPENSES', name: 'View Expenses', description: 'View expense reports' },
      { id: 'ADD_EXPENSES', name: 'Add Expenses', description: 'Submit expense reports' },
      { id: 'EDIT_EXPENSES', name: 'Edit Expenses', description: 'Edit expense reports' },
      { id: 'APPROVE_EXPENSES', name: 'Approve Expenses', description: 'Approve or reject expenses' },
      { id: 'VIEW_ATTENDANCE', name: 'View Attendance', description: 'View attendance records' },
      { id: 'APPROVE_ATTENDANCE', name: 'Approve Attendance', description: 'Approve attendance' },
    ]
  },
  sales: {
    id: 'sales',
    name: 'Sales',
    description: 'Sales team member',
    permissions: [
      { id: 'VIEW_EXPENSES', name: 'View Expenses', description: 'View expense reports' },
      { id: 'ADD_EXPENSES', name: 'Add Expenses', description: 'Submit expense reports' },
      { id: 'EDIT_EXPENSES', name: 'Edit Expenses', description: 'Edit expense reports' },
    ]
  },
  employee: {
    id: 'employee',
    name: 'Employee',
    description: 'Standard employee access',
    permissions: [
      { id: 'VIEW_LEAVES', name: 'View Leaves', description: 'View leave requests' },
      { id: 'ADD_LEAVES', name: 'Add Leaves', description: 'Add leave requests' },
      { id: 'VIEW_EXPENSES', name: 'View Expenses', description: 'View expense reports' },
      { id: 'ADD_EXPENSES', name: 'Add Expenses', description: 'Submit expense reports' },
      { id: 'EDIT_EXPENSES', name: 'Edit Expenses', description: 'Edit expense reports' },
      { id: 'VIEW_ATTENDANCE', name: 'View Attendance', description: 'View attendance records' },
    ]
  },
};

export default function EmployeeRoles() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<RoleInfo | null>(null);

  useEffect(() => {
    loadUserRole();
  }, [user]);

  const loadUserRole = () => {
    try {
      setLoading(true);
      
      if (!user?.role) return;

      // Get role information from predefined roles
      const roleKey = user.role.toLowerCase();
      const roleInfo = PREDEFINED_ROLES[roleKey];

      if (roleInfo) {
        setUserRole(roleInfo);
      } else {
        // Fallback for unknown roles
        setUserRole({
          id: user.role,
          name: user.role.charAt(0).toUpperCase() + user.role.slice(1),
          description: 'Your assigned role',
          permissions: []
        });
      }
    } catch (error) {
      console.error('Error loading role:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground"></p>
        </div>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="p-8">
        <Card className="p-6 rounded-2xl text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Unable to load role information</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">My Role & Permissions</h1>
        <p className="text-muted-foreground">View your assigned role and available permissions</p>
      </div>

      {/* Role Overview */}
      <Card className="p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">{userRole.name}</h2>
              <Badge variant="default" className="text-sm">
                {userRole.permissions.length} permissions
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">{userRole.description}</p>
            <div className="flex flex-wrap gap-2">
              {userRole.permissions.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {userRole.permissions.length} permissions assigned
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Permissions by Category */}
      {userRole.permissions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Your Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => {
              const categoryPermissions = userRole.permissions.filter(p =>
                category.permissions.some(cp => cp.id === p.id)
              );

              if (categoryPermissions.length === 0) return null;

              return (
                <Card key={categoryKey} className="p-4 rounded-2xl">
                  <h4 className="font-semibold mb-3">{category.name}</h4>
                  <div className="space-y-2">
                    {categoryPermissions.map((permission) => (
                      <div key={permission.id} className="flex items-start gap-3">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* No Permissions Message */}
      {userRole.permissions.length === 0 && (
        <Card className="p-6 rounded-2xl text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No permissions assigned to this role</p>
        </Card>
      )}

      {/* Role Information */}
      <Card className="p-6 rounded-2xl bg-accent/50">
        <h3 className="font-semibold mb-3">About Your Role</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Your role determines what actions you can perform in the system. The permissions listed above show exactly what you're authorized to do.
          </p>
          <p>
            If you believe you need additional permissions or have questions about your role, please contact your administrator.
          </p>
        </div>
      </Card>
    </div>
  );
}
