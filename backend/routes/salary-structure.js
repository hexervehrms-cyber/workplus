import express from "express";
import mongoose from "mongoose";
import SalaryStructure from "../models/SalaryStructure.js";
import Employee from "../models/Employee.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { paginationMiddleware } from "../middleware/pagination.js";
import salaryCalculationEngine from "../utils/salaryCalculationEngine.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.use(paginationMiddleware);

/**
 * GET /api/salary-structure
 * List all salary structures with pagination
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = req.pagination;
    const { orgId, employeeId } = req.query;

    const query = {};

    if (orgId) {
      query.orgId = orgId;
    }

    if (employeeId) {
      query.employeeId = employeeId;
    }

    const total = await SalaryStructure.countDocuments(query);

    const structures = await SalaryStructure.find(query)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    logger.info("Salary structures listed", { total, page, limit });

    res.paginate(structures, total);
  })
);

/**
 * GET /api/salary-structure/employee/:employeeId
 * Get salary structure for specific employee
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

    const structure = await SalaryStructure.findByEmployee(employeeId, orgId)
      .populate("employeeId", "employeeCode department designation joiningDate")
      .populate("userId", "name email");

    if (!structure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found"
      });
    }

    res.json({
      success: true,
      data: structure
    });
  })
);

/**
 * GET /api/salary-structure/:id
 * Get single salary structure
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const structure = await SalaryStructure.findById(req.params.id)
      .populate("employeeId", "employeeCode department designation joiningDate")
      .populate("userId", "name email");

    if (!structure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found"
      });
    }

    res.json({
      success: true,
      data: structure
    });
  })
);

/**
 * POST /api/salary-structure
 * Create new salary structure
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      employeeId,
      userId,
      orgId,
      structures,
      notes
    } = req.body;

    if (!employeeId || !userId || !orgId || !structures || structures.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "employeeId, userId, orgId, and structures array are required"
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

    // Check if structure already exists
    const existingStructure = await SalaryStructure.findOne({
      employeeId,
      orgId
    }).lean();

    if (existingStructure) {
      return res.status(400).json({
        success: false,
        message: "Salary structure already exists for this employee"
      });
    }

    // Calculate gross, deductions, and net for each structure
    const processedStructures = structures.map((s) => {
      const grossSalary = salaryCalculationEngine.calculateGrossSalary(s);
      const totalDeductions =
        salaryCalculationEngine.calculateTotalDeductions(s);
      const netSalary = grossSalary - totalDeductions;

      return {
        ...s,
        grossSalary,
        totalDeductions,
        netSalary,
        dailyWage: s.dailyWage || 0
      };
    });

    const salaryStructure = await SalaryStructure.create({
      employeeId,
      userId,
      orgId,
      structures: processedStructures,
      notes
    });

    const populated = await SalaryStructure.findById(salaryStructure._id)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email");

    logger.info("Salary structure created", {
      salaryStructureId: salaryStructure._id,
      employeeId
    });

    res.status(201).json({
      success: true,
      message: "Salary structure created successfully",
      data: populated
    });
  })
);

/**
 * PUT /api/salary-structure/:id
 * Update salary structure
 */
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { structures, notes, activeStructure } = req.body;

    const salaryStructure = await SalaryStructure.findById(id);

    if (!salaryStructure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found"
      });
    }

    // Update structures if provided
    if (structures && Array.isArray(structures)) {
      const processedStructures = structures.map((s) => {
        const grossSalary = salaryCalculationEngine.calculateGrossSalary(s);
        const totalDeductions =
          salaryCalculationEngine.calculateTotalDeductions(s);
        const netSalary = grossSalary - totalDeductions;

        return {
          ...s,
          grossSalary,
          totalDeductions,
          netSalary,
          dailyWage: s.dailyWage || 0
        };
      });

      salaryStructure.structures = processedStructures;
    }

    if (notes !== undefined) {
      salaryStructure.notes = notes;
    }

    if (activeStructure !== undefined) {
      salaryStructure.activeStructure = activeStructure;
    }

    await salaryStructure.save();

    const updated = await SalaryStructure.findById(id)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email");

    logger.info("Salary structure updated", {
      salaryStructureId: id,
      employeeId: salaryStructure.employeeId
    });

    res.json({
      success: true,
      message: "Salary structure updated successfully",
      data: updated
    });
  })
);

/**
 * POST /api/salary-structure/:id/add-structure
 * Add new salary structure entry (for salary changes)
 */
router.post(
  "/:id/add-structure",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const newStructure = req.body;

    if (!newStructure.fromDate || !newStructure.baseSalary) {
      return res.status(400).json({
        success: false,
        message: "fromDate and baseSalary are required"
      });
    }

    const salaryStructure = await SalaryStructure.findById(id);

    if (!salaryStructure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found"
      });
    }

    // Close previous structure if it's still open
    if (salaryStructure.structures.length > 0) {
      const lastStructure =
        salaryStructure.structures[salaryStructure.structures.length - 1];
      if (!lastStructure.toDate) {
        lastStructure.toDate = new Date(newStructure.fromDate);
        lastStructure.toDate.setDate(lastStructure.toDate.getDate() - 1);
      }
    }

    // Calculate gross, deductions, and net
    const grossSalary = salaryCalculationEngine.calculateGrossSalary(
      newStructure
    );
    const totalDeductions =
      salaryCalculationEngine.calculateTotalDeductions(newStructure);
    const netSalary = grossSalary - totalDeductions;

    salaryStructure.structures.push({
      ...newStructure,
      grossSalary,
      totalDeductions,
      netSalary,
      dailyWage: newStructure.dailyWage || 0
    });

    await salaryStructure.save();

    const updated = await SalaryStructure.findById(id)
      .populate("employeeId", "employeeCode department designation")
      .populate("userId", "name email");

    logger.info("New salary structure added", {
      salaryStructureId: id,
      fromDate: newStructure.fromDate
    });

    res.json({
      success: true,
      message: "New salary structure added successfully",
      data: updated
    });
  })
);

/**
 * GET /api/salary-structure/:id/history
 * Get salary structure history for employee
 */
router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const salaryStructure = await SalaryStructure.findById(id).lean();

    if (!salaryStructure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found"
      });
    }

    const history = salaryStructure.structures.map((s) => ({
      fromDate: s.fromDate,
      toDate: s.toDate,
      baseSalary: s.baseSalary,
      hra: s.hra,
      allowances:
        (s.dearness || 0) +
        (s.conveyance || 0) +
        (s.medical || 0) +
        (s.otherAllowances || 0),
      grossSalary: s.grossSalary,
      netSalary: s.netSalary,
      payFrequency: s.payFrequency,
      dailyWage: s.dailyWage
    }));

    res.json({
      success: true,
      data: history
    });
  })
);

/**
 * DELETE /api/salary-structure/:id
 * Delete salary structure
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const salaryStructure = await SalaryStructure.findByIdAndDelete(
      req.params.id
    );

    if (!salaryStructure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found"
      });
    }

    logger.info("Salary structure deleted", {
      salaryStructureId: req.params.id
    });

    res.json({
      success: true,
      message: "Salary structure deleted successfully"
    });
  })
);

export default router;
