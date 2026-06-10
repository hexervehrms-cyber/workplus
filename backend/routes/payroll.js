import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import SalaryStructure from "../models/SalaryStructure.js";
import SalaryRevision from "../models/SalaryRevision.js";
import SalaryCycle from "../models/SalaryCycle.js";
import PayrollCycle from "../models/PayrollCycle.js";
import PayrollRun from "../models/PayrollRun.js";
import Employee from "../models/Employee.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";
import PayrollCycleEngine from "../utils/payrollCycleEngine.js";
import PayrollCalculationEngine from "../utils/payrollCalculationEngine.js";
import { aggregateStructureMoney } from "../utils/payrollMoney.js";
import { isSuperAdmin } from "../utils/orgScopeHelpers.js";
import { buildPayrollAttendanceData } from "../utils/payrollAttendanceData.js";

const router = express.Router();

function resolvePayrollOrgId(req) {
  if (isSuperAdmin(req)) {
    if (!req.query.orgId) {
      return { error: "orgId query parameter is required for super admin" };
    }
    return { orgId: String(req.query.orgId) };
  }
  const oid = req.user?.orgId;
  if (!oid || oid === "system") {
    return { error: "No organization assigned to this account" };
  }
  return { orgId: String(oid) };
}

/**
 * GET /api/payroll/employee/cycle-summary
 * Employee-safe endpoint for viewing current payroll cycle dates
 * Returns cycle start, end, payment date, hold period
 * 
 * WorkPlus Payroll Rules:
 * - Cycle: cycleStartDay to cycleEndDay
 * - Hold Period: starts after cycleEndDate, lasts holdDays (typically 10 days)
 * - Payment Date: 1st of month after hold period ends
 * 
 * - Employee: sees own org cycle (orgId from JWT)
 * - Admin/HR: sees own org cycle
 * - Super_admin: sees own org cycle
 */
