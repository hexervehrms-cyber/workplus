import mongoose from "mongoose";

const salaryCycleSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    // Salary cycle dates
    cycleStartDate: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
      description: "Day of month when salary cycle starts (1-31)"
    },
    cycleEndDate: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
      description: "Day of month when salary cycle ends (1-31)"
    },
    salaryPaymentDate: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
      description: "Day of month when salary is paid (1-31)"
    },
    // Hold period (days to hold salary)
    holdDays: {
      type: Number,
      default: 0,
      min: 0,
      description: "Number of days to hold salary after cycle end"
    },
    // Working days configuration
    workingDaysPerWeek: {
      type: Number,
      default: 5,
      min: 1,
      max: 7
    },
    workingDaysPerMonth: {
      type: Number,
      default: 22,
      min: 1,
      max: 31
    },
    // Leave policy
    leavePolicy: {
      paidLeavePerMonth: {
        type: Number,
        default: 2,
        min: 0
      },
      sickLeavePerMonth: {
        type: Number,
        default: 1,
        min: 0
      },
      casualLeavePerMonth: {
        type: Number,
        default: 1,
        min: 0
      },
      leaveEncashmentRate: {
        type: Number,
        default: 1,
        min: 0,
        description: "Multiplier for leave encashment (1 = full day salary)"
      }
    },
    // Bonus configuration
    bonusPolicy: {
      annualBonus: {
        type: Number,
        default: 0,
        min: 0,
        description: "Annual bonus amount"
      },
      bonusMonth: {
        type: Number,
        default: 12,
        min: 1,
        max: 12,
        description: "Month when bonus is paid"
      },
      bonusEligibilityMonths: {
        type: Number,
        default: 6,
        min: 1,
        description: "Minimum months of service to be eligible for bonus"
      }
    },
    // Deduction policy
    deductionPolicy: {
      advanceSalaryAllowed: {
        type: Boolean,
        default: true
      },
      maxAdvancePercentage: {
        type: Number,
        default: 50,
        min: 0,
        max: 100,
        description: "Maximum advance as percentage of monthly salary"
      },
      loanAllowed: {
        type: Boolean,
        default: true
      },
      maxLoanAmount: {
        type: Number,
        default: 0,
        description: "Maximum loan amount (0 = unlimited)"
      },
      bondDeductionAllowed: {
        type: Boolean,
        default: true
      }
    },
    // FNF configuration
    fnfPolicy: {
      gratuityEligibilityYears: {
        type: Number,
        default: 5,
        min: 0,
        description: "Years of service required for gratuity"
      },
      gratuityRate: {
        type: Number,
        default: 15,
        min: 0,
        description: "Gratuity as number of days salary"
      },
      severancePayDays: {
        type: Number,
        default: 0,
        min: 0,
        description: "Severance pay in days"
      },
      fnfCalculationDays: {
        type: Number,
        default: 2,
        min: 1,
        description: "Days to calculate FNF (Indian law: 2 days)"
      }
    },
    // Tax configuration
    taxPolicy: {
      taxSlabs: [
        {
          minSalary: Number,
          maxSalary: Number,
          taxPercentage: Number
        }
      ],
      standardDeduction: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Compound indexes
salaryCycleSchema.index({ orgId: 1, isActive: 1 });
salaryCycleSchema.index({ orgId: 1, createdAt: -1 });

// Static method to get active cycle for organization
salaryCycleSchema.statics.getActiveCycle = function (orgId) {
  return this.findOne({ orgId, isActive: true });
};

export default mongoose.model("SalaryCycle", salaryCycleSchema);
