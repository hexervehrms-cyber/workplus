/**
 * Automated Payroll System
 * Handles payroll calculation, processing, and compliance automation
 */

import Employee from "../models/Employee.js";
import Payslip from "../models/Payroll.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import logger from "./logger.js";

class AutomatedPayrollSystem {
  constructor(notificationManager, eventSystem, socketManager) {
    this.notificationManager = notificationManager;
    this.eventSystem = eventSystem;
    this.socketManager = socketManager;
    
    // Default payroll configuration
    this.defaultConfig = {
      payrollCycle: 'monthly', // 'weekly', 'bi-weekly', 'monthly'
      payrollDay: 1, // Day of month for monthly cycle
      cutoffDay: 25, // Last day of attendance for payroll
      currency: 'USD',
      taxConfiguration: {
        incomeTaxSlabs: [
          { min: 0, max: 250000, rate: 0 },
          { min: 250001, max: 500000, rate: 5 },
          { min: 500001, max: 1000000, rate: 20 },
          { min: 1000001, max: Infinity, rate: 30 }
        ],
        professionalTax: {
          enabled: true,
          slabs: [
            { min: 0, max: 15000, amount: 0 },
            { min: 15001, max: 25000, amount: 150 },
            { min: 25001, max: Infinity, amount: 200 }
          ]
        },
        providentFund: {
          employeeRate: 12, // percentage
          employerRate: 12,
          maxSalaryLimit: 15000 // PF calculated on max this amount
        },
        esi: {
          enabled: true,
          employeeRate: 0.75,
          employerRate: 3.25,
          maxSalaryLimit: 21000
        }
      },
      allowances: {
        hra: {
          enabled: true,
          calculation: 'percentage', // 'fixed', 'percentage'
          value: 40, // 40% of basic salary
          taxExempt: true
        },
        transport: {
          enabled: true,
          calculation: 'fixed',
          value: 1600,
          taxExempt: true
        },
        medical: {
          enabled: true,
          calculation: 'fixed',
          value: 1250,
          taxExempt: true
        },
        special: {
          enabled: true,
          calculation: 'percentage',
          value: 10,
          taxExempt: false
        }
      },
      deductions: {
        lateDeduction: {
          enabled: true,
          type: 'per_day', // 'per_day', 'per_hour'
          amount: 500 // amount per day/hour
        },
        absentDeduction: {
          enabled: true,
          type: 'per_day',
          calculation: 'daily_wage' // deduct full daily wage
        },
        advanceDeduction: {
          enabled: true,
          maxInstallments: 12
        }
      },
      overtime: {
        enabled: true,
        weekdayMultiplier: 1.5,
        weekendMultiplier: 2.0,
        holidayMultiplier: 2.5,
        maxOvertimeHours: 60 // per month
      },
      compliance: {
        minimumWage: 15000, // per month
        gratuityEligibility: 5, // years of service
        bonusEligibility: 1, // years of service
        leaveEncashment: true
      }
    };
    
    this.organizationConfigs = new Map();
    this.payrollSchedules = new Map();
  }

  /**
   * Set payroll configuration for organization
   */
  setOrganizationConfig(orgId, config) {
    const mergedConfig = {
      ...this.defaultConfig,
      ...config,
      orgId,
      updatedAt: new Date()
    };
    
    this.organizationConfigs.set(orgId, mergedConfig);
    
    logger.info('Payroll configuration updated', { orgId });
    
    return mergedConfig;
  }

  /**
   * Get payroll configuration for organization
   */
  getOrganizationConfig(orgId) {
    return this.organizationConfigs.get(orgId) || this.defaultConfig;
  }