router.get(
  "/employee/cycle-summary",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const orgIdResult = resolvePayrollOrgId(req);
      if (orgIdResult.error) {
        return sendError(res, orgIdResult.error, 400, "MISSING_ORG_CONTEXT");
      }
      const orgId = orgIdResult.orgId;

      // Try to get active SalaryCycle configuration
      const salaryCycle = await SalaryCycle.findOne({
        orgId,
        isActive: true
      }).lean();

      let cycleData;
      if (salaryCycle) {
        // Use configured salary cycle dates
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const dateOfMonth = today.getDate();

        // Calculate current cycle month (21-20 based or configured based)
        let cycleMonth = month;
        if (dateOfMonth < salaryCycle.cycleStartDate) {
          cycleMonth = month - 1;
          if (cycleMonth === 0) {
            cycleMonth = 12;
          }
        }

        // Generate cycle dates based on SalaryCycle configuration
        const cycleStartDay = salaryCycle.cycleStartDate;
        const cycleEndDay = salaryCycle.cycleEndDate;
        const paymentDay = salaryCycle.salaryPaymentDate;
        const holdDays = salaryCycle.holdDays || 10; // Default 10 days

        let cycleStartDate = new Date(year, cycleMonth - 1, cycleStartDay);
        let cycleEndMonth = cycleMonth;
        let cycleEndYear = year;
        if (cycleStartDay > cycleEndDay) {
          cycleEndMonth = cycleMonth + 1;
          if (cycleEndMonth > 12) {
            cycleEndMonth = 1;
            cycleEndYear = year + 1;
          }
        }
        const cycleEndDate = new Date(cycleEndYear, cycleEndMonth - 1, cycleEndDay);

        // Hold period starts after cycleEndDate and lasts holdDays
        const holdStartDate = new Date(cycleEndDate);
        holdStartDate.setDate(holdStartDate.getDate() + 1);
        const salaryHoldUntil = new Date(holdStartDate);
        salaryHoldUntil.setDate(salaryHoldUntil.getDate() + (holdDays - 1)); // -1 because start date counts as day 1

        // Payment date is 1st of month after hold period
        let paymentMonth = cycleEndMonth;
        let paymentYear = cycleEndYear;
        if (paymentDay < cycleEndDay || cycleStartDay > cycleEndDay) {
          paymentMonth = cycleEndMonth + 1;
          if (paymentMonth > 12) {
            paymentMonth = 1;
            paymentYear = cycleEndYear + 1;
          }
        }
        const salaryReleaseDate = new Date(paymentYear, paymentMonth - 1, paymentDay);

        cycleData = {
          cycleStartDate,
          cycleEndDate,
          holdStartDate,
          salaryHoldUntil,
          salaryReleaseDate,
          paymentDate: salaryReleaseDate,
          holdDays,
          cycleLabel: `${cycleStartDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          })} - ${cycleEndDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          })}`,
          currency: "INR"
        };
      } else {
        // Fallback to WorkPlus default: 21-20, payment 1st, hold 10 days
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const dateOfMonth = today.getDate();

        // Default: cycle 21-20, hold 10 days starting 21st, payment 1st
        let cycleMonth = month;
        if (dateOfMonth < 21) {
          cycleMonth = month - 1;
          if (cycleMonth === 0) {
            cycleMonth = 12;
          }
        }

        const cycleStartDate = new Date(year, cycleMonth - 1, 21);
        let cycleEndMonth = cycleMonth;
        let cycleEndYear = year;
        if (cycleMonth === 12) {
          cycleEndMonth = 1;
          cycleEndYear = year + 1;
        } else {
          cycleEndMonth = cycleMonth + 1;
        }
        const cycleEndDate = new Date(cycleEndYear, cycleEndMonth - 1, 20);

        // Hold starts day after cycle ends (21st) and lasts 10 days (21-30)
        const holdStartDate = new Date(cycleEndDate);
        holdStartDate.setDate(holdStartDate.getDate() + 1);
        const salaryHoldUntil = new Date(holdStartDate);
        salaryHoldUntil.setDate(salaryHoldUntil.getDate() + 9); // Days 21-30 = 10 days total

        // Payment on 1st of month after cycle end
        let paymentMonth = cycleEndMonth;
        let paymentYear = cycleEndYear;
        if (cycleEndMonth === 12) {
          paymentMonth = 1;
          paymentYear = cycleEndYear + 1;
        } else {
          paymentMonth = cycleEndMonth + 1;
        }
        const salaryReleaseDate = new Date(paymentYear, paymentMonth - 1, 1);

        cycleData = {
          cycleStartDate,
          cycleEndDate,
          holdStartDate,
          salaryHoldUntil,
          salaryReleaseDate,
          paymentDate: salaryReleaseDate,
          holdDays: 10,
          cycleLabel: `${cycleStartDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          })} - ${cycleEndDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          })}`,
          currency: "INR"
        };
      }

      return sendSuccess(res, cycleData, "Payroll cycle summary fetched successfully");
    } catch (error) {
      logger.error("Get payroll cycle summary error", {
        error: error.message,
        userId: req.user.userId,
        orgId: req.user.orgId
      });
      return sendError(res, "Failed to fetch payroll cycle summary", 500, "FETCH_ERROR");
    }
  })
);

async function findOrCreatePayrollCycleForFromDate(orgId, fromDate, userId) {
  const fd = new Date(fromDate);
  const cycleMeta = PayrollCycleEngine.getPayrollCycleForDate(fd);
  let cycle = await PayrollCycle.findOne({
    orgId: String(orgId),
    year: cycleMeta.year,
    month: cycleMeta.month
  });

  if (!cycle) {
    const cycleData = PayrollCycleEngine.generatePayrollCycle(
      cycleMeta.year,
      cycleMeta.month
    );
    try {
      cycle = await PayrollCycle.create({
        orgId: String(orgId),
        cycleNumber: cycleMeta.month,
        year: cycleMeta.year,
        month: cycleMeta.month,
        cycleStartDate: cycleData.cycleStartDate,
        cycleEndDate: cycleData.cycleEndDate,
        salaryReleaseDate: cycleData.salaryReleaseDate,
        salaryHoldUntil: cycleData.salaryHoldUntil,
        status: "draft",
        createdBy: userId
      });
    } catch (err) {
      if (err?.code === 11000) {
        cycle = await PayrollCycle.findOne({
          orgId: String(orgId),
          year: cycleMeta.year,
          month: cycleMeta.month
        });
      } else {
        throw err;
      }
    }
  }

  return cycle;
}

/**
 * Core payroll run calculation (shared by /run/calculate and /calculate).
 */
