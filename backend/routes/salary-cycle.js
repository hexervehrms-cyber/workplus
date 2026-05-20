import express from "express";
import mongoose from "mongoose";
import SalaryCycle from "../models/SalaryCycle.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { paginationMiddleware } from "../middleware/pagination.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.use(paginationMiddleware);

function userOrgId(user) {
  if (!user) return "";
  const o = user.orgId || user.tenantId;
  return o && o !== "system" ? String(o) : "";
}

function resolveOrgIdForList(req) {
  if (req.user?.role === "super_admin") {
    const q = req.query?.orgId;
    if (!q) {
      return { error: "orgId query parameter is required for super admin" };
    }
    return { orgId: String(q) };
  }
  const oid = userOrgId(req.user);
  if (!oid) {
    return { error: "No organization assigned to this account" };
  }
  return { orgId: oid };
}

function canAccessOrg(req, orgId) {
  if (!orgId) return false;
  if (req.user?.role === "super_admin") return true;
  return userOrgId(req.user) === String(orgId);
}

/**
 * GET /api/salary-cycle
 * List salary cycles with pagination (scoped by organization)
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = resolveOrgIdForList(req);
    if (scope.error) {
      return res.status(400).json({ success: false, message: scope.error });
    }

    const { page, limit, skip } = req.pagination;
    const { isActive } = req.query;

    const query = { orgId: scope.orgId };
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

    logger.info("Salary cycles listed", { total, page, limit, orgId: scope.orgId });

    res.paginate(cycles, total);
  })
);

/**
 * GET /api/salary-cycle/org/:orgId/active
 * Active salary cycle for an organization (registered before /:id)
 */
router.get(
  "/org/:orgId/active",
  asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    if (!canAccessOrg(req, orgId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

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
      orgId: bodyOrgId,
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
      taxPolicy
    } = req.body;

    const orgId =
      req.user?.role === "super_admin" ? bodyOrgId : userOrgId(req.user);

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required"
      });
    }

    if (!canAccessOrg(req, orgId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (
      !name ||
      cycleStartDate === undefined ||
      cycleEndDate === undefined ||
      salaryPaymentDate === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "name, cycleStartDate, cycleEndDate, and salaryPaymentDate are required"
      });
    }

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

    const createdBy = req.user?.userId;

    let cycle;
    try {
      cycle = await SalaryCycle.create({
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
    } catch (err) {
      if (err?.code === 11000) {
        cycle = await SalaryCycle.findOne({ orgId, isActive: true });
        if (cycle) {
          return res.status(409).json({
            success: false,
            message: "An active salary cycle already exists for this organization"
          });
        }
      }
      throw err;
    }

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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    const existing = await SalaryCycle.findById(id).lean();
    if (!existing || !canAccessOrg(req, existing.orgId)) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.orgId;
    delete updateData.createdAt;
    delete updateData.createdBy;
    updateData.updatedBy = req.user?.userId;

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
 */
router.patch(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    const existing = await SalaryCycle.findById(id).lean();
    if (!existing || !canAccessOrg(req, existing.orgId)) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    const cycle = await SalaryCycle.findByIdAndUpdate(
      id,
      { isActive: false, updatedBy: req.user?.userId },
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
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    const existing = await SalaryCycle.findById(id).lean();
    if (!existing || !canAccessOrg(req, existing.orgId)) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    const cycle = await SalaryCycle.findByIdAndDelete(id);

    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    logger.info("Salary cycle deleted", {
      salaryCycleId: id
    });

    res.json({
      success: true,
      message: "Salary cycle deleted successfully"
    });
  })
);

/**
 * GET /api/salary-cycle/:id
 * Single cycle (registered after static paths)
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "Salary cycle not found"
      });
    }

    const cycle = await SalaryCycle.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!cycle || !canAccessOrg(req, cycle.orgId)) {
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

export default router;
