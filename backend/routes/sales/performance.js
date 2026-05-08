import express from "express";
import PerformanceMetrics from "../../models/PerformanceMetrics.js";
import Call from "../../models/Call.js";
import Lead from "../../models/Lead.js";
import Deal from "../../models/Deal.js";
import Revenue from "../../models/Revenue.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

// Middleware to verify org access
const verifyOrgAccess = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    if (!orgId) {
      return res.status(403).json({
        success: false,
        message: "Organization ID not found in token"
      });
    }
    req.orgId = orgId;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying organization access",
      error: error.message
    });
  }
};

router.use(authenticate, verifyOrgAccess);

// Helper function to get today's date at midnight
const getTodayStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const getTodayEnd = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

// GET today's metrics
router.get("/today", async (req, res) => {
  try {
    const startOfDay = getTodayStart();
    const endOfDay = getTodayEnd();

    // Get today's calls
    const callsCount = await Call.countDocuments({
      orgId: req.orgId,
      callDate: { $gte: startOfDay, $lte: endOfDay }
    });

    const connectedCalls = await Call.countDocuments({
      orgId: req.orgId,
      status: "Connected",
      callDate: { $gte: startOfDay, $lte: endOfDay }
    });

    // Get today's leads
    const leadsGenerated = await Lead.countDocuments({
      orgId: req.orgId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // Get today's deals
    const dealsClosedCount = await Deal.countDocuments({
      orgId: req.orgId,
      stage: "Closed Won",
      actualCloseDate: { $gte: startOfDay, $lte: endOfDay }
    });

    // Get today's revenue
    const revenueData = await Revenue.aggregate([
      {
        $match: {
          orgId: req.orgId,
          type: "Sale",
          date: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const revenueGenerated = revenueData[0]?.total || 0;

    // Calculate performance score
    const score = PerformanceMetrics.calculateScore({
      callsCount,
      leadsGenerated,
      meetingsBooked: 0, // Would need separate tracking
      dealsClosedCount
    });

    res.json({
      success: true,
      data: {
        date: new Date(),
        callsCount,
        connectedCalls,
        leadsGenerated,
        meetingsBooked: 0,
        dealsClosedCount,
        revenueGenerated,
        performanceScore: score
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching today's metrics",
      error: error.message
    });
  }
});

// GET weekly metrics
router.get("/week", async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const metrics = await PerformanceMetrics.find({
      orgId: req.orgId,
      date: { $gte: startOfWeek, $lte: endOfWeek }
    })
      .populate("employee", "name email")
      .sort({ date: -1 })
      .lean();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching weekly metrics",
      error: error.message
    });
  }
});

// GET monthly metrics
router.get("/month", async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const metrics = await PerformanceMetrics.find({
      orgId: req.orgId,
      date: { $gte: startDate, $lte: endDate }
    })
      .populate("employee", "name email")
      .sort({ date: -1 })
      .lean();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching monthly metrics",
      error: error.message
    });
  }
});

// GET employee metrics
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { employeeId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const metrics = await PerformanceMetrics.getEmployeeMetrics(
      employeeId,
      new Date(startDate || new Date().setDate(new Date().getDate() - 30)),
      new Date(endDate || new Date())
    );

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching employee metrics",
      error: error.message
    });
  }
});

// GET leaderboard (today)
router.get("/leaderboard/today", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leaderboard = await PerformanceMetrics.getLeaderboard(req.orgId, today);

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching leaderboard",
      error: error.message
    });
  }
});

// GET weekly leaderboard
router.get("/leaderboard/week", async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const leaderboard = await PerformanceMetrics.getWeeklyLeaderboard(
      req.orgId,
      startOfWeek,
      endOfWeek
    );

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching weekly leaderboard",
      error: error.message
    });
  }
});

// GET monthly leaderboard
router.get("/leaderboard/month", async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

    const leaderboard = await PerformanceMetrics.getMonthlyLeaderboard(req.orgId, year, month);

    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching monthly leaderboard",
      error: error.message
    });
  }
});

// GET performance score for employee
router.get("/score/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metrics = await PerformanceMetrics.findOne({
      employeeId,
      date: today
    }).populate("employee", "name email");

    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: "No metrics found for this employee today"
      });
    }

    const tier = PerformanceMetrics.getPerformanceTier(metrics.performanceScore);

    res.json({
      success: true,
      data: {
        ...metrics.toObject(),
        tier
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching performance score",
      error: error.message
    });
  }
});

// POST create/update metrics
router.post("/", async (req, res) => {
  try {
    const {
      employeeId,
      date,
      callsCount,
      connectedCalls,
      leadsGenerated,
      meetingsBooked,
      dealsClosedCount,
      revenueGenerated
    } = req.body;

    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: employeeId, date"
      });
    }

    // Calculate performance score
    const performanceScore = PerformanceMetrics.calculateScore({
      callsCount,
      leadsGenerated,
      meetingsBooked,
      dealsClosedCount
    });

    const metrics = await PerformanceMetrics.findOneAndUpdate(
      { employeeId, date: new Date(date) },
      {
        callsCount,
        connectedCalls,
        leadsGenerated,
        meetingsBooked,
        dealsClosedCount,
        revenueGenerated,
        performanceScore,
        orgId: req.orgId
      },
      { new: true, upsert: true }
    ).populate("employee", "name email");

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("performance:updated", metrics);
    }

    res.status(201).json({
      success: true,
      message: "Performance metrics saved successfully",
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error saving performance metrics",
      error: error.message
    });
  }
});

export default router;
