import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", index: true },
    employeeName: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: { 
      type: String, 
      enum: ["present", "absent", "on-leave", "half-day", "late"], 
      default: "present",
      index: true
    },
    hoursWorked: { type: Number, default: 0 },
    breaks: [{
      startTime: { type: Date },
      endTime: { type: Date },
      duration: { type: Number } // in minutes
    }],
    meetings: [{
      startTime: { type: Date },
      endTime: { type: Date },
      duration: { type: Number } // in minutes
    }],
    notes: { type: String },
    orgId: { type: String, required: true, index: true }
  },
  { 
    timestamps: true,
    optimisticConcurrency: true // Enable version key for optimistic locking
  }
);

// Compound indexes for common queries
attendanceSchema.index({ orgId: 1, date: -1 });
attendanceSchema.index({ userId: 1, date: -1 });
attendanceSchema.index({ employeeId: 1, date: -1 });
attendanceSchema.index({ orgId: 1, status: 1, date: -1 });
attendanceSchema.index({ date: -1, status: 1 });

// Unique constraint: one attendance record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
