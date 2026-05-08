import mongoose from "mongoose";

const dealSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead ID is required"],
      index: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
      index: true
    },
    dealName: {
      type: String,
      required: [true, "Deal name is required"],
      trim: true,
      index: true
    },
    value: {
      type: Number,
      required: [true, "Deal value is required"],
      min: [0, "Value cannot be negative"]
    },
    stage: {
      type: String,
      enum: ["Proposal", "Negotiation", "Closed Won", "Closed Lost"],
      default: "Proposal",
      index: true
    },
    probability: {
      type: Number,
      default: 50,
      min: [0, "Probability cannot be less than 0"],
      max: [100, "Probability cannot be more than 100"]
    },
    expectedCloseDate: {
      type: Date,
      required: [true, "Expected close date is required"],
      index: true
    },
    actualCloseDate: {
      type: Date
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee"
    },
    notes: {
      type: String,
      maxlength: [2000, "Notes cannot exceed 2000 characters"]
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
dealSchema.index({ employeeId: 1, stage: 1 });
dealSchema.index({ orgId: 1, actualCloseDate: -1 });
dealSchema.index({ stage: 1, expectedCloseDate: 1 });
dealSchema.index({ leadId: 1 });

// Virtual for employee details
dealSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true
});

// Virtual for lead details
dealSchema.virtual("lead", {
  ref: "Lead",
  localField: "leadId",
  foreignField: "_id",
  justOne: true
});

// Virtual for closed by employee details
dealSchema.virtual("closedByEmployee", {
  ref: "Employee",
  localField: "closedBy",
  foreignField: "_id",
  justOne: true
});

// Virtual for days remaining
dealSchema.virtual("daysRemaining").get(function() {
  if (!this.expectedCloseDate || this.stage.includes("Closed")) return null;
  const today = new Date();
  const diffTime = this.expectedCloseDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Static method to get deals by stage
dealSchema.statics.getDealsByStage = function(orgId, stage) {
  return this.find({ orgId, stage })
    .populate("employee", "name email")
    .populate("lead", "name company")
    .sort({ expectedCloseDate: 1 })
    .lean();
};

// Static method to get employee's deals
dealSchema.statics.getEmployeeDeals = function(employeeId) {
  return this.find({ employeeId })
    .populate("lead", "name company")
    .sort({ expectedCloseDate: 1 })
    .lean();
};

// Static method to get closed deals
dealSchema.statics.getClosedDeals = function(orgId, startDate, endDate) {
  return this.find({
    orgId,
    stage: "Closed Won",
    actualCloseDate: { $gte: startDate, $lte: endDate }
  })
    .populate("employee", "name email")
    .populate("lead", "name company")
    .sort({ actualCloseDate: -1 })
    .lean();
};

// Static method to calculate total deal value
dealSchema.statics.getTotalDealValue = function(orgId, stage = null) {
  const query = { orgId };
  if (stage) query.stage = stage;

  return this.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: "$value" } } }
  ]);
};

const Deal = mongoose.model("Deal", dealSchema);

export default Deal;
