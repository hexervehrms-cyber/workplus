export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  level: number; // Higher number = higher priority
}

export const PERMISSIONS: Record<string, Permission> = {
  // Dashboard permissions
  VIEW_DASHBOARD: {
    id: 'VIEW_DASHBOARD',
    name: 'View Dashboard',
    description: 'Access to main dashboard'
  },
  
  // Employee permissions
  VIEW_EMPLOYEES: {
    id: 'VIEW_EMPLOYEES',
    name: 'View Employees',
    description: 'View employee list and details'
  },
  ADD_EMPLOYEES: {
    id: 'ADD_EMPLOYEES',
    name: 'Add Employees',
    description: 'Add new employees'
  },
  EDIT_EMPLOYEES: {
    id: 'EDIT_EMPLOYEES',
    name: 'Edit Employees',
    description: 'Edit employee information'
  },
  DELETE_EMPLOYEES: {
    id: 'DELETE_EMPLOYEES',
    name: 'Delete Employees',
    description: 'Delete employees'
  },
  
  // Department permissions
  VIEW_DEPARTMENTS: {
    id: 'VIEW_DEPARTMENTS',
    name: 'View Departments',
    description: 'View department list and details'
  },
  ADD_DEPARTMENTS: {
    id: 'ADD_DEPARTMENTS',
    name: 'Add Departments',
    description: 'Add new departments'
  },
  EDIT_DEPARTMENTS: {
    id: 'EDIT_DEPARTMENTS',
    name: 'Edit Departments',
    description: 'Edit department information'
  },
  DELETE_DEPARTMENTS: {
    id: 'DELETE_DEPARTMENTS',
    name: 'Delete Departments',
    description: 'Delete departments'
  },
  
  // Expense permissions
  VIEW_EXPENSES: {
    id: 'VIEW_EXPENSES',
    name: 'View Expenses',
    description: 'View expense reports and details'
  },
  ADD_EXPENSES: {
    id: 'ADD_EXPENSES',
    name: 'Add Expenses',
    description: 'Submit new expense reports'
  },
  EDIT_EXPENSES: {
    id: 'EDIT_EXPENSES',
    name: 'Edit Expenses',
    description: 'Edit expense reports'
  },
  DELETE_EXPENSES: {
    id: 'DELETE_EXPENSES',
    name: 'Delete Expenses',
    description: 'Delete expense reports'
  },
  APPROVE_EXPENSES: {
    id: 'APPROVE_EXPENSES',
    name: 'Approve Expenses',
    description: 'Approve or reject expense reports'
  },
  
  // Accounting permissions
  VIEW_ACCOUNTING: {
    id: 'VIEW_ACCOUNTING',
    name: 'View Accounting',
    description: 'Access accounting dashboard and reports'
  },
  MANAGE_PAYROLL: {
    id: 'MANAGE_PAYROLL',
    name: 'Manage Payroll',
    description: 'Manage payroll processing and salary'
  },
  MANAGE_TAXES: {
    id: 'MANAGE_TAXES',
    name: 'Manage Taxes',
    description: 'Manage tax calculations and filings'
  },
  VIEW_FINANCIAL_REPORTS: {
    id: 'VIEW_FINANCIAL_REPORTS',
    name: 'View Financial Reports',
    description: 'Access financial reports and analytics'
  },
  MANAGE_BILLING: {
    id: 'MANAGE_BILLING',
    name: 'Manage Billing',
    description: 'Manage client billing and invoicing'
  },
  
  // Profile permissions
  VIEW_PROFILE: {
    id: 'VIEW_PROFILE',
    name: 'View Profile',
    description: 'View own profile information'
  },
  EDIT_PROFILE: {
    id: 'EDIT_PROFILE',
    name: 'Edit Profile',
    description: 'Edit own profile information'
  },
  
  // Employee Onboarding permissions
  GENERATE_INVITE_LINKS: {
    id: 'GENERATE_INVITE_LINKS',
    name: 'Generate Invite Links',
    description: 'Generate invite links for new employee onboarding'
  },
  MANAGE_INVITE_LINKS: {
    id: 'MANAGE_INVITE_LINKS',
    name: 'Manage Invite Links',
    description: 'View and manage generated invite links'
  },
  
  // System permissions
  VIEW_SYSTEM_LOGS: {
    id: 'VIEW_SYSTEM_LOGS',
    name: 'View System Logs',
    description: 'Access system logs and audit trails'
  },
  MANAGE_SETTINGS: {
    id: 'MANAGE_SETTINGS',
    name: 'Manage Settings',
    description: 'Manage system settings and configurations'
  }
};

