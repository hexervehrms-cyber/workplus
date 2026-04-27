import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    employeeName: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String },
    receipt: { type: String },
    status: { 
      type: String, 
      enum: ["pending", "approved", "rejected"], 
      default: "pending" 
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedDate: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedDate: { type: Date },
    rejectionReason: { type: String },
    orgId: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
