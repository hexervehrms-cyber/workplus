import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      unique: true 
    },
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    employeeCode: { 
      type: String, 
      uppercase: true,
      trim: true,
      default: null,
      index: true // Index for searching but not unique
    },
    designation: { 
      type: String,
      trim: true
    },
    department: { 
      type: String,
      trim: true,
      index: true // Index for department queries
    },
    workLocation: {
      type: String,
      trim: true,
      default: ''
    },
    baseSalary: { 
      type: Number, 
      default: 0,
      min: [0, 'Salary cannot be negative']
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: [0, 'Hourly rate cannot be negative'],
      description: "Hourly rate for salary calculation based on working hours"
    },
    salaryCalculationType: {
      type: String,
      enum: ['fixed', 'hourly', 'daily'],
      default: 'fixed',
      description: "How salary is calculated: fixed (baseSalary), hourly (hourlyRate × hours), or daily (dailyRate × days)"
    },
    dailyRate: {
      type: Number,
      default: 0,
      min: [0, 'Daily rate cannot be negative'],
      description: "Daily rate for salary calculation based on working days"
    },
    hra: { 
      type: Number, 
      default: 0,
      min: [0, 'HRA cannot be negative']
    },
    bonus: { 
      type: Number, 
      default: 0 
    },
    incentives: { 
      type: Number, 
      default: 0 
    },
    allowances: { 
      type: Number, 
      default: 0 
    },
    providentFund: { 
      type: Number, 
      default: 0 
    },
    tax: { 
      type: Number, 
      default: 0 
    },
    insurance: { 
      type: Number, 
      default: 0 
    },
    otherDeductions: { 
      type: Number, 
      default: 0 
    },
    joiningDate: { 
      type: Date,
      index: true // Index for date-based queries
    },
    phone: { 
      type: String,
      trim: true
    },
    address: { 
      type: String,
      trim: true
    },
    bankDetails: {
      accountNumber: {
        type: String,
        trim: true
      },
      bankName: {
        type: String,
        trim: true
      },
      ifscCode: {
        type: String,
        trim: true
      },
      accountHolderName: {
        type: String,
        trim: true
      }
    },
    status: { 
      type: String, 
      enum: ["active", "inactive", "terminated"], 
      default: "active",
      index: true // Index for status queries
    },
    createdViaOnboarding: {
      type: Boolean,
      default: false,
      index: true
    },
    orgId: {
      type: String,
      index: true // Index for tenant queries
    },
    // Sensitive Information Fields
    aadharNumber: {
      type: String,
      trim: true,
      default: null
    },
    panNumber: {
      type: String,
      trim: true,
      default: null
    },
    bankAccount: {
      type: String,
      trim: true,
      default: null
    },
    ifscCode: {
      type: String,
      trim: true,
      default: null
    },
    // Lock timestamps for sensitive information (12-hour lock after update)
    sensitiveInfoLocks: {
      aadharNumber: {
        type: Number,
        default: null
      },
      panNumber: {
        type: Number,
        default: null
      },
      bankAccount: {
        type: Number,
        default: null
      },
      ifscCode: {
        type: Number,
        default: null
      }
    },
    // Shift Timing Configuration
    shiftTiming: {
      startTime: {
        type: String, // Format: "HH:MM" (24-hour format)
        default: "09:00",
        description: "Shift start time in HH:MM format"
      },
      endTime: {
        type: String, // Format: "HH:MM" (24-hour format)
        default: "18:00",
        description: "Shift end time in HH:MM format"
      },
      lateThreshold: {
        type: Number, // in minutes
        default: 0,
        description: "Minutes after shift start time to mark as late (0 = no grace period)"
      },
      workingDays: {
        type: [String], // ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        description: "Days of the week when employee is expected to work"
      }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for common queries
employeeSchema.index({ orgId: 1, status: 1 });
employeeSchema.index({ orgId: 1, department: 1 });
employeeSchema.index({ userId: 1 }, { unique: true });
employeeSchema.index({ employeeCode: 1 }, { 
  unique: true, 
  sparse: true,
  partialFilterExpression: { employeeCode: { $exists: true, $ne: null } }
});

// Virtual for user details
employeeSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Static method to find active employees
employeeSchema.statics.findActive = function(orgId) {
  return this.find({ status: 'active', orgId })
    .populate('userId', 'name email avatar role')
    .lean();
};

// Static method to find by department
employeeSchema.statics.findByDepartment = function(department, orgId) {
  return this.find({ department, orgId, status: 'active' })
    .populate('userId', 'name email avatar')
    .lean();
};

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
