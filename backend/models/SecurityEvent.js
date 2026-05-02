import mongoose from "mongoose";

const securityEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      default: () => `SEC-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'login_success', 'login_failed', 'logout', 'password_change', 'password_reset',
        'account_locked', 'account_unlocked', 'two_factor_enabled', 'two_factor_disabled',
        'suspicious_login', 'brute_force_attempt', 'token_revoked', 'permission_denied',
        'data_access', 'data_modification', 'admin_action', 'security_breach',
        'unusual_activity', 'device_registered', 'device_removed'
      ],
      index: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true
    },
    // User and target information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    // Event details
    description: {
      type: String,
      required: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Request context
    requestInfo: {
      ip: { type: String, index: true },
      userAgent: { type: String },
      method: { type: String },
      url: { type: String },
      headers: { type: mongoose.Schema.Types.Mixed },
      body: { type: mongoose.Schema.Types.Mixed, select: false } // Sensitive data
    },
    // Device and location
    deviceInfo: {
      deviceId: { type: String },
      deviceName: { type: String },
      platform: { type: String },
      browser: { type: String },
      version: { type: String }
    },
    locationInfo: {
      country: { type: String },
      region: { type: String },
      city: { type: String },
      timezone: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number }
      }
    },
    // Security analysis
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true
    },
    riskFactors: [{
      factor: { type: String },
      score: { type: Number },
      description: { type: String }
    }],
    // Status and resolution
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'false_positive', 'ignored'],
      default: 'open',
      index: true
    },
    resolution: {
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      resolvedAt: { type: Date },
      resolution: { type: String },
      notes: { type: String }
    },
    // Automated response
    autoResponse: {
      triggered: { type: Boolean, default: false },
      actions: [{ type: String }],
      timestamp: { type: Date }
    },
    // Related events
    relatedEvents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "SecurityEvent"
    }],
    // Organization context
    orgId: {
      type: String,
      required: true,
      index: true
    },
    // Compliance and retention
    compliance: {
      category: { type: String },
      retentionDate: { type: Date },
      exported: { type: Boolean, default: false },
      exportedAt: { type: Date }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
securityEventSchema.index({ orgId: 1, eventType: 1, createdAt: -1 });
securityEventSchema.index({ userId: 1, createdAt: -1 });
securityEventSchema.index({ severity: 1, status: 1 });
securityEventSchema.index({ riskScore: -1, createdAt: -1 });
securityEventSchema.index({ 'requestInfo.ip': 1, createdAt: -1 });
securityEventSchema.index({ createdAt: -1 }); // For time-based queries

// Text search index
securityEventSchema.index({
  description: 'text',
  'details.message': 'text',
  'resolution.notes': 'text'
});

// Virtual for user details
securityEventSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for target user details
securityEventSchema.virtual('targetUser', {
  ref: 'User',
  localField: 'targetUserId',
  foreignField: '_id',
  justOne: true
});

// Method to calculate risk score
securityEventSchema.methods.calculateRiskScore = function() {
  let score = 0;
  
  // Base score by event type
  const eventTypeScores = {
    'login_failed': 10,
    'brute_force_attempt': 50,
    'suspicious_login': 40,
    'account_locked': 30,
    'security_breach': 90,
    'permission_denied': 20,
    'unusual_activity': 35,
    'login_success': 5,
    'logout': 0,
    'password_change': 15,
    'two_factor_enabled': -10, // Reduces risk
    'admin_action': 25
  };
  
  score += eventTypeScores[this.eventType] || 10;
  
  // Risk factors
  this.riskFactors.forEach(factor => {
    score += factor.score;
  });
  
  // Location-based risk
  if (this.locationInfo && this.details.isNewLocation) {
    score += 20;
  }
  
  // Time-based risk (unusual hours)
  const hour = new Date(this.createdAt).getHours();
  if (hour < 6 || hour > 22) {
    score += 15;
  }
  
  // Device-based risk
  if (this.details.isNewDevice) {
    score += 25;
  }
  
  // Frequency-based risk
  if (this.details.recentFailures && this.details.recentFailures > 3) {
    score += this.details.recentFailures * 5;
  }
  
  this.riskScore = Math.min(100, Math.max(0, score));
  return this.riskScore;
};

// Method to add risk factor
securityEventSchema.methods.addRiskFactor = function(factor, score, description) {
  this.riskFactors.push({ factor, score, description });
  this.calculateRiskScore();
  return this.save();
};

// Method to resolve event
securityEventSchema.methods.resolve = function(resolvedBy, resolution, notes) {
  this.status = 'resolved';
  this.resolution = {
    resolvedBy,
    resolvedAt: new Date(),
    resolution,
    notes
  };
  return this.save();
};

// Static method to create security event
securityEventSchema.statics.createEvent = async function(eventData) {
  const event = new this(eventData);
  event.calculateRiskScore();
  
  // Auto-trigger responses for high-risk events
  if (event.riskScore >= 70) {
    event.autoResponse = {
      triggered: true,
      actions: await this.getAutoResponseActions(event),
      timestamp: new Date()
    };
  }
  
  return event.save();
};

// Static method to get auto-response actions
securityEventSchema.statics.getAutoResponseActions = async function(event) {
  const actions = [];
  
  if (event.eventType === 'brute_force_attempt' || event.riskScore >= 80) {
    actions.push('lock_account');
    actions.push('notify_admin');
  }
  
  if (event.eventType === 'suspicious_login') {
    actions.push('require_2fa');
    actions.push('notify_user');
  }
  
  if (event.riskScore >= 90) {
    actions.push('revoke_all_tokens');
    actions.push('emergency_notification');
  }
  
  return actions;
};

// Static method to find recent events for user
securityEventSchema.statics.findRecentForUser = function(userId, hours = 24, eventTypes = null) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const filter = { userId, createdAt: { $gte: since } };
  
  if (eventTypes) {
    filter.eventType = { $in: eventTypes };
  }
  
  return this.find(filter).sort({ createdAt: -1 });
};

// Static method to find high-risk events
securityEventSchema.statics.findHighRisk = function(orgId, minRiskScore = 70) {
  return this.find({
    orgId,
    riskScore: { $gte: minRiskScore },
    status: { $in: ['open', 'investigating'] }
  })
  .populate('user', 'name email')
  .sort({ riskScore: -1, createdAt: -1 });
};

// Static method to get security summary
securityEventSchema.statics.getSecuritySummary = async function(orgId, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const summary = await this.aggregate([
    { $match: { orgId, createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        highRiskEvents: {
          $sum: { $cond: [{ $gte: ['$riskScore', 70] }, 1, 0] }
        },
        criticalEvents: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        },
        avgRiskScore: { $avg: '$riskScore' },
        eventTypes: { $addToSet: '$eventType' }
      }
    }
  ]);
  
  return summary[0] || {
    totalEvents: 0,
    highRiskEvents: 0,
    criticalEvents: 0,
    avgRiskScore: 0,
    eventTypes: []
  };
};

const SecurityEvent = mongoose.model("SecurityEvent", securityEventSchema);

export default SecurityEvent;