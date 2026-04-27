import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", index: true },
    employeeName: { type: String, required: true },
    type: { 
      type: String, 
      required: true,
      enum: ["Sick Leave", "Vacation", "Personal", "Casual", "Maternity", "Paternity", "Other"],
      index: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
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
leaveRequestSchema.index({ orgId: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ userId: 1, status: 1, startDate: -1 });
leaveRequestSchema.index({ employeeId: 1, status: 1 });
leaveRequestSchema.index({ orgId: 1, startDate: -1 });
leaveRequestSchema.index({ status: 1, startDate: 1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
