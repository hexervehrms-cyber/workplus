/**
 * Advanced Leave Policy Engine
 * Handles leave calculations, accruals, balances, and policy enforcement
 */

import LeaveRequest from "../models/LeaveRequest.js";
import Employee from "../models/Employee.js";
import Holiday from "../models/Holiday.js";
import logger from "./logger.js";

class LeavePolicyEngine {
  constructor(notificationManager, eventSystem) {
    this.notificationManager = notificationManager;
    this.eventSystem = eventSystem;
    
    this.leaveTypes = {
      ANNUAL: 'annual',
      SICK: 'sick',
      PERSONAL: 'personal',
      MATERNITY: 'maternity',
      PATERNITY: 'paternity',
      BEREAVEMENT: 'bereavement',
      COMPENSATORY: 'compensatory',
      UNPAID: 'unpaid',
      LOA: 'leave_of_absence'
    };

    this.defaultPolicies = {
      annual: {
        accrualRate: 1.67, // days per month (20 days/year)
        maxAccrual: 20, // days
        carryForward: 5, // days
        carryForwardExpiry: 12, // months
        noticePeriod: 2, // days
        approvalRequired: true
      },
      sick: {
        accrualRate: 1.25, // days per month (15 days/year)
        maxAccrual: 15,
        carryForward: 0,
        noticePeriod: 0, // Can be notified on same day
        approvalRequired: true,
        medicalCertificateRequired: true,
        medicalCertificateThreshold: 3 // days
      },
      personal: {
        accrualRate: 0.5, // days per month (6 days/year)
        maxAccrual: 6,
        carryForward: 0,
        noticePeriod: 1,
        approvalRequired: true
      },
      maternity: {
        duration: 26, // weeks
        noticePeriod: 8, // weeks
        approvalRequired: true,
        medicalCertificateRequired: true
      },
      paternity: {
        duration: 2, // weeks
        noticePeriod: 4, // weeks
        approvalRequired: true
      },
      bereavement: {
        duration: 3, // days
        approvalRequired: false
      },
      compensatory: {
        accrualRate: 0, // Based on overtime
        maxAccrual: 10,
        carryForward: 2,
        noticePeriod: 1,
        approvalRequired: true
      },
      unpaid: {
        approvalRequired: true,
        maxDuration: 90 // days
      },
      leave_of_absence: {
        approvalRequired: true,
        maxDuration: 365 // days
      }
    };

    this.holidayCalendar = {
      publicHolidays: [
        { date: '2024-01-26', name: 'Republic Day' },
        { date: '2024-03-29', name: 'Holi' },
        { date: '2024-04-10', name: 'Good Friday' },
        { date: '2024-05-01', name: 'Labour Day' },
        { date: '2024-08-15', name: 'Independence Day' },
        { date: '2024-10-02', name: 'Gandhi Jayanti' },
        { date: '2024-11-14', name: 'Diwali' },
        { date: '2024-12-25', name: 'Christmas' }
      ],
      companyHolidays: [
        { date: '2024-01-01', name: 'New Year' },
        { date: '2024-06-15', name: 'Company Anniversary' }
      ]
    };
  }