async function calculatePayrollRunForEmployee({
  employeeId,
  payrollCycleId,
  orgId,
  userId,
  adjustments = {}
}) {
  const payrollCycle = await PayrollCycle.findById(payrollCycleId);
  if (!payrollCycle) {
    return { error: "NOT_FOUND", message: "Payroll cycle not found" };
  }

  if (String(payrollCycle.orgId) !== String(orgId)) {
    return { error: "FORBIDDEN", message: "Payroll cycle does not belong to this organization" };
  }

  const employee = await Employee.findById(employeeId).lean();
  if (!employee) {
    return { error: "NOT_FOUND", message: "Employee not found" };
  }

  if (String(employee.orgId || "") !== String(orgId)) {
    return { error: "FORBIDDEN", message: "Employee does not belong to this organization" };
  }

  // Check if payroll run is already approved or released (block recalculation)
  const existingPayrollRun = await PayrollRun.findOne({
    payrollCycleId,
    employeeId,
    orgId: String(orgId)
  }).select("status").lean();

  if (existingPayrollRun && (existingPayrollRun.status === "approved" || existingPayrollRun.status === "released")) {
    return {
      error: "INVALID_STATE",
      message: `Cannot recalculate payroll run with status "${existingPayrollRun.status}". Reset the payroll run to "calculated" status first if changes are needed.`
    };
  }

  // Fetch salary structure with effective date validation
  // Must use approved structure where:
  // - effectiveFrom <= cycleEndDate
  // - effectiveTo is null OR effectiveTo >= cycleStartDate
  const salaryStructure = await SalaryStructure.findOne({
    employeeId,
    orgId: String(orgId),
    status: "approved",
    effectiveFrom: { $lte: payrollCycle.cycleEndDate },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: payrollCycle.cycleStartDate } }
    ]
  }).sort({ effectiveFrom: -1 });

  if (!salaryStructure) {
    return { error: "NOT_FOUND", message: "No approved salary structure found for this payroll cycle" };
  }

  const attendanceData = await buildPayrollAttendanceData({
    employeeId,
    userId: employee.userId,
    orgId: String(orgId),
    cycleStartDate: payrollCycle.cycleStartDate,
    cycleEndDate: payrollCycle.cycleEndDate
  });

  const employmentType = employee.employmentType || "employee";
  const payrollData = {
    salaryStructure,
    attendanceData,
    employeeType: employmentType,
    cycleStartDate: payrollCycle.cycleStartDate,
    cycleEndDate: payrollCycle.cycleEndDate,
    salaryRevisions: []
  };

  const calculationResult = PayrollCalculationEngine.calculatePayroll(payrollData);

  if (!calculationResult.success) {
    return { error: "CALCULATION_ERROR", message: calculationResult.error };
  }

  let payrollRun = await PayrollRun.findOne({
    payrollCycleId,
    employeeId,
    orgId: String(orgId)
  });

  if (!payrollRun) {
    payrollRun = new PayrollRun({
      payrollCycleId,
      employeeId,
      userId: employee.userId,
      orgId: String(orgId),
      employeeType: ["intern", "employee", "consultant", "contract_worker"].includes(
        employmentType
      )
        ? employmentType
        : "employee",
      salaryStructureId: salaryStructure._id,
      cycleStartDate: payrollCycle.cycleStartDate,
      cycleEndDate: payrollCycle.cycleEndDate,
      attendanceData,
      createdBy: userId
    });
  }

  payrollRun.earnings = { ...calculationResult.earnings };
  payrollRun.deductions = { ...calculationResult.deductions };
  payrollRun.attendanceData = attendanceData;

  const bonus = Number(adjustments.bonus);
  const incentive = Number(adjustments.incentive);
  const advance = Number(adjustments.advance);
  const loan = Number(adjustments.loan);
  if (Number.isFinite(bonus) && bonus > 0) payrollRun.earnings.bonus = bonus;
  if (Number.isFinite(incentive) && incentive > 0) payrollRun.earnings.incentives = incentive;
  if (Number.isFinite(advance) && advance > 0) {
    payrollRun.deductions.otherDeductions = [
      ...(payrollRun.deductions.otherDeductions || []),
      { name: 'Advance', amount: advance, type: 'fixed' }
    ];
  }
  if (Number.isFinite(loan) && loan > 0) {
    payrollRun.deductions.otherDeductions = [
      ...(payrollRun.deductions.otherDeductions || []),
      { name: 'Loan', amount: loan, type: 'fixed' }
    ];
  }
  if (adjustments.notes) payrollRun.notes = String(adjustments.notes);

  const { grossEarnings, totalDeductions, netSalary } = aggregateStructureMoney(
    payrollRun.earnings,
    payrollRun.deductions
  );
  payrollRun.grossEarnings = grossEarnings;
  payrollRun.totalDeductions = totalDeductions;
  payrollRun.netSalary = netSalary;
  payrollRun.payableDaysCalculation = calculationResult.payableDaysData;
  payrollRun.status = "calculated";

  try {
    await payrollRun.save();
  } catch (err) {
    if (err?.code === 11000) {
      payrollRun = await PayrollRun.findOne({
        payrollCycleId,
        employeeId,
        orgId: String(orgId)
      });
      if (!payrollRun) throw err;
      payrollRun.earnings = { ...calculationResult.earnings };
      payrollRun.deductions = { ...calculationResult.deductions };
      payrollRun.attendanceData = attendanceData;
      if (Number.isFinite(bonus) && bonus > 0) payrollRun.earnings.bonus = bonus;
      if (Number.isFinite(incentive) && incentive > 0) payrollRun.earnings.incentives = incentive;
      payrollRun.grossEarnings = grossEarnings;
      payrollRun.totalDeductions = totalDeductions;
      payrollRun.netSalary = netSalary;
      payrollRun.payableDaysCalculation = calculationResult.payableDaysData;
      payrollRun.status = "calculated";
      await payrollRun.save();
    } else {
      throw err;
    }
  }

  return { payrollRun };
}

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
        orgId: String(orgId),
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
 * GET /api/payroll/runs
 * List payroll runs for the organization (admin / HR).
 */
