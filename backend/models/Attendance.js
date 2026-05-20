import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", index: true },
    employeeName: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    timezone: { 
      type: String, 
      default: 'Asia/Kolkata',
      description: "User's timezone for date calculations (e.g., 'Asia/Kolkata', 'America/New_York')"
    },
    status: { 
      type: String, 
      enum: ["present", "absent", "on-leave", "half-day", "late"], 
      default: "present",
      index: true
    },
    isLate: {
      type: Boolean,
      default: false,
      description: "Whether employee checked in after shift start time + grace period"
    },
    lateMinutes: {
      type: Number,
      default: 0,
      description: "Number of minutes late (0 if on time)"
    },
    actualWorkingHours: {
      type: Number,
      default: 0,
      description: "Working hours calculated from actual check-in time (excluding breaks)"
    },
    hoursWorked: { type: Number, default: 0 },
    breaks: [{
      startTime: { type: Date },
      endTime: { type: Date },
      duration: { type: Number }, // in minutes
      breakType: { type: String },
      location: { type: String },
      ipAddress: { type: String }
    }],
    meetings: [{
      startTime: { type: Date },
      endTime: { type: Date },
      duration: { type: Number }, // in minutes
      title: { type: String },
      type: { type: String },
      ipAddress: { type: String }
    }],
    meetingMode: {
      isActive: { type: Boolean, default: false },
      toggledAt: { type: Date },
      meetingTitle: { type: String },
      meetingType: { type: String },
      notes: { type: String }
    },
    notes: { type: String },
    orgId: { type: String, required: true, index: true },
    isReEntry: { type: Boolean, default: false },
    previousAttendanceId: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance" }
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

/** At most one open shift (checked in, not checked out) per user per calendar day — prevents double check-in races. */
attendanceSchema.index(
  { userId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      checkIn: { $exists: true, $ne: null },
      $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
    },
    name: "uniq_open_session_user_date",
  }
);

export default mongoose.model("Attendance", attendanceSchema);
