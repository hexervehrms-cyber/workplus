import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    employeeName: { type: String, required: true },
    type: { 
      type: String, 
      required: true,
      enum: ["Sick Leave", "Vacation", "Personal", "Casual", "Maternity", "Paternity", "Other"]
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
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

export default mongoose.model("LeaveRequest", leaveRequestSchema);
