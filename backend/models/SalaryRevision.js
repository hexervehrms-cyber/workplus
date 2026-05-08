import mongoose from "mongoose";

const salaryRevisionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    orgId: {
      type: String,
      required: true,
      index: true
    },
    // Revision details
    revisionType: {
      type: String,
      enum: [
        "increment",
        "promotion",
        "demotion",
        "ppo_conversion",
        "internship_to_employee",
        "salary_adjustment",
        "mid_cycle_change"
      ],
      required: true
    },
    effectiveFrom: {
      type: Date,
      required: true
    },
    effectiveTo: {
      type: Date
    },
    // Previous salary structure
    previousSalaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryStructure"
    },
    previousBasic: {
      type: Number,
      required: true
    },
    previousGrossEarnings: {
      type: Number,
      required: true
    },
    // New salary structure
    newSalaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryStructure"
    },
    newBasic: {
      type: Number,
      required: true
    },
    newGrossEarnings: {
      type: Number,
      required: true
    },
    // Revision details
    reason: {
      type: String,
      required: true
    },
    incrementPercentage: {
      type: Number,
      default: 0
    },
    incrementAmount: {
      type: Number,
      default: 0
    },
    // Approval workflow
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "rejected", "implemented"],
      default: "draft"
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    approvalDate: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    // Payroll cycle impact
    payrollCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollCycle"
    },
    isMidCycleChange: {
      type: Boolean,
      default: false
    },
    // For mid-cycle changes: split calculation details
    splitCalculationDetails: {
      periodOneStartDate: Date,
      periodOneEndDate: Date,
      periodOneBasic: Number,
      periodOneGrossEarnings: Number,
      periodTwoStartDate: Date,
      periodTwoEndDate: Date,
      periodTwoBasic: Number,
      periodTwoGrossEarnings: Number
    },
    // Audit trail
    documentUrl: {
      type: String
    },
    notes: {
      type: String
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Index for common queries
salaryRevisionSchema.index({ employeeId: 1, effectiveFrom: -1 });
salaryRevisionSchema.index({ userId: 1, status: 1 });
salaryRevisionSchema.index({ orgId: 1, status: 1 });
salaryRevisionSchema.index({ effectiveFrom: 1, effectiveTo: 1 });

export default mongoose.model("SalaryRevision", salaryRevisionSchema);
