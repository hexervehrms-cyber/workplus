import mongoose from "mongoose";

const fnfSettlementSchema = new mongoose.Schema(
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
    // Termination details
    terminationDate: {
      type: Date,
      required: true,
      index: true
    },
    terminationReason: {
      type: String,
      enum: ["resignation", "termination", "retirement", "death", "other"],
      required: true
    },
    terminationReasonDetails: String,
    // Calculation details
    joiningDate: Date,
    yearsOfService: Number,
    // Earnings
    earnings: {
      baseSalary: Number,
      hra: Number,
      allowances: Number,
      bonus: Number,
      incentives: Number,
      totalEarnings: Number,
      earnedTillTermination: Number
    },
    // Leave encashment
    leaveEncashment: {
      totalLeaveBalance: Number,
      leaveEncashmentRate: Number,
      totalLeaveEncashment: Number,
      breakdown: [
        {
          leaveType: String,
          balance: Number,
          rate: Number,
          amount: Number
        }
      ]
    },
    // Gratuity
    gratuity: {
      eligible: Boolean,
      yearsOfServiceRequired: Number,
      gratuityRate: Number,
      gratuityAmount: Number,
      reason: String
    },
    // Severance
    severancePay: {
      eligible: Boolean,
      days: Number,
      dailyRate: Number,
      amount: Number,
      reason: String
    },
    // Deductions
    deductions: {
      advanceSalary: Number,
      loans: Number,
      bonds: Number,
      tax: Number,
      insurance: Number,
      otherDeductions: Number,
      totalDeductions: Number,
      breakdown: [
        {
          type: String,
          amount: Number,
          description: String
        }
      ]
    },
    // Final settlement
    totalEarnings: Number,
    totalDeductions: Number,
    netSettlement: Number,
    // Status
    status: {
      type: String,
      enum: ["draft", "calculated", "approved", "paid", "rejected"],
      default: "draft",
      index: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    approvedDate: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    paidDate: Date,
    rejectionReason: String,
    // Documents
    fnfLetterGenerated: {
      type: Boolean,
      default: false
    },
    fnfLetterPath: String,
    // Notes
    notes: String,
    orgId: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Compound indexes
fnfSettlementSchema.index({ employeeId: 1, orgId: 1 });
fnfSettlementSchema.index({ userId: 1, orgId: 1 });
fnfSettlementSchema.index({ orgId: 1, status: 1, terminationDate: -1 });
fnfSettlementSchema.index({ status: 1, terminationDate: -1 });

// Static method to find by employee
fnfSettlementSchema.statics.findByEmployee = function (employeeId, orgId) {
  return this.findOne({ employeeId, orgId }).sort({ createdAt: -1 });
};

export default mongoose.model("FNFSettlement", fnfSettlementSchema);
