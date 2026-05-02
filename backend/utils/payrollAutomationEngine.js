/**
 * Automated Payroll Processing Engine
 * Handles salary calculations, tax compliance, and payroll automation
 */

import Payslip from "../models/Payroll.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import logger from "./logger.js";

class PayrollAutomationEngine {
  constructor(notificationManager, eventSystem) {
    this.notificationManager = notificationManager;
    this.eventSystem = eventSystem;
    
    this.salaryComponents = {
      BASIC: 'basic',
      HRA: 'hra',
      CONVEYANCE: 'conveyance',
      MEDICAL: 'medical',
      SPECIAL_ALLOWANCE: 'special_allowance',
      PROFESSIONAL_TAX: 'professional_tax',
      INCOME_TAX: 'income_tax',
      PF: 'pf',
      ESIC: 'esic',
      LOAN_DEDUCTION: 'loan_deduction',
      TDS: 'tds',
      OTHER_DEDUCTIONS: 'other_deductions'
    };

    this.defaultTaxSlabs = {
      // India tax slabs (FY 2024-25)
      newRegime: {
        0: 0,
        250000: 0,
        500000: 0.05,
        750000: 0.10,
        1000000: 0.15,
        1250000: 0.20,
        1500000: 0.25,
        Infinity: 0.30
      },
      oldRegime: {
        0: 0,
        250000: 0,
        500000: 0.05,
        1000000: 0.20,
        Infinity: 0.30
      }
    };

    this.contributionRates = {
      pf: {
        employee: 0.12,
        employer: 0.12,
        limit: 15000
      },
      esic: {
        employee: 0.0075,
        employer: 0.0325,
        limit: 21000
      }
    };
  }

  /**
   * Process payroll for all employees
   */
  async processPayroll(month, year, orgId) {
    try {
      // Get all active employees
      const employees = await Employee.find({
        orgId,
        status: 'active'
      }).populate('userId', 'name email').lean();

      const payrollResults = [];

      for (const employee of employees) {
        const result = await this.processEmployeePayroll(employee, month, year);
        payrollResults.push(result);
      }

      // Generate payroll summary
      const summary = this.generatePayrollSummary(payrollResults);

      // Emit payroll processed event
      if (this.eventSystem) {
        await this.eventSystem.emit('payroll.processed', {
          month,
          year,
          orgId,
          employeeCount: payrollResults.length,
          summary
        });
      }

      logger.info('Payroll processed', {
        month,
        year,
        orgId,
        employeeCount: payrollResults.length,
        totalPayroll: summary.totalGross,
        totalDeductions: summary.totalDeductions,
        totalNet: summary.totalNet
      });

      return {
        success: true,
        payrollResults,
        summary
      };

    } catch (error) {
      logger.error('Failed to process payroll', {
        error: error.message,
        month,
        year,
        orgId
      });
      throw error;
    }
  }

