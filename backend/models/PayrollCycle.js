import mongoose from "mongoose";

const payrollCycleSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      required: true,
      index: true
    },
    cycleNumber: {
      type: Number,
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true
    },
    // Payroll cycle: 21st of current month to 20th of next month
    cycleStartDate: {
      type: Date,
      required: true
    },
    cycleEndDate: {
      type: Date,
      required: true
    },
    // Salary release date: 1st of next month
    salaryReleaseDate: {
      type: Date,
      required: true
    },
    // Salary hold: 10 days after release
    salaryHoldUntil: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["draft", "active", "locked", "processed", "released"],
      default: "draft"
    },
    totalEmployees: {
      type: Number,
      default: 0
    },
    totalPayroll: {
      type: Number,
      default: 0
    },
    totalDeductions: {
      type: Number,
      default: 0
    },
    totalNetPayable: {
      type: Number,
      default: 0
    },
    processedAt: {
      type: Date
    },
    releasedAt: {
      type: Date
    },
    lockedAt: {
      type: Date
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
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
payrollCycleSchema.index({ orgId: 1, year: 1, month: 1 }, { unique: true });
payrollCycleSchema.index({ orgId: 1, status: 1 });
payrollCycleSchema.index({ cycleStartDate: 1, cycleEndDate: 1 });

export default mongoose.model("PayrollCycle", payrollCycleSchema);
