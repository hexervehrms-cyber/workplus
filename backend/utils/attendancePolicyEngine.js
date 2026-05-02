/**
 * Smart Attendance Policy Engine
 * Handles attendance rules, calculations, compliance, and analytics
 */

import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import logger from "./logger.js";

class AttendancePolicyEngine {
  constructor(notificationManager, eventSystem) {
    this.notificationManager = notificationManager;
    this.eventSystem = eventSystem;
    
    this.defaultPolicies = {
      workHours: 8,
      shiftStart: '09:00',
      shiftEnd: '17:00',
      gracePeriod: 15, // minutes
      lateThreshold: 15, // minutes
      earlyExitThreshold: 15, // minutes
      overtimeThreshold: 2, // hours
      maxOvertime: 4, // hours per day
      minBreak: 30, // minutes
      maxConsecutiveWorkDays: 6,
      weekendWorkAllowed: true,
      holidayWorkAllowed: true
    };
    
    this.attendanceStatuses = {
      PRESENT: 'present',
      ABSENT: 'absent',
      LATE: 'late',
      EARLY_EXIT: 'early_exit',
      HALF_DAY: 'half_day',
      ON_LEAVE: 'on_leave',
      WORK_FROM_HOME: 'work_from_home',
      ON_BUSINESS_TRIP: 'on_business_trip',
      HOLIDAY: 'holiday',
      WEEKEND: 'weekend'
    };
  }

  /**
   * Process attendance record with policy validation
   */
  async processAttendance(attendanceData) {
    try {
      const {
        employeeId,
        date,
        checkIn,
        checkOut,
        location,
        ipAddress,
        deviceInfo,
        orgId
      } = attendanceData;

      // Get employee details
      const employee = await Employee.findById(employeeId)
        .populate('departmentId')
        .lean();

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get attendance policy for organization
      const policy = await this.getAttendancePolicy(orgId);

      // Calculate attendance metrics
      const metrics = this.calculateAttendanceMetrics(
        checkIn,
        checkOut,
        date,
        policy
      );

      // Determine attendance status
      const status = this.determineAttendanceStatus(metrics, policy);

      // Calculate overtime
      const overtime = this.calculateOvertime(metrics, policy);

      // Check for policy violations
      const violations = this.checkPolicyViolations(metrics, policy, employee);

      // Create attendance record
      const attendanceRecord = await Attendance.create({
        employeeId,
        userId: employee.userId,
        date,
        checkIn,
        checkOut,
        status,
        hoursWorked: metrics.hoursWorked,
        overtimeHours: overtime.hours,
        overtimePayable: overtime.payable,
        lateBy: metrics.lateBy,
        earlyExitBy: metrics.earlyExitBy,
        breakDuration: metrics.breakDuration,
        location,
        ipAddress,
        deviceInfo,
        policyViolations: violations,
        orgId
      });

      // Emit business events
      if (this.eventSystem) {
        await this.eventSystem.emit('attendance.processed', {
          attendance: attendanceRecord,
          metrics,
          status,
          violations,
          orgId
        });

        // Special events for specific statuses
        if (status === this.attendanceStatuses.LATE) {
          await this.eventSystem.emit('attendance.late', {
            attendance: attendanceRecord,
            employee,
            lateBy: metrics.lateBy,
            orgId
          });
        }

        if (status === this.attendanceStatuses.ABSENT) {
          await this.eventSystem.emit('attendance.absent', {
            attendance: attendanceRecord,
            employee,
            orgId
          });
        }

        if (overtime.hours > 0) {
          await this.eventSystem.emit('attendance.overtime', {
            attendance: attendanceRecord,
            employee,
            overtimeHours: overtime.hours,
            orgId
          });
        }
      }

      // Send notifications for violations
      if (this.notificationManager && violations.length > 0) {
        await this.sendViolationNotifications(employee, violations, attendanceRecord);
      }

      logger.info('Attendance processed', {
        employeeId,
        date,
        status,
        hoursWorked: metrics.hoursWorked,
        overtimeHours: overtime.hours
      });

      return {
        success: true,
        attendance: attendanceRecord,
        metrics,
        status,
        overtime,
        violations
      };

    } catch (error) {
      logger.error('Failed to process attendance', {
        error: error.message,
        attendanceData
      });
      throw error;
    }
  }

