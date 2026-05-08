import SalaryStructure from "../models/SalaryStructure.js";
import SalaryCycle from "../models/SalaryCycle.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Attendance from "../models/Attendance.js";
import logger from "./logger.js";

/**
 * Salary Calculation Engine
 * Handles daily, weekly, and monthly salary calculations
 * Supports variable salary structures with date ranges
 */
class SalaryCalculationEngine {
  /**
   * Calculate daily wage for an employee
   * @param {Object} salaryStructure - Salary structure for the date
   * @param {Object} salaryCycle - Salary cycle configuration
   * @returns {number} Daily wage
   */
  calculateDailyWage(salaryStructure, salaryCycle) {
    if (!salaryStructure || !salaryCycle) {
      throw new Error("Salary structure and cycle are required");
    }

    const workingDaysPerMonth = salaryCycle.workingDaysPerMonth || 22;
    const grossSalary = this.calculateGrossSalary(salaryStructure);
    const dailyWage = grossSalary / workingDaysPerMonth;

    return Math.round(dailyWage * 100) / 100;
  }

  /**
   * Calculate gross salary from structure
   * @param {Object} structure - Salary structure
   * @returns {number} Gross salary
   */
  calculateGrossSalary(structure) {
    if (!structure) return 0;

    const baseSalary = structure.baseSalary || 0;
    const hra = structure.hra || 0;
    const dearness = structure.dearness || 0;
    const conveyance = structure.conveyance || 0;
    const medical = structure.medical || 0;
    const otherAllowances = structure.otherAllowances || 0;

    return baseSalary + hra + dearness + conveyance + medical + otherAllowances;
  }

  /**
   * Calculate total deductions from structure
   * @param {Object} structure - Salary structure
   * @returns {number} Total deductions
   */
  calculateTotalDeductions(structure) {
    if (!structure) return 0;

    const providentFund = structure.providentFund || 0;
    const tax = structure.tax || 0;
    const insurance = structure.insurance || 0;
    const otherDeductions = structure.otherDeductions || 0;

    return providentFund + tax + insurance + otherDeductions;
  }

  /**
   * Calculate net salary from structure
   * @param {Object} structure - Salary structure
   * @returns {number} Net salary
   */
  calculateNetSalary(structure) {
    const gross = this.calculateGrossSalary(structure);
    const deductions = this.calculateTotalDeductions(structure);
    return gross - deductions;
  }

  /**
   * Calculate salary for a date range
   * @param {string} employeeId - Employee ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} salaryCycle - Salary cycle
   * @returns {Promise<Object>} Salary calculation details
   */
  async calculateSalaryForDateRange(
    employeeId,
    startDate,
    endDate,
    salaryCycle
  ) {
    try {
      const salaryStructure = await SalaryStructure.findByEmployee(
        employeeId,
        salaryCycle.orgId
      );

      if (!salaryStructure) {
        throw new Error("Salary structure not found for employee");
      }

      // Get all structures applicable in the date range
      const applicableStructures = salaryStructure.structures.filter((s) => {
        const structStart = new Date(s.fromDate);
        const structEnd = s.toDate ? new Date(s.toDate) : new Date("2099-12-31");
        return structStart <= endDate && structEnd >= startDate;
      });

      if (applicableStructures.length === 0) {
        throw new Error("No applicable salary structure found for date range");
      }

      let totalEarnings = 0;
      const structureBreakdown = [];

      // Calculate earnings for each applicable structure
      for (const structure of applicableStructures) {
        const structStart = new Date(structure.fromDate);
        const structEnd = structure.toDate
          ? new Date(structure.toDate)
          : new Date("2099-12-31");

        // Calculate overlap period
        const periodStart = new Date(Math.max(startDate, structStart));
        const periodEnd = new Date(Math.min(endDate, structEnd));

        const daysInPeriod = this.calculateWorkingDays(
          periodStart,
          periodEnd,
          salaryCycle
        );
        const dailyWage = this.calculateDailyWage(structure, salaryCycle);
        const earnings = daysInPeriod * dailyWage;

        totalEarnings += earnings;
        structureBreakdown.push({
          fromDate: periodStart,
          toDate: periodEnd,
          daysWorked: daysInPeriod,
          dailyWage,
          earnings: Math.round(earnings * 100) / 100,
          structure: {
            baseSalary: structure.baseSalary,
            hra: structure.hra,
            allowances:
              (structure.dearness || 0) +
              (structure.conveyance || 0) +
              (structure.medical || 0) +
              (structure.otherAllowances || 0)
          }
        });
      }

      return {
        employeeId,
        startDate,
        endDate,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        structureBreakdown,
        workingDays: this.calculateWorkingDays(startDate, endDate, salaryCycle)
      };
    } catch (error) {
      logger.error("Error calculating salary for date range", {
        error: error.message,
        employeeId,
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Calculate working days between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} salaryCycle - Salary cycle configuration
   * @returns {number} Number of working days
   */
  calculateWorkingDays(startDate, endDate, salaryCycle) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;

    const workingDaysPerWeek = salaryCycle?.workingDaysPerWeek || 5;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      // 0 = Sunday, 6 = Saturday
      // If working 5 days per week, exclude Saturday and Sunday
      if (workingDaysPerWeek === 5) {
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++;
        }
      } else if (workingDaysPerWeek === 6) {
        if (dayOfWeek !== 0) {
          workingDays++;
        }
      } else {
        workingDays++;
      }
    }

    return workingDays;
  }

