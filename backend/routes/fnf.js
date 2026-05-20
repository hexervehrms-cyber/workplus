import express from "express";
import mongoose from "mongoose";
import FNFSettlement from "../models/FNFSettlement.js";
import Employee from "../models/Employee.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { paginationMiddleware } from "../middleware/pagination.js";
import fnfCalculationEngine from "../utils/fnfCalculationEngine.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.use(paginationMiddleware);

function userOrgId(user) {
  if (!user) return "";
  const o = user.orgId || user.tenantId;
  return o && o !== "system" ? String(o) : "";
}

function resolveListOrgId(req) {
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
 * GET /api/fnf
 * List FNF settlements (organization-scoped)
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = resolveListOrgId(req);
    if (scope.error) {
      return res.status(400).json({ success: false, message: scope.error });
    }

    const { page, limit, skip } = req.pagination;
    const { status, employeeId } = req.query;

    const query = { orgId: scope.orgId };

    if (status) {
      query.status = status;
    }

    if (employeeId) {
      query.employeeId = employeeId;
    }

    const total = await FNFSettlement.countDocuments(query);

    const settlements = await FNFSettlement.find(query)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email")
      .populate("approvedBy", "name email")
      .populate("paidBy", "name email")
      .sort({ terminationDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    logger.info("FNF settlements listed", { total, page, limit, orgId: scope.orgId });

    res.paginate(settlements, total);
  })
);

/**
 * GET /api/fnf/employee/:employeeId
 */
router.get(
  "/employee/:employeeId",
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const orgId =
      req.user?.role === "super_admin"
        ? req.query.orgId && String(req.query.orgId)
        : userOrgId(req.user);

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message:
          req.user?.role === "super_admin"
            ? "orgId query parameter is required"
            : "No organization assigned to this account"
      });
    }

    if (!canAccessOrg(req, orgId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const settlement = await FNFSettlement.findOne({
      employeeId,
      orgId
    })
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email")
      .populate("approvedBy", "name email")
      .populate("paidBy", "name email");

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "No FNF settlement found for this employee"
      });
    }

    res.json({
      success: true,
      data: settlement
    });
  })
);

/**
 * POST /api/fnf/calculate
 */
router.post(
  "/calculate",
  asyncHandler(async (req, res) => {
    const { employeeId, terminationDate, terminationReason, orgId: bodyOrgId } = req.body;

    const orgId =
      req.user?.role === "super_admin" ? bodyOrgId : userOrgId(req.user);

    if (!employeeId || !terminationDate || !terminationReason || !orgId) {
      return res.status(400).json({
        success: false,
        message:
          "employeeId, terminationDate, terminationReason, and orgId are required"
      });
    }

    if (!canAccessOrg(req, orgId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const employee = await Employee.findById(employeeId).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    if (String(employee.orgId || "") !== String(orgId)) {
      return res.status(400).json({
        success: false,
        message: "Employee does not belong to the specified organization"
      });
    }

    const existingFNF = await FNFSettlement.findOne({
      employeeId,
      orgId
    }).lean();

    if (existingFNF && existingFNF.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "FNF settlement already exists for this employee",
        data: existingFNF
      });
    }

    const fnfData = await fnfCalculationEngine.calculateFNF(
      employeeId,
      new Date(terminationDate),
      terminationReason,
      orgId
    );

    let settlement;

    if (existingFNF && existingFNF.status === "draft") {
      settlement = await FNFSettlement.findByIdAndUpdate(
        existingFNF._id,
        fnfData,
        { new: true }
      );
    } else {
      settlement = await fnfCalculationEngine.saveFNFSettlement(fnfData);
    }

    const populated = await FNFSettlement.findById(settlement._id)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email");

    logger.info("FNF calculated", {
      fnfSettlementId: settlement._id,
      employeeId,
      netSettlement: settlement.netSettlement
    });

    res.status(201).json({
      success: true,
      message: "FNF calculated successfully",
      data: populated
    });
  })
);

/**
 * GET /api/fnf/stats/summary
 */
router.get(
  "/stats/summary",
  asyncHandler(async (req, res) => {
    const scope = resolveListOrgId(req);
    if (scope.error) {
      return res.status(400).json({ success: false, message: scope.error });
    }

    const query = { orgId: scope.orgId };

    const [total, draft, calculated, approved, paid, rejected, totalPayout] =
      await Promise.all([
        FNFSettlement.countDocuments(query),
        FNFSettlement.countDocuments({ ...query, status: "draft" }),
        FNFSettlement.countDocuments({ ...query, status: "calculated" }),
        FNFSettlement.countDocuments({ ...query, status: "approved" }),
        FNFSettlement.countDocuments({ ...query, status: "paid" }),
        FNFSettlement.countDocuments({ ...query, status: "rejected" }),
        FNFSettlement.aggregate([
          { $match: { ...query, status: "paid" } },
          { $group: { _id: null, total: { $sum: "$netSettlement" } } }
        ])
      ]);

    res.json({
      success: true,
      data: {
        total,
        draft,
        calculated,
        approved,
        paid,
        rejected,
        totalPayout: totalPayout[0]?.total || 0
      }
    });
  })
);

