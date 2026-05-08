import mongoose from "mongoose";

const leaveHistorySchema = new mongoose.Schema(
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
    orgId: {
      type: String,
      required: true,
      index: true
    },
    leaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest",
      index: true
    },
    // Leave details
    leaveType: {
      type: String,
      enum: ["paid-leave", "unpaid-leave", "sick-leave", "casual-leave", "earned-leave", "maternity-leave", "paternity-leave"],
      required: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    // Duration
    totalDays: {
      type: Number,
      required: true
    },
    halfDayDate: {
      type: Date
    },
    isHalfDay: {
      type: Boolean,
      default: false
    },
    // Reason
    reason: {
      type: String,
      required: true
    },
    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true
    },
    // Approval details
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
    // Cancellation details
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    cancellationDate: {
      type: Date
    },
    cancellationReason: {
      type: String
    },
    // Attachments (for sick leave, etc.)
    attachmentUrl: {
      type: String
    },
    // Notes
    notes: {
      type: String
    },
    // Audit trail
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

// Indexes for efficient querying
leaveHistorySchema.index({ employeeId: 1, startDate: -1 });
leaveHistorySchema.index({ userId: 1, startDate: -1 });
leaveHistorySchema.index({ orgId: 1, startDate: -1 });
leaveHistorySchema.index({ status: 1, startDate: -1 });
leaveHistorySchema.index({ leaveType: 1, startDate: -1 });

export default mongoose.model("LeaveHistory", leaveHistorySchema);
