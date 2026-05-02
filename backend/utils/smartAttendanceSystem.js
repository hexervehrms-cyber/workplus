/**
 * Smart Attendance System with Policy Engine
 * Handles intelligent attendance tracking, policy enforcement, and analytics
 */

import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import logger from "./logger.js";

class SmartAttendanceSystem {
  constructor(notificationManager, eventSystem, socketManager) {
    this.notificationManager = notificationManager;
    this.eventSystem = eventSystem;
    this.socketManager = socketManager;
    
    // Default attendance policies
    this.defaultPolicies = {
      workingHours: {
        startTime: '09:00',
        endTime: '18:00',
        lunchBreakStart: '13:00',
        lunchBreakEnd: '14:00',
        totalWorkingHours: 8,
        minimumWorkingHours: 7.5
      },
      latePolicy: {
        graceMinutes: 15,
        lateThresholdMinutes: 30,
        maxLateAllowedPerMonth: 3
      },
      overtimePolicy: {
        overtimeThreshold: 8,
        maxOvertimePerDay: 4,
        overtimeMultiplier: 1.5,
        requiresApproval: true
      },
      breakPolicy: {
        maxBreakDuration: 60, // minutes
        maxBreaksPerDay: 3,
        minimumBreakInterval: 120 // minutes between breaks
      },
      geofencing: {
        enabled: false,
        allowedLocations: [],
        radiusMeters: 100
      },
      flexibleTiming: {
        enabled: false,
        coreHours: {
          start: '10:00',
          end: '16:00'
        },
        flexWindow: {
          earliestStart: '07:00',
          latestStart: '11:00',
          earliestEnd: '16:00',
          latestEnd: '20:00'
        }
      }
    };
    
    this.organizationPolicies = new Map();
  }

  /**
   * Set attendance policy for organization
   */
  setOrganizationPolicy(orgId, policy) {
    const mergedPolicy = {
      ...this.defaultPolicies,
      ...policy,
      orgId,
      updatedAt: new Date()
    };
    
    this.organizationPolicies.set(orgId, mergedPolicy);
    
    logger.info('Attendance policy updated', { orgId });
    
    return mergedPolicy;
  }

  /**
   * Get attendance policy for organization
   */
  getOrganizationPolicy(orgId) {
    return this.organizationPolicies.get(orgId) || this.defaultPolicies;
  }