/**
 * PUT /api/fnf/:id
 */
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found"
      });
    }

    const existing = await FNFSettlement.findById(id).lean();
    if (!existing || !canAccessOrg(req, existing.orgId)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be updated"
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.employeeId;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.createdBy;

    const settlement = await FNFSettlement.findOne({
      _id: id,
      status: "draft"
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be updated"
      });
    }

    const updated = await FNFSettlement.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    })
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email");

    logger.info("FNF settlement updated", {
      fnfSettlementId: id
    });

    res.json({
      success: true,
      message: "FNF settlement updated successfully",
      data: updated
    });
  })
);

/**
 * PATCH /api/fnf/:id/approve
 */
router.patch(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found"
      });
    }

    const approvedBy = req.body.approvedBy || req.user?.userId;
    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        message: "approvedBy is required"
      });
    }

    const settlement = await FNFSettlement.findOne({
      _id: id,
      status: "calculated"
    }).lean();

    if (!settlement || !canAccessOrg(req, settlement.orgId)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be approved"
      });
    }

    const updated = await fnfCalculationEngine.approveFNFSettlement(
      id,
      approvedBy
    );

    const populated = await FNFSettlement.findById(updated._id)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email")
      .populate("approvedBy", "name email");

    logger.info("FNF settlement approved", {
      fnfSettlementId: id,
      approvedBy
    });

    res.json({
      success: true,
      message: "FNF settlement approved successfully",
      data: populated
    });
  })
);

/**
 * PATCH /api/fnf/:id/mark-paid
 */
router.patch(
  "/:id/mark-paid",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found"
      });
    }

    const paidBy = req.body.paidBy || req.user?.userId;
    if (!paidBy) {
      return res.status(400).json({
        success: false,
        message: "paidBy is required"
      });
    }

    const settlement = await FNFSettlement.findOne({
      _id: id,
      status: "approved"
    }).lean();

    if (!settlement || !canAccessOrg(req, settlement.orgId)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be marked as paid"
      });
    }

    const updated = await fnfCalculationEngine.markFNFAsPaid(id, paidBy);

    const populated = await FNFSettlement.findById(updated._id)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email")
      .populate("paidBy", "name email");

    logger.info("FNF marked as paid", {
      fnfSettlementId: id,
      paidBy
    });

    res.json({
      success: true,
      message: "FNF marked as paid successfully",
      data: populated
    });
  })
);

/**
 * PATCH /api/fnf/:id/reject
 */
router.patch(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "rejectionReason is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found"
      });
    }

    const settlement = await FNFSettlement.findOne({
      _id: id,
      status: { $in: ["calculated", "approved"] }
    }).lean();

    if (!settlement || !canAccessOrg(req, settlement.orgId)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be rejected"
      });
    }

    const updated = await FNFSettlement.findByIdAndUpdate(
      id,
      {
        status: "rejected",
        rejectionReason
      },
      { new: true }
    )
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email");

    logger.info("FNF settlement rejected", {
      fnfSettlementId: id,
      reason: rejectionReason
    });

    res.json({
      success: true,
      message: "FNF settlement rejected successfully",
      data: updated
    });
  })
);

/**
 * DELETE /api/fnf/:id
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found"
      });
    }

    const existing = await FNFSettlement.findById(id).lean();
    if (!existing || !canAccessOrg(req, existing.orgId)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be deleted"
      });
    }

    const settlement = await FNFSettlement.findOneAndDelete({
      _id: id,
      status: "draft"
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be deleted"
      });
    }

    logger.info("FNF settlement deleted", {
      fnfSettlementId: id
    });

    res.json({
      success: true,
      message: "FNF settlement deleted successfully"
    });
  })
);

/**
 * GET /api/fnf/:id
 * Must be registered after static path segments
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found"
      });
    }

    const settlement = await FNFSettlement.findById(req.params.id)
      .populate("employeeId", "employeeCode department designation phone address")
      .populate("userId", "name email avatar")
      .populate("approvedBy", "name email")
      .populate("paidBy", "name email");

    if (!settlement || !canAccessOrg(req, settlement.orgId)) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found"
      });
    }

    res.json({
      success: true,
      data: settlement
    });
  })
);

export default router;
