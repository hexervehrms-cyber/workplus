import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    orgId: { 
      type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Authentication
        "login", "logout", "password_change", "password_reset",
        
        // Employee Management
        "employee_create", "employee_update", "employee_delete", "employee_activate", "employee_deactivate",
        
        // Attendance
        "attendance_checkin", "attendance_checkout", "attendance_break_start", "attendance_break_end",
        "attendance_correction", "attendance_approve", "attendance_reject",
        
        // Leave Management
        "leave_apply", "leave_approve", "leave_reject", "leave_cancel", "leave_update",
        
        // Payroll
        "payroll_generate", "payroll_approve", "payroll_pay", "payroll_delete",
        
        // Expenses
        "expense_submit", "expense_approve", "expense_reject", "expense_delete",
        
        // Tasks
        "task_create", "task_assign", "task_update", "task_complete", "task_delete",
        
        // Announcements
        "announcement_create", "announcement_publish", "announcement_update", "announcement_delete",
        
        // Documents
        "document_upload", "document_download", "document_delete", "document_share",
        
        // System
        "system_backup", "system_restore", "system_update", "system_maintenance",
        
        // Organization
        "org_create", "org_update", "org_delete", "org_settings_update",
        
        // Department
        "dept_create", "dept_update", "dept_delete",
        
        // Other
        "profile_update", "settings_update", "notification_read", "file_upload", "file_delete"
      ],
      index: true
    },
    entity: {
      entityType: {
        type: String,
        enum: [
          "user", "employee", "attendance", "leave_request", "payroll", "expense",
          "task", "announcement", "document", "organization", "department", "system"
        ]
      },
      entityId: { 
        type: mongoose.Schema.Types.ObjectId 
      },
      entityName: String
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed }
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    location: {
      country: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    deviceInfo: {
      type: String,
      trim: true
    },
    sessionId: {
      type: String,
      trim: true,
      index: true
    },
    success: {
      type: Boolean,
      default: true,
      index: true
    },
    errorMessage: {
      type: String,
      trim: true
    },
    duration: {
      type: Number, // in milliseconds
      min: 0
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true
    },
    category: {
      type: String,
      enum: ["security", "data", "system", "user", "admin"],
      default: "user",
      index: true
    }
  },
  { 
    timestamps: true
  }
);

// Compound indexes for performance
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ orgId: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ orgId: 1, category: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, success: 1, createdAt: -1 });
activityLogSchema.index({ severity: 1, createdAt: -1 });
activityLogSchema.index({ sessionId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 }); // For cleanup

// TTL index for automatic cleanup (keep logs for 1 year)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Virtual for user details
activityLogSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Static method to log activity
activityLogSchema.statics.logActivity = async function(data) {
  try {
    const log = await this.create({
      userId: data.userId,
      orgId: data.orgId,
      action: data.action,
      entity: data.entity,
      details: data.details || {},
      changes: data.changes,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      location: data.location,
      deviceInfo: data.deviceInfo,
      sessionId: data.sessionId,
      success: data.success !== false, // default to true
      errorMessage: data.errorMessage,
      duration: data.duration,
      severity: data.severity || 'low',
      category: data.category || 'user'
    });

    // Emit real-time activity update for admins
    const io = global.io;
    if (io && data.severity === 'high' || data.severity === 'critical') {
      io.to('admins').emit('activity_alert', {
        id: log._id,
        action: log.action,
        userId: log.userId,
        severity: log.severity,
        createdAt: log.createdAt,
        details: log.details
      });
    }

    return log;
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error to avoid breaking main functionality
    return null;
  }
};

// Static method to get user activity
activityLogSchema.statics.getUserActivity = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get organization activity
activityLogSchema.statics.getOrgActivity = function(orgId, options = {}) {
  const query = { orgId };
  
  if (options.action) query.action = options.action;
  if (options.category) query.category = options.category;
  if (options.severity) query.severity = options.severity;
  if (options.success !== undefined) query.success = options.success;
  
  if (options.startDate && options.endDate) {
    query.createdAt = {
      $gte: new Date(options.startDate),
      $lte: new Date(options.endDate)
    };
  }
  
  return this.find(query)
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .lean();
};

// Static method to get security events
activityLogSchema.statics.getSecurityEvents = function(orgId, limit = 100) {
  return this.find({
    orgId,
    $or: [
      { category: 'security' },
      { severity: { $in: ['high', 'critical'] } },
      { success: false },
      { action: { $in: ['login', 'logout', 'password_change', 'password_reset'] } }
    ]
  })
  .populate('user', 'name email')
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();
};

// Static method to get activity statistics
activityLogSchema.statics.getActivityStats = async function(orgId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        orgId: new mongoose.Types.ObjectId(orgId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          action: '$action',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.action',
        totalCount: { $sum: '$count' },
        dailyData: {
          $push: {
            date: '$_id.date',
            count: '$count'
          }
        }
      }
    },
    {
      $sort: { totalCount: -1 }
    }
  ]);
  
  return stats;
};

// Static method to cleanup old logs
activityLogSchema.statics.cleanupOldLogs = async function(daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
};

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;