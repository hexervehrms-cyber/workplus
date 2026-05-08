import mongoose from "mongoose";

const performanceMetricsSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
      index: true
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true
    },
    callsCount: {
      type: Number,
      default: 0,
      min: [0, "Calls count cannot be negative"]
    },
    connectedCalls: {
      type: Number,
      default: 0,
      min: [0, "Connected calls cannot be negative"]
    },
    leadsGenerated: {
      type: Number,
      default: 0,
      min: [0, "Leads generated cannot be negative"]
    },
    meetingsBooked: {
      type: Number,
      default: 0,
      min: [0, "Meetings booked cannot be negative"]
    },
    dealsClosedCount: {
      type: Number,
      default: 0,
      min: [0, "Deals closed cannot be negative"]
    },
    revenueGenerated: {
      type: Number,
      default: 0,
      min: [0, "Revenue cannot be negative"]
    },
    performanceScore: {
      type: Number,
      default: 0,
      min: [0, "Score cannot be less than 0"],
      max: [100, "Score cannot be more than 100"]
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
performanceMetricsSchema.index({ employeeId: 1, date: -1 });
performanceMetricsSchema.index({ orgId: 1, date: -1 });
performanceMetricsSchema.index({ performanceScore: -1, date: -1 });

// Virtual for employee details
performanceMetricsSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true
});

// Static method to calculate performance score
performanceMetricsSchema.statics.calculateScore = function(metrics) {
  const {
    callsCount = 0,
    leadsGenerated = 0,
    meetingsBooked = 0,
    dealsClosedCount = 0
  } = metrics;

  const score =
    callsCount + leadsGenerated * 5 + meetingsBooked * 10 + dealsClosedCount * 25;

  // Normalize to 0-100 scale (assuming max daily score is ~500)
  return Math.min((score / 500) * 100, 100);
};

// Static method to get performance tier
performanceMetricsSchema.statics.getPerformanceTier = function(score) {
  if (score >= 80) return { tier: "Excellent", color: "#10B981", emoji: "🥇" };
  if (score >= 60) return { tier: "Good", color: "#3B82F6", emoji: "✅" };
  if (score >= 40) return { tier: "Average", color: "#F59E0B", emoji: "⚠️" };
  return { tier: "Poor", color: "#EF4444", emoji: "❌" };
};

// Static method to get employee's daily metrics
performanceMetricsSchema.statics.getEmployeeMetrics = function(employeeId, startDate, endDate) {
  return this.find({
    employeeId,
    date: { $gte: startDate, $lte: endDate }
  })
    .populate("employee", "name email")
    .sort({ date: -1 })
    .lean();
};

// Static method to get leaderboard
performanceMetricsSchema.statics.getLeaderboard = function(orgId, date) {
  return this.find({ orgId, date })
    .populate("employee", "name email")
    .sort({ performanceScore: -1 })
    .limit(50)
    .lean();
};

// Static method to get weekly leaderboard
performanceMetricsSchema.statics.getWeeklyLeaderboard = function(orgId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        orgId: mongoose.Types.ObjectId(orgId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$employeeId",
        totalCalls: { $sum: "$callsCount" },
        totalConnected: { $sum: "$connectedCalls" },
        totalLeads: { $sum: "$leadsGenerated" },
        totalMeetings: { $sum: "$meetingsBooked" },
        totalDeals: { $sum: "$dealsClosedCount" },
        totalRevenue: { $sum: "$revenueGenerated" },
        avgScore: { $avg: "$performanceScore" }
      }
    },
    { $sort: { avgScore: -1 } },
    {
      $lookup: {
        from: "employees",
        localField: "_id",
        foreignField: "_id",
        as: "employee"
      }
    },
    { $unwind: "$employee" }
  ]);
};

// Static method to get monthly leaderboard
performanceMetricsSchema.statics.getMonthlyLeaderboard = function(orgId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        orgId: mongoose.Types.ObjectId(orgId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$employeeId",
        totalCalls: { $sum: "$callsCount" },
        totalConnected: { $sum: "$connectedCalls" },
        totalLeads: { $sum: "$leadsGenerated" },
        totalMeetings: { $sum: "$meetingsBooked" },
        totalDeals: { $sum: "$dealsClosedCount" },
        totalRevenue: { $sum: "$revenueGenerated" },
        avgScore: { $avg: "$performanceScore" }
      }
    },
    { $sort: { avgScore: -1 } },
    {
      $lookup: {
        from: "employees",
        localField: "_id",
        foreignField: "_id",
        as: "employee"
      }
    },
    { $unwind: "$employee" }
  ]);
};

const PerformanceMetrics = mongoose.model("PerformanceMetrics", performanceMetricsSchema);

export default PerformanceMetrics;
