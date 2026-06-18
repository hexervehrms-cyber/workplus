import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: { 
      type: String, 
      unique: true, 
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    password: { 
      type: String, 
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "hr", "manager", "employee"],
      default: "employee",
      required: true,
      index: true
    },
    // Enhanced role system
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      index: true
    },
    customPermissions: [{
      module: { type: String, required: true },
      actions: [{ type: String }],
      scope: { type: String, enum: ['own', 'department', 'organization', 'all'], default: 'own' },
      grantedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      grantedAt: { type: Date, default: Date.now },
      expiresAt: { type: Date }
    }],
    // Enhanced user profile
    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      middleName: { type: String, trim: true },
      displayName: { type: String, trim: true },
      title: { type: String, trim: true },
      bio: { type: String, maxlength: 500 },
      timezone: { type: String, default: 'UTC' },
      language: { type: String, default: 'en' },
      dateFormat: { type: String, default: 'MM/DD/YYYY' },
      timeFormat: { type: String, enum: ['12h', '24h'], default: '12h' }
    },
    // Contact information
    contact: {
      phone: { type: String, trim: true },
      mobile: { type: String, trim: true },
      emergencyContact: {
        name: { type: String, trim: true },
        relationship: { type: String, trim: true },
        phone: { type: String, trim: true }
      },
      address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        country: { type: String, trim: true, default: 'US' }
      }
    },
    // Enterprise features
    permissions: [{
      module: { type: String, required: true },
      actions: [{ type: String }], // ['read', 'write', 'delete', 'approve']
      scope: { type: String, enum: ['own', 'department', 'organization', 'all'], default: 'own' }
    }],
    // Security settings
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorSecret: { type: String, select: false },
      passwordLastChanged: { type: Date, default: Date.now },
      passwordHistory: [{ 
        passwordHash: { type: String },
        createdAt: { type: Date, default: Date.now }
      }],
      sessionTimeout: { type: Number, default: 24 }, // hours
      ipWhitelist: [{ type: String }],
      deviceTrust: [{
        deviceId: { type: String },
        deviceName: { type: String },
        trusted: { type: Boolean, default: false },
        lastUsed: { type: Date }
      }]
    },
    // Account status
    isActive: { 
      type: Boolean, 
      default: true,
      index: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    avatar: { 
      type: String,
      default: null
    },
    // GridFS storage fields for avatar (NEW - Sprint G)
    storageKey: {
      type: String,
      default: null,
      description: "Storage key for avatar in GridFS or local storage"
    },
    storageDriver: {
      type: String,
      enum: ['local', 'gridfs', 'mongodb'],
      default: null,
      description: "Storage driver used for avatar (gridfs or local)"
    },
    avatarMimeType: {
      type: String,
      default: null
    },
    avatarSize: {
      type: Number,
      default: null
    },
    avatarUploadedAt: {
      type: Date,
      default: null
    },
    /** Org admin designation (manager, hr, accountant, etc.) */
    adminRole: {
      type: String,
      trim: true,
      default: null,
    },
    // Presence tracking for chat (Phase 3 minimal online/offline)
    presenceStatus: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
      index: true
    },
    lastSeen: {
      type: Date,
      default: null
    },
    // Organization context
    organization: { 
      type: String,
      default: 'WorkPlus Inc.'
    },
    orgId: { 
      type: String,
      required: true,
      index: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      index: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    // Login tracking
    lastLogin: {
      type: Date,
      default: null,
      index: true
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    loginHistory: [{
      timestamp: { type: Date, default: Date.now },
      ip: { type: String },
      userAgent: { type: String },
      success: { type: Boolean },
      location: {
        country: { type: String },
        city: { type: String }
      }
    }],
    // Preferences
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        desktop: { type: Boolean, default: true }
      },
      dashboard: {
        layout: { type: String, default: 'default' },
        widgets: [{ type: String }],
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' }
      },
      privacy: {
        profileVisibility: { type: String, enum: ['public', 'organization', 'private'], default: 'organization' },
        showOnlineStatus: { type: Boolean, default: true },
        allowDirectMessages: { type: Boolean, default: true }
      }
    },
    // Compliance & audit
    compliance: {
      dataProcessingConsent: { type: Boolean, default: false },
      termsAcceptedAt: { type: Date },
      privacyPolicyAcceptedAt: { type: Date },
      gdprConsent: { type: Boolean, default: false },
      dataRetentionDate: { type: Date }
    },
    // Soft delete
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Enhanced compound indexes for enterprise features
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ orgId: 1, role: 1 });
userSchema.index({ orgId: 1, isActive: 1 }); // For filtering by org and status
userSchema.index({ orgId: 1, isActive: 1, lastLogin: -1 }); // For active users in org with recent login
userSchema.index({ departmentId: 1, role: 1 });
userSchema.index({ managerId: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'profile.firstName': 1, 'profile.lastName': 1 });
userSchema.index({ deletedAt: 1 }, { sparse: true });

// Text search index for user search
userSchema.index({
  name: 'text',
  'profile.firstName': 'text',
  'profile.lastName': 'text',
  email: 'text',
  'profile.title': 'text'
});