  /**
   * Calculate attendance metrics
   */
  calculateAttendanceMetrics(checkIn, checkOut, date, policy) {
    const metrics = {
      hoursWorked: 0,
      lateBy: 0,
      earlyExitBy: 0,
      breakDuration: 0,
      isWeekend: this.isWeekend(date),
      isHoliday: this.isHoliday(date),
      shiftStart: new Date(date),
      shiftEnd: new Date(date)
    };

    // Set shift times
    const [shiftHour, shiftMinute] = policy.shiftStart.split(':').map(Number);
    metrics.shiftStart.setHours(shiftHour, shiftMinute, 0, 0);

    const [endHour, endMinute] = policy.shiftEnd.split(':').map(Number);
    metrics.shiftEnd.setHours(endHour, endMinute, 0, 0);

    // Calculate hours worked
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Calculate total time in milliseconds
      const totalTime = checkOutDate - checkInDate;
      metrics.hoursWorked = Math.max(0, totalTime / (1000 * 60 * 60));

      // Calculate late arrival
      if (checkInDate > metrics.shiftStart) {
        metrics.lateBy = (checkInDate - metrics.shiftStart) / (1000 * 60); // minutes
      }

      // Calculate early exit
      if (checkOutDate < metrics.shiftEnd) {
        metrics.earlyExitBy = (metrics.shiftEnd - checkOutDate) / (1000 * 60); // minutes
      }

      // Calculate break duration (assuming 1 hour lunch break)
      metrics.breakDuration = 60; // Default 1 hour
    }

