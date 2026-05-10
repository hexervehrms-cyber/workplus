import express from "express";
import Deal from "../../models/Deal.js";
import Lead from "../../models/Lead.js";
import Employee from "../../models/Employee.js";
import Revenue from "../../models/Revenue.js";
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

// POST create deal
router.post("/", asyncHandler(async (req, res) => {
  const { leadId, employeeId, dealName, value, stage, probability, expectedCloseDate, notes } =
    req.body;

  // Validate required fields
  if (!leadId || !employeeId || !dealName || !value || !expectedCloseDate) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: leadId, employeeId, dealName, value, expectedCloseDate"
    });
  }

  // Verify lead exists
  const lead = await Lead.findById(leadId);
  if (!lead) {
    return res.status(404).json({
      success: false,
      message: "Lead not found"
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

  const deal = new Deal({
    leadId,
    employeeId,
    dealName,
    value,
    stage: stage || "Proposal",
    probability: probability || 50,
    expectedCloseDate,
    notes,
    orgId: req.orgId
  });

  await deal.save();
  await deal.populate("employee", "name email");
  await deal.populate("lead", "name company");

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("deal:created", deal);
  }

  res.status(201).json({
    success: true,
    message: "Deal created successfully",
    data: deal
  });
}));

// PATCH close deal
router.patch("/:id/close", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stage, closedBy } = req.body;

  if (!stage || !["Closed Won", "Closed Lost"].includes(stage)) {
    return res.status(400).json({
      success: false,
      message: "Invalid stage. Must be 'Closed Won' or 'Closed Lost'"
    });
  }

  const deal = await Deal.findByIdAndUpdate(
    id,
    {
      stage,
      actualCloseDate: new Date(),
      closedBy: closedBy || req.user.id
    },
    { new: true, runValidators: true }
  )
    .populate("employee", "name email")
    .populate("lead", "name company");

  if (!deal) {
    return res.status(404).json({
      success: false,
      message: "Deal not found"
    });
  }

  // Create revenue record if deal is won
  if (stage === "Closed Won") {
    const revenue = new Revenue({
      dealId: deal._id,
      employeeId: deal.employeeId,
      amount: deal.value,
      date: new Date(),
      type: "Sale",
      orgId: req.orgId
    });

    await revenue.save();

    // Emit revenue update
    if (global.io) {
      global.io.to(`tenant_${req.orgId}`).emit("revenue:created", revenue);
    }
  }

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("deal:closed", deal);
  }

  res.json({
    success: true,
    message: `Deal closed as ${stage}`,
    data: deal
  });
}));

// GET all deals
router.get("/", asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, stage, employeeId } = req.query;
  const skip = (page - 1) * limit;

  const query = { orgId: req.orgId };
  if (stage) query.stage = stage;
  if (employeeId) query.employeeId = employeeId;

  const deals = await Deal.find(query)
    .populate("employee", "name email")
    .populate("lead", "name company")
    .sort({ expectedCloseDate: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await Deal.countDocuments(query);

  res.json({
    success: true,
    data: deals,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  });
}));

// GET deals by stage
router.get("/stage/:stage", asyncHandler(async (req, res) => {
  const { stage } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;

  const deals = await Deal.getDealsByStage(req.orgId, stage);

  res.json({
    success: true,
    data: deals.slice(skip, skip + parseInt(limit)),
    pagination: {
      total: deals.length,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(deals.length / limit)
    }
  });
}));

// GET deal by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id)
    .populate("employee", "name email")
    .populate("lead", "name company")
    .populate("closedBy", "name email");

  if (!deal) {
    return res.status(404).json({
      success: false,
      message: "Deal not found"
    });
  }

  if (deal.orgId.toString() !== req.orgId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized access to this deal"
    });
  }

  res.json({
    success: true,
    data: deal
  });
}));

// PATCH update deal
router.patch("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove orgId from updates if present
  delete updates.orgId;

  const deal = await Deal.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true
  })
    .populate("employee", "name email")
    .populate("lead", "name company");

  if (!deal) {
    return res.status(404).json({
      success: false,
      message: "Deal not found"
    });
  }

  if (deal.orgId.toString() !== req.orgId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized access to this deal"
    });
  }

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("deal:updated", deal);
  }

  res.json({
    success: true,
    message: "Deal updated successfully",
    data: deal
  });
}));

// DELETE deal
router.delete("/:id", asyncHandler(async (req, res) => {
  const deal = await Deal.findByIdAndDelete(req.params.id);

  if (!deal) {
    return res.status(404).json({
      success: false,
      message: "Deal not found"
    });
  }

  if (deal.orgId.toString() !== req.orgId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized access to this deal"
    });
  }

  // Emit real-time update
  if (global.io) {
    global.io.to(`tenant_${req.orgId}`).emit("deal:deleted", { id: deal._id });
  }

  res.json({
    success: true,
    message: "Deal deleted successfully"
  });
}));

export default router;
