import mongoose from "mongoose";

const callRecordingSchema = new mongoose.Schema(
  {
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Call",
      required: [true, "Call ID is required"],
      index: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
      index: true
    },
    recordingUrl: {
      type: String,
      required: [true, "Recording URL is required"]
    },
    duration: {
      type: Number,
      required: [true, "Duration is required"],
      min: [0, "Duration cannot be negative"]
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size cannot be negative"]
    },
    transcription: {
      type: String,
      maxlength: [10000, "Transcription cannot exceed 10000 characters"]
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
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
callRecordingSchema.index({ callId: 1 });
callRecordingSchema.index({ employeeId: 1, uploadedAt: -1 });
callRecordingSchema.index({ orgId: 1, uploadedAt: -1 });
callRecordingSchema.index({ expiresAt: 1 });

// Virtual for call details
callRecordingSchema.virtual("call", {
  ref: "Call",
  localField: "callId",
  foreignField: "_id",
  justOne: true
});

// Virtual for employee details
callRecordingSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true
});

// Virtual for file size in MB
callRecordingSchema.virtual("fileSizeInMB").get(function() {
  return (this.fileSize / (1024 * 1024)).toFixed(2);
});

// Virtual for is expired
callRecordingSchema.virtual("isExpired").get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Static method to get employee's recordings
callRecordingSchema.statics.getEmployeeRecordings = function(employeeId, limit = 50) {
  return this.find({ employeeId })
    .populate("call", "callDate duration outcome")
    .sort({ uploadedAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get expired recordings
callRecordingSchema.statics.getExpiredRecordings = function(orgId) {
  return this.find({
    orgId,
    expiresAt: { $lt: new Date() }
  })
    .sort({ expiresAt: 1 })
    .lean();
};

// Static method to get recent recordings
callRecordingSchema.statics.getRecentRecordings = function(orgId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    orgId,
    uploadedAt: { $gte: startDate }
  })
    .populate("employee", "name email")
    .sort({ uploadedAt: -1 })
    .lean();
};

const CallRecording = mongoose.model("CallRecording", callRecordingSchema);

export default CallRecording;
