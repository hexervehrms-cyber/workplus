/**
 * Salary Routes
 * Handles salary structure and salary slip management
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import SalaryStructure from "../models/SalaryStructure.js";
import SalarySlip from "../models/SalarySlip.js";
import Payslip from "../models/Payroll.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.js";
import EmailNotificationService from "../utils/emailNotificationService.js";
import logger from "../utils/logger.js";
import { aggregateStructureMoney } from "../utils/payrollMoney.js";
import { emitKPIUpdate } from "../utils/kpiUpdater.js";
import {
  employeeLookupQuery,
  structureLookupQuery,
  isSuperAdmin,
  findScopedEmployee,
  userOrgIdFromReq
} from "../utils/orgScopeHelpers.js";
import { buildSalarySlipHtml } from "../utils/salarySlipHtml.js";
import Organization from "../models/Organization.js";
import { findEmployeeForSelfService } from "../utils/employeeSelfService.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const payslipUploadDir = path.join(__dirname, "..", "uploads", "payslips");
const payslipUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      if (!fs.existsSync(payslipUploadDir)) {
        fs.mkdirSync(payslipUploadDir, { recursive: true });
      }
      cb(null, payslipUploadDir);
    },
    filename(_req, file, cb) {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `payslip-${unique}${path.extname(file.originalname) || ".pdf"}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "text/csv",
      "application/vnd.ms-excel",
    ];
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith(".csv"));
  },
});

const router = express.Router();

/**
 * Ensures the caller may read salary-slip data for the given employee (tenant isolation).
 * Admin / HR / super_admin: employee must belong to the same org (super_admin: any org).
 * Everyone else: only their own employee id.
 */
async function assertCanAccessEmployeeSalaryData(req, employeeId) {
  const privileged = ["super_admin", "admin", "hr"];
  if (privileged.includes(req.user.role)) {
    const emp = await findScopedEmployee(req, employeeId);
    if (!emp) {
      return { ok: false, status: 404, message: "Employee not found" };
    }
    if (req.user.role === "super_admin") {
      return { ok: true };
    }
    const callerOrg = userOrgIdFromReq(req) || req.user.orgId;
    if (callerOrg && emp.orgId && String(emp.orgId) !== String(callerOrg)) {
      return { ok: false, status: 403, message: "Forbidden" };
    }
    return { ok: true };
  }

  const callerOrg = userOrgIdFromReq(req) || req.user.orgId;
  const self = await Employee.findOne({
    userId: req.user.userId,
    ...(callerOrg ? { orgId: String(callerOrg) } : {}),
  })
    .select("_id")
    .lean();

  if (!self || String(self._id) !== String(employeeId)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: true };
}

function resolveSalaryListOrgId(req) {
  if (isSuperAdmin(req)) {
    const q = req.query.orgId ? String(req.query.orgId).trim() : "";
    return q || null;
  }
  return String(req.user.orgId);
}

async function assertSlipOrgAccess(req, slip) {
  if (!slip) {
    return { ok: false, status: 404, message: "Salary slip not found" };
  }
  if (isSuperAdmin(req)) {
    return { ok: true };
  }
  const callerOrg = userOrgIdFromReq(req) || req.user.orgId;
  if (!callerOrg || !slip.orgId) {
    return { ok: true };
  }
  if (String(slip.orgId) !== String(callerOrg)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: true };
}

/**
 * POST /api/salary/structure
 * Create a new salary structure
 */
router.post(
  "/structure",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const {
        employeeId,
        employeeType,
        effectiveFrom,
        earnings,
        deductions,
        notes
      } = req.body;

      if (!employeeId || !employeeType || !effectiveFrom) {
        return sendError(res, "Missing required fields", 400, "VALIDATION_ERROR");
      }

      const employee = await findScopedEmployee(req, employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      const structureOrgId = employee.orgId || userOrgIdFromReq(req) || req.user.orgId;
      if (!isSuperAdmin(req) && String(structureOrgId) !== String(req.user.orgId)) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      const { grossEarnings, totalDeductions, netSalary } = aggregateStructureMoney(earnings, deductions);
      const costToCompany = grossEarnings + (deductions?.providentFund || 0) * 0.12; // Employer PF contribution

      const salaryStructure = await SalaryStructure.create({
        employeeId: employee._id,
        userId: employee.userId,
        employeeType,
        orgId: structureOrgId,
        location: "Noida",
        effectiveFrom: new Date(effectiveFrom),
        earnings: earnings || {},
        deductions: deductions || {},
        grossEarnings,
        totalDeductions,
        netSalary,
        costToCompany,
        notes,
        createdBy: req.user.userId,
        status: "pending_approval"
      });

      logger.info("Salary structure created", {
        salaryStructureId: salaryStructure._id,
        employeeId,
        createdBy: req.user.userId
      });

      return sendSuccess(res, salaryStructure, "Salary structure created successfully", 201);
    } catch (error) {
      logger.error("Create salary structure error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to create salary structure", 500, "CREATE_ERROR");
    }
  })
);

