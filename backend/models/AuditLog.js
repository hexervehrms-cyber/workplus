import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    orgId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Organization",
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Data Operations
        "CREATE", "READ", "UPDATE", "DELETE", "BULK_UPDATE", "BULK_DELETE",
        
        // Authentication & Authorization
        "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT", "PASSWORD_CHANGE", "PASSWORD_RESET",
        "ROLE_CHANGE", "PERMISSION_GRANT", "PERMISSION_REVOKE",
        
        // Financial Operations
        "PAYROLL_GENERATE", "PAYROLL_APPROVE", "PAYROLL_PAY", "SALARY_UPDATE",
        "EXPENSE_APPROVE", "EXPENSE_REJECT", "EXPENSE_PAY",
        
        // Administrative Actions
        "USER_CREATE", "USER_ACTIVATE", "USER_DEACTIVATE", "USER_DELETE",
        "ORG_CREATE", "ORG_UPDATE", "ORG_DELETE", "ORG_SETTINGS_CHANGE",
        "DEPT_CREATE", "DEPT_UPDATE", "DEPT_DELETE",
        
        // System Operations
        "BACKUP_CREATE", "BACKUP_RESTORE", "SYSTEM_UPDATE", "CONFIG_CHANGE",
        "DATABASE_MIGRATION", "SECURITY_SCAN",
        
        // Compliance & Legal
        "DATA_EXPORT", "DATA_IMPORT", "GDPR_REQUEST", "AUDIT_EXPORT",
        "COMPLIANCE_CHECK", "POLICY_UPDATE"
      ],
      index: true
    },
    resource: {
      type: {
        type: String,
        required: true,
        enum: [
          "user", "employee", "organization", "department", "attendance", 
          "leave_request", "payroll", "expense", "task", "announcement", 
          "document", "system", "database", "configuration", "backup"
        ],
        index: true
      },
      id: { 
        type: mongoose.Schema.Types.ObjectId 
      },
      name: String,
      identifier: String // employee code, email, etc.
    },
    oldValues: {
      type: mongoose.Schema.Types.Mixed
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed
    },
    changedFields: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }],
    metadata: {
      ipAddress: String,
      userAgent: String,
      sessionId: String,
      requestId: String,
      apiEndpoint: String,
      httpMethod: String,
      responseStatus: Number,
      processingTime: Number, // milliseconds
      location: {
        country: String,
        city: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      },
      deviceInfo: {
        browser: String,
        os: String,
        device: String
      }
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
      index: true
    },
    complianceFlags: [{
      type: String,
      enum: ["GDPR", "SOX", "HIPAA", "PCI_DSS", "ISO27001", "CUSTOM"]
    }],
    success: {
      type: Boolean,
      required: true,
      default: true,
      index: true
    },
    errorCode: String,
    errorMessage: String,
    stackTrace: String,
    tags: [String],
    category: {
      type: String,
      enum: ["SECURITY", "FINANCIAL", "OPERATIONAL", "COMPLIANCE", "SYSTEM"],
      required: true,
      index: true
    },
    severity: {
      type: String,
      enum: ["INFO", "WARNING", "ERROR", "CRITICAL"],
      default: "INFO",
      index: true
    },
    retention: {
      type: String,
      enum: ["1_YEAR", "3_YEARS", "7_YEARS", "PERMANENT"],
      default: "7_YEARS",
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    archivedAt: Date,
    reviewedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    reviewedAt: Date,
    reviewNotes: String
  },
  { 
    timestamps: true
  }
);

// Compound indexes for performance and compliance queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ orgId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ orgId: 1, category: 1, createdAt: -1 });
auditLogSchema.index({ riskLevel: 1, createdAt: -1 });
auditLogSchema.index({ complianceFlags: 1, createdAt: -1 });
auditLogSchema.index({ 'resource.type': 1, 'resource.id': 1, createdAt: -1 });
auditLogSchema.index({ success: 1, severity: 1, createdAt: -1 });
auditLogSchema.index({ retention: 1, createdAt: 1 }); // For retention policy
auditLogSchema.index({ isArchived: 1, createdAt: -1 });

// Virtual for user details
auditLogSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for reviewer details
auditLogSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true
});

// Static method to create audit log
auditLogSchema.statics.createAuditLog = async function(data) {
  try {
    // Determine risk level based on action and resource
    const riskLevel = this.calculateRiskLevel(data.action, data.resource?.type);
    
    // Determine compliance flags
    const complianceFlags = this.getComplianceFlags(data.action, data.resource?.type);
    
    // Determine retention period
    const retention = this.getRetentionPeriod(data.action, data.category);
    
    const auditLog = await this.create({
      userId: data.userId,
      orgId: data.orgId,
      action: data.action,
      resource: data.resource,
      oldValues: data.oldValues,
      newValues: data.newValues,
      changedFields: data.changedFields,
      metadata: data.metadata || {},
      riskLevel,
      complianceFlags,
      success: data.success !== false,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      stackTrace: data.stackTrace,
      tags: data.tags || [],
      category: data.category || 'OPERATIONAL',
      severity: data.severity || 'INFO',
      retention
    });

    // Alert on high-risk activities
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      await this.alertHighRiskActivity(auditLog);
    }

    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking main functionality
    return null;
  }
};

