import mongoose from "mongoose";

const salaryStructureSchema = new mongoose.Schema(
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
    employeeType: {
      type: String,
      enum: ["intern", "employee", "manager", "director"],
      required: true
    },
    orgId: {
      type: String,
      required: true,
      index: true
    },
    location: {
      type: String,
      default: "Noida",
      required: true
    },
    effectiveFrom: {
      type: Date,
      required: true
    },
    effectiveTo: {
      type: Date
    },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "rejected"],
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
    // Earnings
    earnings: {
      basic: {
        type: Number,
        default: 0,
        description: "Basic salary"
      },
      hra: {
        type: Number,
        default: 0,
        description: "House Rent Allowance"
      },
      medicalExpenses: {
        type: Number,
        default: 0,
        description: "Medical expenses allowance"
      },
      travel: {
        type: Number,
        default: 0,
        description: "Travel allowance"
      },
      internetCharges: {
        type: Number,
        default: 0,
        description: "Internet charges allowance"
      },
      nightShiftAllowance: {
        type: Number,
        default: 0,
        description: "Night shift allowance"
      },
      incentives: {
        type: Number,
        default: 0,
        description: "Performance incentives"
      },
      bonus: {
        type: Number,
        default: 0,
        description: "Annual bonus"
      },
      commission: {
        type: Number,
        default: 0,
        description: "Sales commission"
      },
      otherEarnings: [
        {
          name: String,
          amount: Number,
          description: String
        }
      ]
    },
    // Deductions
    deductions: {
      providentFund: {
        type: Number,
        default: 0,
        description: "PF contribution (12% of basic)"
      },
      employeeStateInsurance: {
        type: Number,
        default: 0,
        description: "ESI contribution"
      },
      professionalTax: {
        type: Number,
        default: 0,
        description: "Professional tax"
      },
      incomeTax: {
        type: Number,
        default: 0,
        description: "Income tax"
      },
      otherDeductions: [
        {
          name: String,
          amount: Number,
          description: String
        }
      ]
    },
    // Calculated fields
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
    costToCompany: {
      type: Number,
      default: 0
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
salaryStructureSchema.index({ orgId: 1, employeeId: 1, status: 1 });
salaryStructureSchema.index({ userId: 1, status: 1 });
salaryStructureSchema.index({ orgId: 1, status: 1, effectiveFrom: -1 });

export default mongoose.model("SalaryStructure", salaryStructureSchema);