router.get(
  "/runs",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const scope = resolvePayrollOrgId(req);
      if (scope.error) {
        return sendError(res, scope.error, 400, "VALIDATION_ERROR");
      }

      const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
      const runs = await PayrollRun.find({ orgId: scope.orgId })
        .populate("employeeId", "employeeCode department designation")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const data = runs.map((r) => ({
        _id: r._id,
        employeeId: r.employeeId,
        userId: r.userId,
        baseSalary: r.earnings?.basic ?? 0,
        perDaySalary: r.payableDaysCalculation?.perDaySalary ?? 0,
        fromDate: r.cycleStartDate,
        toDate: r.cycleEndDate,
        workingDays:
          r.attendanceData?.totalWorkingDays ??
          r.payableDaysCalculation?.totalWorkingDays ??
          0,
        totalEarnings: r.grossEarnings,
        totalDeductions: r.totalDeductions,
        netSalary: r.netSalary,
        status: r.status === "released" ? "paid" : r.status,
        createdAt: r.createdAt
      }));

      return sendSuccess(res, data, "Payroll runs fetched successfully");
    } catch (error) {
      logger.error("List payroll runs error", { error: error.message });
      return sendError(res, "Failed to fetch payroll runs", 500, "FETCH_ERROR");
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

      if (!employeeId || !payrollCycleId) {
        return sendError(
          res,
          "Employee ID and Payroll Cycle ID are required",
          400,
          "VALIDATION_ERROR"
        );
      }

      const employee = await Employee.findById(employeeId).lean();
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      const orgId = String(employee.orgId || req.user.orgId);
      if (!isSuperAdmin(req) && orgId !== String(req.user.orgId)) {
        return sendError(res, "Forbidden", 403, "FORBIDDEN");
      }

      const result = await calculatePayrollRunForEmployee({
        employeeId,
        payrollCycleId,
        orgId,
        userId: req.user.userId
      });

      if (result.error) {
        const code = result.error;
        let status = 500;
        if (code === "NOT_FOUND") status = 404;
        else if (code === "FORBIDDEN") status = 403;
        else if (code === "INVALID_STATE") status = 409;
        return sendError(res, result.message, status, code);
      }

      logger.info("Payroll calculated", {
        payrollRunId: result.payrollRun._id,
        employeeId,
        netSalary: result.payrollRun.netSalary
      });

      return sendSuccess(res, result.payrollRun, "Payroll calculated successfully");
    } catch (error) {
      logger.error("Calculate payroll error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to calculate payroll", 500, "CALCULATION_ERROR");
    }
  })
);

