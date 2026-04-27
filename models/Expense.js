import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", index: true },
    employeeName: { type: String, required: true },
    category: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, index: true },
    description: { type: String },
    receipt: { type: String },
    status: { 
      type: String, 
      enum: ["pending", "approved", "rejected"], 
      default: "pending",
      index: true
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedDate: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedDate: { type: Date },
    rejectionReason: { type: String },
    orgId: { type: String, required: true, index: true }
  },
  { 
    timestamps: true,
    optimisticConcurrency: true // Enable version key for optimistic locking
  }
);

// Compound indexes for common queries
expenseSchema.index({ orgId: 1, status: 1, date: -1 });
expenseSchema.index({ userId: 1, status: 1, date: -1 });
expenseSchema.index({ employeeId: 1, status: 1 });
expenseSchema.index({ orgId: 1, category: 1, date: -1 });
expenseSchema.index({ status: 1, date: -1 });

export default mongoose.model("Expense", expenseSchema);
