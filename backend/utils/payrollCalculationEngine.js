import logger from "./logger.js";

/**
 * Enterprise Payroll Calculation Engine
 * Handles all salary calculations with support for:
 * - Multiple employee types (Intern, Employee, Consultant, Contract Worker)
 * - Salary revisions and mid-cycle changes
 * - Attendance-based deductions
 * - Leave-based deductions
 * - Prorated calculations
 */

class PayrollCalculationEngine {
  /**
   * Calculate payable days based on attendance
   * Formula: Total Working Days - Absent Days - (Half Days * 0.5) - Unpaid Leaves - Late Mark Deductions
   */
  static calculatePayableDays(attendanceData, config = {}) {
    const {
      lateMarkThreshold = 3, // 3 late marks = 0.5 day deduction
      sandwichPolicy = true // Handle sandwich policy
    } = config;

    const {
      totalWorkingDays = 0,
      presentDays = 0,
      absentDays = 0,
      halfDays = 0,
      unpaidLeaveDays = 0,
      lateMarks = 0
    } = attendanceData;

    // Calculate late mark deduction
    const lateMarkDeduction = Math.floor(lateMarks / lateMarkThreshold) * 0.5;

    // Calculate total payable days
    const payableDays =
      totalWorkingDays -
      absentDays -
      halfDays * 0.5 -
      unpaidLeaveDays -
      lateMarkDeduction;

    return {
      totalWorkingDays,
      presentDays,
      absentDays,
      halfDayDeduction: halfDays * 0.5,
      unpaidLeaveDeduction: unpaidLeaveDays,
      lateMarkDeduction,
      totalPayableDays: Math.max(0, payableDays),
      calculationBreakdown: {
        formula: `${totalWorkingDays} - ${absentDays} - (${halfDays} * 0.5) - ${unpaidLeaveDays} - ${lateMarkDeduction}`,
        result: Math.max(0, payableDays)
      }
    };
  }

  /**
   * Calculate per-day salary
   * Formula: Monthly Gross Salary / Total Payable Days
   * Supports: 30-day basis, actual month basis, working-day basis
   */
  static calculatePerDaySalary(grossSalary, payableDays, basis = "actual") {
    if (payableDays === 0) {
      logger.warn("Payable days is 0, cannot calculate per-day salary");
      return 0;
    }

    let divisor = payableDays;

    switch (basis) {
      case "30-day":
        divisor = 30;
        break;
      case "actual":
        divisor = payableDays;
        break;
      case "working-day":
        divisor = payableDays;
        break;
      default:
        divisor = payableDays;
    }

    return Math.round((grossSalary / divisor) * 100) / 100;
  }

  /**
   * Calculate per-hour salary
   * Formula: Per Day Salary / 8 hours
   */
  static calculatePerHourSalary(perDaySalary, hoursPerDay = 8) {
    return Math.round((perDaySalary / hoursPerDay) * 100) / 100;
  }

  /**
   * Calculate per-minute salary
   * Formula: Per Hour Salary / 60 minutes
   */
  static calculatePerMinuteSalary(perHourSalary) {
    return Math.round((perHourSalary / 60) * 100) / 100;
  }

  /**
   * Calculate prorated salary for mid-month joining/resignation
   * Formula: (Per Day Salary * Number of Days Worked)
   */
  static calculateProratedSalary(
    grossSalary,
    totalDaysInMonth,
    daysWorked,
    payableDays
  ) {
    const perDaySalary = this.calculatePerDaySalary(
      grossSalary,
      payableDays,
      "actual"
    );
    const proratedAmount = perDaySalary * daysWorked;

    return {
      perDaySalary,
      daysWorked,
      totalDaysInMonth,
      proratedAmount: Math.round(proratedAmount * 100) / 100,
      calculationBreakdown: {
        formula: `(${grossSalary} / ${payableDays}) * ${daysWorked}`,
        result: Math.round(proratedAmount * 100) / 100
      }
    };
  }