    return metrics;
  }

  /**
   * Determine attendance status based on metrics
   */
  determineAttendanceStatus(metrics, policy) {
    // If weekend or holiday, mark accordingly
    if (metrics.isWeekend) {
      return this.attendanceStatuses.WEEKEND;
    }

    if (metrics.isHoliday) {
      return this.attendanceStatuses.HOLIDAY;
    }

    // If no check-in, mark as absent
    if (!metrics.hoursWorked || metrics.hoursWorked === 0) {
      return this.attendanceStatuses.ABSENT;
    }

    // If worked less than half day, mark as half day
    if (metrics.hoursWorked < policy.workHours / 2) {
      return this.attendanceStatuses.HALF_DAY;
    }

    // If worked less than full day, mark as present with early exit
    if (metrics.hoursWorked < policy.workHours) {
      if (metrics.earlyExitBy > policy.earlyExitThreshold) {
        return this.attendanceStatuses.EARLY_EXIT;
      }
      return this.attendanceStatuses.PRESENT;
    }

    // If late, mark as late
    if (metrics.lateBy > policy.lateThreshold) {
      return this.attendanceStatuses.LATE;
    }

    return this.attendanceStatuses.PRESENT;
  }

  /**
   * Calculate overtime
   */
  calculateOvertime(metrics, policy) {
    const overtime = {
      hours: 0,
      payable: false,
      rateMultiplier: 1.5 // Default 1.5x
    };

    // Calculate overtime hours
    if (metrics.hoursWorked > policy.workHours) {
      overtime.hours = metrics.hoursWorked - policy.workHours;

      // Cap at maximum overtime
      if (overtime.hours > policy.maxOvertime) {
        overtime.hours = policy.maxOvertime;
      }

      // Overtime is payable if it exceeds threshold
      if (overtime.hours >= policy.overtimeThreshold) {
        overtime.payable = true;
      }
    }

    return overtime;
  }

  /**
   * Check for policy violations
   */
  checkPolicyViolations(metrics, policy, employee) {
    const violations = [];

    // Check for excessive late arrivals
    if (metrics.lateBy > policy.lateThreshold) {
      violations.push({
        type: 'late_arrival',
        severity: metrics.lateBy > 60 ? 'high' : 'medium',
        description: `Arrived ${Math.round(metrics.lateBy)} minutes late`,
        threshold: policy.lateThreshold,
        actual: Math.round(metrics.lateBy)
      });
    }

    // Check for early exit
    if (metrics.earlyExitBy > policy.earlyExitThreshold) {
      violations.push({
        type: 'early_exit',
        severity: metrics.earlyExitBy > 60 ? 'high' : 'medium',
        description: `Left ${Math.round(metrics.earlyExitBy)} minutes early`,
        threshold: policy.earlyExitThreshold,
        actual: Math.round(metrics.earlyExitBy)
      });
    }

    // Check for excessive overtime
    if (metrics.hoursWorked > policy.workHours * 2) {
      violations.push({
        type: 'excessive_hours',
        severity: 'high',
        description: `Worked ${Math.round(metrics.hoursWorked)} hours (exceeds double shift)`,
        threshold: policy.workHours * 2,
        actual: Math.round(metrics.hoursWorked)
      });
    }

    // Check for weekend/holiday work without approval
    if (metrics.isWeekend && !policy.weekendWorkAllowed) {
      violations.push({
        type: 'weekend_work',
        severity: 'medium',
        description: 'Worked on weekend without approval',
        threshold: 'not_allowed',
        actual: 'worked'
      });
    }

    if (metrics.isHoliday && !policy.holidayWorkAllowed) {
      violations.push({
        type: 'holiday_work',
        severity: 'medium',
        description: 'Worked on holiday without approval',
        threshold: 'not_allowed',
        actual: 'worked'
      });
    }

    return violations;
  }

  /**
   * Send violation notifications
   */
  async sendViolationNotifications(employee, violations, attendance) {
    try {
      // Notify employee about violations
      for (const violation of violations) {
        await this.notificationManager.sendNotification({
          type: 'attendance_violation',
          title: 'Attendance Violation',
          message: `${violation.type.replace('_', ' ')} - ${violation.description}`,
          recipients: [employee.userId],
          priority: violation.severity === 'high' ? 'high' : 'normal',
          channels: ['in_app', 'email'],
          data: {
            violation,
            attendanceId: attendance._id,
            date: attendance.date
          },
          orgId: employee.orgId
        });
      }

      // Notify manager for high severity violations
      const highSeverityViolations = violations.filter(v => v.severity === 'high');
      if (highSeverityViolations.length > 0 && employee.managerId) {
        await this.notificationManager.sendNotification({
          type: 'attendance_violation_manager',
          title: 'Attendance Violation - Manager Notification',
          message: `${employee.name} has attendance violations`,
          recipients: [employee.managerId],
          priority: 'high',
          channels: ['in_app'],
          data: {
            employee,
            violations: highSeverityViolations,
            attendanceId: attendance._id
          },
          orgId: employee.orgId
        });
      }

    } catch (error) {
      logger.error('Failed to send violation notifications', {
        error: error.message,
        employeeId: employee._id,
        violationCount: violations.length
      });
    }
  }

  /**
   * Get attendance policy for organization
   */
  async getAttendancePolicy(orgId) {
    // In production, this would fetch from database
    // For now, return default policy with org-specific overrides
    return {
      ...this.defaultPolicies,
      orgId
    };
  }

  /**
   * Check if date is weekend
   */
  isHoliday(date) {
    // In production, this would check holiday calendar
    // For now, return false
    return false;
  }

  /**
   * Check if date is weekend
   */
  isWeekend(date) {
    const day = new Date(date).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Get attendance summary for employee
   */
  async getEmployeeSummary(employeeId, period = 'month') {
    try {
      const now = new Date();
      const startDate = new Date();
      
      if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === 'quarter') {
        startDate.setMonth(now.getMonth() - 3);
      } else if (period === 'year') {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      const summary = await Attendance.aggregate([
        {
          $match: {
            employeeId,
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalHours: { $sum: "$hoursWorked" },
            totalOvertime: { $sum: "$overtimeHours" }
          }
        },
        {
          $group: {
            _id: null,
            present: { $sum: { $cond: [{ $eq: ["$_id", "present"] }, "$count", 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$_id", "absent"] }, "$count", 0] } },
            late: { $sum: { $cond: [{ $eq: ["$_id", "late"] }, "$count", 0] } },
            earlyExit: { $sum: { $cond: [{ $eq: ["$_id", "early_exit"] }, "$count", 0] } },
            halfDay: { $sum: { $cond: [{ $eq: ["$_id", "half_day"] }, "$count", 0] } },
            totalHours: { $sum: "$totalHours" },
            totalOvertime: { $sum: "$totalOvertime" },
            totalRecords: { $sum: "$count" }
          }
        }
      ]);

      const result = summary[0] || {
        present: 0,
        absent: 0,
        late: 0,
        earlyExit: 0,
        halfDay: 0,
        totalHours: 0,
        totalOvertime: 0,
        totalRecords: 0
      };

      // Calculate attendance rate
      const attendanceRate = result.totalRecords > 0
        ? Math.round((result.present / result.totalRecords) * 100)
        : 0;

      return {
        period,
        employeeId,
        summary: result,
        attendanceRate,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get employee attendance summary', {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Get attendance analytics for organization
   */
  async getOrganizationAnalytics(orgId, period = 'month') {
    try {
      const now = new Date();
      const startDate = new Date();
      
      if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === 'quarter') {
        startDate.setMonth(now.getMonth() - 3);
      } else if (period === 'year') {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      const analytics = await Attendance.aggregate([
        {
          $match: {
            orgId,
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              status: "$status"
            },
            count: { $sum: 1 },
            totalHours: { $sum: "$hoursWorked" }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            present: { $sum: { $cond: [{ $eq: ["$_id.status", "present"] }, "$count", 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$_id.status", "absent"] }, "$count", 0] } },
            late: { $sum: { $cond: [{ $eq: ["$_id.status", "late"] }, "$count", 0] } },
            totalHours: { $sum: "$totalHours" },
            totalRecords: { $sum: "$count" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Calculate overall metrics
      const overall = await Attendance.aggregate([
        {
          $match: {
            orgId,
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
            totalRecords: { $sum: 1 }
          }
        }
      ]);

      return {
        period,
        orgId,
        dailyTrends: analytics,
        overall: overall[0] || {
          present: 0,
          absent: 0,
          late: 0,
          totalRecords: 0
        },
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get organization attendance analytics', {
        error: error.message,
        orgId
      });
      throw error;
    }
  }

  /**
   * Get attendance policy
   */
  getPolicy() {
    return this.defaultPolicies;
  }
}

export default AttendancePolicyEngine;