  /**
   * Calculate payroll for employee
   */
  async calculateEmployeePayroll(employeeId, payrollMonth, payrollYear) {
    try {
      const employee = await Employee.findById(employeeId).populate('userId');
      if (!employee) {
        throw new Error('Employee not found');
      }

      const config = this.getOrganizationConfig(employee.orgId);
      
      // Get payroll period dates
      const { startDate, endDate } = this.getPayrollPeriod(payrollMonth, payrollYear, config);
      
      // Get attendance data
      const attendanceData = await this.getAttendanceData(employeeId, startDate, endDate);
      
      // Get leave data
      const leaveData = await this.getLeaveData(employeeId, startDate, endDate);
      
      // Calculate basic components
      const basicSalary = employee.baseSalary || 0;
      const dailyWage = this.calculateDailyWage(basicSalary, config);
      
      // Calculate earnings
      const earnings = await this.calculateEarnings(employee, attendanceData, leaveData, config, dailyWage);
      
      // Calculate deductions
      const deductions = await this.calculateDeductions(employee, attendanceData, leaveData, earnings, config);
      
      // Calculate taxes
      const taxes = this.calculateTaxes(earnings.grossSalary, config);
      
      // Calculate net salary
      const totalDeductions = deductions.totalDeductions + taxes.totalTax;
      const netSalary = earnings.grossSalary - totalDeductions;
      
      const payrollCalculation = {
        employeeId,
        employeeName: employee.userId.name,
        employeeCode: employee.employeeCode,
        department: employee.department,
        designation: employee.designation,
        payrollMonth,
        payrollYear,
        payrollPeriod: { startDate, endDate },
        
        // Salary components
        basicSalary,
        dailyWage,
        
        // Attendance summary
        attendanceSummary: {
          totalDays: attendanceData.totalDays,
          presentDays: attendanceData.presentDays,
          absentDays: attendanceData.absentDays,
          lateDays: attendanceData.lateDays,
          overtimeHours: attendanceData.overtimeHours,
          weekendHours: attendanceData.weekendHours,
          holidayHours: attendanceData.holidayHours
        },
        
        // Leave summary
        leaveSummary: {
          totalLeave: leaveData.totalDays,
          paidLeave: leaveData.paidDays,
          unpaidLeave: leaveData.unpaidDays,
          leaveTypes: leaveData.leaveTypes
        },
        
        // Earnings breakdown
        earnings: {
          basicPay: earnings.basicPay,
          hra: earnings.hra,
          allowances: earnings.allowances,
          overtime: earnings.overtime,
          bonus: earnings.bonus,
          incentives: earnings.incentives,
          grossSalary: earnings.grossSalary
        },
        
        // Deductions breakdown
        deductions: {
          lateDeduction: deductions.lateDeduction,
          absentDeduction: deductions.absentDeduction,
          advanceDeduction: deductions.advanceDeduction,
          loanDeduction: deductions.loanDeduction,
          otherDeductions: deductions.otherDeductions,
          totalDeductions: deductions.totalDeductions
        },
        
        // Tax breakdown
        taxes: {
          incomeTax: taxes.incomeTax,
          professionalTax: taxes.professionalTax,
          providentFund: taxes.providentFund,
          esi: taxes.esi,
          totalTax: taxes.totalTax
        },
        
        // Final calculation
        netSalary,
        
        // Metadata
        calculatedAt: new Date(),
        calculatedBy: 'system',
        orgId: employee.orgId
      };

      return payrollCalculation;

    } catch (error) {
      logger.error('Failed to calculate employee payroll', {
        error: error.message,
        employeeId,
        payrollMonth,
        payrollYear
      });
      throw error;
    }
  }