  /**
   * Calculate leave balance for employee
   */
  async calculateLeaveBalance(employeeId, leaveType = null) {
    try {
      const employee = await Employee.findById(employeeId).lean();

      if (!employee) {
        throw new Error('Employee not found');
      }

      const policies = this.defaultPolicies;
      const balances = {};

      // Get all leave types
      const types = leaveType ? [leaveType] : Object.keys(this.leaveTypes);

      for (const type of types) {
        const policy = policies[type];
        
        if (!policy) continue;

        // Calculate accrued leave
        const monthsWorked = this.calculateMonthsWorked(employee.createdAt);
        const accrued = monthsWorked * policy.accrualRate;

        // Get used leave
        const used = await this.getUsedLeave(employeeId, type);

        // Get pending leave
        const pending = await this.getPendingLeave(employeeId, type);

        // Calculate balance
        const balance = Math.max(0, accrued - used - pending);

        // Apply accrual cap
        const finalBalance = Math.min(balance, policy.maxAccrual);

        // Apply carry-forward
        const carryForward = Math.min(policy.carryForward, finalBalance);

        balances[type] = {
          type,
          name: this.getLeaveTypeName(type),
          accrued,
          used,
          pending,
          balance: finalBalance,
          carryForward,
          maxAccrual: policy.maxAccrual,
          policy
        };
      }

      return {
        employeeId,
        balances,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to calculate leave balance', {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Calculate leave balance for specific period
   */
  async calculatePeriodBalance(employeeId, leaveType, startDate, endDate) {
    try {
      const employee = await Employee.findById(employeeId).lean();

      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.defaultPolicies[leaveType];
      if (!policy) {
        throw new Error('Invalid leave type');
      }

      // Calculate months in period
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                     (end.getMonth() - start.getMonth());

      // Calculate accrual for period
      const accrued = months * policy.accrualRate;

      // Get used leave in period
      const used = await this.getUsedLeaveInPeriod(employeeId, leaveType, startDate, endDate);

      // Get pending leave in period
      const pending = await this.getPendingLeaveInPeriod(employeeId, leaveType, startDate, endDate);

      // Calculate balance
      const balance = Math.max(0, accrued - used - pending);

      return {
        employeeId,
        leaveType,
        period: { startDate, endDate },
        accrued,
        used,
        pending,
        balance,
        policy
      };

    } catch (error) {
      logger.error('Failed to calculate period balance', {
        error: error.message,
        employeeId,
        leaveType
      });
      throw error;
    }
  }

  /**
   * Validate leave request against policy
   */
  async validateLeaveRequest(leaveData) {
    try {
      const {
        employeeId,
        type,
        startDate,
        endDate,
        reason,
        orgId
      } = leaveData;

      const employee = await Employee.findById(employeeId).lean();
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.defaultPolicies[type];
      if (!policy) {
        return {
          valid: false,
          errors: ['Invalid leave type']
        };
      }

      const errors = [];
      const warnings = [];

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end < start) {
        errors.push('End date must be after start date');
      }

      // Calculate leave days
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // Check balance
      const balance = await this.calculateLeaveBalance(employeeId, type);
      const availableBalance = balance.balances[type]?.balance || 0;

      if (days > availableBalance) {
        errors.push(`Insufficient balance. Available: ${availableBalance} days, Requested: ${days} days`);
      }

      // Check notice period
      const today = new Date();
      const daysBefore = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
      
      if (daysBefore < policy.noticePeriod && policy.noticePeriod > 0) {
        errors.push(`Notice period of ${policy.noticePeriod} days required. Requested ${daysBefore} days before.`);
      }

      // Check for overlapping leave
      const overlapping = await LeaveRequest.findOne({
        employeeId,
        status: { $in: ['pending', 'approved'] },
        type,
        $or: [
          { startDate: { $lte: end }, endDate: { $gte: start } }
        ]
      });

      if (overlapping) {
        errors.push('Overlapping leave request already exists');
      }

      // Check medical certificate requirement
      if (type === 'sick' && days > policy.medicalCertificateThreshold) {
        warnings.push('Medical certificate will be required for this leave duration');
      }

      // Check for holidays in leave period
      const holidaysInPeriod = await this.getHolidaysInPeriod(start, end);
      if (holidaysInPeriod.length > 0) {
        warnings.push(`Leave period includes ${holidaysInPeriod.length} holidays`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        days,
        availableBalance,
        policy
      };

    } catch (error) {
      logger.error('Failed to validate leave request', {
        error: error.message,
        leaveData
      });
      throw error;
    }
  }

  /**
   * Calculate leave accrual for employee
   */
  async calculateAccrual(employeeId, leaveType = null) {
    try {
      const employee = await Employee.findById(employeeId).lean();
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policies = this.defaultPolicies;
      const types = leaveType ? [leaveType] : Object.keys(this.leaveTypes);
      const accruals = {};

      for (const type of types) {
        const policy = policies[type];
        if (!policy) continue;

        const monthsWorked = this.calculateMonthsWorked(employee.createdAt);
        const accrued = monthsWorked * policy.accrualRate;
        const used = await this.getUsedLeave(employeeId, type);
        const balance = Math.max(0, Math.min(accrued - used, policy.maxAccrual));

        accruals[type] = {
          type,
          monthsWorked,
          accrualRate: policy.accrualRate,
          accrued,
          used,
          balance,
          maxAccrual: policy.maxAccrual
        };
      }

      return {
        employeeId,
        accruals,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to calculate accrual', {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Get holidays in date range
   */
  async getHolidaysInPeriod(startDate, endDate) {
    try {
      const holidays = [];

      // Check public holidays
      for (const holiday of this.holidayCalendar.publicHolidays) {
        const holidayDate = new Date(holiday.date);
        if (holidayDate >= startDate && holidayDate <= endDate) {
          holidays.push({
            date: holiday.date,
            name: holiday.name,
            type: 'public'
          });
        }
      }

      // Check company holidays
      for (const holiday of this.holidayCalendar.companyHolidays) {
        const holidayDate = new Date(holiday.date);
        if (holidayDate >= startDate && holidayDate <= endDate) {
          holidays.push({
            date: holiday.date,
            name: holiday.name,
            type: 'company'
          });
        }
      }

      return holidays;

    } catch (error) {
      logger.error('Failed to get holidays in period', {
        error: error.message,
        startDate,
        endDate
      });
      return [];
    }
  }

  /**
   * Get used leave count
   */
  async getUsedLeave(employeeId, leaveType) {
    const result = await LeaveRequest.aggregate([
      {
        $match: {
          employeeId,
          type: leaveType,
          status: 'approved'
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: "$days" }
        }
      }
    ]);

    return result[0]?.totalDays || 0;
  }

  /**
   * Get pending leave count
   */
  async getPendingLeave(employeeId, leaveType) {
    const result = await LeaveRequest.aggregate([
      {
        $match: {
          employeeId,
          type: leaveType,
          status: 'pending'
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: "$days" }
        }
      }
    ]);

    return result[0]?.totalDays || 0;
  }

  /**
   * Get used leave in period
   */
  async getUsedLeaveInPeriod(employeeId, leaveType, startDate, endDate) {
    const result = await LeaveRequest.aggregate([
      {
        $match: {
          employeeId,
          type: leaveType,
          status: 'approved',
          startDate: { $gte: new Date(startDate) },
          endDate: { $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: "$days" }
        }
      }
    ]);

    return result[0]?.totalDays || 0;
  }

  /**
   * Get pending leave in period
   */
  async getPendingLeaveInPeriod(employeeId, leaveType, startDate, endDate) {
    const result = await LeaveRequest.aggregate([
      {
        $match: {
          employeeId,
          type: leaveType,
          status: 'pending',
          startDate: { $gte: new Date(startDate) },
          endDate: { $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: "$days" }
        }
      }
    ]);

    return result[0]?.totalDays || 0;
  }

  /**
   * Calculate months worked
   */
  calculateMonthsWorked(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    return (now.getFullYear() - created.getFullYear()) * 12 + 
           (now.getMonth() - created.getMonth());
  }

  /**
   * Get leave type name
   */
  getLeaveTypeName(type) {
    const names = {
      annual: 'Annual Leave',
      sick: 'Sick Leave',
      personal: 'Personal Leave',
      maternity: 'Maternity Leave',
      paternity: 'Paternity Leave',
      bereavement: 'Bereavement Leave',
      compensatory: 'Compensatory Leave',
      unpaid: 'Unpaid Leave',
      leave_of_absence: 'Leave of Absence'
    };
    return names[type] || type;
  }

  /**
   * Get all leave types
   */
  getLeaveTypes() {
    return this.leaveTypes;
  }

  /**
   * Get all policies
   */
  getPolicies() {
    return this.defaultPolicies;
  }

  /**
   * Get holiday calendar
   */
  getHolidayCalendar() {
    return this.holidayCalendar;
  }
}

export default LeavePolicyEngine;