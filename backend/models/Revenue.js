import mongoose from "mongoose";

const revenueSchema = new mongoose.Schema(
  {
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: [true, "Deal ID is required"],
      index: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
      index: true
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"]
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
      index: true
    },
    type: {
      type: String,
      enum: ["Sale", "Refund", "Adjustment"],
      default: "Sale",
      index: true
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"]
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
revenueSchema.index({ employeeId: 1, date: -1 });
revenueSchema.index({ orgId: 1, date: -1 });
revenueSchema.index({ dealId: 1 });
revenueSchema.index({ type: 1, date: -1 });

// Virtual for employee details
revenueSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true
});

// Virtual for deal details
revenueSchema.virtual("deal", {
  ref: "Deal",
  localField: "dealId",
  foreignField: "_id",
  justOne: true
});

// Static method to get today's revenue
revenueSchema.statics.getTodaysRevenue = function(orgId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        orgId: mongoose.Types.ObjectId(orgId),
        date: { $gte: startOfDay, $lte: endOfDay },
        type: "Sale"
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method to get employee's revenue
revenueSchema.statics.getEmployeeRevenue = function(employeeId, startDate, endDate) {
  return this.find({
    employeeId,
    date: { $gte: startDate, $lte: endDate },
    type: "Sale"
  })
    .populate("deal", "dealName value")
    .sort({ date: -1 })
    .lean();
};

// Static method to get monthly revenue
revenueSchema.statics.getMonthlyRevenue = function(orgId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        orgId: mongoose.Types.ObjectId(orgId),
        date: { $gte: startDate, $lte: endDate },
        type: "Sale"
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        total: { $sum: "$amount" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Static method to get total revenue
revenueSchema.statics.getTotalRevenue = function(orgId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        orgId: mongoose.Types.ObjectId(orgId),
        date: { $gte: startDate, $lte: endDate },
        type: "Sale"
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
        count: { $sum: 1 }
      }
    }
  ]);
};

const Revenue = mongoose.model("Revenue", revenueSchema);

export default Revenue;
