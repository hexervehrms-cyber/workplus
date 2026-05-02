import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      index: true
    },
    // Role hierarchy and inheritance
    parentRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null
    },
    inheritsPermissions: {
      type: Boolean,
      default: true
    },
    // Core permissions for this role
    permissions: [{
      module: {
        type: String,
        required: true,
        enum: [
          'users', 'employees', 'attendance', 'leave', 'payroll', 'expenses',
          'dashboard', 'reports', 'settings', 'holidays', 'tasks', 'announcements',
          'chat', 'performance', 'assets', 'departments', 'roles', 'audit'
        ]
      },
      actions: [{
        type: String,
        enum: ['create', 'read', 'update', 'delete', 'approve', 'export', 'import', 'manage']
      }],
      scope: {
        type: String,
        enum: ['own', 'department', 'organization', 'all'],
        default: 'own'
      },
      conditions: [{
        field: { type: String },
        operator: { type: String, enum: ['eq', 'ne', 'in', 'nin', 'gt', 'lt', 'gte', 'lte'] },
        value: { type: mongoose.Schema.Types.Mixed }
      }]
    }],
    // Role restrictions and limits
    restrictions: {
      maxUsers: { type: Number, default: null }, // null = unlimited
      maxDepartments: { type: Number, default: null },
      dataRetentionDays: { type: Number, default: null },
      allowedFeatures: [{ type: String }],
      deniedFeatures: [{ type: String }],
      ipWhitelist: [{ type: String }],
      timeRestrictions: {
        allowedHours: {
          start: { type: String }, // "09:00"
          end: { type: String }   // "17:00"
        },
        allowedDays: [{ type: Number, min: 0, max: 6 }], // 0=Sunday, 6=Saturday
        timezone: { type: String, default: 'UTC' }
      }
    },
    // Role metadata
    isSystemRole: {
      type: Boolean,
      default: false,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isCustom: {
      type: Boolean,
      default: false
    },
    // Organization context
    orgId: {
      type: String,
      required: true,
      index: true
    },
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    // Usage statistics
    stats: {
      userCount: { type: Number, default: 0 },
      lastUsed: { type: Date },
      totalLogins: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
roleSchema.index({ orgId: 1, name: 1 }, { unique: true });
roleSchema.index({ orgId: 1, level: 1 });
roleSchema.index({ orgId: 1, isActive: 1 });
roleSchema.index({ parentRole: 1 });

// Virtual for users with this role
roleSchema.virtual('users', {
  ref: 'User',
  localField: '_id',
  foreignField: 'roleId'
});

// Virtual for child roles
roleSchema.virtual('childRoles', {
  ref: 'Role',
  localField: '_id',
  foreignField: 'parentRole'
});

// Method to get all permissions (including inherited)
roleSchema.methods.getAllPermissions = async function() {
  let allPermissions = [...this.permissions];
  
  if (this.inheritsPermissions && this.parentRole) {
    const parentRole = await this.constructor.findById(this.parentRole);
    if (parentRole) {
      const parentPermissions = await parentRole.getAllPermissions();
      
      // Merge permissions, child overrides parent
      const permissionMap = new Map();
      
      // Add parent permissions first
      parentPermissions.forEach(perm => {
        const key = `${perm.module}:${perm.scope}`;
        permissionMap.set(key, perm);
      });
      
      // Override with child permissions
      allPermissions.forEach(perm => {
        const key = `${perm.module}:${perm.scope}`;
        permissionMap.set(key, perm);
      });
      
      allPermissions = Array.from(permissionMap.values());
    }
  }
  
  return allPermissions;
};

// Method to check if role has specific permission
roleSchema.methods.hasPermission = async function(module, action, scope = 'own') {
  const allPermissions = await this.getAllPermissions();
  
  return allPermissions.some(permission => 
    permission.module === module &&
    permission.actions.includes(action) &&
    (permission.scope === scope || permission.scope === 'all')
  );
};

// Method to add permission
roleSchema.methods.addPermission = function(module, actions, scope = 'own', conditions = []) {
  const existingIndex = this.permissions.findIndex(p => 
    p.module === module && p.scope === scope
  );
  
  if (existingIndex >= 0) {
    // Update existing permission
    this.permissions[existingIndex].actions = [...new Set([
      ...this.permissions[existingIndex].actions,
      ...actions
    ])];
    this.permissions[existingIndex].conditions = conditions;
  } else {
    // Add new permission
    this.permissions.push({ module, actions, scope, conditions });
  }
  
  return this.save();
};

// Method to remove permission
roleSchema.methods.removePermission = function(module, actions = null, scope = null) {
  if (actions === null && scope === null) {
    // Remove all permissions for module
    this.permissions = this.permissions.filter(p => p.module !== module);
  } else if (scope === null) {
    // Remove specific actions from all scopes
    this.permissions.forEach(permission => {
      if (permission.module === module) {
        permission.actions = permission.actions.filter(a => !actions.includes(a));
      }
    });
    // Remove empty permissions
    this.permissions = this.permissions.filter(p => p.actions.length > 0);
  } else {
    // Remove specific actions from specific scope
    const permissionIndex = this.permissions.findIndex(p => 
      p.module === module && p.scope === scope
    );
    
    if (permissionIndex >= 0) {
      if (actions === null) {
        // Remove entire permission
        this.permissions.splice(permissionIndex, 1);
      } else {
        // Remove specific actions
        this.permissions[permissionIndex].actions = 
          this.permissions[permissionIndex].actions.filter(a => !actions.includes(a));
        
        // Remove if no actions left
        if (this.permissions[permissionIndex].actions.length === 0) {
          this.permissions.splice(permissionIndex, 1);
        }
      }
    }
  }
  
  return this.save();
};

// Static method to create system roles
roleSchema.statics.createSystemRoles = async function(orgId, createdBy) {
  const systemRoles = [
    {
      name: 'SUPER_ADMIN',
      displayName: 'Super Administrator',
      description: 'Full system access across all organizations',
      level: 10,
      permissions: [
        {
          module: 'users',
          actions: ['create', 'read', 'update', 'delete', 'manage'],
          scope: 'all'
        },
        {
          module: 'roles',
          actions: ['create', 'read', 'update', 'delete', 'manage'],
          scope: 'all'
        },
        {
          module: 'audit',
          actions: ['read', 'export'],
          scope: 'all'
        }
      ],
      isSystemRole: true,
      orgId,
      createdBy
    },
    {
      name: 'ADMIN',
      displayName: 'Administrator',
      description: 'Full access within organization',
      level: 9,
      permissions: [
        {
          module: 'users',
          actions: ['create', 'read', 'update', 'delete'],
          scope: 'organization'
        },
        {
          module: 'employees',
          actions: ['create', 'read', 'update', 'delete', 'manage'],
          scope: 'organization'
        },
        {
          module: 'payroll',
          actions: ['create', 'read', 'update', 'delete', 'approve'],
          scope: 'organization'
        },
        {
          module: 'reports',
          actions: ['read', 'export'],
          scope: 'organization'
        }
      ],
      isSystemRole: true,
      orgId,
      createdBy
    },
    {
      name: 'HR',
      displayName: 'Human Resources',
      description: 'HR management and employee operations',
      level: 7,
      permissions: [
        {
          module: 'employees',
          actions: ['create', 'read', 'update', 'manage'],
          scope: 'organization'
        },
        {
          module: 'leave',
          actions: ['read', 'update', 'approve'],
          scope: 'organization'
        },
        {
          module: 'performance',
          actions: ['create', 'read', 'update', 'manage'],
          scope: 'organization'
        },
        {
          module: 'announcements',
          actions: ['create', 'read', 'update', 'delete'],
          scope: 'organization'
        }
      ],
      isSystemRole: true,
      orgId,
      createdBy
    },
    {
      name: 'MANAGER',
      displayName: 'Manager',
      description: 'Team and department management',
      level: 5,
      permissions: [
        {
          module: 'employees',
          actions: ['read', 'update'],
          scope: 'department'
        },
        {
          module: 'attendance',
          actions: ['read'],
          scope: 'department'
        },
        {
          module: 'leave',
          actions: ['read', 'approve'],
          scope: 'department'
        },
        {
          module: 'tasks',
          actions: ['create', 'read', 'update', 'delete'],
          scope: 'department'
        },
        {
          module: 'expenses',
          actions: ['read', 'approve'],
          scope: 'department'
        }
      ],
      isSystemRole: true,
      orgId,
      createdBy
    },
    {
      name: 'EMPLOYEE',
      displayName: 'Employee',
      description: 'Standard employee access',
      level: 1,
      permissions: [
        {
          module: 'attendance',
          actions: ['create', 'read', 'update'],
          scope: 'own'
        },
        {
          module: 'leave',
          actions: ['create', 'read', 'update'],
          scope: 'own'
        },
        {
          module: 'expenses',
          actions: ['create', 'read', 'update'],
          scope: 'own'
        },
        {
          module: 'tasks',
          actions: ['read', 'update'],
          scope: 'own'
        },
        {
          module: 'payroll',
          actions: ['read'],
          scope: 'own'
        }
      ],
      isSystemRole: true,
      orgId,
      createdBy
    }
  ];
  
  const createdRoles = [];
  for (const roleData of systemRoles) {
    const existingRole = await this.findOne({ 
      name: roleData.name, 
      orgId: roleData.orgId 
    });
    
    if (!existingRole) {
      const role = await this.create(roleData);
      createdRoles.push(role);
    } else {
      createdRoles.push(existingRole);
    }
  }
  
  return createdRoles;
};

// Static method to find roles by level range
roleSchema.statics.findByLevelRange = function(orgId, minLevel, maxLevel) {
  return this.find({
    orgId,
    level: { $gte: minLevel, $lte: maxLevel },
    isActive: true
  }).sort({ level: -1 });
};

const Role = mongoose.model("Role", roleSchema);

export default Role;