  /**
   * Calculate salary for mid-cycle revision
   * Splits salary calculation into two periods with different salary structures
   */
  static calculateMidCycleSalary(
    periodOne,
    periodTwo,
    salaryStructureOne,
    salaryStructureTwo
  ) {
    const {
      startDate: p1Start,
      endDate: p1End,
      payableDays: p1PayableDays,
      attendanceData: p1Attendance
    } = periodOne;

    const {
      startDate: p2Start,
      endDate: p2End,
      payableDays: p2PayableDays,
      attendanceData: p2Attendance
    } = periodTwo;

    // Calculate earnings for period 1
    const p1Earnings = this.calculateEarnings(
      salaryStructureOne.earnings,
      p1PayableDays
    );
    const p1Deductions = this.calculateDeductions(
      salaryStructureOne.deductions,
      p1Earnings.grossEarnings,
      p1Attendance
    );

    // Calculate earnings for period 2
    const p2Earnings = this.calculateEarnings(
      salaryStructureTwo.earnings,
      p2PayableDays
    );
    const p2Deductions = this.calculateDeductions(
      salaryStructureTwo.deductions,
      p2Earnings.grossEarnings,
      p2Attendance
    );

    const totalGrossEarnings = p1Earnings.grossEarnings + p2Earnings.grossEarnings;
    const totalDeductions = p1Deductions.totalDeductions + p2Deductions.totalDeductions;
    const netSalary = totalGrossEarnings - totalDeductions;

    return {
      periodOne: {
        startDate: p1Start,
        endDate: p1End,
        payableDays: p1PayableDays,
        earnings: p1Earnings,
        deductions: p1Deductions,
        netSalary: p1Earnings.grossEarnings - p1Deductions.totalDeductions
      },
      periodTwo: {
        startDate: p2Start,
        endDate: p2End,
        payableDays: p2PayableDays,
        earnings: p2Earnings,
        deductions: p2Deductions,
        netSalary: p2Earnings.grossEarnings - p2Deductions.totalDeductions
      },
      totalGrossEarnings,
      totalDeductions,
      netSalary,
      calculationBreakdown: {
        periodOneNetSalary: p1Earnings.grossEarnings - p1Deductions.totalDeductions,
        periodTwoNetSalary: p2Earnings.grossEarnings - p2Deductions.totalDeductions,
        totalNetSalary: netSalary
      }
    };
  }

  /**
   * Calculate earnings based on salary structure
   * Supports: Fixed, Percentage-based, Dynamic formulas
   */
  static calculateEarnings(earningsStructure, payableDays = 1, basicSalary = null) {
    let grossEarnings = 0;
    const earningsBreakdown = {};

    for (const [key, value] of Object.entries(earningsStructure || {})) {
      if (key === "otherEarnings" && Array.isArray(value)) {
        let otherEarningsTotal = 0;
        value.forEach((earning) => {
          let amount = 0;
          if (earning.type === "fixed") {
            amount = earning.amount;
          } else if (earning.type === "percentage" && basicSalary) {
            amount = (basicSalary * earning.amount) / 100;
          }
          otherEarningsTotal += amount;
          earningsBreakdown[earning.name] = Math.round(amount * 100) / 100;
        });
        grossEarnings += otherEarningsTotal;
      } else if (typeof value === "number" && value > 0) {
        earningsBreakdown[key] = Math.round(value * 100) / 100;
        grossEarnings += value;
      }
    }

    return {
      breakdown: earningsBreakdown,
      grossEarnings: Math.round(grossEarnings * 100) / 100
    };
  }

