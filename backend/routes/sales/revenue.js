import express from "express";
import Revenue from "../../models/Revenue.js";
import Deal from "../../models/Deal.js";
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

// Helper functions
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

// GET all revenue
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50, employeeId, type } = req.query;
    const skip = (page - 1) * limit;

    const query = { orgId: req.orgId };
    if (employeeId) query.employeeId = employeeId;
    if (type) query.type = type;

    const revenue = await Revenue.find(query)
      .populate("employee", "name email")
      .populate("deal", "dealName value")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Revenue.countDocuments(query);

    res.json({
      success: true,
      data: revenue,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching revenue",
      error: error.message
    });
  }
});

// GET today's revenue
router.get("/today", async (req, res) => {
  try {
    const startOfDay = getTodayStart();
    const endOfDay = getTodayEnd();

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
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const result = revenueData[0] || { total: 0, count: 0 };

    res.json({
      success: true,
      data: {
        date: new Date(),
        total: result.total,
        count: result.count
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching today's revenue",
      error: error.message
    });
  }
});

// GET monthly revenue
router.get("/month", async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

    const monthlyData = await Revenue.getMonthlyRevenue(req.orgId, year, month);

    res.json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching monthly revenue",
      error: error.message
    });
  }
});

// GET yearly revenue
router.get("/year", async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const yearlyData = await Revenue.aggregate([
      {
        $match: {
          orgId: req.orgId,
          type: "Sale",
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: yearlyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching yearly revenue",
      error: error.message
    });
  }
});

// GET employee revenue
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const employeeRevenue = await Revenue.getEmployeeRevenue(employeeId, start, end);

    res.json({
      success: true,
      data: employeeRevenue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching employee revenue",
      error: error.message
    });
  }
});

// GET revenue vs target
router.get("/vs-target", async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const totalRevenueData = await Revenue.getTotalRevenue(req.orgId, startDate, endDate);
    const totalRevenue = totalRevenueData[0]?.total || 0;

    // TODO: Get target from organization settings
    const target = 100000; // Placeholder

    res.json({
      success: true,
      data: {
        period: `${year}-${month}`,
        revenue: totalRevenue,
        target,
        percentage: (totalRevenue / target) * 100,
        remaining: Math.max(0, target - totalRevenue)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching revenue vs target",
      error: error.message
    });
  }
});

// POST create revenue record
router.post("/", async (req, res) => {
  try {
    const { dealId, employeeId, amount, date, type, notes } = req.body;

    if (!dealId || !employeeId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: dealId, employeeId, amount"
      });
    }

    // Verify deal exists
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found"
      });
    }

    const revenue = new Revenue({
      dealId,
      employeeId,
      amount,
      date: date || new Date(),
      type: type || "Sale",
      notes,
      orgId: req.orgId
    });

    await revenue.save();
    await revenue.populate("employee", "name email");
    await revenue.populate("deal", "dealName value");

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("revenue:created", revenue);
    }

    res.status(201).json({
      success: true,
      message: "Revenue record created successfully",
      data: revenue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating revenue record",
      error: error.message
    });
  }
});

// GET revenue by ID
router.get("/:id", async (req, res) => {
  try {
    const revenue = await Revenue.findById(req.params.id)
      .populate("employee", "name email")
      .populate("deal", "dealName value");

    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue record not found"
      });
    }

    if (revenue.orgId.toString() !== req.orgId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this revenue record"
      });
    }

    res.json({
      success: true,
      data: revenue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching revenue record",
      error: error.message
    });
  }
});

// PATCH update revenue
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.orgId;

    const revenue = await Revenue.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate("employee", "name email")
      .populate("deal", "dealName value");

    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue record not found"
      });
    }

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("revenue:updated", revenue);
    }

    res.json({
      success: true,
      message: "Revenue record updated successfully",
      data: revenue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating revenue record",
      error: error.message
    });
  }
});

// DELETE revenue
router.delete("/:id", async (req, res) => {
  try {
    const revenue = await Revenue.findByIdAndDelete(req.params.id);

    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue record not found"
      });
    }

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("revenue:deleted", { id: revenue._id });
    }

    res.json({
      success: true,
      message: "Revenue record deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting revenue record",
      error: error.message
    });
  }
});

export default router;
