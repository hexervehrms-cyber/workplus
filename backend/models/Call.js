import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
      index: true
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true
    },
    callDate: {
      type: Date,
      required: [true, "Call date is required"],
      default: Date.now,
      index: true
    },
    duration: {
      type: Number,
      required: [true, "Duration is required"],
      min: [0, "Duration cannot be negative"]
    },
    callType: {
      type: String,
      enum: ["Inbound", "Outbound"],
      required: [true, "Call type is required"],
      index: true
    },
    status: {
      type: String,
      enum: ["Connected", "Missed", "Voicemail", "Declined"],
      required: [true, "Status is required"],
      index: true
    },
    recordingUrl: {
      type: String,
      default: null
    },
    recordingDuration: {
      type: Number,
      default: 0
    },
    outcome: {
      type: String,
      enum: ["Hot", "Warm", "Cold", "Not Interested", "Follow-up"],
      default: "Cold"
    },
    notes: {
      type: String,
      maxlength: [2000, "Notes cannot exceed 2000 characters"]
    },
    nextFollowUpDate: {
      type: Date,
      index: true
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization ID is required"],
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
callSchema.index({ employeeId: 1, callDate: -1 });
callSchema.index({ leadId: 1, callDate: -1 });
callSchema.index({ orgId: 1, callDate: -1 });
callSchema.index({ status: 1, callDate: -1 });
callSchema.index({ outcome: 1, callDate: -1 });

// Virtual for employee details
callSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true
});

// Virtual for lead details
callSchema.virtual("lead", {
  ref: "Lead",
  localField: "leadId",
  foreignField: "_id",
  justOne: true
});

// Static method to get today's calls
callSchema.statics.getTodaysCalls = function(orgId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    orgId,
    callDate: { $gte: startOfDay, $lte: endOfDay }
  })
    .populate("employee", "name email")
    .populate("lead", "name company")
    .sort({ callDate: -1 })
    .lean();
};

// Static method to get employee's calls
callSchema.statics.getEmployeeCalls = function(employeeId, limit = 50) {
  return this.find({ employeeId })
    .populate("lead", "name company")
    .sort({ callDate: -1 })
    .limit(limit)
    .lean();
};

// Static method to get connected calls count
callSchema.statics.getConnectedCallsCount = function(orgId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.countDocuments({
    orgId,
    status: "Connected",
    callDate: { $gte: startOfDay, $lte: endOfDay }
  });
};

const Call = mongoose.model("Call", callSchema);

export default Call;