/**
 * PUT /api/salary/structure/:structureId
 * Update an existing salary structure
 */
router.put(
  "/structure/:structureId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { structureId } = req.params;
      const {
        employeeType,
        effectiveFrom,
        earnings,
        deductions,
        notes
      } = req.body;

      const structure = await SalaryStructure.findOne(structureLookupQuery(req, structureId));
      if (!structure) {
        return sendError(res, "Salary structure not found", 404, "NOT_FOUND");
      }

      const { grossEarnings, totalDeductions, netSalary } = aggregateStructureMoney(earnings, deductions);
      const costToCompany = grossEarnings + (deductions?.providentFund || 0) * 0.12;

      const updatedStructure = await SalaryStructure.findOneAndUpdate(
        structureLookupQuery(req, structureId),
        {
          employeeType,
          effectiveFrom: new Date(effectiveFrom),
          earnings: earnings || {},
          deductions: deductions || {},
          grossEarnings,
          totalDeductions,
          netSalary,
          costToCompany,
          notes,
          updatedBy: req.user.userId,
          updatedAt: new Date()
        },
        { new: true }
      );

      logger.info("Salary structure updated", {
        salaryStructureId: structureId,
        updatedBy: req.user.userId
      });

      return sendSuccess(res, updatedStructure, "Salary structure updated successfully");
    } catch (error) {
      logger.error("Update salary structure error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to update salary structure", 500, "UPDATE_ERROR");
    }
  })
);

/**
 * GET /api/salary/structures/by-id/:structureId
 * Single structure for admin edit (avoids pagination and ambiguous /structure/:id routes)
 */
router.get(
  "/structures/by-id/:structureId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { structureId } = req.params;
      const structure = await SalaryStructure.findOne(structureLookupQuery(req, structureId))
        .populate("employeeId", "firstName lastName employeeCode")
        .lean();

      if (!structure) {
        return sendError(res, "Salary structure not found", 404, "NOT_FOUND");
      }

      return sendSuccess(res, structure, "Salary structure fetched successfully");
    } catch (error) {
      logger.error("Get salary structure by id error", {
        error: error.message,
        structureId: req.params.structureId
      });
      return sendError(res, "Failed to fetch salary structure", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/salary/structure/:employeeId
 * Get salary structure for an employee
 */
router.get(
  "/structure/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;

      const access = await assertCanAccessEmployeeSalaryData(req, employeeId);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      const emp = await findScopedEmployee(req, employeeId);
      const structureOrgId = emp?.orgId || userOrgIdFromReq(req) || req.user.orgId;

      const salaryStructure = await SalaryStructure.findOne({
        employeeId: emp?._id || employeeId,
        orgId: structureOrgId,
        status: "approved"
      })
        .sort({ effectiveFrom: -1 })
        .populate("employeeId", "firstName lastName employeeCode")
        .populate("approvedBy", "name email");

      if (!salaryStructure) {
        return sendError(res, "Salary structure not found", 404, "NOT_FOUND");
      }

      return sendSuccess(res, salaryStructure, "Salary structure fetched successfully");
    } catch (error) {
      logger.error("Get salary structure error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch salary structure", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/salary/structures
 * Get all salary structures (admin/hr only)
 */
router.get(
  "/structures",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 10, status = "all", employeeId } = req.query;
      const skip = (page - 1) * limit;

      const query = {};
      if (isSuperAdmin(req)) {
        if (!req.query.orgId) {
          return sendError(
            res,
            "orgId query parameter is required",
            400,
            "VALIDATION_ERROR"
          );
        }
        query.orgId = String(req.query.orgId);
      } else {
        query.orgId = String(req.user.orgId);
      }
      if (status !== "all") {
        query.status = status;
      }
      if (employeeId) {
        query.employeeId = employeeId;
      }

      const total = await SalaryStructure.countDocuments(query);
      const structures = await SalaryStructure.find(query)
        .populate("employeeId", "firstName lastName employeeCode")
        .populate("approvedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      return sendPaginated(res, structures, total, page, limit, "Salary structures fetched successfully");
    } catch (error) {
      logger.error("Get salary structures error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to fetch salary structures", 500, "FETCH_ERROR");
    }
  })
);

/**
 * PUT /api/salary/structure/:structureId/approve
 * Approve a salary structure
 */
router.put(
  "/structure/:structureId/approve",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { structureId } = req.params;

      const structure = await SalaryStructure.findOneAndUpdate(
        structureLookupQuery(req, structureId),
        {
          status: "approved",
          approvedBy: req.user.userId,
          approvalDate: new Date()
        },
        { new: true }
      );

      if (!structure) {
        return sendError(res, "Salary structure not found", 404, "NOT_FOUND");
      }

      logger.info("Salary structure approved", {
        structureId,
        approvedBy: req.user.userId
      });

      return sendSuccess(res, structure, "Salary structure approved successfully");
    } catch (error) {
      logger.error("Approve salary structure error", {
        error: error.message,
        structureId: req.params.structureId
      });
      return sendError(res, "Failed to approve salary structure", 500, "UPDATE_ERROR");
    }
  })
);

