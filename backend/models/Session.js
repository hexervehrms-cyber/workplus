import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    refreshToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    deviceInfo: {
      userAgent: { type: String },
      ip: { type: String, index: true },
      device: { type: String },
      browser: { type: String },
      os: { type: String },
      location: {
        country: { type: String },
        city: { type: String },
        timezone: { type: String }
      }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    logoutAt: {
      type: Date,
      default: null
    },
    orgId: {
      type: String,
      required: true,
      index: true
    },
    // Security flags
    isSuspicious: {
      type: Boolean,
      default: false
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    // Session metadata
    metadata: {
      loginMethod: {
        type: String,
        enum: ['password', 'sso', 'token', 'biometric'],
        default: 'password'
      },
      twoFactorVerified: {
        type: Boolean,
        default: false
      },
      permissions: [{
        type: String
      }],
      features: [{
        type: String
      }]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ orgId: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
sessionSchema.index({ lastActivity: 1 });
sessionSchema.index({ 'deviceInfo.ip': 1, userId: 1 });

// Virtual for user details
sessionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Method to check if session is expired
sessionSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Method to extend session
sessionSchema.methods.extend = function(hours = 24) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  this.lastActivity = new Date();
  return this.save();
};

// Static method to cleanup expired sessions
sessionSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isActive: false, logoutAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
    ]
  });
};

// Static method to find active sessions for user
sessionSchema.statics.findActiveForUser = function(userId) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};

const Session = mongoose.model("Session", sessionSchema);

export default Session;