  /**
   * Process check-in
   */
  async processCheckIn(checkInData) {
    try {
      const {
        employeeId,
        timestamp = new Date(),
        location,
        deviceInfo,
        ipAddress,
        notes,
        orgId
      } = checkInData;

      // Get employee and policy
      const employee = await Employee.findById(employeeId).populate('userId');
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.getOrganizationPolicy(orgId);

      // Validate location if geofencing is enabled
      if (policy.geofencing.enabled) {
        const locationValid = await this.validateLocation(location, policy.geofencing);
        if (!locationValid) {
          throw new Error('Check-in location is outside allowed area');
        }
      }

      // Check for existing attendance record today
      const today = new Date(timestamp);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let attendance = await Attendance.findOne({
        employeeId,
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });

      if (attendance && attendance.checkIn) {
        throw new Error('Already checked in today');
      }

      // Create or update attendance record
      if (!attendance) {
        attendance = new Attendance({
          employeeId,
          date: today,
          orgId,
          status: 'present'
        });
      }

      attendance.checkIn = timestamp;
      attendance.checkInLocation = location;
      attendance.checkInDevice = deviceInfo;
      attendance.checkInIP = ipAddress;
      attendance.checkInNotes = notes;

      // Calculate if late
      const scheduledStart = this.parseTime(policy.workingHours.startTime);
      const actualCheckIn = new Date(timestamp);
      const isLate = actualCheckIn > scheduledStart;
      const minutesLate = isLate ? Math.round((actualCheckIn - scheduledStart) / (1000 * 60)) : 0;

      if (isLate) {
        attendance.isLate = true;
        attendance.minutesLate = minutesLate;
        attendance.lateReason = notes;
      }

      // Apply policy rules
      const policyViolations = await this.checkPolicyViolations(employee, attendance, policy, 'check_in');
      attendance.policyViolations = policyViolations;

      await attendance.save();

      // Emit events
      if (this.eventSystem) {
        await this.eventSystem.emit('attendance.checkin', {
          attendance,
          employee,
          isLate,
          minutesLate,
          policyViolations,
          orgId
        });

        if (isLate && minutesLate > policy.latePolicy.lateThresholdMinutes) {
          await this.eventSystem.emit('attendance.late', {
            attendance,
            employee,
            minutesLate,
            policy: policy.latePolicy,
            orgId
          });
        }
      }

      // Send real-time updates
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(orgId, 'attendance_checkin', {
          employeeId,
          employeeName: employee.userId.name,
          checkInTime: timestamp,
          isLate,
          minutesLate,
          location: location?.name || 'Office'
        });
      }

      // Send notifications for policy violations
      if (policyViolations.length > 0) {
        await this.sendPolicyViolationNotifications(employee, policyViolations, orgId);
      }

      logger.info('Check-in processed', {
        employeeId,
        isLate,
        minutesLate,
        violations: policyViolations.length
      });

      return {
        success: true,
        attendance,
        isLate,
        minutesLate,
        policyViolations
      };

    } catch (error) {
      logger.error('Check-in processing failed', {
        error: error.message,
        employeeId: checkInData.employeeId
      });
      throw error;
    }
  }

  /**
   * Process check-out
   */
  async processCheckOut(checkOutData) {
    try {
      const {
        employeeId,
        timestamp = new Date(),
        location,
        deviceInfo,
        ipAddress,
        notes,
        orgId
      } = checkOutData;

      // Get employee and policy
      const employee = await Employee.findById(employeeId).populate('userId');
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.getOrganizationPolicy(orgId);

      // Find today's attendance record
      const today = new Date(timestamp);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const attendance = await Attendance.findOne({
        employeeId,
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });

      if (!attendance || !attendance.checkIn) {
        throw new Error('No check-in record found for today');
      }

      if (attendance.checkOut) {
        throw new Error('Already checked out today');
      }

      // Update attendance record
      attendance.checkOut = timestamp;
      attendance.checkOutLocation = location;
      attendance.checkOutDevice = deviceInfo;
      attendance.checkOutIP = ipAddress;
      attendance.checkOutNotes = notes;

      // Calculate working hours
      const workingMilliseconds = timestamp - attendance.checkIn;
      const workingHours = workingMilliseconds / (1000 * 60 * 60);
      
      // Subtract break time if recorded
      let totalBreakTime = 0;
      if (attendance.breaks && attendance.breaks.length > 0) {
        totalBreakTime = attendance.breaks.reduce((total, breakRecord) => {
          if (breakRecord.endTime) {
            return total + (breakRecord.endTime - breakRecord.startTime);
          }
          return total;
        }, 0);
      }

      const actualWorkingHours = workingHours - (totalBreakTime / (1000 * 60 * 60));
      attendance.hoursWorked = actualWorkingHours;

      // Check for overtime
      const isOvertime = actualWorkingHours > policy.overtimePolicy.overtimeThreshold;
      const overtimeHours = isOvertime ? actualWorkingHours - policy.overtimePolicy.overtimeThreshold : 0;

      if (isOvertime) {
        attendance.isOvertime = true;
        attendance.overtimeHours = overtimeHours;
      }

      // Check for undertime
      const isUndertime = actualWorkingHours < policy.workingHours.minimumWorkingHours;
      if (isUndertime) {
        attendance.isUndertime = true;
        attendance.undertimeHours = policy.workingHours.minimumWorkingHours - actualWorkingHours;
      }

      // Apply policy rules
      const policyViolations = await this.checkPolicyViolations(employee, attendance, policy, 'check_out');
      attendance.policyViolations = [...(attendance.policyViolations || []), ...policyViolations];

      await attendance.save();

      // Emit events
      if (this.eventSystem) {
        await this.eventSystem.emit('attendance.checkout', {
          attendance,
          employee,
          workingHours: actualWorkingHours,
          isOvertime,
          overtimeHours,
          isUndertime,
          policyViolations,
          orgId
        });
      }

      // Send real-time updates
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(orgId, 'attendance_checkout', {
          employeeId,
          employeeName: employee.userId.name,
          checkOutTime: timestamp,
          hoursWorked: actualWorkingHours,
          isOvertime,
          overtimeHours
        });
      }

      // Send notifications
      if (isOvertime && policy.overtimePolicy.requiresApproval) {
        await this.sendOvertimeApprovalRequest(employee, attendance, orgId);
      }

      if (policyViolations.length > 0) {
        await this.sendPolicyViolationNotifications(employee, policyViolations, orgId);
      }

      logger.info('Check-out processed', {
        employeeId,
        hoursWorked: actualWorkingHours,
        isOvertime,
        overtimeHours,
        violations: policyViolations.length
      });

      return {
        success: true,
        attendance,
        hoursWorked: actualWorkingHours,
        isOvertime,
        overtimeHours,
        isUndertime,
        policyViolations
      };

    } catch (error) {
      logger.error('Check-out processing failed', {
        error: error.message,
        employeeId: checkOutData.employeeId
      });
      throw error;
    }
  }

  /**
   * Process break start
   */
  async processBreakStart(breakData) {
    try {
      const {
        employeeId,
        timestamp = new Date(),
        breakType = 'general',
        notes,
        orgId
      } = breakData;

      const employee = await Employee.findById(employeeId).populate('userId');
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.getOrganizationPolicy(orgId);

      // Find today's attendance record
      const today = new Date(timestamp);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const attendance = await Attendance.findOne({
        employeeId,
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });

      if (!attendance || !attendance.checkIn) {
        throw new Error('Must check in before taking a break');
      }

      if (attendance.checkOut) {
        throw new Error('Cannot take break after check-out');
      }

      // Check if already on break
      const activeBreak = attendance.breaks?.find(b => !b.endTime);
      if (activeBreak) {
        throw new Error('Already on break');
      }

      // Validate break policy
      const breakViolations = this.validateBreakPolicy(attendance, policy.breakPolicy, timestamp);
      
      // Initialize breaks array if not exists
      if (!attendance.breaks) {
        attendance.breaks = [];
      }

      // Add new break record
      const breakRecord = {
        startTime: timestamp,
        breakType,
        notes,
        violations: breakViolations
      };

      attendance.breaks.push(breakRecord);
      await attendance.save();

      // Send real-time updates
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(orgId, 'break_started', {
          employeeId,
          employeeName: employee.userId.name,
          breakType,
          startTime: timestamp
        });
      }

      logger.info('Break started', {
        employeeId,
        breakType,
        violations: breakViolations.length
      });

      return {
        success: true,
        breakRecord,
        violations: breakViolations
      };

    } catch (error) {
      logger.error('Break start processing failed', {
        error: error.message,
        employeeId: breakData.employeeId
      });
      throw error;
    }
  }

  /**
   * Process break end
   */
  async processBreakEnd(breakData) {
    try {
      const {
        employeeId,
        timestamp = new Date(),
        notes,
        orgId
      } = breakData;

      const employee = await Employee.findById(employeeId).populate('userId');
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.getOrganizationPolicy(orgId);

      // Find today's attendance record
      const today = new Date(timestamp);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const attendance = await Attendance.findOne({
        employeeId,
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });

      if (!attendance || !attendance.breaks) {
        throw new Error('No active break found');
      }

      // Find active break
      const activeBreak = attendance.breaks.find(b => !b.endTime);
      if (!activeBreak) {
        throw new Error('No active break found');
      }

      // End the break
      activeBreak.endTime = timestamp;
      activeBreak.endNotes = notes;
      
      // Calculate break duration
      const breakDuration = (timestamp - activeBreak.startTime) / (1000 * 60); // minutes
      activeBreak.duration = breakDuration;

      // Check for policy violations
      if (breakDuration > policy.breakPolicy.maxBreakDuration) {
        activeBreak.violations = activeBreak.violations || [];
        activeBreak.violations.push({
          type: 'excessive_break_duration',
          message: `Break duration (${Math.round(breakDuration)} min) exceeds policy limit (${policy.breakPolicy.maxBreakDuration} min)`,
          severity: 'medium'
        });
      }

      await attendance.save();

      // Send real-time updates
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(orgId, 'break_ended', {
          employeeId,
          employeeName: employee.userId.name,
          breakType: activeBreak.breakType,
          duration: breakDuration
        });
      }

      logger.info('Break ended', {
        employeeId,
        breakType: activeBreak.breakType,
        duration: breakDuration
      });

      return {
        success: true,
        breakRecord: activeBreak,
        duration: breakDuration
      };

    } catch (error) {
      logger.error('Break end processing failed', {
        error: error.message,
        employeeId: breakData.employeeId
      });
      throw error;
    }
  }

  /**
   * Check policy violations
   */
  async checkPolicyViolations(employee, attendance, policy, action) {
    const violations = [];

    try {
      // Check late policy violations
      if (action === 'check_in' && attendance.isLate) {
        const monthStart = new Date(attendance.date);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const lateCount = await Attendance.countDocuments({
          employeeId: employee._id,
          date: { $gte: monthStart, $lt: monthEnd },
          isLate: true
        });

        if (lateCount > policy.latePolicy.maxLateAllowedPerMonth) {
          violations.push({
            type: 'excessive_late_arrivals',
            message: `Exceeded monthly late arrival limit (${lateCount}/${policy.latePolicy.maxLateAllowedPerMonth})`,
            severity: 'high',
            count: lateCount,
            limit: policy.latePolicy.maxLateAllowedPerMonth
          });
        }
      }

      // Check overtime policy violations
      if (action === 'check_out' && attendance.isOvertime) {
        if (attendance.overtimeHours > policy.overtimePolicy.maxOvertimePerDay) {
          violations.push({
            type: 'excessive_overtime',
            message: `Overtime hours (${attendance.overtimeHours.toFixed(1)}) exceed daily limit (${policy.overtimePolicy.maxOvertimePerDay})`,
            severity: 'medium',
            hours: attendance.overtimeHours,
            limit: policy.overtimePolicy.maxOvertimePerDay
          });
        }
      }

      return violations;

    } catch (error) {
      logger.error('Policy violation check failed', {
        error: error.message,
        employeeId: employee._id
      });
      return [];
    }
  }

  /**
   * Validate break policy
   */
  validateBreakPolicy(attendance, breakPolicy, timestamp) {
    const violations = [];

    if (!attendance.breaks) {
      return violations;
    }

    // Check maximum breaks per day
    const completedBreaks = attendance.breaks.filter(b => b.endTime);
    if (completedBreaks.length >= breakPolicy.maxBreaksPerDay) {
      violations.push({
        type: 'max_breaks_exceeded',
        message: `Maximum breaks per day (${breakPolicy.maxBreaksPerDay}) exceeded`,
        severity: 'medium'
      });
    }

    // Check minimum interval between breaks
    const lastBreak = completedBreaks[completedBreaks.length - 1];
    if (lastBreak) {
      const timeSinceLastBreak = (timestamp - lastBreak.endTime) / (1000 * 60); // minutes
      if (timeSinceLastBreak < breakPolicy.minimumBreakInterval) {
        violations.push({
          type: 'insufficient_break_interval',
          message: `Insufficient time since last break (${Math.round(timeSinceLastBreak)} min, required: ${breakPolicy.minimumBreakInterval} min)`,
          severity: 'low'
        });
      }
    }

    return violations;
  }

  /**
   * Validate location for geofencing
   */
  async validateLocation(location, geofencingPolicy) {
    if (!location || !geofencingPolicy.enabled) {
      return true;
    }

    const { latitude, longitude } = location;
    
    for (const allowedLocation of geofencingPolicy.allowedLocations) {
      const distance = this.calculateDistance(
        latitude, longitude,
        allowedLocation.latitude, allowedLocation.longitude
      );
      
      if (distance <= geofencingPolicy.radiusMeters) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  /**
   * Parse time string to Date object
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Send policy violation notifications
   */
  async sendPolicyViolationNotifications(employee, violations, orgId) {
    if (!this.notificationManager || violations.length === 0) {
      return;
    }

    const highSeverityViolations = violations.filter(v => v.severity === 'high');
    
    if (highSeverityViolations.length > 0) {
      // Notify employee
      await this.notificationManager.sendNotification({
        type: 'policy_violation',
        title: 'Attendance Policy Violation',
        message: `You have ${highSeverityViolations.length} high-severity attendance policy violation(s)`,
        recipients: [employee.userId._id],
        priority: 'high',
        channels: ['in_app', 'email'],
        data: { violations: highSeverityViolations },
        orgId
      });

      // Notify managers
      await this.notificationManager.sendNotification({
        type: 'employee_policy_violation',
        title: 'Employee Policy Violation',
        message: `${employee.userId.name} has attendance policy violations`,
        recipients: 'managers',
        priority: 'high',
        channels: ['in_app'],
        data: { employee, violations: highSeverityViolations },
        orgId
      });
    }
  }

  /**
   * Send overtime approval request
   */
  async sendOvertimeApprovalRequest(employee, attendance, orgId) {
    if (!this.notificationManager) {
      return;
    }

    await this.notificationManager.sendNotification({
      type: 'overtime_approval_required',
      title: 'Overtime Approval Required',
      message: `${employee.userId.name} worked ${attendance.overtimeHours.toFixed(1)} hours of overtime`,
      recipients: 'managers',
      priority: 'normal',
      channels: ['in_app', 'email'],
      data: { employee, attendance },
      actionUrl: `/attendance/overtime-approval/${attendance._id}`,
      orgId
    });
  }

  /**
   * Get attendance analytics
   */
  async getAttendanceAnalytics(orgId, timeframe = 30) {
    try {
      const since = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const analytics = await Attendance.aggregate([
        {
          $match: {
            orgId,
            date: { $gte: since }
          }
        },
        {
          $group: {
            _id: null,
            totalDays: { $sum: 1 },
            presentDays: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            lateDays: { $sum: { $cond: ["$isLate", 1, 0] } },
            overtimeDays: { $sum: { $cond: ["$isOvertime", 1, 0] } },
            avgHoursWorked: { $avg: "$hoursWorked" },
            totalOvertimeHours: { $sum: "$overtimeHours" },
            totalViolations: { $sum: { $size: { $ifNull: ["$policyViolations", []] } } }
          }
        }
      ]);

      const employeeStats = await Attendance.aggregate([
        {
          $match: {
            orgId,
            date: { $gte: since }
          }
        },
        {
          $group: {
            _id: "$employeeId",
            totalDays: { $sum: 1 },
            presentDays: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            lateDays: { $sum: { $cond: ["$isLate", 1, 0] } },
            avgHoursWorked: { $avg: "$hoursWorked" },
            totalOvertimeHours: { $sum: "$overtimeHours" }
          }
        },
        {
          $lookup: {
            from: 'employees',
            localField: '_id',
            foreignField: '_id',
            as: 'employee'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'employee.userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $project: {
            employeeId: '$_id',
            employeeName: { $arrayElemAt: ['$user.name', 0] },
            department: { $arrayElemAt: ['$employee.department', 0] },
            totalDays: 1,
            presentDays: 1,
            lateDays: 1,
            attendanceRate: { $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100] },
            avgHoursWorked: 1,
            totalOvertimeHours: 1
          }
        },
        {
          $sort: { attendanceRate: -1 }
        }
      ]);

      return {
        timeframe: `${timeframe} days`,
        summary: analytics[0] || {},
        employeeStats,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get attendance analytics', {
        error: error.message,
        orgId
      });
      throw error;
    }
  }

  /**
   * Generate attendance report
   */
  async generateAttendanceReport(orgId, startDate, endDate, employeeIds = null) {
    try {
      const query = {
        orgId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (employeeIds && employeeIds.length > 0) {
        query.employeeId = { $in: employeeIds };
      }

      const attendanceRecords = await Attendance.find(query)
        .populate({
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'name email'
          }
        })
        .sort({ date: -1, 'employeeId.userId.name': 1 })
        .lean();

      const summary = {
        totalRecords: attendanceRecords.length,
        presentDays: attendanceRecords.filter(r => r.status === 'present').length,
        absentDays: attendanceRecords.filter(r => r.status === 'absent').length,
        lateDays: attendanceRecords.filter(r => r.isLate).length,
        overtimeDays: attendanceRecords.filter(r => r.isOvertime).length,
        totalHoursWorked: attendanceRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
        totalOvertimeHours: attendanceRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
        totalViolations: attendanceRecords.reduce((sum, r) => sum + (r.policyViolations?.length || 0), 0)
      };

      return {
        summary,
        records: attendanceRecords,
        dateRange: { startDate, endDate },
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to generate attendance report', {
        error: error.message,
        orgId
      });
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    return {
      organizationPolicies: this.organizationPolicies.size,
      defaultPolicies: Object.keys(this.defaultPolicies).length,
      timestamp: new Date()
    };
  }
}

export default SmartAttendanceSystem;