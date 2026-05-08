import mongoose from "mongoose";

const attendanceHistorySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      index: true
    },
    // Check-in and Check-out times
    checkInTime: {
      type: Date
    },
    checkOutTime: {
      type: Date
    },
    // Hours worked
    hoursWorked: {
      type: Number,
      default: 0
    },
    // Attendance status
    status: {
      type: String,
      enum: ["present", "absent", "half-day", "work-from-home", "on-leave", "holiday", "week-off"],
      required: true,
      index: true
    },
    // Leave details if applicable
    leaveType: {
      type: String,
      enum: ["paid-leave", "unpaid-leave", "sick-leave", "casual-leave", "earned-leave", null],
      default: null
    },
    leaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest"
    },
    // Break information
    breaks: [
      {
        breakType: {
          type: String,
          enum: ["regular", "meal", "emergency"],
          default: "regular"
        },
        startTime: Date,
        endTime: Date,
        duration: Number, // in minutes
        reason: String
      }
    ],
    totalBreakDuration: {
      type: Number,
      default: 0 // in minutes
    },
    breakCount: {
      type: Number,
      default: 0
    },
    // Late arrival
    isLate: {
      type: Boolean,
      default: false
    },
    lateMinutes: {
      type: Number,
      default: 0
    },
    // Early departure
    isEarlyDeparture: {
      type: Boolean,
      default: false
    },
    earlyDepartureMinutes: {
      type: Number,
      default: 0
    },
    // Notes
    notes: {
      type: String
    },
    // Approval status
    isApproved: {
      type: Boolean,
      default: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    approvalDate: {
      type: Date
    },
    // Audit trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    // Archive fields
    isArchived: {
      type: Boolean,
      default: false
    },
    archivedAt: {
      type: Date
    },
    archivedBy: {
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
attendanceHistorySchema.index({ employeeId: 1, date: -1 });
attendanceHistorySchema.index({ userId: 1, date: -1 });
attendanceHistorySchema.index({ orgId: 1, date: -1 });
attendanceHistorySchema.index({ date: 1, status: 1 });
attendanceHistorySchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model("AttendanceHistory", attendanceHistorySchema);
