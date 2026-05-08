/**
 * Salary Routes
 * Handles salary structure and salary slip management
 */

import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import SalaryStructure from "../models/SalaryStructure.js";
import SalarySlip from "../models/SalarySlip.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.js";
import EmailNotificationService from "../utils/emailNotificationService.js";
import logger from "../utils/logger.js";

const router = express.Router();

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

      // Find employee
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Calculate totals - ensure all values are properly handled
      const grossEarnings = Object.values(earnings || {}).reduce((sum, val) => {
        if (typeof val === 'number') return sum + Math.max(0, val);
        if (Array.isArray(val)) return sum + val.reduce((s, item) => s + Math.max(0, item.amount || 0), 0);
        return sum;
      }, 0);

      const totalDeductions = Object.values(deductions || {}).reduce((sum, val) => {
        if (typeof val === 'number') return sum + Math.max(0, val);
        if (Array.isArray(val)) return sum + val.reduce((s, item) => s + Math.max(0, item.amount || 0), 0);
        return sum;
      }, 0);

      const netSalary = grossEarnings - totalDeductions;
      const costToCompany = grossEarnings + (deductions?.providentFund || 0) * 0.12; // Employer PF contribution

      const salaryStructure = await SalaryStructure.create({
        employeeId,
        userId: employee.userId,
        employeeType,
        orgId: req.user.orgId,
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

      // Find existing structure
      const structure = await SalaryStructure.findById(structureId);
      if (!structure) {
        return sendError(res, "Salary structure not found", 404, "NOT_FOUND");
      }

      // Calculate totals - ensure all values are properly handled
      const grossEarnings = Object.values(earnings || {}).reduce((sum, val) => {
        if (typeof val === 'number') return sum + Math.max(0, val);
        if (Array.isArray(val)) return sum + val.reduce((s, item) => s + Math.max(0, item.amount || 0), 0);
        return sum;
      }, 0);

      const totalDeductions = Object.values(deductions || {}).reduce((sum, val) => {
        if (typeof val === 'number') return sum + Math.max(0, val);
        if (Array.isArray(val)) return sum + val.reduce((s, item) => s + Math.max(0, item.amount || 0), 0);
        return sum;
      }, 0);

      const netSalary = grossEarnings - totalDeductions;
      const costToCompany = grossEarnings + (deductions?.providentFund || 0) * 0.12;

      // Update structure
      const updatedStructure = await SalaryStructure.findByIdAndUpdate(
        structureId,
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
 * GET /api/salary/structure/:employeeId
 * Get salary structure for an employee
 */
router.get(
  "/structure/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;

      const salaryStructure = await SalaryStructure.findOne({
        employeeId,
        orgId: req.user.orgId,
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
      const { page = 1, limit = 10, status = "all" } = req.query;
      const skip = (page - 1) * limit;

      const query = { orgId: req.user.orgId };
      if (status !== "all") {
        query.status = status;
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

      const structure = await SalaryStructure.findByIdAndUpdate(
        structureId,
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

      const structure = await SalaryStructure.findByIdAndUpdate(
        structureId,
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

      // Get approved salary structure
      const salaryStructure = await SalaryStructure.findOne({
        employeeId,
        orgId: req.user.orgId,
        status: "approved"
      }).sort({ effectiveFrom: -1 });

      if (!salaryStructure) {
        return sendError(res, "No approved salary structure found for this employee", 400, "VALIDATION_ERROR");
      }

      // Get employee
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Calculate attendance data
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendanceRecords = await Attendance.find({
        userId: employee.userId,
        orgId: req.user.orgId,
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

      const grossEarnings = Object.values(earnings).reduce((sum, val) => {
        if (typeof val === 'number') return sum + Math.max(0, val);
        if (Array.isArray(val)) return sum + val.reduce((s, item) => s + Math.max(0, item.amount || 0), 0);
        return sum;
      }, 0);

      // Calculate deductions - ensure all are numbers and handle zero values properly
      const deductions = {
        providentFund: salaryStructure.deductions.providentFund || 0,
        employeeStateInsurance: salaryStructure.deductions.employeeStateInsurance || 0,
        professionalTax: salaryStructure.deductions.professionalTax || 0,
        incomeTax: salaryStructure.deductions.incomeTax || 0,
        leaveDeduction: leaveDeduction > 0 ? Math.round(leaveDeduction) : 0,
        otherDeductions: salaryStructure.deductions.otherDeductions || []
      };

      const totalDeductions = Object.values(deductions).reduce((sum, val) => {
        if (typeof val === 'number') return sum + Math.max(0, val); // Ensure no negative values
        if (Array.isArray(val)) return sum + val.reduce((s, item) => s + Math.max(0, item.amount || 0), 0);
        return sum;
      }, 0);

      const netSalary = grossEarnings - totalDeductions;

      // Create or update salary slip
      let salarySlip = await SalarySlip.findOne({
        employeeId,
        month,
        year,
        orgId: req.user.orgId
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
          employeeId,
          userId: employee.userId,
          salaryStructureId: salaryStructure._id,
          orgId: req.user.orgId,
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

      const query = { orgId: req.user.orgId };
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
 * GET /api/salary/slip/:employeeId/:month/:year
 * Get salary slip for an employee for a specific month
 */
router.get(
  "/slip/:employeeId/:month/:year",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId, month, year } = req.params;

      const salarySlip = await SalarySlip.findOne({
        employeeId,
        month: parseInt(month),
        year: parseInt(year),
        orgId: req.user.orgId
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
 */
router.get(
  "/slips/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { page = 1, limit = 12 } = req.query;
      const skip = (page - 1) * limit;

      const total = await SalarySlip.countDocuments({
        employeeId,
        orgId: req.user.orgId
      });

      const slips = await SalarySlip.find({
        employeeId,
        orgId: req.user.orgId
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
 */
router.get(
  "/slip/:slipId/download",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { slipId } = req.params;

      const slip = await SalarySlip.findById(slipId)
        .populate("employeeId", "firstName lastName employeeCode email")
        .populate("salaryStructureId");

      if (!slip) {
        return sendError(res, "Salary slip not found", 404, "NOT_FOUND");
      }

      // Check authorization
      if (slip.userId.toString() !== req.user.userId && req.user.role !== "admin" && req.user.role !== "hr" && req.user.role !== "super_admin") {
        return sendError(res, "Unauthorized", 403, "FORBIDDEN");
      }

      // Generate PDF content as HTML with professional format
      const monthName = new Date(slip.year, slip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const employee = slip.employeeId;
      const slipNumber = `S${slip._id.toString().slice(-6).toUpperCase()}`;
      const organization = slip.salaryStructureId?.location || 'WorkPlus HRMS';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Arial', sans-serif; 
              background-color: #f5f5f5;
              padding: 20px;
            }
            .container {
              background-color: white;
              max-width: 900px;
              margin: 0 auto;
              padding: 40px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #1a5f3f;
              padding-bottom: 20px;
            }
            .company-info {
              flex: 1;
            }
            .company-logo {
              font-size: 24px;
              font-weight: bold;
              color: #1a5f3f;
              margin-bottom: 5px;
            }
            .company-address {
              font-size: 12px;
              color: #666;
            }
            .slip-header {
              text-align: center;
              flex: 1;
            }
            .slip-title {
              font-size: 32px;
              font-weight: bold;
              color: #000;
              margin-bottom: 10px;
            }
            .slip-details {
              text-align: right;
              flex: 1;
            }
            .slip-detail-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              margin-bottom: 5px;
            }
            .slip-detail-label {
              font-weight: bold;
              margin-right: 20px;
            }
            .content {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-weight: bold;
              font-size: 13px;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .info-table td {
              border: 1px solid #000;
              padding: 8px;
            }
            .info-table td:first-child {
              font-weight: bold;
              background-color: #f0f0f0;
              width: 50%;
            }
            .earnings-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .earnings-table td {
              border: 1px solid #000;
              padding: 8px;
            }
            .earnings-table td:first-child {
              font-weight: bold;
              background-color: #f0f0f0;
            }
            .earnings-table td:last-child {
              text-align: right;
            }
            .summary-section {
              grid-column: 1 / -1;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
            }
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .summary-table td {
              border: 1px solid #000;
              padding: 10px;
            }
            .summary-table td:first-child {
              font-weight: bold;
              background-color: #f0f0f0;
              width: 60%;
            }
            .summary-table td:last-child {
              text-align: right;
            }
            .net-salary-box {
              background-color: #1a5f3f;
              color: white;
              padding: 15px;
              text-align: center;
              font-weight: bold;
              font-size: 14px;
              border-radius: 4px;
              margin-top: 10px;
            }
            .net-salary-label {
              font-size: 12px;
              margin-bottom: 5px;
            }
            .net-salary-amount {
              font-size: 18px;
            }
            .signature-section {
              margin-top: 30px;
              text-align: right;
              font-size: 12px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            .footer-bar {
              background-color: #1a5f3f;
              height: 20px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header-top">
              <div class="company-info">
                <div class="company-logo">WorkPlus HRMS</div>
                <div class="company-address">123 Anywhere St, Any City</div>
              </div>
              <div class="slip-header">
                <div class="slip-title">SALARY SLIP</div>
              </div>
              <div class="slip-details">
                <div class="slip-detail-row">
                  <span class="slip-detail-label">Pay Period</span>
                  <span>${monthName}</span>
                </div>
                <div class="slip-detail-row">
                  <span class="slip-detail-label">Slip Number</span>
                  <span>${slipNumber}</span>
                </div>
              </div>
            </div>

            <!-- Main Content -->
            <div class="content">
              <!-- Employee Information -->
              <div class="section">
                <div class="section-title">EMPLOYEE INFORMATION</div>
                <table class="info-table">
                  <tr>
                    <td>Employee Name</td>
                    <td>${employee.firstName} ${employee.lastName}</td>
                  </tr>
                  <tr>
                    <td>Employee NIP/ID</td>
                    <td>${employee.employeeCode || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>Department</td>
                    <td>${slip.salaryStructureId?.location || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>Designation</td>
                    <td>${slip.salaryStructureId?.employeeType || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>Email</td>
                    <td>${employee.email || 'N/A'}</td>
                  </tr>
                </table>
              </div>

              <!-- Salary Details (Income) -->
              <div class="section">
                <div class="section-title">SALARY DETAILS</div>
                <div style="margin-bottom: 10px;">
                  <strong>Income</strong>
                </div>
                <table class="earnings-table">
                  ${slip.earnings.basic ? `<tr><td>Basic Salary</td><td>₹${slip.earnings.basic.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.hra ? `<tr><td>House Rent Allowance (HRA)</td><td>₹${slip.earnings.hra.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.medicalExpenses ? `<tr><td>Medical Expenses</td><td>₹${slip.earnings.medicalExpenses.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.travel ? `<tr><td>Travel Allowance</td><td>₹${slip.earnings.travel.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.internetCharges ? `<tr><td>Internet Charges</td><td>₹${slip.earnings.internetCharges.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.nightShiftAllowance ? `<tr><td>Night Shift Allowance</td><td>₹${slip.earnings.nightShiftAllowance.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.incentives ? `<tr><td>Incentives</td><td>₹${slip.earnings.incentives.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.bonus ? `<tr><td>Bonus / Incentive</td><td>₹${slip.earnings.bonus.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.commission ? `<tr><td>Commission</td><td>₹${slip.earnings.commission.toLocaleString()}</td></tr>` : ''}
                  ${slip.earnings.otherEarnings && slip.earnings.otherEarnings.length > 0 ? slip.earnings.otherEarnings.map(e => `<tr><td>${e.name}</td><td>₹${e.amount.toLocaleString()}</td></tr>`).join('') : ''}
                </table>
              </div>

              <!-- Salary Summary -->
              <div class="section">
                <div class="section-title">SALARY SUMMARY</div>
                <table class="summary-table">
                  <tr>
                    <td>Total Revenue</td>
                    <td>₹${slip.grossEarnings.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Total Deductions</td>
                    <td>₹${slip.totalDeductions.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Net Salary Received</td>
                    <td>₹${slip.netSalary.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <!-- Deductions -->
              <div class="section">
                <div class="section-title">DEDUCTIONS</div>
                <table class="earnings-table">
                  ${slip.deductions.providentFund ? `<tr><td>Provident Fund (PF)</td><td>₹${slip.deductions.providentFund.toLocaleString()}</td></tr>` : ''}
                  ${slip.deductions.employeeStateInsurance ? `<tr><td>Employee State Insurance (ESI)</td><td>₹${slip.deductions.employeeStateInsurance.toLocaleString()}</td></tr>` : ''}
                  ${slip.deductions.professionalTax ? `<tr><td>Professional Tax</td><td>₹${slip.deductions.professionalTax.toLocaleString()}</td></tr>` : ''}
                  ${slip.deductions.incomeTax ? `<tr><td>Income Tax</td><td>₹${slip.deductions.incomeTax.toLocaleString()}</td></tr>` : ''}
                  ${slip.deductions.leaveDeduction ? `<tr><td>Leave Deduction</td><td>₹${slip.deductions.leaveDeduction.toLocaleString()}</td></tr>` : ''}
                  ${slip.deductions.otherDeductions && slip.deductions.otherDeductions.length > 0 ? slip.deductions.otherDeductions.map(d => `<tr><td>${d.name}</td><td>₹${d.amount.toLocaleString()}</td></tr>`).join('') : ''}
                </table>
              </div>

              <!-- Net Salary Box -->
              <div class="section">
                <div class="net-salary-box">
                  <div class="net-salary-label">Net Salary Received</div>
                  <div class="net-salary-amount">₹${slip.netSalary.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <!-- Signature Section -->
            <div class="signature-section">
              <div style="margin-bottom: 30px;">HR / Finance Signature</div>
              <div style="border-top: 1px solid #000; width: 150px; margin-left: auto;"></div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>Slip Print Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p>This is a system-generated document. No signature required.</p>
            </div>

            <div class="footer-bar"></div>
          </div>
        </body>
        </html>
      `;

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

      const structure = await SalaryStructure.findByIdAndDelete(structureId);

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

      const slip = await SalarySlip.findByIdAndDelete(slipId);

      if (!slip) {
        logger.warn("Salary slip not found for deletion", {
          slipId,
          userId: req.user.userId
        });
        return sendError(res, "Salary slip not found", 404, "NOT_FOUND");
      }

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

export default router;
