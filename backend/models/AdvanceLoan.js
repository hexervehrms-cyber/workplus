import mongoose from "mongoose";

const advanceLoanSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeName: { type: String, required: true },
    type: { type: String, enum: ["advance", "loan"], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    installmentAmount: { type: Number },
    totalInstallments: { type: Number },
    paidInstallments: { type: Number, default: 0 },
    monthlyDeduction: { type: Number, default: 0 },
    requestedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["pending", "approved", "rejected", "completed"], default: "pending" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedDate: { type: Date },
    rejectionReason: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("AdvanceLoan", advanceLoanSchema);