/**
 * POST /api/payroll/calculate
 * Legacy-friendly: resolve cycle from `fromDate`, then calculate run.
 */
router.post(
  "/calculate",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const {
        employeeId,
        fromDate,
        bonus,
        incentive,
        advance,
        loan,
        notes
      } = req.body;

      if (!employeeId || !fromDate) {
        return sendError(
          res,
          "employeeId and fromDate are required",
          400,
          "VALIDATION_ERROR"
        );
      }

      const employee = await Employee.findById(employeeId).lean();
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      const orgId = String(employee.orgId || req.user.orgId);
      if (!isSuperAdmin(req) && orgId !== String(req.user.orgId)) {
        return sendError(res, "Forbidden", 403, "FORBIDDEN");
      }

      const cycle = await findOrCreatePayrollCycleForFromDate(
        orgId,
        fromDate,
        req.user.userId
      );

      const result = await calculatePayrollRunForEmployee({
        employeeId,
        payrollCycleId: cycle._id,
        orgId,
        userId: req.user.userId,
        adjustments: { bonus, incentive, advance, loan, notes }
      });

      if (result.error) {
        const code = result.error;
        let status = 500;
        if (code === "NOT_FOUND") status = 404;
        else if (code === "FORBIDDEN") status = 403;
        else if (code === "INVALID_STATE") status = 409;
        return sendError(res, result.message, status, code);
      }

      logger.info("Payroll calculated (legacy /calculate)", {
        payrollRunId: result.payrollRun._id,
        employeeId
      });

      return sendSuccess(res, result.payrollRun, "Payroll calculated successfully");
    } catch (error) {
      logger.error("Legacy calculate payroll error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to calculate payroll", 500, "CALCULATION_ERROR");
    }
  })
);

/**
 * PUT /api/payroll/:id/approve
 */
router.put(
  "/:id/approve",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const orgFilter = isSuperAdmin(req)
        ? {}
        : { orgId: String(req.user.orgId) };

      const run = await PayrollRun.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "calculated",
          ...orgFilter,
        },
        {
          $set: {
            status: "approved",
            approvedBy: req.user.userId,
            approvalDate: new Date(),
          },
        },
        { new: true }
      );

      if (!run) {
        const existing = await PayrollRun.findById(req.params.id).select("status orgId").lean();
        if (!existing) {
          return sendError(res, "Payroll run not found", 404, "NOT_FOUND");
        }
        if (!isSuperAdmin(req) && String(existing.orgId) !== String(req.user.orgId)) {
          return sendError(res, "Forbidden", 403, "FORBIDDEN");
        }
        return sendError(
          res,
          "Only calculated payroll runs can be approved",
          409,
          "INVALID_STATE"
        );
      }

      return sendSuccess(res, run, "Payroll approved successfully");
    } catch (error) {
      logger.error("Approve payroll error", { error: error.message });
      return sendError(res, "Failed to approve payroll", 500, "UPDATE_ERROR");
    }
  })
);

/**
 * PUT /api/payroll/:id/mark-paid
 * Marks payroll as released (shown as "paid" in admin UI).
 */
router.put(
  "/:id/mark-paid",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const orgFilter = isSuperAdmin(req)
        ? {}
        : { orgId: String(req.user.orgId) };

      const run = await PayrollRun.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "approved",
          ...orgFilter,
        },
        {
          $set: {
            status: "released",
            releasedAt: new Date(),
            releasedBy: req.user.userId,
          },
        },
        { new: true }
      );

      if (!run) {
        const existing = await PayrollRun.findById(req.params.id).select("status orgId").lean();
        if (!existing) {
          return sendError(res, "Payroll run not found", 404, "NOT_FOUND");
        }
        if (!isSuperAdmin(req) && String(existing.orgId) !== String(req.user.orgId)) {
          return sendError(res, "Forbidden", 403, "FORBIDDEN");
        }
        return sendError(
          res,
          "Only approved payroll runs can be marked paid",
          409,
          "INVALID_STATE"
        );
      }

      return sendSuccess(res, run, "Payroll marked as paid successfully");
    } catch (error) {
      logger.error("Mark payroll paid error", { error: error.message });
      return sendError(res, "Failed to mark payroll as paid", 500, "UPDATE_ERROR");
    }
  })
);

export default router;