  /**
   * Get salary structure for a specific date
   * @param {string} employeeId - Employee ID
   * @param {Date} date - Date to get structure for
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Salary structure
   */
  async getSalaryStructureForDate(employeeId, date, orgId) {
    try {
      const salaryStructure = await SalaryStructure.findByEmployee(
        employeeId,
        orgId
      );

      if (!salaryStructure) {
        throw new Error("Salary structure not found");
      }

      const structure = salaryStructure.getStructureForDate(date);

      if (!structure) {
        throw new Error("No applicable salary structure found for date");
      }

      return structure;
    } catch (error) {
      logger.error("Error getting salary structure for date", {
        error: error.message,
        employeeId,
        date
      });
      throw error;
    }
  }

  /**
   * Calculate salary till date (from joining date to specified date)
   * @param {string} employeeId - Employee ID
   * @param {Date} tillDate - Date to calculate till
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Salary calculation
   */
  async calculateSalaryTillDate(employeeId, tillDate, orgId) {
    try {
      const salaryStructure = await SalaryStructure.findByEmployee(
        employeeId,
        orgId
      );

      if (!salaryStructure) {
        throw new Error("Salary structure not found");
      }

      const salaryCycle = await SalaryCycle.getActiveCycle(orgId);

      if (!salaryCycle) {
        throw new Error("Salary cycle not configured");
      }

      // Get first structure's from date as joining date
      const joiningDate = new Date(salaryStructure.structures[0].fromDate);

      return await this.calculateSalaryForDateRange(
        employeeId,
        joiningDate,
        tillDate,
        salaryCycle
      );
    } catch (error) {
      logger.error("Error calculating salary till date", {
        error: error.message,
        employeeId,
        tillDate
      });
      throw error;
    }
  }

  /**
   * Calculate monthly salary for a specific month
   * @param {string} employeeId - Employee ID
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {string} orgId - Organization ID
   * @returns {Promise<Object>} Monthly salary calculation
   */
  async calculateMonthlySalary(employeeId, month, year, orgId) {
    try {
      const salaryCycle = await SalaryCycle.getActiveCycle(orgId);

      if (!salaryCycle) {
        throw new Error("Salary cycle not configured");
      }

      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      return await this.calculateSalaryForDateRange(
        employeeId,
        startDate,
        endDate,
        salaryCycle
      );
    } catch (error) {
      logger.error("Error calculating monthly salary", {
        error: error.message,
        employeeId,
        month,
        year
      });
      throw error;
    }
  }

  /**
   * Get salary structure history for employee
   * @param {string} employeeId - Employee ID
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} Array of salary structures
   */
  async getSalaryStructureHistory(employeeId, orgId) {
    try {
      const salaryStructure = await SalaryStructure.findByEmployee(
        employeeId,
        orgId
      );

      if (!salaryStructure) {
        return [];
      }

      return salaryStructure.structures.map((s) => ({
        fromDate: s.fromDate,
        toDate: s.toDate,
        baseSalary: s.baseSalary,
        grossSalary: this.calculateGrossSalary(s),
        netSalary: this.calculateNetSalary(s),
        payFrequency: s.payFrequency,
        dailyWage: s.dailyWage
      }));
    } catch (error) {
      logger.error("Error getting salary structure history", {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }
}

export default new SalaryCalculationEngine();
