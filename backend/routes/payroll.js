import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import SalaryStructure from "../models/SalaryStructure.js";
import SalaryRevision from "../models/SalaryRevision.js";
import PayrollCycle from "../models/PayrollCycle.js";
import PayrollRun from "../models/PayrollRun.js";
import Employee from "../models/Employee.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";
import PayrollCycleEngine from "../utils/payrollCycleEngine.js";
import PayrollCalculationEngine from "../utils/payrollCalculationEngine.js";

const router = express.Router();

/**
 * GET /api/payroll/employee/dashboard
 * Get employee payroll dashboard data with KPI cards
 */
router.get(
  "/employee/dashboard",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const userId = req.user.userId;
      const orgId = req.user.orgId;

      // Get employee details
      const employee = await Employee.findOne({ userId, orgId });
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Get current salary structure
      const currentSalaryStructure = await SalaryStructure.findOne({
        employeeId: employee._id,
        orgId,
        status: "approved"
      }).sort({ effectiveFrom: -1 });

      if (!currentSalaryStructure) {
        return sendError(res, "No approved salary structure found", 404, "NOT_FOUND");
      }

      // Get previous salary structure (if any)
      const previousSalaryStructure = await SalaryStructure.findOne({
        employeeId: employee._id,
        orgId,
        status: "approved",
        _id: { $ne: currentSalaryStructure._id }
      }).sort({ effectiveFrom: -1 });

      // Get current payroll cycle
      const currentCycle = PayrollCycleEngine.getCurrentPayrollCycle();

      // Get salary revisions for history
      const salaryRevisions = await SalaryRevision.find({
        employeeId: employee._id,
        status: "implemented"
      })
        .sort({ effectiveFrom: -1 })
        .limit(12);

      // Build salary history for chart
      const salaryHistory = salaryRevisions.map((revision) => ({
        month: new Date(revision.effectiveFrom).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric"
        }),
        salary: revision.newBasic,
        type: revision.revisionType
      }));

      // Add current salary to history if not already present
      if (
        salaryHistory.length === 0 ||
        salaryHistory[0].salary !== currentSalaryStructure.earnings.basic
      ) {
        salaryHistory.unshift({
          month: new Date().toLocaleDateString("en-US", {
            month: "short",
            year: "numeric"
          }),
          salary: currentSalaryStructure.earnings.basic,
          type: "current"
        });
      }

      // Calculate per-day salary
      const perDaySalary = PayrollCalculationEngine.calculatePerDaySalary(
        currentSalaryStructure.grossEarnings,
        30,
        "30-day"
      );

      // Build KPI data
      const kpiData = {
        currentAmount: currentSalaryStructure.earnings.basic,
        previousAmount: previousSalaryStructure
          ? previousSalaryStructure.earnings.basic
          : 0,
        effectiveFrom: currentSalaryStructure.effectiveFrom,
        effectiveTo: currentSalaryStructure.effectiveTo,
        perDayAmount: perDaySalary,
        cycleStartDate: currentCycle.cycleStartDate,
        cycleEndDate: currentCycle.cycleEndDate,
        employeeType: employee.employmentType || "employee"
      };

      logger.info("Employee payroll dashboard data fetched", {
        userId,
        employeeId: employee._id
      });

      return sendSuccess(
        res,
        {
          kpiData,
          salaryHistory,
          employeeType: employee.employmentType || "employee"
        },
        "Payroll dashboard data fetched successfully"
      );
    } catch (error) {
      logger.error("Get employee payroll dashboard error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to fetch payroll dashboard", 500, "FETCH_ERROR");
    }
  })
);

/**
 * GET /api/payroll/cycles
 * Get all payroll cycles for a year
 */
router.get(
  "/cycles",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { year } = req.query;
      const currentYear = year ? parseInt(year) : new Date().getFullYear();

      const cycles = PayrollCycleEngine.getYearPayrollCycles(currentYear);

      return sendSuccess(res, cycles, "Payroll cycles fetched successfully");
    } catch (error) {
      logger.error("Get payroll cycles error", {
        error: error.message
      });
      return sendError(res, "Failed to fetch payroll cycles", 500, "FETCH_ERROR");
    }
  })
);

/**
 * POST /api/payroll/cycle/create
 * Create a new payroll cycle
 */