// Virtual for employee profile
userSchema.virtual('employeeProfile', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Virtual for department
userSchema.virtual('department', {
  ref: 'Department',
  localField: 'departmentId',
  foreignField: '_id',
  justOne: true
});

// Virtual for manager
userSchema.virtual('manager', {
  ref: 'User',
  localField: 'managerId',
  foreignField: '_id',
  justOne: true
});

// Virtual for direct reports
userSchema.virtual('directReports', {
  ref: 'User',
  localField: '_id',
  foreignField: 'managerId'
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.profile?.firstName && this.profile?.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.name;
});

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Virtual for role details
userSchema.virtual('roleDetails', {
  ref: 'Role',
  localField: 'roleId',
  foreignField: '_id',
  justOne: true
});

// Method to get all permissions (role + custom)
userSchema.methods.getAllPermissions = async function() {
  let allPermissions = [];
  
  // Get role permissions
  if (this.roleId) {
    const role = await mongoose.model('Role').findById(this.roleId);
    if (role) {
      const rolePermissions = await role.getAllPermissions();
      allPermissions = [...rolePermissions];
    }
  }
  
  // Add custom permissions
  const activeCustomPermissions = this.customPermissions.filter(p => 
    !p.expiresAt || p.expiresAt > new Date()
  );
  
  allPermissions = [...allPermissions, ...activeCustomPermissions];
  
  return allPermissions;
};

// Enhanced permission checking method
userSchema.methods.hasPermission = async function(module, action, scope = 'own') {
  // Super admin has all permissions
  if (this.role === 'super_admin') return true;
  
  const allPermissions = await this.getAllPermissions();
  
  return allPermissions.some(permission => 
    permission.module === module &&
    permission.actions.includes(action) &&
    (permission.scope === scope || permission.scope === 'all')
  );
};

// Method to grant custom permission
userSchema.methods.grantPermission = function(module, actions, scope = 'own', grantedBy, expiresAt = null) {
  const existingIndex = this.customPermissions.findIndex(p => 
    p.module === module && p.scope === scope
  );
  
  if (existingIndex >= 0) {
    // Update existing permission
    this.customPermissions[existingIndex].actions = [...new Set([
      ...this.customPermissions[existingIndex].actions,
      ...actions
    ])];
    this.customPermissions[existingIndex].grantedBy = grantedBy;
    this.customPermissions[existingIndex].grantedAt = new Date();
    if (expiresAt) this.customPermissions[existingIndex].expiresAt = expiresAt;
  } else {
    // Add new permission
    this.customPermissions.push({
      module,
      actions,
      scope,
      grantedBy,
      grantedAt: new Date(),
      expiresAt
    });
  }
  
  return this.save();
};

// Method to revoke custom permission
userSchema.methods.revokePermission = function(module, actions = null, scope = null) {
  if (actions === null && scope === null) {
    // Remove all permissions for module
    this.customPermissions = this.customPermissions.filter(p => p.module !== module);
  } else if (scope === null) {
    // Remove specific actions from all scopes
    this.customPermissions.forEach(permission => {
      if (permission.module === module) {
        permission.actions = permission.actions.filter(a => !actions.includes(a));
      }
    });
    // Remove empty permissions
    this.customPermissions = this.customPermissions.filter(p => p.actions.length > 0);
  } else {
    // Remove specific actions from specific scope
    const permissionIndex = this.customPermissions.findIndex(p => 
      p.module === module && p.scope === scope
    );
    
    if (permissionIndex >= 0) {
      if (actions === null) {
        // Remove entire permission
        this.customPermissions.splice(permissionIndex, 1);
      } else {
        // Remove specific actions
        this.customPermissions[permissionIndex].actions = 
          this.customPermissions[permissionIndex].actions.filter(a => !actions.includes(a));
        
        // Remove if no actions left
        if (this.customPermissions[permissionIndex].actions.length === 0) {
          this.customPermissions.splice(permissionIndex, 1);
        }
      }
    }
  }
  
  return this.save();
};

// Method to log login attempt
userSchema.methods.logLoginAttempt = function(ip, userAgent, success, location) {
  this.loginHistory.push({
    timestamp: new Date(),
    ip,
    userAgent,
    success,
    location
  });
  
  // Keep only last 50 login attempts
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  
  if (success) {
    this.lastLogin = new Date();
    this.loginAttempts = 0;
    this.lockUntil = null;
  } else {
    this.loginAttempts += 1;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
      this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }
  
  return this.save();
};

// Pre-save hook to hash password - DISABLED due to callback issues
// Using route-level hashing instead
// userSchema.pre('save', function(next) {
//   ...
// });

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ 
    email: email.toLowerCase(),
    isActive: true,
    deletedAt: null
  }).select('+password');
  
  if (!user) {
    return null;
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    return null;
  }
  
  return user;
};

// Static method to find by role and organization
userSchema.statics.findByRoleAndOrg = function(role, orgId, includeInactive = false) {
  const query = { role, orgId };
  
  if (!includeInactive) {
    query.isActive = true;
    query.deletedAt = null;
  }
  
  return this.find(query)
    .populate('department', 'name')
    .populate('manager', 'name email')
    .sort({ name: 1 })
    .lean();
};

// Static method for advanced search
userSchema.statics.advancedSearch = function(searchParams) {
  const {
    query,
    role,
    department,
    orgId,
    isActive = true,
    page = 1,
    limit = 50
  } = searchParams;
  
  const filter = { orgId, deletedAt: null };
  
  if (isActive !== undefined) {
    filter.isActive = isActive;
  }
  
  if (role) {
    filter.role = role;
  }
  
  if (department) {
    filter.departmentId = department;
  }
  
  let searchQuery = this.find(filter);
  
  if (query) {
    searchQuery = searchQuery.find({
      $text: { $search: query }
    });
  }
  
  return searchQuery
    .populate('department', 'name')
    .populate('manager', 'name email')
    .sort({ name: 1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

const User = mongoose.model("User", userSchema);

export default User;
