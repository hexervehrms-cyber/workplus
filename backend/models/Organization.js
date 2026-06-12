import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: [100, 'Organization name cannot exceed 100 characters']
    },
    code: { 
      type: String, 
      unique: true, 
      required: true,
      uppercase: true,
      trim: true
    },
    email: { 
      type: String, 
      required: [true, 'Organization email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    phone: { 
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    },
    website: { 
      type: String,
      trim: true
    },
    logo: { 
      type: String,
      default: null
    },
    industry: { 
      type: String,
      trim: true
    },
    employeeCount: { 
      type: Number,
      default: 0,
      min: [0, 'Employee count cannot be negative']
    },
    subscriptionPlan: {
      type: String,
      enum: ["free", "basic", "premium", "enterprise"],
      default: "free"
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "suspended", "trial"],
      default: "trial"
    },
    subscriptionExpiresAt: {
      type: Date
    },
    settings: {
      workingHours: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" }
      },
      workingDays: {
        type: [String],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      },
      timezone: { type: String, default: "UTC" },
      currency: { type: String, default: "INR" },
      expenseLimits: {
        enabled: { type: Boolean, default: true },
        defaultDailyLimit: { type: Number, default: 5000 },
        defaultMonthlyLimit: { type: Number, default: 50000 },
        maxSingleClaim: { type: Number, default: 25000 },
        maxClaimAgeDays: { type: Number, default: 90 },
        requireReceiptAbove: { type: Number, default: 500 },
        categoryLimits: { type: mongoose.Schema.Types.Mixed, default: {} }
      },
      dateFormat: { type: String, default: "DD/MM/YYYY" },
      allowRemoteWork: { type: Boolean, default: false },
      requireCheckInLocation: { type: Boolean, default: false },
      integrations: {
        smtp: {
          useCustom: { type: Boolean, default: false },
          host: { type: String, default: '' },
          port: { type: Number, default: 587 },
          secure: { type: Boolean, default: false },
          user: { type: String, default: '' },
          pass: { type: String, default: '' },
          fromEmail: { type: String, default: '' },
          fromName: { type: String, default: '' }
        },
        teams: {
          enabled: { type: Boolean, default: false },
          webhookUrl: { type: String, default: '' }
        }
      },
      notificationRouting: {
        notifyAdminsOnLeaveSubmit: { type: Boolean, default: true },
        notifyAdminsOnExpenseSubmit: { type: Boolean, default: true },
        notifyEmployeeOnLeaveDecision: { type: Boolean, default: true },
        notifyEmployeeOnExpenseDecision: { type: Boolean, default: true },
        adminRoles: {
          type: [String],
          default: ['admin', 'hr', 'manager']
        }
      }
    },
    // Custom domain support
    customDomain: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true
    },
    customDomainStatus: {
      type: String,
      enum: ['not_configured', 'pending', 'verified', 'failed'],
      default: 'not_configured'
    },
    customDomainDnsRecords: [{
      type: { type: String, enum: ['CNAME', 'A', 'MX'] },
      name: String,
      value: String,
      status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' }
    }],
    isActive: { 
      type: Boolean, 
      default: true 
    },
    createdBy: { 
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

// Indexes for performance
organizationSchema.index({ code: 1 }, { unique: true });
organizationSchema.index({ email: 1 });
organizationSchema.index({ name: 1 });
organizationSchema.index({ subscriptionStatus: 1 });
organizationSchema.index({ createdAt: -1 });

// Virtual for active employees count
organizationSchema.virtual('activeEmployees', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'orgId',
  count: true,
  match: { status: 'active' }
});

// Static method to find active organizations
organizationSchema.statics.findActive = function() {
  return this.find({ isActive: true }).lean();
};

// Method to check if subscription is active
organizationSchema.methods.hasActiveSubscription = function() {
  return this.subscriptionStatus === 'active' && 
         (!this.subscriptionExpiresAt || this.subscriptionExpiresAt > new Date());
};

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;