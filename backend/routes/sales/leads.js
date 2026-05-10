import express from "express";
import Lead from "../../models/Lead.js";
import Employee from "../../models/Employee.js";
import { asyncHandler } from "../../middleware/errorHandler.js";

const router = express.Router();

// Middleware to verify org access
const verifyOrgAccess = asyncHandler(async (req, res, next) => {
  const { orgId } = req.user;
  if (!orgId) {
    return res.status(403).json({
      success: false,
      message: "Organization ID not found in token"
    });
  }
  req.orgId = orgId;
  next();
});

router.use(verifyOrgAccess);

// POST create lead
router.post("/", asyncHandler(async (req, res) => {
  const { name, email, phone, company, source, value, assignedTo, notes } = req.body;

  // Validate required fields
  if (!name || !email || !phone || !source) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: name, email, phone, source"
    });
  }

  // Verify assigned employee exists if provided
  if (assignedTo) {
    const employee = await Employee.findById(assignedTo);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Assigned employee not found"
      });
    }
  }

  const lead = new Lead({
    name,
    email,
    phone,
    company,
    source,
    value: value || 0,
    assignedTo,
    notes,
    orgId: req.orgId
  });

  await lead.save();
  await lead.populate("assignedTo", "name email");

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("lead:created", lead);
  }

  res.status(201).json({
    success: true,
    message: "Lead created successfully",
    data: lead
  });
}));

// POST assign lead to employee
router.post("/:id/assign", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return res.status(400).json({
      success: false,
      message: "assignedTo is required"
    });
  }

  // Verify employee exists
  const employee = await Employee.findById(assignedTo);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found"
    });
  }

  const lead = await Lead.findByIdAndUpdate(id, { assignedTo }, { new: true }).populate(
    "assignedTo",
    "name email"
  );

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: "Lead not found"
    });
  }

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("lead:assigned", lead);
  }

  res.json({
    success: true,
    message: "Lead assigned successfully",
    data: lead
  });
}));

// GET all leads
router.get("/", asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, assignedTo, source } = req.query;
  const skip = (page - 1) * limit;

  const query = { orgId: req.orgId };
  if (status) query.status = status;
  if (assignedTo) query.assignedTo = assignedTo;
  if (source) query.source = source;

  const leads = await Lead.find(query)
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Lead.countDocuments(query);

  res.json({
    success: true,
    data: leads,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  });
}));

// GET leads by status
router.get("/status/:status", asyncHandler(async (req, res) => {
  const { status } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;

  const leads = await Lead.find({ orgId: req.orgId, status })
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Lead.countDocuments({ orgId: req.orgId, status });

  res.json({
    success: true,
    data: leads,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  });
}));

// GET lead by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate("assignedTo", "name email");

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: "Lead not found"
    });
  }

  if (lead.orgId.toString() !== req.orgId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized access to this lead"
    });
  }

  res.json({
    success: true,
    data: lead
  });
}));

// PATCH update lead
router.patch("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove orgId from updates if present
  delete updates.orgId;

  const lead = await Lead.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true
  }).populate("assignedTo", "name email");

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: "Lead not found"
    });
  }

  if (lead.orgId.toString() !== req.orgId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized access to this lead"
    });
  }

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("lead:updated", lead);
  }

  res.json({
    success: true,
    message: "Lead updated successfully",
    data: lead
  });
}));

// DELETE lead
router.delete("/:id", asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: "Lead not found"
    });
  }

  if (lead.orgId.toString() !== req.orgId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized access to this lead"
    });
  }

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("lead:deleted", { id: lead._id });
  }

  res.json({
    success: true,
    message: "Lead deleted successfully"
  });
}));

export default router;