  /**
   * Process payroll for single employee
   */
  async processEmployeePayroll(employee, month, year) {
    try {
      const { _id: employeeId, userId, name, email, baseSalary, department, designation, orgId } = employee;

      // Get attendance for the month
      const attendance = await this.getMonthlyAttendance(employeeId, month, year);

      // Get leave for the month
      const leave = await this.getMonthlyLeave(employeeId, month, year);

      // Calculate salary components
      const salaryComponents = this.calculateSalaryComponents(
        baseSalary,
        attendance,
        leave,
        employee
      );

      // Calculate deductions
      const deductions = this.calculateDeductions(salaryComponents, employee);

      // Calculate net salary
      const netSalary = salaryComponents.grossSalary - deductions.totalDeductions;

      // Create payslip record
      const payslip = await Payslip.create({
        employeeId,
        userId: userId._id,
        employeeName: name,
        email,
        department,
        designation,
        month,
        year,
        attendanceDays: attendance.totalDays,
        presentDays: attendance.presentDays,
        absentDays: attendance.absentDays,
        leaveDays: leave.totalDays,
        salaryComponents,
        deductions,
        grossSalary: salaryComponents.grossSalary,
        netSalary,
        status: 'generated',
        orgId
      });

      // Emit payroll event
      if (this.eventSystem) {
        await this.eventSystem.emit('payroll.employee_processed', {
          employee,
          payslip,
          month,
          year,
          orgId
        });
      }

      // Send notification to employee
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'payroll_generated',
          title: 'Payslip Generated',
          message: `Your payslip for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year} is ready`,
          recipients: [userId._id],
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: {
            payslipId: payslip._id,
            month,
            year,
            netSalary,
            grossSalary: salaryComponents.grossSalary
          },
          orgId
        });
      }

      logger.info('Employee payroll processed', {
        employeeId,
        name,
        month,
        year,
        netSalary
      });

      return {
        employeeId,
        name,
        email,
        month,
        year,
        netSalary,
        grossSalary: salaryComponents.grossSalary,
        deductions: deductions.totalDeductions,
        payslipId: payslip._id
      };

    } catch (error) {
      logger.error('Failed to process employee payroll', {
        error: error.message,
        employeeId: employee._id,
        month,
        year
      });
      throw error;
    }
  }

  /**
   * Calculate salary components
   */
  calculateSalaryComponents(baseSalary, attendance, leave, employee) {
    // Calculate daily wage
    const workingDays = 26; // Standard working days per month
    const dailyWage = baseSalary / workingDays;

    // Calculate attendance-based pay
    const presentDays = attendance.presentDays || 0;
    const absentDays = attendance.absentDays || 0;
    const leaveDays = leave.totalDays || 0;

    // Attendance pay
    const attendancePay = presentDays * dailyWage;

    // Absent deduction
    const absentDeduction = absentDays * dailyWage;

    // Leave deduction (unpaid leave)
    const unpaidLeave = leave.unpaidDays || 0;
    const leaveDeduction = unpaidLeave * dailyWage;

    // Calculate gross salary
    const grossSalary = attendancePay - absentDeduction - leaveDeduction;

    // Break down into components
    const components = {
      basic: grossSalary * 0.5,
      hra: grossSalary * 0.4,
      conveyance: 1600,
      medical: 1250,
      specialAllowance: grossSalary - (grossSalary * 0.5) - (grossSalary * 0.4) - 1600 - 1250,
      grossSalary
    };

    return components;
  }

  /**
   * Calculate deductions
   */
  calculateDeductions(salaryComponents, employee) {
    const grossSalary = salaryComponents.grossSalary;

    // Professional tax (max ₹2,500 per year in most states)
    const professionalTax = Math.min(2500, grossSalary * 0.01);

    // PF contribution
    const pfEmployee = Math.min(
      salaryComponents.basic * this.contributionRates.pf.employee,
      this.contributionRates.pf.limit * this.contributionRates.pf.employee
    );

    // ESIC contribution (if applicable)
    const esicEmployee = grossSalary <= this.contributionRates.esic.limit
      ? grossSalary * this.contributionRates.esic.employee
      : 0;

    // Income tax (simplified - in production, use tax calculation service)
    const taxableIncome = grossSalary * 12; // Annualized
    const incomeTax = this.calculateIncomeTax(taxableIncome, 'newRegime') / 12;

    // Total deductions
    const totalDeductions = 
      professionalTax + 
      pfEmployee + 
      esicEmployee + 
      incomeTax;

    return {
      professionalTax,
      pf: pfEmployee,
      esic: esicEmployee,
      incomeTax,
      totalDeductions
    };
  }

  /**
   * Calculate income tax
   */
  calculateIncomeTax(annualIncome, regime = 'newRegime') {
    const slabs = this.defaultTaxSlabs[regime];
    let tax = 0;
    let previousLimit = 0;

    for (const [limit, rate] of Object.entries(slabs)) {
      if (annualIncome > limit) {
        const taxableAmount = annualIncome - previousLimit;
        tax += taxableAmount * rate;
        previousLimit = limit;
      }
    }

    // Add 4% health and education cess
    tax += tax * 0.04;

    return tax;
  }

  /**
   * Get monthly attendance
   */
  async getMonthlyAttendance(employeeId, month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendance = await Attendance.aggregate([
      {
        $match: {
          employeeId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      earlyExitDays: 0
    };

    for (const item of attendance) {
      if (item._id === 'present') {
        result.presentDays = item.count;
      } else if (item._id === 'absent') {
        result.absentDays = item.count;
      } else if (item._id === 'late') {
        result.lateDays = item.count;
      } else if (item._id === 'early_exit') {
        result.earlyExitDays = item.count;
      }
      result.totalDays += item.count;
    }

    return result;
  }

  /**
   * Get monthly leave
   */
  async getMonthlyLeave(employeeId, month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const leave = await LeaveRequest.aggregate([
      {
        $match: {
          employeeId,
          status: 'approved',
          startDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: "$days" },
          unpaidDays: {
            $sum: {
              $cond: [{ $eq: ["$type", "unpaid"] }, "$days", 0]
            }
          }
        }
      }
    ]);

    return leave[0] || { totalDays: 0, unpaidDays: 0 };
  }

  /**
   * Generate payroll summary
   */
  generatePayrollSummary(results) {
    return results.reduce((summary, result) => ({
      totalEmployees: summary.totalEmployees + 1,
      totalGross: summary.totalGross + result.grossSalary,
      totalDeductions: summary.totalDeductions + result.deductions,
      totalNet: summary.totalNet + result.netSalary,
      minNetSalary: Math.min(summary.minNetSalary, result.netSalary),
      maxNetSalary: Math.max(summary.maxNetSalary, result.netSalary),
      avgNetSalary: (summary.totalNet + result.netSalary) / (summary.totalEmployees + 1)
    }), {
      totalEmployees: 0,
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      minNetSalary: Infinity,
      maxNetSalary: 0,
      avgNetSalary: 0
    });
  }

  /**
   * Generate payslip PDF (placeholder)
   */
  async generatePayslipPDF(payslipId) {
    // In production, this would generate PDF using a library like pdfmake or puppeteer
    logger.info('Payslip PDF generation requested', { payslipId });
    return { success: true, message: 'PDF generation would be triggered here' };
  }

  /**
   * Get payroll history for employee
   */
  async getPayrollHistory(employeeId, limit = 12) {
    try {
      const history = await Payslip.find({
        employeeId,
        status: { $in: ['generated', 'paid'] }
      })
      .sort({ year: -1, month: -1 })
      .limit(limit)
      .lean();

      return {
        employeeId,
        history,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get payroll history', {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Get payroll analytics
   */
  async getPayrollAnalytics(orgId, month, year) {
    try {
      const analytics = await Payslip.aggregate([
        {
          $match: { orgId, month, year, status: { $in: ['generated', 'paid'] } }
        },
        {
          $group: {
            _id: "$department",
            count: { $sum: 1 },
            avgGross: { $avg: "$grossSalary" },
            avgNet: { $avg: "$netSalary" },
            totalGross: { $sum: "$grossSalary" },
            totalNet: { $sum: "$netSalary" }
          }
        },
        {
          $group: {
            _id: null,
            departments: { $push: "$$ROOT" },
            totalEmployees: { $sum: "$count" },
            totalGross: { $sum: "$totalGross" },
            totalNet: { $sum: "$totalNet" },
            avgGross: { $avg: "$avgGross" },
            avgNet: { $avg: "$avgNet" }
          }
        }
      ]);

      return {
        orgId,
        month,
        year,
        analytics: analytics[0] || {
          departments: [],
          totalEmployees: 0,
          totalGross: 0,
          totalNet: 0,
          avgGross: 0,
          avgNet: 0
        },
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get payroll analytics', {
        error: error.message,
        orgId,
        month,
        year
      });
      throw error;
    }
  }

  /**
   * Get salary components
   */
  getSalaryComponents() {
    return this.salaryComponents;
  }

  /**
   * Get contribution rates
   */
  getContributionRates() {
    return this.contributionRates;
  }
}

export default PayrollAutomationEngine;