import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"]
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true
    },
    company: {
      type: String,
      trim: true
    },
    source: {
      type: String,
      enum: ["Website", "Referral", "Cold Call", "Email", "Social", "Event"],
      required: [true, "Source is required"],
      index: true
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Interested", "Qualified", "Lost"],
      default: "New",
      index: true
    },
    value: {
      type: Number,
      default: 0,
      min: [0, "Value cannot be negative"]
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      index: true
    },
    notes: {
      type: String,
      maxlength: [2000, "Notes cannot exceed 2000 characters"]
    },
    lastContactDate: {
      type: Date
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
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ orgId: 1, createdAt: -1 });
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ email: 1, orgId: 1 });

// Virtual for assigned employee details
leadSchema.virtual("assignedEmployee", {
  ref: "Employee",
  localField: "assignedTo",
  foreignField: "_id",
  justOne: true
});

// Static method to get leads by status
leadSchema.statics.getLeadsByStatus = function(orgId, status) {
  return this.find({ orgId, status })
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to get employee's leads
leadSchema.statics.getEmployeeLeads = function(employeeId) {
  return this.find({ assignedTo: employeeId })
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to get leads needing follow-up
leadSchema.statics.getFollowUpLeads = function(orgId) {
  return this.find({
    orgId,
    nextFollowUpDate: { $lte: new Date() },
    status: { $nin: ["Lost", "Qualified"] }
  })
    .populate("assignedTo", "name email")
    .sort({ nextFollowUpDate: 1 })
    .lean();
};

const Lead = mongoose.model("Lead", leadSchema);

export default Lead;
