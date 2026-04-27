import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    employeeName: { type: String, required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: { 
      type: String, 
      enum: ["present", "absent", "on-leave", "half-day", "late"], 
      default: "present" 
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
    orgId: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Attendance", attendanceSchema);
