import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: String, required: true, index: true },
    year: { type: Number, required: true, index: true },
    grossSalary: { type: Number, required: true },
    baseSalary: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    providentFund: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    advanceDeductions: { type: Number, default: 0 },
    loanDeductions: { type: Number, default: 0 },
    totalDeductions: { type: Number, required: true },
    netPay: { type: Number, required: true },
    status: { type: String, enum: ["draft", "paid", "pending"], default: "draft", index: true },
    paidDate: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    orgId: { type: String, index: true }
  },
  { 
    timestamps: true,
    optimisticConcurrency: true // Enable version key for optimistic locking
  }
);

// Compound indexes for common queries
payslipSchema.index({ employeeId: 1, year: -1, month: -1 });
payslipSchema.index({ userId: 1, year: -1, month: -1 });
payslipSchema.index({ orgId: 1, status: 1, year: -1, month: -1 });
payslipSchema.index({ status: 1, year: -1, month: -1 });
payslipSchema.index({ year: -1, month: -1 });

// Unique constraint: one payslip per employee per month/year
payslipSchema.index({ employeeId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model("Payslip", payslipSchema);