export const ROLES: Record<string, Role> = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full system access with all permissions',
    permissions: Object.values(PERMISSIONS),
    level: 100
  },
  
  ADMIN: {
    id: 'ADMIN',
    name: 'Admin',
    description: 'Administrative access with most permissions',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.ADD_EMPLOYEES,
      PERMISSIONS.EDIT_EMPLOYEES,
      PERMISSIONS.DELETE_EMPLOYEES,
      PERMISSIONS.VIEW_DEPARTMENTS,
      PERMISSIONS.ADD_DEPARTMENTS,
      PERMISSIONS.EDIT_DEPARTMENTS,
      PERMISSIONS.DELETE_DEPARTMENTS,
      PERMISSIONS.VIEW_EXPENSES,
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.GENERATE_INVITE_LINKS,
      PERMISSIONS.MANAGE_INVITE_LINKS,
      PERMISSIONS.VIEW_PROFILE,
      PERMISSIONS.EDIT_PROFILE
    ],
    level: 80
  },
  
  ACCOUNTANT: {
    id: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Financial and accounting access',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.EDIT_EMPLOYEES, // Limited edit for salary info
      PERMISSIONS.VIEW_EXPENSES,
      PERMISSIONS.ADD_EXPENSES,
      PERMISSIONS.EDIT_EXPENSES,
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.VIEW_ACCOUNTING,
      PERMISSIONS.MANAGE_PAYROLL,
      PERMISSIONS.MANAGE_TAXES,
      PERMISSIONS.VIEW_FINANCIAL_REPORTS,
      PERMISSIONS.MANAGE_BILLING,
      PERMISSIONS.VIEW_PROFILE,
      PERMISSIONS.EDIT_PROFILE
    ],
    level: 70
  },
  
  MANAGER: {
    id: 'MANAGER',
    name: 'Manager',
    description: 'Department management access',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.ADD_EMPLOYEES,
      PERMISSIONS.EDIT_EMPLOYEES, // Limited to team members
      PERMISSIONS.VIEW_DEPARTMENTS,
      PERMISSIONS.VIEW_EXPENSES,
      PERMISSIONS.ADD_EXPENSES,
      PERMISSIONS.EDIT_EXPENSES,
      PERMISSIONS.APPROVE_EXPENSES, // Limited to team expenses
      PERMISSIONS.VIEW_PROFILE,
      PERMISSIONS.EDIT_PROFILE
    ],
    level: 60
  },
  
  HR_SPECIALIST: {
    id: 'HR_SPECIALIST',
    name: 'HR Specialist',
    description: 'Human resources management access',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.ADD_EMPLOYEES,
      PERMISSIONS.EDIT_EMPLOYEES, // Limited to HR info
      PERMISSIONS.VIEW_DEPARTMENTS,
      PERMISSIONS.VIEW_EXPENSES,
      PERMISSIONS.GENERATE_INVITE_LINKS,
      PERMISSIONS.MANAGE_INVITE_LINKS,
      PERMISSIONS.VIEW_PROFILE,
      PERMISSIONS.EDIT_PROFILE
    ],
    level: 50
  },

  EMPLOYEE: {
    id: 'EMPLOYEE',
    name: 'Employee',
    description: 'Basic employee access',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_EMPLOYEES, // Limited view
      PERMISSIONS.VIEW_EXPENSES,
      PERMISSIONS.ADD_EXPENSES,
      PERMISSIONS.EDIT_EXPENSES, // Own expenses only
      PERMISSIONS.VIEW_PROFILE,
      PERMISSIONS.EDIT_PROFILE
    ],
    level: 40
  }
};

// Helper functions for permission checking
export function hasPermission(userRole: Role, permissionId: string): boolean {
  return userRole.permissions.some(p => p.id === permissionId);
}

export function hasAnyPermission(userRole: Role, permissionIds: string[]): boolean {
  return permissionIds.some(id => hasPermission(userRole, id));
}

export function hasAllPermissions(userRole: Role, permissionIds: string[]): boolean {
  return permissionIds.every(id => hasPermission(userRole, id));
}

export function getRoleById(roleId: string): Role | undefined {
  return ROLES[roleId];
}

export function getRoleNames(): string[] {
  return Object.values(ROLES).map(role => role.name);
}

export function getRoleOptions(): Array<{ value: string; label: string; description: string }> {
  return Object.values(ROLES).map(role => ({
    value: role.id,
    label: role.name,
    description: role.description
  }));
}
