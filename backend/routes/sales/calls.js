import express from "express";
import Call from "../../models/Call.js";
import Lead from "../../models/Lead.js";
import Employee from "../../models/Employee.js";
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

// POST create call
router.post("/", async (req, res) => {
  try {
    const {
      employeeId,
      leadId,
      callDate,
      duration,
      callType,
      status,
      outcome,
      notes,
      nextFollowUpDate
    } = req.body;

    // Validate required fields
    if (!employeeId || !duration || !callType || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: employeeId, duration, callType, status"
      });
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Verify lead exists if provided
    if (leadId) {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead not found"
        });
      }
    }

    const call = new Call({
      employeeId,
      leadId,
      callDate: callDate || new Date(),
      duration,
      callType,
      status,
      outcome: outcome || "Cold",
      notes,
      nextFollowUpDate,
      orgId: req.orgId
    });

    await call.save();

    // Populate references
    await call.populate("employee", "name email");
    await call.populate("lead", "name company");

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("call:created", call);
    }

    res.status(201).json({
      success: true,
      message: "Call created successfully",
      data: call
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating call",
      error: error.message
    });
  }
});

// POST tag call outcome
router.post("/:id/outcome", async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, notes, nextFollowUpDate } = req.body;

    if (!outcome) {
      return res.status(400).json({
        success: false,
        message: "Outcome is required"
      });
    }

    const call = await Call.findByIdAndUpdate(
      id,
      {
        outcome,
        notes: notes || call.notes,
        nextFollowUpDate
      },
      { new: true, runValidators: true }
    )
      .populate("employee", "name email")
      .populate("lead", "name company");

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found"
      });
    }

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("call:outcome_tagged", call);
    }

    res.json({
      success: true,
      message: "Call outcome tagged successfully",
      data: call
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error tagging call outcome",
      error: error.message
    });
  }
});

// GET all calls
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 50, employeeId, status, outcome } = req.query;
    const skip = (page - 1) * limit;

    const query = { orgId: req.orgId };
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (outcome) query.outcome = outcome;

    const calls = await Call.find(query)
      .populate("employee", "name email")
      .populate("lead", "name company")
      .sort({ callDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Call.countDocuments(query);

    res.json({
      success: true,
      data: calls,
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
      message: "Error fetching calls",
      error: error.message
    });
  }
});

// GET today's calls
router.get("/today", async (req, res) => {
  try {
    const calls = await Call.getTodaysCalls(req.orgId);

    res.json({
      success: true,
      data: calls
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching today's calls",
      error: error.message
    });
  }
});

// GET employee's calls
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { limit = 50 } = req.query;

    const calls = await Call.getEmployeeCalls(employeeId, parseInt(limit));

    res.json({
      success: true,
      data: calls
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching employee calls",
      error: error.message
    });
  }
});

// GET call by ID
router.get("/:id", async (req, res) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate("employee", "name email")
      .populate("lead", "name company");

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found"
      });
    }

    if (call.orgId.toString() !== req.orgId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this call"
      });
    }

    res.json({
      success: true,
      data: call
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching call",
      error: error.message
    });
  }
});

// PATCH update call
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove orgId from updates if present
    delete updates.orgId;

    const call = await Call.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
      .populate("employee", "name email")
      .populate("lead", "name company");

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found"
      });
    }

    if (call.orgId.toString() !== req.orgId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this call"
      });
    }

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("call:updated", call);
    }

    res.json({
      success: true,
      message: "Call updated successfully",
      data: call
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating call",
      error: error.message
    });
  }
});

// DELETE call
router.delete("/:id", async (req, res) => {
  try {
    const call = await Call.findByIdAndDelete(req.params.id);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found"
      });
    }

    if (call.orgId.toString() !== req.orgId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this call"
      });
    }

    // Emit real-time update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("call:deleted", { id: call._id });
    }

    res.json({
      success: true,
      message: "Call deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting call",
      error: error.message
    });
  }
});

export default router;
