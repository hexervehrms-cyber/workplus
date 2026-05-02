import mongoose from "mongoose";
import crypto from "crypto";

const authTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tokenType: {
      type: String,
      enum: ['refresh', 'reset_password', 'email_verification', 'two_factor', 'api_key'],
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    hashedToken: {
      type: String,
      required: true,
      select: false
    },
    // Token metadata
    purpose: {
      type: String,
      required: true
    },
    scope: [{
      type: String,
      enum: ['read', 'write', 'admin', 'api', 'mobile']
    }],
    // Expiration and usage
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    usageCount: {
      type: Number,
      default: 0
    },
    maxUsage: {
      type: Number,
      default: 1 // Most tokens are single-use
    },
    // Security metadata
    deviceInfo: {
      userAgent: { type: String },
      ip: { type: String, index: true },
      deviceId: { type: String },
      deviceName: { type: String },
      platform: { type: String },
      browser: { type: String },
      location: {
        country: { type: String },
        city: { type: String },
        timezone: { type: String }
      }
    },
    // Token restrictions
    restrictions: {
      ipWhitelist: [{ type: String }],
      allowedHours: {
        start: { type: String }, // "09:00"
        end: { type: String }   // "17:00"
      },
      allowedDays: [{ type: Number, min: 0, max: 6 }], // 0=Sunday
      maxConcurrentSessions: { type: Number, default: 5 }
    },
    // Status and flags
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    revokedReason: {
      type: String,
      enum: ['user_request', 'security_breach', 'admin_action', 'expired', 'suspicious_activity']
    },
    // Organization context
    orgId: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
authTokenSchema.index({ userId: 1, tokenType: 1, isActive: 1 });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
authTokenSchema.index({ orgId: 1, tokenType: 1 });
authTokenSchema.index({ 'deviceInfo.ip': 1, userId: 1 });
authTokenSchema.index({ isRevoked: 1, isActive: 1 });

// Virtual for user details
authTokenSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Method to check if token is valid
authTokenSchema.methods.isValid = function() {
  return this.isActive && 
         !this.isRevoked && 
         new Date() < this.expiresAt &&
         (this.maxUsage === -1 || this.usageCount < this.maxUsage);
};

// Method to check IP restrictions
authTokenSchema.methods.isIPAllowed = function(ip) {
  if (!this.restrictions.ipWhitelist || this.restrictions.ipWhitelist.length === 0) {
    return true;
  }
  return this.restrictions.ipWhitelist.includes(ip);
};

// Method to check time restrictions
authTokenSchema.methods.isTimeAllowed = function() {
  if (!this.restrictions.allowedHours || !this.restrictions.allowedDays) {
    return true;
  }
  
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().substring(0, 5); // "HH:MM"
  
  // Check day restriction
  if (this.restrictions.allowedDays.length > 0 && 
      !this.restrictions.allowedDays.includes(currentDay)) {
    return false;
  }
  
  // Check time restriction
  if (this.restrictions.allowedHours.start && this.restrictions.allowedHours.end) {
    return currentTime >= this.restrictions.allowedHours.start && 
           currentTime <= this.restrictions.allowedHours.end;
  }
  
  return true;
};

// Method to use token
authTokenSchema.methods.use = function() {
  this.usedAt = new Date();
  this.usageCount += 1;
  
  // Revoke if max usage reached
  if (this.maxUsage !== -1 && this.usageCount >= this.maxUsage) {
    this.isActive = false;
  }
  
  return this.save();
};

// Method to revoke token
authTokenSchema.methods.revoke = function(revokedBy, reason = 'user_request') {
  this.isRevoked = true;
  this.isActive = false;
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokedReason = reason;
  return this.save();
};

// Static method to generate secure token
authTokenSchema.statics.generateToken = function(length = 32) {
  return crypto.randomBytes(length).toString('hex');
};

// Static method to hash token
authTokenSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Static method to create token
authTokenSchema.statics.createToken = async function(tokenData) {
  const token = this.generateToken();
  const hashedToken = this.hashToken(token);
  
  const authToken = await this.create({
    ...tokenData,
    token: token.substring(0, 8) + '...', // Store only prefix for reference
    hashedToken
  });
  
  // Return the full token (only time it's available in plain text)
  return { token, authToken };
};

// Static method to find by token
authTokenSchema.statics.findByToken = async function(token) {
  const hashedToken = this.hashToken(token);
  return this.findOne({ hashedToken, isActive: true, isRevoked: false });
};

// Static method to cleanup expired tokens
authTokenSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    ]
  });
};

// Static method to revoke all user tokens
authTokenSchema.statics.revokeAllUserTokens = function(userId, tokenType = null, revokedBy, reason = 'security_action') {
  const filter = { userId, isActive: true };
  if (tokenType) filter.tokenType = tokenType;
  
  return this.updateMany(filter, {
    $set: {
      isRevoked: true,
      isActive: false,
      revokedAt: new Date(),
      revokedBy,
      revokedReason: reason
    }
  });
};

const AuthToken = mongoose.model("AuthToken", authTokenSchema);

export default AuthToken;