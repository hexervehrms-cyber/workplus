import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    module: {
      type: String,
      required: true,
      enum: [
        'users', 'employees', 'attendance', 'leave', 'payroll', 'expenses',
        'dashboard', 'reports', 'settings', 'holidays', 'tasks', 'announcements',
        'chat', 'performance', 'assets', 'departments', 'roles', 'audit'
      ],
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: ['create', 'read', 'update', 'delete', 'approve', 'export', 'import', 'manage'],
      index: true
    },
    // Permission metadata
    category: {
      type: String,
      enum: ['core', 'administrative', 'operational', 'reporting', 'security'],
      default: 'operational'
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    // Scope definitions
    availableScopes: [{
      type: String,
      enum: ['own', 'department', 'organization', 'all']
    }],
    defaultScope: {
      type: String,
      enum: ['own', 'department', 'organization', 'all'],
      default: 'own'
    },
    // Permission dependencies
    dependencies: [{
      permission: { type: String }, // Permission name
      required: { type: Boolean, default: true }
    }],
    conflicts: [{ type: String }], // Conflicting permissions
    // Conditions and constraints
    conditions: [{
      field: { type: String },
      operator: { type: String, enum: ['eq', 'ne', 'in', 'nin', 'gt', 'lt', 'gte', 'lte'] },
      value: { type: mongoose.Schema.Types.Mixed },
      description: { type: String }
    }],
    // System flags
    isSystemPermission: {
      type: Boolean,
      default: false,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    // Usage tracking
    stats: {
      rolesUsing: { type: Number, default: 0 },
      usersWithPermission: { type: Number, default: 0 },
      lastUsed: { type: Date }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes
permissionSchema.index({ module: 1, action: 1 }, { unique: true });
permissionSchema.index({ category: 1, riskLevel: 1 });
permissionSchema.index({ isSystemPermission: 1, isActive: 1 });

// Virtual for full permission identifier
permissionSchema.virtual('identifier').get(function() {
  return `${this.module}:${this.action}`;
});

// Method to check dependencies
permissionSchema.methods.checkDependencies = async function(userPermissions) {
  const missingDependencies = [];
  
  for (const dep of this.dependencies) {
    if (dep.required) {
      const hasPermission = userPermissions.some(p => p.name === dep.permission);
      if (!hasPermission) {
        const depPermission = await this.constructor.findOne({ name: dep.permission });
        missingDependencies.push({
          permission: dep.permission,
          displayName: depPermission?.displayName || dep.permission
        });
      }
    }
  }
  
  return missingDependencies;
};

// Method to check conflicts
permissionSchema.methods.checkConflicts = function(userPermissions) {
  const conflicts = [];
  
  for (const conflictName of this.conflicts) {
    const hasConflict = userPermissions.some(p => p.name === conflictName);
    if (hasConflict) {
      conflicts.push(conflictName);
    }
  }
  
  return conflicts;
};

// Static method to create system permissions
permissionSchema.statics.createSystemPermissions = async function() {
  const systemPermissions = [
    // User Management
    { name: 'USERS_CREATE', displayName: 'Create Users', module: 'users', action: 'create', category: 'administrative', riskLevel: 'high' },
    { name: 'USERS_READ', displayName: 'View Users', module: 'users', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'USERS_UPDATE', displayName: 'Update Users', module: 'users', action: 'update', category: 'administrative', riskLevel: 'medium' },
    { name: 'USERS_DELETE', displayName: 'Delete Users', module: 'users', action: 'delete', category: 'administrative', riskLevel: 'critical' },
    { name: 'USERS_MANAGE', displayName: 'Manage Users', module: 'users', action: 'manage', category: 'administrative', riskLevel: 'critical' },
    
    // Employee Management
    { name: 'EMPLOYEES_CREATE', displayName: 'Create Employees', module: 'employees', action: 'create', category: 'operational', riskLevel: 'medium' },
    { name: 'EMPLOYEES_READ', displayName: 'View Employees', module: 'employees', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'EMPLOYEES_UPDATE', displayName: 'Update Employees', module: 'employees', action: 'update', category: 'operational', riskLevel: 'medium' },
    { name: 'EMPLOYEES_DELETE', displayName: 'Delete Employees', module: 'employees', action: 'delete', category: 'administrative', riskLevel: 'high' },
    { name: 'EMPLOYEES_MANAGE', displayName: 'Manage Employees', module: 'employees', action: 'manage', category: 'administrative', riskLevel: 'high' },
    
    // Attendance Management
    { name: 'ATTENDANCE_CREATE', displayName: 'Create Attendance', module: 'attendance', action: 'create', category: 'operational', riskLevel: 'low' },
    { name: 'ATTENDANCE_READ', displayName: 'View Attendance', module: 'attendance', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'ATTENDANCE_UPDATE', displayName: 'Update Attendance', module: 'attendance', action: 'update', category: 'operational', riskLevel: 'medium' },
    { name: 'ATTENDANCE_DELETE', displayName: 'Delete Attendance', module: 'attendance', action: 'delete', category: 'administrative', riskLevel: 'high' },
    
    // Leave Management
    { name: 'LEAVE_CREATE', displayName: 'Create Leave Requests', module: 'leave', action: 'create', category: 'operational', riskLevel: 'low' },
    { name: 'LEAVE_READ', displayName: 'View Leave Requests', module: 'leave', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'LEAVE_UPDATE', displayName: 'Update Leave Requests', module: 'leave', action: 'update', category: 'operational', riskLevel: 'medium' },
    { name: 'LEAVE_DELETE', displayName: 'Delete Leave Requests', module: 'leave', action: 'delete', category: 'administrative', riskLevel: 'medium' },
    { name: 'LEAVE_APPROVE', displayName: 'Approve Leave Requests', module: 'leave', action: 'approve', category: 'administrative', riskLevel: 'medium' },
    
    // Payroll Management
    { name: 'PAYROLL_CREATE', displayName: 'Create Payroll', module: 'payroll', action: 'create', category: 'administrative', riskLevel: 'high' },
    { name: 'PAYROLL_READ', displayName: 'View Payroll', module: 'payroll', action: 'read', category: 'core', riskLevel: 'medium' },
    { name: 'PAYROLL_UPDATE', displayName: 'Update Payroll', module: 'payroll', action: 'update', category: 'administrative', riskLevel: 'high' },
    { name: 'PAYROLL_DELETE', displayName: 'Delete Payroll', module: 'payroll', action: 'delete', category: 'administrative', riskLevel: 'critical' },
    { name: 'PAYROLL_APPROVE', displayName: 'Approve Payroll', module: 'payroll', action: 'approve', category: 'administrative', riskLevel: 'critical' },
    
    // Expense Management
    { name: 'EXPENSES_CREATE', displayName: 'Create Expenses', module: 'expenses', action: 'create', category: 'operational', riskLevel: 'low' },
    { name: 'EXPENSES_READ', displayName: 'View Expenses', module: 'expenses', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'EXPENSES_UPDATE', displayName: 'Update Expenses', module: 'expenses', action: 'update', category: 'operational', riskLevel: 'medium' },
    { name: 'EXPENSES_DELETE', displayName: 'Delete Expenses', module: 'expenses', action: 'delete', category: 'administrative', riskLevel: 'medium' },
    { name: 'EXPENSES_APPROVE', displayName: 'Approve Expenses', module: 'expenses', action: 'approve', category: 'administrative', riskLevel: 'medium' },
    
    // Dashboard & Reports
    { name: 'DASHBOARD_READ', displayName: 'View Dashboard', module: 'dashboard', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'REPORTS_READ', displayName: 'View Reports', module: 'reports', action: 'read', category: 'reporting', riskLevel: 'low' },
    { name: 'REPORTS_EXPORT', displayName: 'Export Reports', module: 'reports', action: 'export', category: 'reporting', riskLevel: 'medium' },
    
    // Task Management
    { name: 'TASKS_CREATE', displayName: 'Create Tasks', module: 'tasks', action: 'create', category: 'operational', riskLevel: 'low' },
    { name: 'TASKS_READ', displayName: 'View Tasks', module: 'tasks', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'TASKS_UPDATE', displayName: 'Update Tasks', module: 'tasks', action: 'update', category: 'operational', riskLevel: 'low' },
    { name: 'TASKS_DELETE', displayName: 'Delete Tasks', module: 'tasks', action: 'delete', category: 'operational', riskLevel: 'medium' },
    
    // Announcement Management
    { name: 'ANNOUNCEMENTS_CREATE', displayName: 'Create Announcements', module: 'announcements', action: 'create', category: 'operational', riskLevel: 'medium' },
    { name: 'ANNOUNCEMENTS_READ', displayName: 'View Announcements', module: 'announcements', action: 'read', category: 'core', riskLevel: 'low' },
    { name: 'ANNOUNCEMENTS_UPDATE', displayName: 'Update Announcements', module: 'announcements', action: 'update', category: 'operational', riskLevel: 'medium' },
    { name: 'ANNOUNCEMENTS_DELETE', displayName: 'Delete Announcements', module: 'announcements', action: 'delete', category: 'administrative', riskLevel: 'medium' },
    
    // Role & Permission Management
    { name: 'ROLES_CREATE', displayName: 'Create Roles', module: 'roles', action: 'create', category: 'security', riskLevel: 'critical' },
    { name: 'ROLES_READ', displayName: 'View Roles', module: 'roles', action: 'read', category: 'security', riskLevel: 'medium' },
    { name: 'ROLES_UPDATE', displayName: 'Update Roles', module: 'roles', action: 'update', category: 'security', riskLevel: 'critical' },
    { name: 'ROLES_DELETE', displayName: 'Delete Roles', module: 'roles', action: 'delete', category: 'security', riskLevel: 'critical' },
    { name: 'ROLES_MANAGE', displayName: 'Manage Roles', module: 'roles', action: 'manage', category: 'security', riskLevel: 'critical' },
    
    // Audit & Security
    { name: 'AUDIT_READ', displayName: 'View Audit Logs', module: 'audit', action: 'read', category: 'security', riskLevel: 'high' },
    { name: 'AUDIT_EXPORT', displayName: 'Export Audit Logs', module: 'audit', action: 'export', category: 'security', riskLevel: 'high' }
  ];
  
  const createdPermissions = [];
  for (const permData of systemPermissions) {
    const existing = await this.findOne({ name: permData.name });
    if (!existing) {
      permData.isSystemPermission = true;
      permData.availableScopes = ['own', 'department', 'organization', 'all'];
      const permission = await this.create(permData);
      createdPermissions.push(permission);
    } else {
      createdPermissions.push(existing);
    }
  }
  
  return createdPermissions;
};

// Static method to get permissions by module
permissionSchema.statics.getByModule = function(module) {
  return this.find({ module, isActive: true }).sort({ action: 1 });
};

// Static method to get permissions by category
permissionSchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ module: 1, action: 1 });
};

const Permission = mongoose.model("Permission", permissionSchema);

export default Permission;