/**
 * PUT /api/salary/structure/:structureId/reject
 * Reject a salary structure
 */
router.put(
  "/structure/:structureId/reject",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { structureId } = req.params;
      const { rejectionReason } = req.body;

      const structure = await SalaryStructure.findOneAndUpdate(
        structureLookupQuery(req, structureId),
        {
          status: "rejected",
          rejectionReason,
          approvedBy: req.user.userId,
          approvalDate: new Date()
        },
        { new: true }
      );

      if (!structure) {
        return sendError(res, "Salary structure not found", 404, "NOT_FOUND");
      }

      logger.info("Salary structure rejected", {
        structureId,
        rejectedBy: req.user.userId
      });

      return sendSuccess(res, structure, "Salary structure rejected successfully");
    } catch (error) {
      logger.error("Reject salary structure error", {
        error: error.message,
        structureId: req.params.structureId
      });
      return sendError(res, "Failed to reject salary structure", 500, "UPDATE_ERROR");
    }
  })
);

/**
 * POST /api/salary/slip/generate
 * Generate salary slip for an employee for a specific month
 */
router.post(
  "/slip/generate",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { employeeId, month, year } = req.body;

      if (!employeeId || !month || !year) {
        return sendError(res, "Missing required fields", 400, "VALIDATION_ERROR");
      }

      const employee = await findScopedEmployee(req, employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      const slipOrgId = employee.orgId || userOrgIdFromReq(req) || req.user.orgId;

      // Get approved salary structure
      const salaryStructure = await SalaryStructure.findOne({
        employeeId: employee._id,
        orgId: slipOrgId,
        status: "approved"
      }).sort({ effectiveFrom: -1 });

      if (!salaryStructure) {
        return sendError(res, "No approved salary structure found for this employee", 400, "VALIDATION_ERROR");
      }

      // Calculate attendance data
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendanceRecords = await Attendance.find({
        userId: employee.userId,
        orgId: slipOrgId,
        date: { $gte: startDate, $lte: endDate }
      });

      const presentDays = attendanceRecords.filter(r => r.status === "present").length;
      const absentDays = attendanceRecords.filter(r => r.status === "absent").length;
      const halfDays = attendanceRecords.filter(r => r.status === "half-day").length;

      // Get approved leaves for the month
      const approvedLeaves = await LeaveRequest.find({
        userId: employee.userId,
        status: "approved",
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      });

      let leavesTaken = 0;
      approvedLeaves.forEach(leave => {
        const start = new Date(Math.max(leave.startDate, startDate));
        const end = new Date(Math.min(leave.endDate, endDate));
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        leavesTaken += days;
      });

      const totalWorkingDays = attendanceRecords.length;

      // Calculate leave deduction (1 day leave = 1/30 of basic salary)
      const leaveDeduction = (leavesTaken / 30) * salaryStructure.earnings.basic;

      // Calculate earnings
      const earnings = {
        basic: salaryStructure.earnings.basic || 0,
        hra: salaryStructure.earnings.hra || 0,
        medicalExpenses: salaryStructure.earnings.medicalExpenses || 0,
        travel: salaryStructure.earnings.travel || 0,
        internetCharges: salaryStructure.earnings.internetCharges || 0,
        nightShiftAllowance: salaryStructure.earnings.nightShiftAllowance || 0,
        incentives: salaryStructure.earnings.incentives || 0,
        bonus: salaryStructure.earnings.bonus || 0,
        commission: salaryStructure.earnings.commission || 0,
        otherEarnings: salaryStructure.earnings.otherEarnings || []
      };

      const deductions = {
        providentFund: salaryStructure.deductions.providentFund || 0,
        employeeStateInsurance: salaryStructure.deductions.employeeStateInsurance || 0,
        professionalTax: salaryStructure.deductions.professionalTax || 0,
        incomeTax: salaryStructure.deductions.incomeTax || 0,
        leaveDeduction: leaveDeduction > 0 ? Math.round(leaveDeduction * 100) / 100 : 0,
        otherDeductions: salaryStructure.deductions.otherDeductions || []
      };

      const { grossEarnings, totalDeductions, netSalary } = aggregateStructureMoney(earnings, deductions);

      const resolvedEmployeeId = employee._id;

      // Create or update salary slip
      let salarySlip = await SalarySlip.findOne({
        employeeId: resolvedEmployeeId,
        month,
        year,
        orgId: slipOrgId
      });

      if (salarySlip) {
        // Update existing slip
        salarySlip.earnings = earnings;
        salarySlip.deductions = deductions;
        salarySlip.grossEarnings = grossEarnings;
        salarySlip.totalDeductions = totalDeductions;
        salarySlip.netSalary = netSalary;
        salarySlip.attendanceData = {
          totalWorkingDays,
          presentDays,
          absentDays,
          leavesTaken,
          halfDays
        };
        await salarySlip.save();
      } else {
        // Create new slip
        salarySlip = await SalarySlip.create({
          employeeId: resolvedEmployeeId,
          userId: employee.userId,
          salaryStructureId: salaryStructure._id,
          orgId: slipOrgId,
          month,
          year,
          earnings,
          deductions,
          grossEarnings,
          totalDeductions,
          netSalary,
          attendanceData: {
            totalWorkingDays,
            presentDays,
            absentDays,
            leavesTaken,
            halfDays
          },
          createdBy: req.user.userId,
          status: "draft"
        });
      }

      logger.info("Salary slip generated", {
        salarySlipId: salarySlip._id,
        employeeId,
        month,
        year
      });

      if (global.io && req.user.orgId) {
        emitKPIUpdate(global.io, req.user.orgId, 'payroll', {
          action: 'slip_generated',
          salarySlipId: salarySlip._id,
        }).catch((err) =>
          logger.warn('KPI emit after salary slip generate failed', { error: err.message })
        );
      }

      return sendSuccess(res, salarySlip, "Salary slip generated successfully", 201);
    } catch (error) {
      logger.error("Generate salary slip error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to generate salary slip", 500, "GENERATION_ERROR");
    }
  })
);