// Static method to calculate risk level
auditLogSchema.statics.calculateRiskLevel = function(action, resourceType) {
  const highRiskActions = [
    'DELETE', 'BULK_DELETE', 'USER_DELETE', 'ORG_DELETE', 
    'PAYROLL_PAY', 'ROLE_CHANGE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE',
    'BACKUP_RESTORE', 'DATABASE_MIGRATION', 'CONFIG_CHANGE'
  ];
  
  const criticalRiskActions = [
    'SYSTEM_UPDATE', 'SECURITY_SCAN', 'GDPR_REQUEST', 'DATA_EXPORT'
  ];
  
  const financialResources = ['payroll', 'expense'];
  
  if (criticalRiskActions.includes(action)) return 'CRITICAL';
  if (highRiskActions.includes(action)) return 'HIGH';
  if (financialResources.includes(resourceType)) return 'HIGH';
  if (action.includes('DELETE') || action.includes('REMOVE')) return 'MEDIUM';
  
  return 'LOW';
};

// Static method to get compliance flags
auditLogSchema.statics.getComplianceFlags = function(action, resourceType) {
  const flags = [];
  
  // GDPR compliance
  if (['DATA_EXPORT', 'DATA_IMPORT', 'GDPR_REQUEST', 'USER_DELETE'].includes(action)) {
    flags.push('GDPR');
  }
  
  // SOX compliance (financial data)
  if (['payroll', 'expense'].includes(resourceType) || action.includes('PAYROLL') || action.includes('EXPENSE')) {
    flags.push('SOX');
  }
  
  // ISO27001 (security)
  if (['SECURITY_SCAN', 'ROLE_CHANGE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE'].includes(action)) {
    flags.push('ISO27001');
  }
  
  return flags;
};

// Static method to get retention period
auditLogSchema.statics.getRetentionPeriod = function(action, category) {
  if (category === 'FINANCIAL') return '7_YEARS';
  if (category === 'SECURITY') return '7_YEARS';
  if (category === 'COMPLIANCE') return 'PERMANENT';
  if (['GDPR_REQUEST', 'AUDIT_EXPORT'].includes(action)) return 'PERMANENT';
  
  return '3_YEARS';
};

// Static method to alert high-risk activity
auditLogSchema.statics.alertHighRiskActivity = async function(auditLog) {
  const Notification = mongoose.model('Notification');
  
  // Find all super admins and admins in the organization
  const User = mongoose.model('User');
  const admins = await User.find({
    orgId: auditLog.orgId,
    role: { $in: ['super_admin', 'admin'] },
    isActive: true
  }).lean();
  
  // Create notifications for admins
  const notifications = admins.map(admin => ({
    title: 'High-Risk Activity Detected',
    message: `High-risk action "${auditLog.action}" performed on ${auditLog.resource.type}`,
    type: 'warning',
    priority: 'high',
    recipientId: admin._id,
    senderId: auditLog.userId,
    orgId: auditLog.orgId,
    relatedEntity: {
      entityType: 'audit_log',
      entityId: auditLog._id
    },
    actionUrl: `/audit-logs/${auditLog._id}`
  }));
  
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
  
  // Emit real-time alert
  const io = global.io;
  if (io) {
    io.to(`org_${auditLog.orgId}`).emit('security_alert', {
      id: auditLog._id,
      action: auditLog.action,
      riskLevel: auditLog.riskLevel,
      userId: auditLog.userId,
      createdAt: auditLog.createdAt
    });
  }
};

// Static method to get audit trail for resource
auditLogSchema.statics.getResourceAuditTrail = function(resourceType, resourceId, limit = 50) {
  return this.find({
    'resource.type': resourceType,
    'resource.id': resourceId
  })
  .populate('user', 'name email')
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();
};

// Static method to get compliance report
auditLogSchema.statics.getComplianceReport = async function(orgId, options = {}) {
  const query = { orgId };
  
  if (options.complianceFlag) {
    query.complianceFlags = options.complianceFlag;
  }
  
  if (options.startDate && options.endDate) {
    query.createdAt = {
      $gte: new Date(options.startDate),
      $lte: new Date(options.endDate)
    };
  }
  
  const report = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          action: '$action',
          category: '$category',
          riskLevel: '$riskLevel'
        },
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: ['$success', 1, 0] }
        },
        failureCount: {
          $sum: { $cond: ['$success', 0, 1] }
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return report;
};

// Static method to archive old logs
auditLogSchema.statics.archiveOldLogs = async function(retentionPolicy = '7_YEARS') {
  const retentionDays = {
    '1_YEAR': 365,
    '3_YEARS': 1095,
    '7_YEARS': 2555,
    'PERMANENT': null
  };
  
  const days = retentionDays[retentionPolicy];
  if (!days) return 0; // Don't archive permanent records
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const result = await this.updateMany(
    {
      retention: retentionPolicy,
      createdAt: { $lt: cutoffDate },
      isArchived: false
    },
    {
      isArchived: true,
      archivedAt: new Date()
    }
  );
  
  return result.modifiedCount;
};

// Static method to export audit logs for compliance
auditLogSchema.statics.exportForCompliance = async function(orgId, options = {}) {
  const query = { orgId, isArchived: false };
  
  if (options.complianceFlag) {
    query.complianceFlags = options.complianceFlag;
  }
  
  if (options.startDate && options.endDate) {
    query.createdAt = {
      $gte: new Date(options.startDate),
      $lte: new Date(options.endDate)
    };
  }
  
  return this.find(query)
    .populate('user', 'name email')
    .populate('reviewer', 'name email')
    .sort({ createdAt: -1 })
    .lean();
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;