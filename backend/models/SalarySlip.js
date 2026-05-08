import mongoose from "mongoose";

const salarySlipSchema = new mongoose.Schema(
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
    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryStructure",
      required: true
    },
    orgId: {
      type: String,
      required: true,
      index: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "processed", "paid"],
      default: "draft"
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    approvalDate: {
      type: Date
    },
    // Attendance data
    attendanceData: {
      totalWorkingDays: {
        type: Number,
        default: 0
      },
      presentDays: {
        type: Number,
        default: 0
      },
      absentDays: {
        type: Number,
        default: 0
      },
      leavesTaken: {
        type: Number,
        default: 0
      },
      halfDays: {
        type: Number,
        default: 0
      }
    },
    // Earnings breakdown
    earnings: {
      basic: {
        type: Number,
        default: 0
      },
      hra: {
        type: Number,
        default: 0
      },
      medicalExpenses: {
        type: Number,
        default: 0
      },
      travel: {
        type: Number,
        default: 0
      },
      internetCharges: {
        type: Number,
        default: 0
      },
      nightShiftAllowance: {
        type: Number,
        default: 0
      },
      incentives: {
        type: Number,
        default: 0
      },
      bonus: {
        type: Number,
        default: 0
      },
      commission: {
        type: Number,
        default: 0
      },
      otherEarnings: [
        {
          name: String,
          amount: Number
        }
      ]
    },
    // Deductions breakdown
    deductions: {
      providentFund: {
        type: Number,
        default: 0
      },
      employeeStateInsurance: {
        type: Number,
        default: 0
      },
      professionalTax: {
        type: Number,
        default: 0
      },
      incomeTax: {
        type: Number,
        default: 0
      },
      leaveDeduction: {
        type: Number,
        default: 0,
        description: "Deduction for leaves taken"
      },
      otherDeductions: [
        {
          name: String,
          amount: Number
        }
      ]
    },
    // Totals
    grossEarnings: {
      type: Number,
      default: 0
    },
    totalDeductions: {
      type: Number,
      default: 0
    },
    netSalary: {
      type: Number,
      default: 0
    },
    // Additional info
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      bankName: String
    },
    notes: {
      type: String
    },
    downloadedAt: {
      type: Date
    },
    downloadCount: {
      type: Number,
      default: 0
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

// Unique index: one salary slip per employee per month per year
salarySlipSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
salarySlipSchema.index({ orgId: 1, month: 1, year: 1 });
salarySlipSchema.index({ userId: 1, month: 1, year: 1 });
salarySlipSchema.index({ status: 1, year: 1, month: 1 });

export default mongoose.model("SalarySlip", salarySlipSchema);