/**
 * GET /api/salary/slips/all
 * Get all salary slips (admin/hr only)
 */
router.get(
  "/slips/all",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 10, status = "all" } = req.query;
      const skip = (page - 1) * limit;

      const listOrgId = resolveSalaryListOrgId(req);
      if (!listOrgId) {
        return sendError(res, "orgId query parameter is required", 400, "VALIDATION_ERROR");
      }

      const query = { orgId: listOrgId };
      if (status !== "all") {
        query.status = status;
      }

      const total = await SalarySlip.countDocuments(query);
      const slips = await SalarySlip.find(query)
        .populate("employeeId", "firstName lastName employeeCode")
        .populate("approvedBy", "name email")
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Add employee name to each slip
      const slipsWithNames = slips.map(slip => ({
        ...slip,
        employeeName: slip.employeeId ? `${slip.employeeId.firstName} ${slip.employeeId.lastName}` : 'Unknown'
      }));

      return sendPaginated(res, slipsWithNames, total, page, limit, "Salary slips fetched successfully");
    } catch (error) {
      logger.error("Get all salary slips error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to fetch salary slips", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/salary/slip/by-id/:slipId
 * Get full salary slip details (admin / owner)
 */
router.get(
  "/slip/by-id/:slipId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { slipId } = req.params;

      const slip = await SalarySlip.findById(slipId)
        .populate("employeeId", "firstName lastName employeeCode email department designation userId")
        .populate("approvedBy", "name email")
        .lean();

      if (!slip) {
        return sendError(res, "Salary slip not found", 404, "NOT_FOUND");
      }

      const isPrivileged = ["admin", "hr", "super_admin"].includes(req.user.role);
      const employeeId = slip.employeeId?._id || slip.employeeId;
      if (!isPrivileged) {
        const access = await assertCanAccessEmployeeSalaryData(req, employeeId);
        if (!access.ok) {
          return sendError(
            res,
            access.message,
            access.status,
            access.status === 403 ? "FORBIDDEN" : "NOT_FOUND"
          );
        }
      }

      const orgAccess = await assertSlipOrgAccess(req, slip);
      if (!orgAccess.ok) {
        return sendError(res, orgAccess.message, orgAccess.status, orgAccess.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      const employeeDoc = slip.employeeId;
      const employeeName = employeeDoc
        ? `${employeeDoc.firstName || ""} ${employeeDoc.lastName || ""}`.trim()
        : slip.employeeName || "Unknown";

      return sendSuccess(res, { ...slip, employeeName }, "Salary slip fetched successfully");
    } catch (error) {
      logger.error("Get salary slip by id error", {
        error: error.message,
        slipId: req.params.slipId
      });
      return sendError(res, "Failed to fetch salary slip", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/salary/slip/:employeeId/:month/:year
 * Get salary slip for an employee for a specific month
 */
router.get(
  "/slip/:employeeId/:month/:year",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId, month, year } = req.params;

      const access = await assertCanAccessEmployeeSalaryData(req, employeeId);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      const emp = await Employee.findById(employeeId).select("orgId").lean();
      const slipOrgId =
        isSuperAdmin(req) && emp?.orgId
          ? String(emp.orgId)
          : String(req.user.orgId);

      // Employee role: only see released/approved slips
      const isEmployee = req.user.role === "employee";
      const statusFilter = isEmployee ? { status: { $in: ["approved", "released"] } } : {};

      const salarySlip = await SalarySlip.findOne({
        employeeId,
        month: parseInt(month),
        year: parseInt(year),
        orgId: slipOrgId,
        ...statusFilter
      })
        .populate("employeeId", "firstName lastName employeeCode")
        .populate("userId", "email")
        .populate("approvedBy", "name email");

      if (!salarySlip) {
        return sendError(res, "Salary slip not found", 404, "NOT_FOUND");
      }

      return sendSuccess(res, salarySlip, "Salary slip fetched successfully");
    } catch (error) {
      logger.error("Get salary slip error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch salary slip", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/salary/slips/:employeeId
 * Get all salary slips for an employee
 * - Employee role: only see released/approved slips
 * - Admin/HR: see all slips for same org
 * - Super admin: see all slips
 */
router.get(
  "/slips/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { page = 1, limit = 12 } = req.query;
      const skip = (page - 1) * limit;

      const access = await assertCanAccessEmployeeSalaryData(req, employeeId);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      const emp = await Employee.findById(employeeId).select("orgId").lean();
      const slipOrgId =
        isSuperAdmin(req) && emp?.orgId
          ? String(emp.orgId)
          : String(req.user.orgId);

      // Employee role: only see released/approved slips
      const isEmployee = req.user.role === "employee";
      const statusFilter = isEmployee ? { status: { $in: ["approved", "released"] } } : {};

      const total = await SalarySlip.countDocuments({
        employeeId,
        orgId: slipOrgId,
        ...statusFilter
      });

      const slips = await SalarySlip.find({
        employeeId,
        orgId: slipOrgId,
        ...statusFilter
      })
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      return sendPaginated(res, slips, total, page, limit, "Salary slips fetched successfully");
    } catch (error) {
      logger.error("Get salary slips error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch salary slips", 500, "FETCH_ERROR");
    }
  })
);

/**
 * PUT /api/salary/slip/:slipId/approve
 * Approve a salary slip
 */
router.put(
  "/slip/:slipId/approve",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { slipId } = req.params;

      const existing = await SalarySlip.findById(slipId).lean();
      const orgAccess = await assertSlipOrgAccess(req, existing);
      if (!orgAccess.ok) {
        return sendError(res, orgAccess.message, orgAccess.status, orgAccess.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      const slip = await SalarySlip.findByIdAndUpdate(
        slipId,
        {
          status: "approved",
          approvedBy: req.user.userId,
          approvalDate: new Date()
        },
        { new: true }
      ).populate({
        path: "employeeId",
        populate: {
          path: "userId",
          select: "name email"
        }
      });

      if (!slip) {
        return sendError(res, "Salary slip not found", 404, "NOT_FOUND");
      }

      logger.info("Salary slip approved", {
        slipId,
        approvedBy: req.user.userId
      });

      // Send email notification to employee
      try {
        const employee = {
          _id: slip.employeeId._id,
          name: slip.employeeId.userId?.name || slip.employeeName,
          email: slip.employeeId.userId?.email
        };

        if (employee.email) {
          await EmailNotificationService.sendSalarySlipApprovedEmail(employee, {
            _id: slip._id,
            month: slip.month,
            year: slip.year,
            grossEarnings: slip.grossEarnings,
            netSalary: slip.netSalary
          });
          
          logger.info("Salary slip approval email sent", {
            slipId,
            employeeEmail: employee.email
          });
        } else {
          logger.warn("Employee email not found, skipping email notification", {
            slipId,
            employeeId: slip.employeeId._id
          });
        }
      } catch (emailError) {
        // Log error but don't fail the approval
        logger.error("Failed to send salary slip approval email", {
          error: emailError.message,
          slipId
        });
      }

      return sendSuccess(res, slip, "Salary slip approved successfully");
    } catch (error) {
      logger.error("Approve salary slip error", {
        error: error.message,
        slipId: req.params.slipId
      });
      return sendError(res, "Failed to approve salary slip", 500, "UPDATE_ERROR");
    }
  })
);

/**
 * GET /api/salary/slip/:slipId/download
 * Download salary slip as PDF
 * Employee role: can only download approved/released slips
 * Admin/HR/Super_admin: can download any slip
 */
router.get(
  "/slip/:slipId/download",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { slipId } = req.params;

      const slip = await SalarySlip.findById(slipId)
        .populate({
          path: "employeeId",
          select:
            "firstName lastName employeeCode email userId department designation joiningDate",
          populate: { path: "userId", select: "_id" }
        })
        .populate("salaryStructureId")
        .lean();

      if (!slip) {
        return sendError(res, "Salary slip not found", 404, "NOT_FOUND");
      }

      // Check authorization (userId on slip, or owning employee's user)
      const slipOwnerUserId =
        slip.userId == null
          ? null
          : slip.userId._id
            ? slip.userId._id.toString()
            : slip.userId.toString();
      const employeeDoc = slip.employeeId || {};
      let employeeUserId = null;
      if (employeeDoc?.userId) {
        const u = employeeDoc.userId;
        employeeUserId = (u._id || u).toString();
      }
      const requestUserId = req.user.userId?.toString?.() || String(req.user.userId);
      const isOwner =
        (slipOwnerUserId != null && slipOwnerUserId === requestUserId) ||
        (employeeUserId != null && employeeUserId === requestUserId);
      const isPrivileged = ["admin", "hr", "super_admin"].includes(req.user.role);
      if (!isOwner && !isPrivileged) {
        return sendError(res, "Unauthorized", 403, "FORBIDDEN");
      }

      const orgAccess = await assertSlipOrgAccess(req, slip);
      if (!orgAccess.ok) {
        return sendError(res, orgAccess.message, orgAccess.status, orgAccess.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      // Employee role: only allow downloading approved/released slips
      const isEmployee = req.user.role === "employee";
      if (isEmployee && !["approved", "released", "paid", "processed"].includes(slip.status)) {
        return sendError(res, "This salary slip is not yet available for download", 403, "FORBIDDEN");
      }

      if (slip.source === "employee_upload" && slip.uploadFilePath && fs.existsSync(slip.uploadFilePath)) {
        const mime = slip.uploadMimeType || "application/octet-stream";
        res.setHeader("Content-Type", mime);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${slip.uploadFileName || `payslip-${slip.month}-${slip.year}`}"`
        );
        await SalarySlip.findByIdAndUpdate(slipId, {
          downloadedAt: new Date(),
          $inc: { downloadCount: 1 },
        });
        return res.sendFile(path.resolve(slip.uploadFilePath));
      }

      let organization = null;
      const orgId = slip.orgId || employeeDoc.orgId;
      if (orgId) {
        organization = await Organization.findById(orgId)
          .select("name address logo settings")
          .lean();
      }

      const htmlContent = buildSalarySlipHtml({
        slip,
        employee: employeeDoc,
        organization: organization || {},
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="salary-slip-${slip.month}-${slip.year}.html"`);

      // Send HTML content (browser will handle conversion to PDF)
      res.send(htmlContent);

      // Update download count
      await SalarySlip.findByIdAndUpdate(slipId, {
        downloadedAt: new Date(),
        $inc: { downloadCount: 1 }
      });

      logger.info("Salary slip downloaded", {
        slipId,
        downloadedBy: req.user.userId
      });
    } catch (error) {
      logger.error("Download salary slip error", {
        error: error.message,
        slipId: req.params.slipId
      });
      return sendError(res, "Failed to download salary slip", 500, "DOWNLOAD_ERROR");
    }
  })
);

/**
 * DELETE /api/salary/structure/:structureId
 * Delete a salary structure
 */
router.delete(
  "/structure/:structureId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { structureId } = req.params;
      
      logger.info("Attempting to delete salary structure", {
        structureId,
        userId: req.user.userId
      });

      const structure = await SalaryStructure.findOneAndDelete(structureLookupQuery(req, structureId));

      if (!structure) {
        logger.warn("Salary structure not found for deletion", {
          structureId,
          userId: req.user.userId
        });
        return sendError(res, "Salary structure not found", 404, "NOT_FOUND");
      }

      logger.info("Salary structure deleted successfully", {
        structureId,
        deletedBy: req.user.userId
      });

      return sendSuccess(res, null, "Salary structure deleted successfully");
    } catch (error) {
      logger.error("Delete salary structure error", {
        error: error.message,
        structureId: req.params.structureId,
        userId: req.user.userId
      });
      return sendError(res, "Failed to delete salary structure", 500, "DELETE_ERROR");
    }
  })
);

/**
 * DELETE /api/salary/slip/:slipId
 * Delete a salary slip
 */
router.delete(
  "/slip/:slipId",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { slipId } = req.params;
      
      logger.info("Attempting to delete salary slip", {
        slipId,
        userId: req.user.userId
      });

      const existing = await SalarySlip.findById(slipId).lean();
      const orgAccess = await assertSlipOrgAccess(req, existing);
      if (!orgAccess.ok) {
        return sendError(res, orgAccess.message, orgAccess.status, orgAccess.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      const deleteQuery = isSuperAdmin(req)
        ? { _id: slipId }
        : { _id: slipId, orgId: req.user.orgId };

      const slip = await SalarySlip.findOneAndDelete(deleteQuery);

      if (!slip) {
        logger.warn("Salary slip not found for deletion", {
          slipId,
          userId: req.user.userId
        });
        return sendError(res, "Salary slip not found", 404, "NOT_FOUND");
      }

      // Remove legacy Payslip rows so employee dashboard stays in sync
      await Payslip.deleteMany({
        employeeId: slip.employeeId,
        orgId: slip.orgId,
        year: slip.year,
        $or: [
          { month: String(slip.month) },
          { month: slip.month }
        ]
      }).catch((err) => {
        logger.warn("Payslip cleanup on salary slip delete failed", { error: err.message, slipId });
      });

      logger.info("Salary slip deleted successfully", {
        slipId,
        deletedBy: req.user.userId
      });

      return sendSuccess(res, null, "Salary slip deleted successfully");
    } catch (error) {
      logger.error("Delete salary slip error", {
        error: error.message,
        slipId: req.params.slipId,
        userId: req.user.userId
      });
      return sendError(res, "Failed to delete salary slip", 500, "DELETE_ERROR");
    }
  })
);

/**
 * GET /api/salary/slip/upload/template
 * CSV template for employee payslip metadata import
 */
router.get(
  "/slip/upload/template",
  authenticate,
  asyncHandler(async (req, res) => {
    const csv =
      "month,year,notes\n" +
      `${new Date().getMonth() + 1},${new Date().getFullYear()},Optional note for HR\n`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="payslip-upload-template.csv"');
    res.send(csv);
  })
);

/**
 * GET /api/salary/slip/export/:employeeId
 * Export employee salary slip list as CSV
 */
router.get(
  "/slip/export/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const access = await assertCanAccessEmployeeSalaryData(req, employeeId);
    if (!access.ok) {
      return sendError(res, access.message, access.status, "FORBIDDEN");
    }

    // Get employee to retrieve orgId
    const emp = await Employee.findById(employeeId).select("orgId").lean();
    if (!emp) {
      return sendError(res, "Employee not found", 404, "NOT_FOUND");
    }

    // Determine orgId (super_admin can export from any org, others use their own)
    const slipOrgId =
      isSuperAdmin(req) && emp.orgId
        ? String(emp.orgId)
        : String(req.user.orgId);

    const slips = await SalarySlip.find({ employeeId, orgId: slipOrgId })
      .sort({ year: -1, month: -1 })
      .lean();

    const header = "month,year,status,source,grossEarnings,netSalary,uploadFileName\n";
    const rows = slips
      .map((s) =>
        [
          s.month,
          s.year,
          s.status,
          s.source || "generated",
          s.grossEarnings ?? 0,
          s.netSalary ?? 0,
          s.uploadFileName || "",
        ].join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="salary-slips-${employeeId}.csv"`
    );
    res.send(header + rows);
  })
);

/**
 * POST /api/salary/slip/employee-upload
 * Employee uploads payslip file (PDF/image) for HR approval
 */
router.post(
  "/slip/employee-upload",
  authenticate,
  payslipUpload.single("file"),
  asyncHandler(async (req, res) => {
    const month = parseInt(req.body?.month, 10);
    const year = parseInt(req.body?.year, 10);
    const notes = String(req.body?.notes || "").trim();

    if (!req.file) {
      return sendError(res, "Payslip file is required", 400, "VALIDATION_ERROR");
    }
    if (!month || month < 1 || month > 12 || !year) {
      return sendError(res, "Valid month and year are required", 400, "VALIDATION_ERROR");
    }

    const orgId = userOrgIdFromReq(req) || req.validatedOrgId;
    const emp = await findEmployeeForSelfService(req.user.userId, orgId, {
      allowCrossOrgFallback: true,
    });
    if (!emp) {
      return sendError(res, "Employee profile not found", 404, "NOT_FOUND");
    }

    const existing = await SalarySlip.findOne({
      employeeId: emp._id,
      month,
      year,
    });
    if (existing && ["approved", "paid", "processed"].includes(existing.status)) {
      return sendError(
        res,
        "A payslip for this period is already approved. Contact HR to replace it.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const payload = {
      employeeId: emp._id,
      userId: req.user.userId,
      orgId: String(emp.orgId || orgId),
      month,
      year,
      status: "pending_approval",
      source: "employee_upload",
      uploadFileName: req.file.originalname,
      uploadMimeType: req.file.mimetype,
      uploadFilePath: req.file.path,
      employeeNotes: notes,
      grossEarnings: 0,
      totalDeductions: 0,
      netSalary: 0,
      earnings: {},
      deductions: {},
      attendanceData: {},
      createdBy: req.user.userId,
    };

    let slip;
    if (existing) {
      if (existing.uploadFilePath && fs.existsSync(existing.uploadFilePath)) {
        try {
          fs.unlinkSync(existing.uploadFilePath);
        } catch {
          /* ignore */
        }
      }
      slip = await SalarySlip.findByIdAndUpdate(existing._id, payload, { new: true });
    } else {
      slip = await SalarySlip.create(payload);
    }

    return sendSuccess(
      res,
      slip,
      "Payslip uploaded and sent to admin for approval",
      existing ? 200 : 201
    );
  })
);

export default router;
