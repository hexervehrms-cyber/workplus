import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
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
    status: { type: String, enum: ["draft", "paid", "pending"], default: "draft" },
    paidDate: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Payslip", payslipSchema);