router.post(
  "/cycle/create",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { year, month } = req.body;
      const orgId = req.user.orgId;

      if (!year || !month) {
        return sendError(res, "Year and month are required", 400, "VALIDATION_ERROR");
      }

      // Check if cycle already exists
      const existingCycle = await PayrollCycle.findOne({
        orgId,
        year,
        month
      });

      if (existingCycle) {
        return sendError(res, "Payroll cycle already exists", 400, "DUPLICATE_ERROR");
      }

      // Generate cycle dates
      const cycleData = PayrollCycleEngine.generatePayrollCycle(year, month);

      // Create new cycle
      const payrollCycle = await PayrollCycle.create({
        orgId,
        cycleNumber: month,
        year,
        month,
        cycleStartDate: cycleData.cycleStartDate,
        cycleEndDate: cycleData.cycleEndDate,
        salaryReleaseDate: cycleData.salaryReleaseDate,
        salaryHoldUntil: cycleData.salaryHoldUntil,
        status: "draft",
        createdBy: req.user.userId
      });

      logger.info("Payroll cycle created", {
        cycleId: payrollCycle._id,
        year,
        month,
        createdBy: req.user.userId
      });

      return sendSuccess(res, payrollCycle, "Payroll cycle created successfully", 201);
    } catch (error) {
      logger.error("Create payroll cycle error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to create payroll cycle", 500, "CREATE_ERROR");
    }
  })
);

/**
 * POST /api/payroll/run/calculate
 * Calculate payroll for an employee in a cycle
 */
router.post(
  "/run/calculate",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { employeeId, payrollCycleId } = req.body;
      const orgId = req.user.orgId;

      if (!employeeId || !payrollCycleId) {
        return sendError(
          res,
          "Employee ID and Payroll Cycle ID are required",
          400,
          "VALIDATION_ERROR"
        );
      }

      // Get payroll cycle
      const payrollCycle = await PayrollCycle.findById(payrollCycleId);
      if (!payrollCycle) {
        return sendError(res, "Payroll cycle not found", 404, "NOT_FOUND");
      }

      // Get employee
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      // Get salary structure
      const salaryStructure = await SalaryStructure.findOne({
        employeeId,
        orgId,
        status: "approved"
      }).sort({ effectiveFrom: -1 });

      if (!salaryStructure) {
        return sendError(res, "No approved salary structure found", 404, "NOT_FOUND");
      }

      // TODO: Get attendance data from Attendance collection
      const attendanceData = {
        totalWorkingDays: 22,
        presentDays: 20,
        absentDays: 0,
        halfDays: 0,
        unpaidLeaveDays: 0,
        lateMarks: 0
      };

      // Calculate payroll
      const payrollData = {
        salaryStructure,
        attendanceData,
        employeeType: employee.employmentType,
        cycleStartDate: payrollCycle.cycleStartDate,
        cycleEndDate: payrollCycle.cycleEndDate,
        salaryRevisions: []
      };

      const calculationResult = PayrollCalculationEngine.calculatePayroll(payrollData);

      if (!calculationResult.success) {
        return sendError(res, calculationResult.error, 500, "CALCULATION_ERROR");
      }

      // Create or update payroll run
      let payrollRun = await PayrollRun.findOne({
        payrollCycleId,
        employeeId,
        orgId
      });

      if (!payrollRun) {
        payrollRun = new PayrollRun({
          payrollCycleId,
          employeeId,
          userId: employee.userId,
          orgId,
          employeeType: employee.employmentType,
          salaryStructureId: salaryStructure._id,
          cycleStartDate: payrollCycle.cycleStartDate,
          cycleEndDate: payrollCycle.cycleEndDate,
          attendanceData,
          createdBy: req.user.userId
        });
      }

      // Update with calculation results
      payrollRun.earnings = calculationResult.earnings;
      payrollRun.deductions = calculationResult.deductions;
      payrollRun.grossEarnings = calculationResult.grossEarnings;
      payrollRun.totalDeductions = calculationResult.totalDeductions;
      payrollRun.netSalary = calculationResult.netSalary;
      payrollRun.payableDaysCalculation = calculationResult.payableDaysData;
      payrollRun.status = "calculated";

      await payrollRun.save();

      logger.info("Payroll calculated", {
        payrollRunId: payrollRun._id,
        employeeId,
        netSalary: payrollRun.netSalary
      });

      return sendSuccess(res, payrollRun, "Payroll calculated successfully");
    } catch (error) {
      logger.error("Calculate payroll error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to calculate payroll", 500, "CALCULATION_ERROR");
    }
  })
);

export default router;
