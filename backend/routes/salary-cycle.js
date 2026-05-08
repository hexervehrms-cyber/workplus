import express from "express";
import SalaryCycle from "../models/SalaryCycle.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { paginationMiddleware } from "../middleware/pagination.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.use(paginationMiddleware);

/**
 * GET /api/salary-cycle
 * List all salary cycles with pagination
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = req.pagination;
    const { orgId, isActive } = req.query;

    const query = {};

    if (orgId) {
      query.orgId = orgId;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const total = await SalaryCycle.countDocuments(query);

    const cycles = await SalaryCycle.find(query)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    logger.info("Salary cycles listed", { total, page, limit });

    res.paginate(cycles, total);
  })
);

/**
 * GET /api/salary-cycle/:id
 * Get single salary cycle
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const cycle = await SalaryCycle.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    res.json({
      success: true,
      data: cycle
    });
  })
);

/**
 * GET /api/salary-cycle/org/:orgId/active
 * Get active salary cycle for organization
 */
router.get(
  "/org/:orgId/active",
  asyncHandler(async (req, res) => {
    const { orgId } = req.params;

    const cycle = await SalaryCycle.getActiveCycle(orgId)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "No active salary cycle found for organization"
      });
    }

    res.json({
      success: true,
      data: cycle
    });
  })
);

/**
 * POST /api/salary-cycle
 * Create new salary cycle
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      orgId,
      name,
      description,
      cycleStartDate,
      cycleEndDate,
      salaryPaymentDate,
      holdDays,
      workingDaysPerWeek,
      workingDaysPerMonth,
      leavePolicy,
      bonusPolicy,
      deductionPolicy,
      fnfPolicy,
      taxPolicy,
      createdBy
    } = req.body;

    if (
      !orgId ||
      !name ||
      cycleStartDate === undefined ||
      cycleEndDate === undefined ||
      salaryPaymentDate === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "orgId, name, cycleStartDate, cycleEndDate, and salaryPaymentDate are required"
      });
    }

    // Validate dates
    if (cycleStartDate < 1 || cycleStartDate > 31) {
      return res.status(400).json({
        success: false,
        message: "cycleStartDate must be between 1 and 31"
      });
    }

    if (cycleEndDate < 1 || cycleEndDate > 31) {
      return res.status(400).json({
        success: false,
        message: "cycleEndDate must be between 1 and 31"
      });
    }

    if (salaryPaymentDate < 1 || salaryPaymentDate > 31) {
      return res.status(400).json({
        success: false,
        message: "salaryPaymentDate must be between 1 and 31"
      });
    }

    // Check if active cycle already exists
    const existingActive = await SalaryCycle.findOne({
      orgId,
      isActive: true
    }).lean();

    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: "An active salary cycle already exists for this organization"
      });
    }

    const cycle = await SalaryCycle.create({
      orgId,
      name,
      description,
      cycleStartDate,
      cycleEndDate,
      salaryPaymentDate,
      holdDays: holdDays || 0,
      workingDaysPerWeek: workingDaysPerWeek || 5,
      workingDaysPerMonth: workingDaysPerMonth || 22,
      leavePolicy: leavePolicy || {},
      bonusPolicy: bonusPolicy || {},
      deductionPolicy: deductionPolicy || {},
      fnfPolicy: fnfPolicy || {},
      taxPolicy: taxPolicy || {},
      isActive: true,
      createdBy
    });

    const populated = await SalaryCycle.findById(cycle._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    logger.info("Salary cycle created", {
      salaryCycleId: cycle._id,
      orgId
    });

    res.status(201).json({
      success: true,
      message: "Salary cycle created successfully",
      data: populated
    });
  })
);

/**
 * PUT /api/salary-cycle/:id
 * Update salary cycle
 */
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.orgId;
    delete updateData.createdAt;
    delete updateData.createdBy;

    const cycle = await SalaryCycle.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    logger.info("Salary cycle updated", {
      salaryCycleId: id
    });

    res.json({
      success: true,
      message: "Salary cycle updated successfully",
      data: cycle
    });
  })
);

/**
 * PATCH /api/salary-cycle/:id/deactivate
 * Deactivate salary cycle
 */
router.patch(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const cycle = await SalaryCycle.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    )
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    logger.info("Salary cycle deactivated", {
      salaryCycleId: id
    });

    res.json({
      success: true,
      message: "Salary cycle deactivated successfully",
      data: cycle
    });
  })
);

/**
 * DELETE /api/salary-cycle/:id
 * Delete salary cycle
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const cycle = await SalaryCycle.findByIdAndDelete(req.params.id);

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    logger.info("Salary cycle deleted", {
      salaryCycleId: req.params.id
    });

    res.json({
      success: true,
      message: "Salary cycle deleted successfully"
    });
  })
);

export default router;