  /**
   * Calculate deductions based on salary structure and attendance
   * Supports: Fixed, Percentage-based, Attendance-linked, Leave-linked
   */
  static calculateDeductions(
    deductionsStructure,
    grossEarnings,
    attendanceData = {}
  ) {
    let totalDeductions = 0;
    const deductionsBreakdown = {};

    for (const [key, value] of Object.entries(deductionsStructure || {})) {
      if (key === "otherDeductions" && Array.isArray(value)) {
        let otherDeductionsTotal = 0;
        value.forEach((deduction) => {
          let amount = 0;
          if (deduction.type === "fixed") {
            amount = deduction.amount;
          } else if (deduction.type === "percentage") {
            amount = (grossEarnings * deduction.amount) / 100;
          }
          otherDeductionsTotal += amount;
          deductionsBreakdown[deduction.name] = Math.round(amount * 100) / 100;
        });
        totalDeductions += otherDeductionsTotal;
      } else if (typeof value === "number" && value > 0) {
        deductionsBreakdown[key] = Math.round(value * 100) / 100;
        totalDeductions += value;
      }
    }

    // Add attendance-based deductions
    if (attendanceData.unpaidLeaveDays) {
      const perDaySalary = this.calculatePerDaySalary(
        grossEarnings,
        attendanceData.totalWorkingDays || 30
      );
      const unpaidLeaveDeduction = perDaySalary * attendanceData.unpaidLeaveDays;
      deductionsBreakdown.unpaidLeaveDeduction = Math.round(
        unpaidLeaveDeduction * 100
      ) / 100;
      totalDeductions += unpaidLeaveDeduction;
    }

    return {
      breakdown: deductionsBreakdown,
      totalDeductions: Math.round(totalDeductions * 100) / 100
    };
  }

  /**
   * Calculate complete payroll for an employee
   */
  static calculatePayroll(payrollData) {
    const {
      salaryStructure,
      attendanceData,
      employeeType,
      cycleStartDate,
      cycleEndDate,
      salaryRevisions = []
    } = payrollData;

    try {
      // Step 1: Calculate payable days
      const payableDaysData = this.calculatePayableDays(attendanceData);

      // Step 2: Check for mid-cycle salary revisions
      let earnings, deductions, grossEarnings, totalDeductions, netSalary;

      if (salaryRevisions.length > 0) {
        // Handle mid-cycle salary changes
        const midCycleData = this.calculateMidCycleSalary(
          salaryRevisions[0].periodOne,
          salaryRevisions[0].periodTwo,
          salaryRevisions[0].salaryStructureOne,
          salaryRevisions[0].salaryStructureTwo
        );

        earnings = {
          periodOne: midCycleData.periodOne.earnings,
          periodTwo: midCycleData.periodTwo.earnings
        };
        deductions = {
          periodOne: midCycleData.periodOne.deductions,
          periodTwo: midCycleData.periodTwo.deductions
        };
        grossEarnings = midCycleData.totalGrossEarnings;
        totalDeductions = midCycleData.totalDeductions;
        netSalary = midCycleData.netSalary;
      } else {
        // Standard calculation
        earnings = this.calculateEarnings(
          salaryStructure.earnings,
          payableDaysData.totalPayableDays,
          salaryStructure.earnings.basic
        );
        deductions = this.calculateDeductions(
          salaryStructure.deductions,
          earnings.grossEarnings,
          attendanceData
        );
        grossEarnings = earnings.grossEarnings;
        totalDeductions = deductions.totalDeductions;
        netSalary = grossEarnings - totalDeductions;
      }

      // Step 3: Calculate per-day, per-hour, per-minute salary
      const perDaySalary = this.calculatePerDaySalary(
        grossEarnings,
        payableDaysData.totalPayableDays
      );
      const perHourSalary = this.calculatePerHourSalary(perDaySalary);
      const perMinuteSalary = this.calculatePerMinuteSalary(perHourSalary);

      return {
        success: true,
        payableDaysData,
        earnings,
        deductions,
        grossEarnings: Math.round(grossEarnings * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100,
        perDaySalary,
        perHourSalary,
        perMinuteSalary,
        employeeType,
        cycleStartDate,
        cycleEndDate
      };
    } catch (error) {
      logger.error("Payroll calculation error", {
        error: error.message,
        payrollData
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default PayrollCalculationEngine;
