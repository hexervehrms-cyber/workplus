import express from "express";
import FNFSettlement from "../models/FNFSettlement.js";
import Employee from "../models/Employee.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { paginationMiddleware } from "../middleware/pagination.js";
import fnfCalculationEngine from "../utils/fnfCalculationEngine.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.use(paginationMiddleware);

/**
 * GET /api/fnf
 * List all FNF settlements with pagination
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = req.pagination;
    const { orgId, status, employeeId } = req.query;

    const query = {};

    if (orgId) {
      query.orgId = orgId;
    }

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

    logger.info("FNF settlements listed", { total, page, limit });

    res.paginate(settlements, total);
  })
);

/**
 * GET /api/fnf/:id
 * Get single FNF settlement
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const settlement = await FNFSettlement.findById(req.params.id)
      .populate("employeeId", "employeeCode department designation phone address")
      .populate("userId", "name email avatar")
      .populate("approvedBy", "name email")
      .populate("paidBy", "name email");

    if (!settlement) {
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

/**
 * GET /api/fnf/employee/:employeeId
 * Get FNF settlement for specific employee
 */
router.get(
  "/employee/:employeeId",
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "orgId is required"
      });
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
 * Calculate FNF for an employee
 */
router.post(
  "/calculate",
  asyncHandler(async (req, res) => {
    const { employeeId, terminationDate, terminationReason, orgId } = req.body;

    if (!employeeId || !terminationDate || !terminationReason || !orgId) {
      return res.status(400).json({
        success: false,
        message:
          "employeeId, terminationDate, terminationReason, and orgId are required"
      });
    }

    // Check if employee exists
    const employee = await Employee.findById(employeeId).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Check if FNF already exists
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

    // Calculate FNF
    const fnfData = await fnfCalculationEngine.calculateFNF(
      employeeId,
      new Date(terminationDate),
      terminationReason,
      orgId
    );

    // Save FNF settlement
    let settlement;

    if (existingFNF && existingFNF.status === "draft") {
      // Update existing draft
      settlement = await FNFSettlement.findByIdAndUpdate(
        existingFNF._id,
        fnfData,
        { new: true }
      );
    } else {
      // Create new
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
 * PUT /api/fnf/:id
 * Update FNF settlement (only draft status)
 */
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
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
 * Approve FNF settlement
 */
router.patch(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { approvedBy } = req.body;

    if (!approvedBy) {
      return res.status(400).json({
        success: false,
        message: "approvedBy is required"
      });
    }

    const settlement = await FNFSettlement.findOne({
      _id: id,
      status: "calculated"
    });

    if (!settlement) {
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
 * Mark FNF as paid
 */
router.patch(
  "/:id/mark-paid",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paidBy } = req.body;

    if (!paidBy) {
      return res.status(400).json({
        success: false,
        message: "paidBy is required"
      });
    }

    const settlement = await FNFSettlement.findOne({
      _id: id,
      status: "approved"
    });

    if (!settlement) {
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
 * Reject FNF settlement
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

    const settlement = await FNFSettlement.findOne({
      _id: id,
      status: { $in: ["calculated", "approved"] }
    });

    if (!settlement) {
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
 * Delete FNF settlement (only draft status)
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const settlement = await FNFSettlement.findOneAndDelete({
      _id: req.params.id,
      status: "draft"
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: "FNF settlement not found or cannot be deleted"
      });
    }

    logger.info("FNF settlement deleted", {
      fnfSettlementId: req.params.id
    });

    res.json({
      success: true,
      message: "FNF settlement deleted successfully"
    });
  })
);

/**
 * GET /api/fnf/stats/summary
 * Get FNF statistics
 */
router.get(
  "/stats/summary",
  asyncHandler(async (req, res) => {
    const { orgId } = req.query;

    const query = {};

    if (orgId) {
      query.orgId = orgId;
    }

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

export default router;
