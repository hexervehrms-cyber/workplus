import logger from "./logger.js";

/**
 * Payroll Cycle Engine
 * Manages payroll cycles with the following rules:
 * - Cycle: 21st of current month to 20th of next month
 * - Salary Release: 1st of next month
 * - Salary Hold: 10 days after release
 */

class PayrollCycleEngine {
  /**
   * Generate payroll cycle for a given month
   * @param {number} year - Year (e.g., 2026)
   * @param {number} month - Month (1-12)
   * @returns {Object} Payroll cycle details
   */
  static generatePayrollCycle(year, month) {
    // Cycle starts on 21st of current month
    const cycleStartDate = new Date(year, month - 1, 21);

    // Cycle ends on 20th of next month
    let cycleEndMonth = month;
    let cycleEndYear = year;
    if (month === 12) {
      cycleEndMonth = 1;
      cycleEndYear = year + 1;
    } else {
      cycleEndMonth = month + 1;
    }
    const cycleEndDate = new Date(cycleEndYear, cycleEndMonth - 1, 20);

    // Salary release date: 1st of next month after cycle end
    let releaseMonth = cycleEndMonth;
    let releaseYear = cycleEndYear;
    if (cycleEndMonth === 12) {
      releaseMonth = 1;
      releaseYear = cycleEndYear + 1;
    } else {
      releaseMonth = cycleEndMonth + 1;
    }
    const salaryReleaseDate = new Date(releaseYear, releaseMonth - 1, 1);

    // Salary hold: 10 days after release
    const salaryHoldUntil = new Date(salaryReleaseDate);
    salaryHoldUntil.setDate(salaryHoldUntil.getDate() + 10);

    return {
      cycleStartDate,
      cycleEndDate,
      salaryReleaseDate,
      salaryHoldUntil,
      cycleNumber: month,
      year,
      month
    };
  }

  /**
   * Get current payroll cycle
   * @returns {Object} Current payroll cycle
   */
  static getCurrentPayrollCycle() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const date = today.getDate();

    // If date is between 1-20, cycle is from previous month's 21st
    // If date is between 21-31, cycle is from current month's 21st
    let cycleMonth = month;
    if (date < 21) {
      cycleMonth = month - 1;
      if (cycleMonth === 0) {
        cycleMonth = 12;
      }
    }

    return this.generatePayrollCycle(year, cycleMonth);
  }

  /**
   * Get payroll cycle for a specific date
   * @param {Date} date - Date to find cycle for
   * @returns {Object} Payroll cycle
   */
  static getPayrollCycleForDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dateOfMonth = date.getDate();

    // If date is between 1-20, cycle is from previous month's 21st
    // If date is between 21-31, cycle is from current month's 21st
    let cycleMonth = month;
    if (dateOfMonth < 21) {
      cycleMonth = month - 1;
      if (cycleMonth === 0) {
        cycleMonth = 12;
      }
    }

    return this.generatePayrollCycle(year, cycleMonth);
  }

  /**
   * Calculate working days in a payroll cycle
   * Excludes weekends and public holidays
   * @param {Date} startDate - Cycle start date
   * @param {Date} endDate - Cycle end date
   * @param {Array} publicHolidays - Array of public holiday dates
   * @returns {number} Total working days
   */
  static calculateWorkingDays(startDate, endDate, publicHolidays = []) {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      const isPublicHoliday = publicHolidays.some(
        (holiday) =>
          holiday.getDate() === currentDate.getDate() &&
          holiday.getMonth() === currentDate.getMonth() &&
          holiday.getFullYear() === currentDate.getFullYear()
      );

      if (!isWeekend && !isPublicHoliday) {
        workingDays++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  /**
   * Calculate payable days for an employee in a cycle
   * Takes into account joining date, resignation date, leaves, etc.
   */
  static calculatePayableDays(
    cycleStartDate,
    cycleEndDate,
    joiningDate,
    resignationDate = null,
    publicHolidays = []
  ) {
    let effectiveStartDate = cycleStartDate;
    let effectiveEndDate = cycleEndDate;

    // If employee joined after cycle start
    if (joiningDate > cycleStartDate) {
      effectiveStartDate = joiningDate;
    }

    // If employee resigned before cycle end
    if (resignationDate && resignationDate < cycleEndDate) {
      effectiveEndDate = resignationDate;
    }

    const totalWorkingDays = this.calculateWorkingDays(
      effectiveStartDate,
      effectiveEndDate,
      publicHolidays
    );

    return {
      cycleStartDate,
      cycleEndDate,
      effectiveStartDate,
      effectiveEndDate,
      totalWorkingDays,
      joiningDate,
      resignationDate
    };
  }

  /**
   * Check if a date falls within a payroll cycle
   */
  static isDateInCycle(date, cycleStartDate, cycleEndDate) {
    return date >= cycleStartDate && date <= cycleEndDate;
  }

  /**
   * Get all payroll cycles for a year
   */
  static getYearPayrollCycles(year) {
    const cycles = [];
    for (let month = 1; month <= 12; month++) {
      cycles.push(this.generatePayrollCycle(year, month));
    }
    return cycles;
  }

  /**
   * Calculate days between two dates (inclusive)
   */
  static calculateDaysBetween(startDate, endDate) {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(startDate);
    const secondDate = new Date(endDate);
    return Math.round((secondDate - firstDate) / oneDay) + 1;
  }

  /**
   * Validate if payroll cycle is locked
   * Payroll is locked 10 days after salary release
   */
  static isPayrollLocked(salaryReleaseDate) {
    const today = new Date();
    const lockDate = new Date(salaryReleaseDate);
    lockDate.setDate(lockDate.getDate() + 10);
    return today > lockDate;
  }

  /**
   * Get salary hold status
   */
  static getSalaryHoldStatus(salaryReleaseDate) {
    const today = new Date();
    const holdUntilDate = new Date(salaryReleaseDate);
    holdUntilDate.setDate(holdUntilDate.getDate() + 10);

    return {
      isOnHold: today < holdUntilDate,
      holdUntilDate,
      daysRemaining: Math.ceil(
        (holdUntilDate - today) / (24 * 60 * 60 * 1000)
      )
    };
  }
}

export default PayrollCycleEngine;