  /**
   * Process payroll for organization
   */
  async processOrganizationPayroll(orgId, payrollMonth, payrollYear, options = {}) {
    try {
      const {
        employeeIds = null,
        autoApprove = false,
        generatePayslips = true,
        sendNotifications = true
      } = options;

      logger.info('Starting payroll processing', { orgId, payrollMonth, payrollYear });

      // Get employees to process
      const query = { orgId, status: 'active' };
      if (employeeIds && employeeIds.length > 0) {
        query._id = { $in: employeeIds };
      }

      const employees = await Employee.find(query).populate('userId');
      
      if (employees.length === 0) {
        throw new Error('No active employees found for payroll processing');
      }

      const payrollResults = [];
      const errors = [];

      // Process each employee
      for (const employee of employees) {
        try {
          // Calculate payroll
          const calculation = await this.calculateEmployeePayroll(
            employee._id,
            payrollMonth,
            payrollYear
          );

          // Generate payslip if requested
          let payslip = null;
          if (generatePayslips) {
            payslip = await this.generatePayslip(calculation, autoApprove);
          }

          payrollResults.push({
            employeeId: employee._id,
            employeeName: employee.userId.name,
            calculation,
            payslip,
            status: 'success'
          });

          // Send notification to employee
          if (sendNotifications && payslip && this.notificationManager) {
            await this.notificationManager.sendNotification({
              type: 'payslip_generated',
              title: 'Payslip Generated',
              message: `Your payslip for ${this.getMonthName(payrollMonth)} ${payrollYear} is ready`,
              recipients: [employee.userId._id],
              priority: 'normal',
              channels: ['in_app', 'email'],
              data: { payslip, calculation },
              actionUrl: `/payroll/payslip/${payslip._id}`,
              orgId
            });
          }

        } catch (employeeError) {
          logger.error('Failed to process payroll for employee', {
            error: employeeError.message,
            employeeId: employee._id,
            employeeName: employee.userId.name
          });

          errors.push({
            employeeId: employee._id,
            employeeName: employee.userId.name,
            error: employeeError.message
          });

          payrollResults.push({
            employeeId: employee._id,
            employeeName: employee.userId.name,
            status: 'error',
            error: employeeError.message
          });
        }
      }

      // Generate payroll summary
      const summary = {
        orgId,
        payrollMonth,
        payrollYear,
        totalEmployees: employees.length,
        successfulProcessing: payrollResults.filter(r => r.status === 'success').length,
        failedProcessing: errors.length,
        totalGrossSalary: payrollResults
          .filter(r => r.status === 'success')
          .reduce((sum, r) => sum + r.calculation.earnings.grossSalary, 0),
        totalNetSalary: payrollResults
          .filter(r => r.status === 'success')
          .reduce((sum, r) => sum + r.calculation.netSalary, 0),
        totalDeductions: payrollResults
          .filter(r => r.status === 'success')
          .reduce((sum, r) => sum + r.calculation.deductions.totalDeductions, 0),
        totalTaxes: payrollResults
          .filter(r => r.status === 'success')
          .reduce((sum, r) => sum + r.calculation.taxes.totalTax, 0),
        processedAt: new Date()
      };

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('payroll.processed', {
          summary,
          results: payrollResults,
          errors,
          orgId
        });
      }

      // Send summary notification to HR/Admin
      if (sendNotifications && this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'payroll_processed',
          title: 'Payroll Processing Complete',
          message: `Payroll for ${this.getMonthName(payrollMonth)} ${payrollYear} processed successfully`,
          recipients: ['hr', 'admin'],
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: { summary, errors },
          orgId
        });
      }

      logger.info('Payroll processing completed', {
        orgId,
        payrollMonth,
        payrollYear,
        totalEmployees: employees.length,
        successful: summary.successfulProcessing,
        failed: summary.failedProcessing
      });

      return {
        success: true,
        summary,
        results: payrollResults,
        errors
      };

    } catch (error) {
      logger.error('Failed to process organization payroll', {
        error: error.message,
        orgId,
        payrollMonth,
        payrollYear
      });
      throw error;
    }
  }

  /**
   * Generate payslip
   */
  async generatePayslip(calculation, autoApprove = false) {
    try {
      const payslip = await Payslip.create({
        employeeId: calculation.employeeId,
        employeeName: calculation.employeeName,
        employeeCode: calculation.employeeCode,
        department: calculation.department,
        designation: calculation.designation,
        month: calculation.payrollMonth,
        year: calculation.payrollYear,
        
        // Salary components
        basicSalary: calculation.basicSalary,
        hra: calculation.earnings.hra,
        allowances: calculation.earnings.allowances,
        overtime: calculation.earnings.overtime,
        bonus: calculation.earnings.bonus,
        incentives: calculation.earnings.incentives,
        grossSalary: calculation.earnings.grossSalary,
        
        // Deductions
        providentFund: calculation.taxes.providentFund,
        tax: calculation.taxes.incomeTax,
        professionalTax: calculation.taxes.professionalTax,
        esi: calculation.taxes.esi,
        insurance: calculation.deductions.otherDeductions,
        otherDeductions: calculation.deductions.totalDeductions - calculation.deductions.otherDeductions,
        
        // Net salary
        netSalary: calculation.netSalary,
        
        // Attendance summary
        workingDays: calculation.attendanceSummary.totalDays,
        presentDays: calculation.attendanceSummary.presentDays,
        absentDays: calculation.attendanceSummary.absentDays,
        overtimeHours: calculation.attendanceSummary.overtimeHours,
        
        // Leave summary
        leavesTaken: calculation.leaveSummary.totalLeave,
        paidLeaves: calculation.leaveSummary.paidDays,
        
        // Status
        status: autoApprove ? 'approved' : 'generated',
        generatedAt: new Date(),
        orgId: calculation.orgId,
        
        // Store full calculation for reference
        calculationDetails: calculation
      });

      logger.info('Payslip generated', {
        payslipId: payslip._id,
        employeeId: calculation.employeeId,
        month: calculation.payrollMonth,
        year: calculation.payrollYear
      });

      return payslip;

    } catch (error) {
      logger.error('Failed to generate payslip', {
        error: error.message,
        employeeId: calculation.employeeId
      });
      throw error;
    }
  }

  /**
   * Calculate earnings
   */
  async calculateEarnings(employee, attendanceData, leaveData, config, dailyWage) {
    const basicPay = (attendanceData.presentDays + leaveData.paidDays) * dailyWage;
    
    // Calculate HRA
    let hra = 0;
    if (config.allowances.hra.enabled) {
      if (config.allowances.hra.calculation === 'percentage') {
        hra = (employee.baseSalary * config.allowances.hra.value) / 100;
      } else {
        hra = config.allowances.hra.value;
      }
    }
    
    // Calculate other allowances
    const allowances = (employee.allowances || 0) + 
                     (config.allowances.transport.enabled ? config.allowances.transport.value : 0) +
                     (config.allowances.medical.enabled ? config.allowances.medical.value : 0);
    
    // Calculate overtime
    let overtime = 0;
    if (config.overtime.enabled && attendanceData.overtimeHours > 0) {
      const hourlyRate = dailyWage / 8; // Assuming 8 hours per day
      overtime = attendanceData.overtimeHours * hourlyRate * config.overtime.weekdayMultiplier;
      
      // Add weekend and holiday overtime
      if (attendanceData.weekendHours > 0) {
        overtime += attendanceData.weekendHours * hourlyRate * config.overtime.weekendMultiplier;
      }
      if (attendanceData.holidayHours > 0) {
        overtime += attendanceData.holidayHours * hourlyRate * config.overtime.holidayMultiplier;
      }
    }
    
    const bonus = employee.bonus || 0;
    const incentives = employee.incentives || 0;
    
    const grossSalary = basicPay + hra + allowances + overtime + bonus + incentives;
    
    return {
      basicPay,
      hra,
      allowances,
      overtime,
      bonus,
      incentives,
      grossSalary
    };
  }

  /**
   * Calculate deductions
   */
  async calculateDeductions(employee, attendanceData, leaveData, earnings, config) {
    let lateDeduction = 0;
    let absentDeduction = 0;
    let advanceDeduction = 0;
    let loanDeduction = 0;
    
    // Late deduction
    if (config.deductions.lateDeduction.enabled && attendanceData.lateDays > 0) {
      lateDeduction = attendanceData.lateDays * config.deductions.lateDeduction.amount;
    }
    
    // Absent deduction
    if (config.deductions.absentDeduction.enabled && attendanceData.absentDays > 0) {
      const dailyWage = this.calculateDailyWage(employee.baseSalary, config);
      absentDeduction = attendanceData.absentDays * dailyWage;
    }
    
    // Advance/Loan deductions (would be fetched from advance/loan records)
    advanceDeduction = employee.advanceDeduction || 0;
    loanDeduction = employee.loanDeduction || 0;
    
    const otherDeductions = employee.otherDeductions || 0;
    const totalDeductions = lateDeduction + absentDeduction + advanceDeduction + loanDeduction + otherDeductions;
    
    return {
      lateDeduction,
      absentDeduction,
      advanceDeduction,
      loanDeduction,
      otherDeductions,
      totalDeductions
    };
  }

  /**
   * Calculate taxes
   */
  calculateTaxes(grossSalary, config) {
    const annualSalary = grossSalary * 12;
    
    // Income Tax calculation
    let incomeTax = 0;
    for (const slab of config.taxConfiguration.incomeTaxSlabs) {
      if (annualSalary > slab.min) {
        const taxableAmount = Math.min(annualSalary, slab.max) - slab.min;
        incomeTax += (taxableAmount * slab.rate) / 100;
      }
    }
    incomeTax = incomeTax / 12; // Monthly tax
    
    // Professional Tax
    let professionalTax = 0;
    if (config.taxConfiguration.professionalTax.enabled) {
      for (const slab of config.taxConfiguration.professionalTax.slabs) {
        if (grossSalary >= slab.min && grossSalary <= slab.max) {
          professionalTax = slab.amount;
          break;
        }
      }
    }
    
    // Provident Fund
    let providentFund = 0;
    if (config.taxConfiguration.providentFund) {
      const pfSalary = Math.min(grossSalary, config.taxConfiguration.providentFund.maxSalaryLimit);
      providentFund = (pfSalary * config.taxConfiguration.providentFund.employeeRate) / 100;
    }
    
    // ESI
    let esi = 0;
    if (config.taxConfiguration.esi.enabled && grossSalary <= config.taxConfiguration.esi.maxSalaryLimit) {
      esi = (grossSalary * config.taxConfiguration.esi.employeeRate) / 100;
    }
    
    const totalTax = incomeTax + professionalTax + providentFund + esi;
    
    return {
      incomeTax,
      professionalTax,
      providentFund,
      esi,
      totalTax
    };
  }

  /**
   * Helper methods
   */
  getPayrollPeriod(month, year, config) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    
    return { startDate, endDate };
  }

  calculateDailyWage(monthlySalary, config) {
    // Assuming 30 days per month for calculation
    return monthlySalary / 30;
  }

  async getAttendanceData(employeeId, startDate, endDate) {
    const attendance = await Attendance.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    const totalDays = this.calculateWorkingDays(startDate, endDate);
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const absentDays = totalDays - presentDays;
    const lateDays = attendance.filter(a => a.isLate).length;
    const overtimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
    
    return {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      overtimeHours,
      weekendHours: 0, // TODO: Calculate weekend hours
      holidayHours: 0   // TODO: Calculate holiday hours
    };
  }

  async getLeaveData(employeeId, startDate, endDate) {
    const leaves = await LeaveRequest.find({
      employeeId,
      status: 'approved',
      startDate: { $gte: startDate },
      endDate: { $lte: endDate }
    });

    const totalDays = leaves.reduce((sum, leave) => sum + leave.days, 0);
    const paidDays = leaves.filter(leave => this.isPaidLeave(leave.leaveType)).reduce((sum, leave) => sum + leave.days, 0);
    const unpaidDays = totalDays - paidDays;
    
    const leaveTypes = {};
    leaves.forEach(leave => {
      leaveTypes[leave.leaveType] = (leaveTypes[leave.leaveType] || 0) + leave.days;
    });

    return {
      totalDays,
      paidDays,
      unpaidDays,
      leaveTypes
    };
  }

  calculateWorkingDays(startDate, endDate) {
    let days = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude weekends
        days++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }

  isPaidLeave(leaveType) {
    const paidLeaveTypes = ['annual', 'sick', 'maternity', 'paternity'];
    return paidLeaveTypes.includes(leaveType);
  }

  getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }

  /**
   * Get payroll analytics
   */
  async getPayrollAnalytics(orgId, year) {
    try {
      const analytics = await Payslip.aggregate([
        {
          $match: {
            orgId,
            year,
            status: { $in: ['approved', 'paid'] }
          }
        },
        {
          $group: {
            _id: "$month",
            totalEmployees: { $sum: 1 },
            totalGrossSalary: { $sum: "$grossSalary" },
            totalNetSalary: { $sum: "$netSalary" },
            totalDeductions: { $sum: { $add: ["$providentFund", "$tax", "$professionalTax", "$esi", "$otherDeductions"] } },
            avgSalary: { $avg: "$netSalary" }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      const departmentAnalytics = await Payslip.aggregate([
        {
          $match: {
            orgId,
            year,
            status: { $in: ['approved', 'paid'] }
          }
        },
        {
          $group: {
            _id: "$department",
            totalEmployees: { $sum: 1 },
            totalSalary: { $sum: "$netSalary" },
            avgSalary: { $avg: "$netSalary" }
          }
        },
        {
          $sort: { totalSalary: -1 }
        }
      ]);

      return {
        year,
        monthlyAnalytics: analytics,
        departmentAnalytics,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get payroll analytics', {
        error: error.message,
        orgId,
        year
      });
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    return {
      organizationConfigs: this.organizationConfigs.size,
      payrollSchedules: this.payrollSchedules.size,
      timestamp: new Date()
    };
  }
}

export default AutomatedPayrollSystem;