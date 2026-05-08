import mongoose from "mongoose";

const payrollRunSchema = new mongoose.Schema(
  {
    payrollCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollCycle",
      required: true,
      index: true
    },
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
    // Employee type
    employeeType: {
      type: String,
      enum: ["intern", "employee", "consultant", "contract_worker"],
      required: true
    },
    // Salary structure applied
    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryStructure",
      required: true
    },
    // Payroll cycle dates
    cycleStartDate: {
      type: Date,
      required: true
    },
    cycleEndDate: {
      type: Date,
      required: true
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
      halfDays: {
        type: Number,
        default: 0
      },
      workFromHomeDays: {
        type: Number,
        default: 0
      },
      paidLeaveDays: {
        type: Number,
        default: 0
      },
      unpaidLeaveDays: {
        type: Number,
        default: 0
      },
      holidayDays: {
        type: Number,
        default: 0
      },
      weekOffDays: {
        type: Number,
        default: 0
      },
      lateMarks: {
        type: Number,
        default: 0
      }
    },
    // Payable days calculation
    payableDaysCalculation: {
      totalCalendarDays: Number,
      totalWorkingDays: Number,
      presentDays: Number,
      halfDayDeduction: Number,
      unpaidLeaveDeduction: Number,
      lateMarkDeduction: Number,
      totalPayableDays: Number,
      perDaySalary: Number
    },
    // Salary revisions in this cycle (if any)
    salaryRevisions: [
      {
        revisionId: mongoose.Schema.Types.ObjectId,
        effectiveFrom: Date,
        effectiveTo: Date,
        previousBasic: Number,
        newBasic: Number,
        periodPayableDays: Number,
        periodGrossEarnings: Number
      }
    ],
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
      variableSalary: {
        type: Number,
        default: 0
      },
      otherEarnings: [
        {
          name: String,
          amount: Number,
          type: {
            type: String,
            enum: ["fixed", "percentage", "dynamic"],
            default: "fixed"
          }
        }
      ]
    },
    grossEarnings: {
      type: Number,
      default: 0
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
      unpaidLeaveDeduction: {
        type: Number,
        default: 0
      },
      lateMarkDeduction: {
        type: Number,
        default: 0
      },
      otherDeductions: [
        {
          name: String,
          amount: Number,
          type: {
            type: String,
            enum: ["fixed", "percentage"],
            default: "fixed"
          }
        }
      ]
    },
    totalDeductions: {
      type: Number,
      default: 0
    },
    // Net salary
    netSalary: {
      type: Number,
      default: 0
    },
    // Status
    status: {
      type: String,
      enum: ["draft", "calculated", "approved", "locked", "released", "rejected"],
      default: "draft"
    },
    // Approval workflow
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
    // Release details
    releasedAt: {
      type: Date
    },
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    // Audit trail
    calculationLog: {
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

// Unique index: one payroll run per employee per cycle
payrollRunSchema.index({ payrollCycleId: 1, employeeId: 1 }, { unique: true });
payrollRunSchema.index({ orgId: 1, status: 1 });
payrollRunSchema.index({ userId: 1, cycleStartDate: -1 });

export default mongoose.model("PayrollRun", payrollRunSchema);
