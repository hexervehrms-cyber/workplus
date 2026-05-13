/**
 * Attendance Routes - Simplified Version
 * Only handles check-in, check-out, and basic attendance tracking
 * No breaks, meetings, or complex state management
 */

import express from 'express';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import ActivityLog from '../models/ActivityLog.js';
import { authorize, authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import logger from '../utils/logger.js';
import EmailNotificationService from '../utils/emailNotificationService.js';
import { emitAttendanceKPIUpdate } from '../utils/kpiUpdater.js';
import { dashboardCache } from '../utils/dashboardCache.js';

const router = express.Router();

const queueHrAttendanceEmail = (type, payload) => {
  setImmediate(async () => {
    try {
      const { effectiveEmployeeId, effectiveOrgId, effectiveEmployeeName, attendance, hoursWorked } = payload;
      const hrEmail = process.env.HR_EMAIL;
      if (!hrEmail) {
        logger.warn(`HR_EMAIL not configured; skipping ${type} HR email`, {
          employeeId: effectiveEmployeeId,
          orgId: effectiveOrgId
        });
        return;
      }

      const employee = await Employee.findById(effectiveEmployeeId)
        .select('firstName lastName email employeeCode department userId')
        .populate('userId', 'name email')
        .lean();

      if (!employee) return;

      const empName = employee.firstName && employee.lastName
        ? `${employee.firstName} ${employee.lastName}`
        : employee.userId?.name || effectiveEmployeeName;
      const employeeEmail = employee.userId?.email || employee.email;

      if (!employeeEmail) return;

      if (type === 'check-in') {
        await EmailNotificationService.sendCheckInNotificationToHR(
          {
            name: empName,
            email: employeeEmail,
            employeeCode: employee.employeeCode,
            department: employee.department
          },
          attendance.checkIn,
          hrEmail
        );
      } else if (type === 'check-out') {
        await EmailNotificationService.sendCheckOutNotificationToHR(
          {
            name: empName,
            email: employeeEmail,
            employeeCode: employee.employeeCode,
            department: employee.department
          },
          new Date(),
          Math.round((hoursWorked || 0) * 100) / 100,
          hrEmail
        );
      }

      logger.info(`${type} notification sent to HR`, {
        employeeName: empName,
        employeeEmail,
        hrEmail,
        orgId: effectiveOrgId
      });
    } catch (emailError) {
      logger.error(`Failed to send ${type} notification to HR`, {
        error: emailError.message
      });
    }
  });
};

/**
 * GET /api/attendance/today
 * Get today's attendance for the current user
 * Returns: { attendance, liveStatus }
 */
router.get('/today', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const userRole = req.user.role;
  const currentUserId = req.user.userId;
  const userOrgId = req.user.orgId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's attendance record - try with userId first
  let attendance = await Attendance.findOne({
    userId: currentUserId,
    orgId: userOrgId,
    date: { $gte: today, $lt: tomorrow }
  })
  .sort({ _id: -1 })
  .populate('userId', 'name email avatar')
  .populate('employeeId', 'employeeCode department')
  .lean();

  // Calculate live status
  let liveStatus = 'not_checked_in';
  let currentHours = 0;
  let isOnBreak = false;
  let currentBreakDuration = 0;
  let totalBreakTime = 0;

  if (attendance) {
    const now = new Date();
    
    if (attendance.checkOut) {
      liveStatus = 'checked_out';
      currentHours = (attendance.checkOut - attendance.checkIn) / (1000 * 60 * 60);
    } else if (attendance.checkIn) {
      liveStatus = 'checked_in';
      currentHours = (now - attendance.checkIn) / (1000 * 60 * 60);

      // Check if on break
      if (attendance.breaks && attendance.breaks.length > 0) {
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];
        
        if (lastBreak.startTime && !lastBreak.endTime) {
          isOnBreak = true;
          currentBreakDuration = (now - lastBreak.startTime) / (1000 * 60);
          liveStatus = 'on_break';
        }
      }

      // Calculate total break time
      if (attendance.breaks && attendance.breaks.length > 0) {
        totalBreakTime = attendance.breaks.reduce((total, breakItem) => {
          if (breakItem.startTime && breakItem.endTime) {
            return total + (breakItem.endTime - breakItem.startTime);
          }
          return total;
        }, 0) / (1000 * 60);
      }
    }
  }

  res.json({
    success: true,
    data: {
      attendance,
      liveStatus: {
        status: liveStatus,
        currentHours: Math.round(currentHours * 100) / 100,
        isOnBreak,
        currentBreakDuration: Math.round(currentBreakDuration),
        totalBreakTime: Math.round(totalBreakTime),
        lastUpdated: new Date()
      }
    }
  });
}));

/**
 * GET /api/attendance/activity-logs
 * Get today's attendance activity logs for admin live view
 */
router.get('/activity-logs', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  const orgId = req.user.orgId;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendanceActions = [
    'attendance_checkin',
    'attendance_checkout',
    'attendance_break_start',
    'attendance_break_end',
    'attendance_meeting_start',
    'attendance_meeting_end'
  ];

  const logs = await ActivityLog.find({
    orgId,
    action: { $in: attendanceActions },
    createdAt: { $gte: today, $lt: tomorrow }
  })
    .select('userId action details ipAddress deviceInfo createdAt')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const mapped = logs.map((log) => ({
    _id: log._id,
    userId: log.userId?._id || log.userId || null,
    employeeName: log.details?.employeeName || log.userId?.name || 'Employee',
    action: log.action,
    timestamp: log.createdAt,
    details: log.details || {},
    ipAddress: log.ipAddress,
    deviceInfo: log.deviceInfo
  }));

  res.json({
    success: true,
    data: mapped
  });
}));

/**
 * POST /api/attendance/check-in
 * Check in for the day
 */
router.post('/check-in', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId, employeeId, employeeName, orgId, location, notes } = req.body;
  const authUserId = req.user?.userId;
  const authOrgId = req.user?.orgId;
  const authRole = req.user?.role;
  
  // Enforce tenant/user isolation. Employee check-in is always for authenticated user.
  let effectiveUserId = userId;
  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId || authOrgId;
  let effectiveEmployeeName = employeeName;

  if (authRole === 'employee') {
    const employee = await Employee.findOne({ userId: authUserId, orgId: authOrgId, status: 'active' }).select('_id firstName lastName userId').lean();
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Employee profile not found or inactive for authenticated user'
      });
    }
    effectiveUserId = authUserId;
    effectiveEmployeeId = employee._id;
    effectiveOrgId = authOrgId;
    effectiveEmployeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employeeName || 'Employee';
  } else {
    if (!effectiveUserId || !effectiveEmployeeId || !effectiveOrgId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, employeeId, orgId'
      });
    }
    // Non-employee actors cannot write attendance for another org
    if (effectiveOrgId !== authOrgId && authRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized org access'
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if already checked in today
  const existingAttendance = await Attendance.findOne({
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    date: { $gte: today, $lt: tomorrow }
  });

  if (existingAttendance && existingAttendance.checkIn && !existingAttendance.checkOut) {
    return res.status(200).json({
      success: true,
      message: 'Already checked in today.',
      data: existingAttendance
    });
  }

  // IMPORTANT: Close any open breaks from previous days to prevent stale break status
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEnd = new Date(today);
  
  const previousAttendance = await Attendance.findOne({
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    date: { $gte: yesterday, $lt: today }
  });

  if (previousAttendance && previousAttendance.breaks && previousAttendance.breaks.length > 0) {
    const lastBreak = previousAttendance.breaks[previousAttendance.breaks.length - 1];
    if (lastBreak.startTime && !lastBreak.endTime) {
      // Close the open break from yesterday
      const breakEndTime = new Date(today);
      breakEndTime.setHours(0, 0, 0, 0); // Set to midnight (end of previous day)
      const breakDuration = (breakEndTime - lastBreak.startTime) / (1000 * 60);
      
      await Attendance.updateOne(
        { _id: previousAttendance._id },
        {
          $set: {
            [`breaks.${previousAttendance.breaks.length - 1}.endTime`]: breakEndTime,
            [`breaks.${previousAttendance.breaks.length - 1}.duration`]: Math.round(breakDuration),
            [`breaks.${previousAttendance.breaks.length - 1}.endNotes`]: 'Auto-closed at end of day'
          }
        }
      );
      logger.info('Auto-closed open break from previous day', {
        employeeId: effectiveEmployeeId,
        orgId: effectiveOrgId,
        breakDuration: Math.round(breakDuration)
      });
    }
  }

  // Create new attendance record
  const attendance = await Attendance.create({
    userId: effectiveUserId,
    employeeId: effectiveEmployeeId,
    employeeName: effectiveEmployeeName,
    date: today,
    checkIn: new Date(),
    status: 'present',
    orgId: effectiveOrgId,
    checkInLocation: location || 'Office',
    checkInIP: req.ip || req.connection.remoteAddress,
    checkInNotes: notes
  });

  // Log activity
  await ActivityLog.logActivity({
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    action: 'attendance_checkin',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `${effectiveEmployeeName} - Check In`
    },
    details: {
      location: location || 'Office',
      notes,
      employeeName: effectiveEmployeeName
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user'
  });

  // Emit real-time update (this also emits KPI update internally)
  if (req.emitAttendanceUpdate) {
    req.emitAttendanceUpdate(attendance, effectiveOrgId);
  }

  // Send response first to confirm check-in
  res.status(201).json({
    success: true,
    message: 'Checked in successfully',
    data: attendance
  });

  // Invalidate dashboard cache for this organization
  dashboardCache.invalidateEndpoint('/dashboard/quick-stats', effectiveOrgId);
  dashboardCache.invalidateEndpoint('/dashboard/stats', effectiveOrgId);

  // Emit specific check-in event for page synchronization (like break:started and meeting:started)
  if (global.io) {
    global.io.to(`tenant_${effectiveOrgId}`).emit('attendance:checked_in', {
      employeeId: effectiveEmployeeId,
      userId: effectiveUserId,
      timestamp: new Date().toISOString(),
      checkInTime: attendance.checkIn
    });
  }

  // Emit KPI update to admin dashboard
  if (global.io) {
    emitAttendanceKPIUpdate(global.io, effectiveOrgId, {
      action: 'check_in',
      employeeId: effectiveEmployeeId,
      status: 'checked_in'
    }).catch(err => logger.error('Failed to emit KPI update on check-in', { error: err.message }));
  }

  queueHrAttendanceEmail('check-in', {
    effectiveEmployeeId,
    effectiveOrgId,
    effectiveEmployeeName,
    attendance
  });
}));

/**
 * POST /api/attendance/check-out
 * Check out for the day
 */
router.post('/check-out', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId, employeeId, employeeName, orgId, location, notes } = req.body;
  const authUserId = req.user?.userId;
  const authOrgId = req.user?.orgId;
  const authRole = req.user?.role;

  let effectiveUserId = userId;
  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId || authOrgId;
  let effectiveEmployeeName = employeeName;

  if (authRole === 'employee') {
    const employee = await Employee.findOne({ userId: authUserId, orgId: authOrgId, status: 'active' }).select('_id firstName lastName').lean();
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Employee profile not found or inactive for authenticated user'
      });
    }
    effectiveUserId = authUserId;
    effectiveEmployeeId = employee._id;
    effectiveOrgId = authOrgId;
    effectiveEmployeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employeeName || 'Employee';
  } else {
    if (!effectiveUserId || !effectiveEmployeeId || !effectiveOrgId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, employeeId, orgId'
      });
    }
    if (effectiveOrgId !== authOrgId && authRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized org access'
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    date: { $gte: today, $lt: tomorrow }
  }).sort({ _id: -1 });

  if (!attendance || !attendance.checkIn) {
    return res.status(400).json({
      success: false,
      message: 'No check-in found for today. Please check in first.'
    });
  }

  if (attendance.checkOut) {
    return res.status(200).json({
      success: true,
      message: 'Already checked out today.',
      data: attendance
    });
  }

  // Calculate hours worked
  const checkOutTime = new Date();
  let hoursWorked = (checkOutTime - attendance.checkIn) / (1000 * 60 * 60);

  // Subtract break time from hours worked
  if (attendance.breaks && attendance.breaks.length > 0) {
    let totalBreakTime = 0;
    attendance.breaks.forEach(breakItem => {
      if (breakItem.startTime && breakItem.endTime) {
        const breakDuration = (breakItem.endTime - breakItem.startTime) / (1000 * 60 * 60);
        totalBreakTime += breakDuration;
      }
    });
    hoursWorked -= totalBreakTime;
  }

  // Ensure hoursWorked is not negative
  hoursWorked = Math.max(0, hoursWorked);

  // Update attendance record
  const updatedAttendance = await Attendance.findByIdAndUpdate(
    attendance._id,
    {
      $set: {
        checkOut: checkOutTime,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        checkOutLocation: location || 'Office',
        checkOutIP: req.ip || req.connection.remoteAddress,
        checkOutNotes: notes
      }
    },
    { new: true }
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  // Log activity
  await ActivityLog.logActivity({
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    action: 'attendance_checkout',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `${effectiveEmployeeName} - Check Out`
    },
    details: {
      location: location || 'Office',
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      notes,
      employeeName: effectiveEmployeeName
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user'
  });

  // Emit real-time update (this also emits KPI update internally)
  if (req.emitAttendanceUpdate) {
    req.emitAttendanceUpdate(updatedAttendance, effectiveOrgId);
  }

  // Send response first to confirm check-out
  res.json({
    success: true,
    message: 'Checked out successfully',
    data: updatedAttendance
  });

  // Invalidate dashboard cache for this organization
  dashboardCache.invalidateEndpoint('/dashboard/quick-stats', effectiveOrgId);
  dashboardCache.invalidateEndpoint('/dashboard/stats', effectiveOrgId);

  // Emit specific check-out event for page synchronization (like break:ended and meeting:ended)
  if (global.io) {
    global.io.to(`tenant_${effectiveOrgId}`).emit('attendance:checked_out', {
      employeeId: effectiveEmployeeId,
      userId: effectiveUserId,
      timestamp: new Date().toISOString(),
      hoursWorked: Math.round(hoursWorked * 100) / 100
    });
  }

  // Emit KPI update to admin dashboard
  if (global.io) {
    emitAttendanceKPIUpdate(global.io, effectiveOrgId, {
      action: 'check_out',
      employeeId: effectiveEmployeeId,
      status: 'checked_out'
    }).catch(err => logger.error('Failed to emit KPI update on check-out', { error: err.message }));
  }

  queueHrAttendanceEmail('check-out', {
    effectiveEmployeeId,
    effectiveOrgId,
    effectiveEmployeeName,
    attendance: updatedAttendance,
    hoursWorked
  });
}));

/**
 * GET /api/attendance
 * List all attendance records with pagination
 */
router.get('/', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, orgId, userId, startDate, endDate } = req.query;
  const userOrgId = req.user.orgId;
  const currentUserId = req.user.userId;
  const userRole = req.user.role;

  // CRITICAL: Enforce orgId validation - users can only access their organization's data
  const query = { orgId: orgId || userOrgId };

  // Employees can only see their own attendance
  if (userRole === 'employee') {
    query.userId = currentUserId;
  } else if (userId) {
    query.userId = userId;
  }
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  const skip = (page - 1) * limit;

  const records = await Attendance.find(query)
    .sort({ date: -1, _id: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'name email')
    .populate('employeeId', 'employeeCode department')
    .lean();

  // Recalculate hours for records with breaks to ensure accuracy
  const recordsWithRecalculatedHours = records.map(record => {
    if (record.checkIn && record.checkOut) {
      let calculatedHours = (new Date(record.checkOut) - new Date(record.checkIn)) / (1000 * 60 * 60);
      
      // Subtract break time if breaks exist
      if (record.breaks && record.breaks.length > 0) {
        let totalBreakTime = 0;
        record.breaks.forEach(breakItem => {
          if (breakItem.startTime && breakItem.endTime) {
            const breakDuration = (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60 * 60);
            totalBreakTime += breakDuration;
          }
        });
        calculatedHours -= totalBreakTime;
      }
      
      // Ensure hours is not negative
      calculatedHours = Math.max(0, calculatedHours);
      
      // Update the record with recalculated hours
      return {
        ...record,
        hoursWorked: Math.round(calculatedHours * 100) / 100
      };
    }
    return record;
  });

  const total = await Attendance.countDocuments(query);

  res.json({
    success: true,
    data: recordsWithRecalculatedHours,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * POST /api/attendance/break-start
 * Start a break - ATOMIC OPERATION
 * Uses MongoDB atomic operations to prevent race conditions
 */
router.post('/break-start', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, breakType = 'regular', notes, orgId, employeeName, idempotencyKey } = req.body;
  const currentUserId = req.user.userId;
  const authOrgId = req.user.orgId;
  const authRole = req.user.role;

  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId;
  let effectiveEmployeeName = employeeName;

  if (authRole === 'employee') {
    const employee = await Employee.findOne({ userId: currentUserId, orgId: authOrgId, status: 'active' })
      .select('_id firstName lastName')
      .lean();
    if (!employee) {
      return res.status(403).json({ success: false, message: 'Employee profile not found or inactive for authenticated user' });
    }
    effectiveEmployeeId = employee._id;
    effectiveOrgId = authOrgId;
    effectiveEmployeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || effectiveEmployeeName || 'Employee';
  } else if (effectiveOrgId !== authOrgId && authRole !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized org access' });
  }

  if (!effectiveEmployeeId || !effectiveOrgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ATOMIC OPERATION: Find and update in one operation to prevent race conditions
  // This ensures only one break can be started even with concurrent requests
  const newBreak = {
    startTime: new Date(),
    breakType,
    notes,
    ipAddress: req.ip || req.connection.remoteAddress,
    idempotencyKey // Store key for deduplication
  };

  try {
    // Use findOneAndUpdate with atomic $push to prevent duplicate breaks
    const updatedAttendance = await Attendance.findOneAndUpdate(
      {
        employeeId: effectiveEmployeeId,
        orgId: effectiveOrgId,
        date: { $gte: today, $lt: tomorrow },
        checkIn: { $exists: true },
        checkOut: { $exists: false }, // Not checked out
        'breaks': { $not: { $elemMatch: { startTime: { $exists: true }, endTime: { $exists: false } } } }, // No active break
        'meetingMode.isActive': { $ne: true } // Not in meeting
      },
      {
        $push: { breaks: newBreak }
      },
      { new: true, runValidators: false }
    ).select('_id employeeId orgId breaks meetingMode checkIn checkOut');

    if (!updatedAttendance) {
      // Check why update failed
      const attendance = await Attendance.findOne({
        employeeId: effectiveEmployeeId,
        orgId: effectiveOrgId,
        date: { $gte: today, $lt: tomorrow }
      }).select('_id checkIn checkOut breaks meetingMode');

      if (!attendance) {
        return res.status(400).json({
          success: false,
          message: 'No check-in found for today. Please check in first.'
        });
      }

      if (attendance.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Already checked out. Cannot start break.'
        });
      }

      if (attendance.breaks?.some(b => b.startTime && !b.endTime)) {
        return res.status(200).json({
          success: true,
          message: 'Already on break.',
          data: attendance
        });
      }

      if (attendance.meetingMode?.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot start break while in meeting. End meeting first.'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to start break. Please try again.'
      });
    }

    // Send response immediately with updated data
    res.status(201).json({
      success: true,
      message: 'Break started successfully',
      data: updatedAttendance
    });

    // Log activity asynchronously
    setImmediate(async () => {
      try {
        await ActivityLog.logActivity({
          userId: currentUserId,
          orgId: effectiveOrgId,
          action: 'attendance_break_start',
          entity: {
            entityType: 'attendance',
            entityId: updatedAttendance._id,
            entityName: `Break Started - ${breakType}`
          },
          details: {
            breakType,
            notes,
            idempotencyKey
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          severity: 'low',
          category: 'user'
        }).catch(err => logger.error('Failed to log break start activity', { error: err.message }));

        // Emit real-time event to notify all connected clients
        if (global.io) {
          try {
            global.io.to(`tenant_${effectiveOrgId}`).emit('break:started', {
              employeeId: effectiveEmployeeId,
              breakType: breakType,
              timestamp: new Date().toISOString()
            });
            logger.info('Break started event emitted', { employeeId: effectiveEmployeeId, orgId: effectiveOrgId });
          } catch (err) {
            logger.error('Failed to emit break:started event', { error: err.message });
          }
        }

        // Emit KPI update to admin dashboard
        if (global.io) {
          try {
            emitAttendanceKPIUpdate(global.io, effectiveOrgId, {
              action: 'break_start',
              employeeId: effectiveEmployeeId,
              status: 'on_break'
            });
          } catch (err) {
            logger.error('Failed to emit KPI update', { error: err.message });
          }
        }
      } catch (err) {
        logger.error('Error in async break start operations', { error: err.message, employeeId: effectiveEmployeeId });
      }
    });

  } catch (err) {
    logger.error('Break start operation failed', { error: err.message, employeeId: effectiveEmployeeId });
    return res.status(500).json({
      success: false,
      message: 'Failed to start break. Please try again.'
    });
  }
}));

/**
 * POST /api/attendance/break-end
 * End a break - ATOMIC OPERATION
 * Uses MongoDB atomic operations to prevent race conditions
 */
router.post('/break-end', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, notes, orgId, employeeName, idempotencyKey } = req.body;
  const currentUserId = req.user.userId;
  const authOrgId = req.user.orgId;
  const authRole = req.user.role;

  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId;
  let effectiveEmployeeName = employeeName;

  if (authRole === 'employee') {
    const employee = await Employee.findOne({ userId: currentUserId, orgId: authOrgId, status: 'active' })
      .select('_id firstName lastName')
      .lean();
    if (!employee) {
      return res.status(403).json({ success: false, message: 'Employee profile not found or inactive for authenticated user' });
    }
    effectiveEmployeeId = employee._id;
    effectiveOrgId = authOrgId;
    effectiveEmployeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || effectiveEmployeeName || 'Employee';
  } else if (effectiveOrgId !== authOrgId && authRole !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized org access' });
  }

  if (!effectiveEmployeeId || !effectiveOrgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // ATOMIC OPERATION: Use $pull with condition to end the active break
    // This ensures only the active break is ended, preventing race conditions
    const endTime = new Date();

    const updatedAttendance = await Attendance.findOneAndUpdate(
      {
        employeeId: effectiveEmployeeId,
        orgId: effectiveOrgId,
        date: { $gte: today, $lt: tomorrow },
        'breaks': { $elemMatch: { startTime: { $exists: true }, endTime: { $exists: false } } } // Has active break
      },
      {
        $set: {
          'breaks.$[activeBreak].endTime': endTime,
          'breaks.$[activeBreak].endNotes': notes
        }
      },
      {
        arrayFilters: [{ 'activeBreak.startTime': { $exists: true }, 'activeBreak.endTime': { $exists: false } }],
        new: true,
        runValidators: false
      }
    ).populate('userId', 'name email avatar')
     .populate('employeeId', 'employeeCode department');

    if (!updatedAttendance) {
      // Check why update failed
      const attendance = await Attendance.findOne({
        employeeId: effectiveEmployeeId,
        orgId: effectiveOrgId,
        date: { $gte: today, $lt: tomorrow }
      }).select('_id breaks');

      if (!attendance) {
        return res.status(400).json({
          success: false,
          message: 'No attendance record found for today.'
        });
      }

      if (!attendance.breaks?.some(b => b.startTime && !b.endTime)) {
        return res.status(200).json({
          success: true,
          message: 'No active break found to end.',
          data: attendance
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to end break. Please try again.'
      });
    }

    // Calculate break duration from the updated break
    const activeBreak = updatedAttendance.breaks?.find(b => b.endTime && b.startTime);
    const breakDuration = activeBreak 
      ? Math.round((new Date(activeBreak.endTime).getTime() - new Date(activeBreak.startTime).getTime()) / (1000 * 60))
      : 0;

    // Log activity asynchronously
    setImmediate(async () => {
      try {
        await ActivityLog.logActivity({
          userId: currentUserId,
          orgId: effectiveOrgId,
          action: 'attendance_break_end',
          entity: {
            entityType: 'attendance',
            entityId: updatedAttendance._id,
            entityName: `Break Ended - ${breakDuration} minutes`
          },
          details: {
            duration: breakDuration,
            notes,
            idempotencyKey
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          severity: 'low',
          category: 'user'
        }).catch(err => logger.error('Failed to log break end activity', { error: err.message }));

        // Emit real-time event to notify admin dashboard
        if (req.emitAttendanceUpdate) {
          req.emitAttendanceUpdate(updatedAttendance, effectiveOrgId).catch(err => 
            logger.error('Failed to emit attendance update', { error: err.message })
          );
        }

        // Emit specific break:ended event for page synchronization
        if (global.io) {
          try {
            global.io.to(`tenant_${effectiveOrgId}`).emit('break:ended', {
              employeeId: effectiveEmployeeId,
              timestamp: new Date().toISOString(),
              attendance: updatedAttendance
            });
            logger.info('Break ended event emitted', { employeeId: effectiveEmployeeId, orgId: effectiveOrgId });
          } catch (err) {
            logger.error('Failed to emit break:ended event', { error: err.message });
          }
        }

        // Emit KPI update to admin dashboard
        if (global.io) {
          try {
            emitAttendanceKPIUpdate(global.io, effectiveOrgId, {
              action: 'break_end',
              employeeId: effectiveEmployeeId,
              status: 'checked_in'
            });
          } catch (err) {
            logger.error('Failed to emit KPI update', { error: err.message });
          }
        }
      } catch (err) {
        logger.error('Error in async break end operations', { error: err.message, employeeId: effectiveEmployeeId });
      }
    });

    res.json({
      success: true,
      message: 'Break ended successfully',
      data: updatedAttendance
    });

  } catch (err) {
    logger.error('Break end operation failed', { error: err.message, employeeId: effectiveEmployeeId });
    return res.status(500).json({
      success: false,
      message: 'Failed to end break. Please try again.'
    });
  }
}));

/**
 * GET /api/attendance/stats/summary
 * Get attendance statistics
 */
  const { employeeId, meetingTitle = 'Meeting', meetingType = 'internal', notes, orgId } = req.body;
  const currentUserId = req.user.userId;
  const authOrgId = req.user.orgId;
  const authRole = req.user.role;

  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId;

  if (authRole === 'employee') {
    const employee = await Employee.findOne({ userId: currentUserId, orgId: authOrgId, status: 'active' })
      .select('_id')
      .lean();
    if (!employee) {
      return res.status(403).json({ success: false, message: 'Employee profile not found or inactive for authenticated user' });
    }
    effectiveEmployeeId = employee._id;
    effectiveOrgId = authOrgId;
  } else if (effectiveOrgId !== authOrgId && authRole !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized org access' });
  }

  if (!effectiveEmployeeId || !effectiveOrgId) {
    return res.status(400).json({ success: false, message: 'Missing required fields: employeeId, orgId' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    employeeId: effectiveEmployeeId,
    orgId: effectiveOrgId,
    date: { $gte: today, $lt: tomorrow }
  }).sort({ _id: -1 });

  if (!attendance || !attendance.checkIn) {
    return res.status(400).json({
      success: false,
      message: 'No check-in found for today. Please check in first.'
    });
  }

  if (attendance.checkOut) {
    return res.status(400).json({
      success: false,
      message: 'Already checked out. Cannot start meeting.'
    });
  }

  // Check if already in meeting
  if (attendance.meetingMode?.isActive) {
    return res.status(200).json({
      success: true,
      message: 'Already in a meeting.',
      data: attendance
    });
  }

  // Check if on break - cannot start meeting while on break
  const currentBreak = attendance.breaks?.find(b => b.startTime && !b.endTime);
  if (currentBreak) {
    // Try to auto-end the break
    const endTime = new Date();
    const breakDuration = (endTime - currentBreak.startTime) / (1000 * 60);
    
    const breakIndex = attendance.breaks.findIndex(b => b.startTime && !b.endTime);
    if (breakIndex !== -1) {
      const updateQuery = {
        $set: {
          [`breaks.${breakIndex}.endTime`]: endTime,
          [`breaks.${breakIndex}.duration`]: Math.round(breakDuration),
          [`breaks.${breakIndex}.endNotes`]: 'Auto-ended to start meeting'
        }
      };
      
      try {
        await Attendance.findByIdAndUpdate(attendance._id, updateQuery);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Cannot start meeting while on break. Failed to auto-end break.'
        });
      }
    }
  }

  // Start meeting
  const meetingMode = {
    isActive: true,
    meetingTitle,
    meetingType,
    notes,
    startTime: new Date(),
    startedBy: currentUserId
  };

  // Send response immediately
  res.status(201).json({
    success: true,
    message: 'Meeting started successfully',
    data: {
      meetingMode: {
        isActive: true,
        meetingTitle
      }
    }
  });

  // Update database asynchronously
  setImmediate(async () => {
    try {
      const updatedAttendance = await Attendance.findByIdAndUpdate(
        attendance._id,
        { 
          $set: { meetingMode },
          $push: {
            meetings: {
              startTime: meetingMode.startTime,
              title: meetingTitle,
              type: meetingType,
              ipAddress: req.ip || req.connection.remoteAddress
            }
          }
        },
        { new: true }
      ).select('_id employeeId orgId meetingMode');

      // Log activity asynchronously
      ActivityLog.logActivity({
        userId: currentUserId,
        orgId: effectiveOrgId,
        action: 'attendance_meeting_start',
        entity: {
          entityType: 'attendance',
          entityId: attendance._id,
          entityName: `Meeting Started - ${meetingTitle}`
        },
        details: {
          meetingTitle,
          meetingType,
          notes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'low',
        category: 'user'
      }).catch(err => logger.error('Failed to log meeting start activity', { error: err.message }));

      // Emit real-time event to notify admin dashboard
      if (req.emitAttendanceUpdate) {
        req.emitAttendanceUpdate(updatedAttendance, effectiveOrgId).catch(err => 
          logger.error('Failed to emit attendance update', { error: err.message })
        );
      }

      // Emit specific meeting:started event for page synchronization
      if (global.io) {
        global.io.to(`tenant_${effectiveOrgId}`).emit('meeting:started', {
          employeeId: effectiveEmployeeId,
          meetingTitle: meetingMode.meetingTitle,
          meetingType: meetingMode.meetingType,
          timestamp: new Date().toISOString()
        });
        logger.info('Meeting started event emitted', { employeeId: effectiveEmployeeId, orgId: effectiveOrgId });
      }
    } catch (err) {
      logger.error('Error in async meeting start operations', { error: err.message, employeeId: effectiveEmployeeId });
    }
  });
}));

/**
 * GET /api/attendance/stats/summary
 * Get attendance statistics
 */
router.get('/stats/summary', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  const { orgId, startDate, endDate } = req.query;
  const userOrgId = req.user.orgId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const query = { orgId: orgId || userOrgId };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  } else {
    query.date = { $gte: today, $lt: tomorrow };
  }

  const stats = await Attendance.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        checkedOut: { $sum: { $cond: ['$checkOut', 1, 0] } },
        stillCheckedIn: { $sum: { $cond: [{ $eq: ['$checkOut', null] }, 1, 0] } }
      }
    }
  ]);

  res.json({
    success: true,
    data: stats[0] || {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      checkedOut: 0,
      stillCheckedIn: 0
    }
  });
}));

/**
 * GET /api/attendance/late-today
 * Get employees who were late today
 * Returns: Array of late employees with details
 */
router.get('/late-today', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  const userOrgId = req.user.orgId;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all attendance records for today
  const attendanceRecords = await Attendance.find({
    orgId: userOrgId,
    date: { $gte: today, $lt: tomorrow },
    checkIn: { $exists: true, $ne: null }
  })
  .populate('employeeId', 'shiftTiming')
  .populate('userId', 'name email')
  .lean();

  // Filter and process late employees
  const lateEmployees = attendanceRecords
    .filter(record => {
      const employee = record.employeeId;
      if (!employee || !employee.shiftTiming) return false;

      const shiftTiming = employee.shiftTiming;
      const checkInTime = new Date(record.checkIn);
      const checkInHours = checkInTime.getHours();
      const checkInMins = checkInTime.getMinutes();
      const checkInTotalMinutes = checkInHours * 60 + checkInMins;

      // Parse shift start time
      const [shiftHours, shiftMins] = shiftTiming.startTime.split(':').map(Number);
      const shiftStartMinutes = shiftHours * 60 + shiftMins;
      
      // Calculate allowed time (shift start + grace period)
      const lateThreshold = shiftTiming.lateThreshold || 0;
      const allowedMinutes = shiftStartMinutes + lateThreshold;

      // Check if late
      return checkInTotalMinutes > allowedMinutes;
    })
    .map(record => {
      const employee = record.employeeId;
      const shiftTiming = employee.shiftTiming;
      const checkInTime = new Date(record.checkIn);
      const checkInHours = checkInTime.getHours();
      const checkInMins = checkInTime.getMinutes();
      const checkInTotalMinutes = checkInHours * 60 + checkInMins;

      // Parse shift start time
      const [shiftHours, shiftMins] = shiftTiming.startTime.split(':').map(Number);
      const shiftStartMinutes = shiftHours * 60 + shiftMins;
      
      // Calculate late minutes
      const lateThreshold = shiftTiming.lateThreshold || 0;
      const allowedMinutes = shiftStartMinutes + lateThreshold;
      const lateMinutes = checkInTotalMinutes - allowedMinutes;

      return {
        employeeId: record.employeeId._id,
        employeeName: record.employeeName,
        checkInTime: record.checkIn,
        shiftStartTime: shiftTiming.startTime,
        lateMinutes: Math.round(lateMinutes),
        status: 'late'
      };
    });

  res.json({
    success: true,
    data: lateEmployees,
    count: lateEmployees.length
  });
}));

/**
 * GET /api/attendance/on-break
 * Get employees currently on break
 */
router.get('/on-break', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  // Disable caching for real-time data
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  const userOrgId = req.user.orgId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Fetch only records that are likely on active break
  const attendanceRecords = await Attendance.find({
    orgId: userOrgId,
    date: { $gte: today, $lt: tomorrow },
    checkIn: { $exists: true, $ne: null },
    $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
    breaks: {
      $elemMatch: {
        startTime: { $exists: true },
        endTime: { $exists: false }
      }
    }
  })
  .populate('userId', 'name email avatar')
  .populate('employeeId', 'employeeCode department designation')
  .select('userId employeeId checkIn breaks')
  .lean();

  // Filter employees currently on break
  const employeesOnBreak = attendanceRecords
    .filter(record => {
      if (!record.breaks || record.breaks.length === 0) {
        return false;
      }
      
      // Check if the last break has no end time (currently on break)
      const lastBreak = record.breaks[record.breaks.length - 1];
      const isOnBreak = lastBreak.startTime && !lastBreak.endTime;
      return isOnBreak;
    })
    .map(record => {
      const lastBreak = record.breaks[record.breaks.length - 1];
      const breakStartTime = new Date(lastBreak.startTime);
      const now = new Date();
      const breakDuration = Math.round((now - breakStartTime) / (1000 * 60)); // in minutes

      return {
        employeeId: record.employeeId?._id,
        employeeName: record.userId?.name || 'Unknown',
        department: record.employeeId?.department || 'N/A',
        designation: record.employeeId?.designation || 'N/A',
        breakStartTime: lastBreak.startTime,
        breakDuration: breakDuration,
        breakType: lastBreak.breakType || 'Regular Break',
        avatar: record.userId?.avatar,
        checkInTime: record.checkIn
      };
    });

  res.json({
    success: true,
    data: employeesOnBreak,
    count: employeesOnBreak.length
  });
}));

/**
 * POST /api/attendance/bulk-import
 * Import attendance records in bulk from CSV
 * CSV format: employeeId/email, date (YYYY-MM-DD), checkIn (HH:MM), checkOut (HH:MM), status
 */
router.post('/bulk-import', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  try {
    const { records } = req.body;
    const userOrgId = req.user.orgId;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records provided'
      });
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        const { employeeId, email, date, checkIn, checkOut, status, notes } = record;

        // Validate required fields
        if (!date || (!employeeId && !email)) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: 'Missing required fields: date and (employeeId or email)'
          });
          continue;
        }

        // Find employee
        let employee = null;
        if (employeeId) {
          employee = await Employee.findOne({ _id: employeeId, orgId: userOrgId });
        } else if (email) {
          const user = await (await import('../models/User.js')).default.findOne({ email });
          if (user) {
            employee = await Employee.findOne({ userId: user._id, orgId: userOrgId });
          }
        }

        if (!employee) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: `Employee not found: ${employeeId || email}`
          });
          continue;
        }

        // Parse date
        const attendanceDate = new Date(date);
        if (isNaN(attendanceDate.getTime())) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: `Invalid date format: ${date}. Use YYYY-MM-DD`
          });
          continue;
        }

        // Set date to start of day
        attendanceDate.setHours(0, 0, 0, 0);

        // Parse check-in and check-out times
        let checkInTime = null;
        let checkOutTime = null;

        if (checkIn) {
          const [hours, minutes] = checkIn.split(':').map(Number);
          if (isNaN(hours) || isNaN(minutes)) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              error: `Invalid checkIn time format: ${checkIn}. Use HH:MM`
            });
            continue;
          }
          checkInTime = new Date(attendanceDate);
          checkInTime.setHours(hours, minutes, 0, 0);
        }

        if (checkOut) {
          const [hours, minutes] = checkOut.split(':').map(Number);
          if (isNaN(hours) || isNaN(minutes)) {
            results.failed++;
            results.errors.push({
              row: i + 1,
              error: `Invalid checkOut time format: ${checkOut}. Use HH:MM`
            });
            continue;
          }
          checkOutTime = new Date(attendanceDate);
          checkOutTime.setHours(hours, minutes, 0, 0);
        }

        // Validate status
        const validStatuses = ['present', 'absent', 'on-leave', 'half-day', 'late'];
        const attendanceStatus = status && validStatuses.includes(status) ? status : 'present';

        // Check if attendance record already exists for this date
        const existingAttendance = await Attendance.findOne({
          userId: employee.userId,
          orgId: userOrgId,
          date: { $gte: attendanceDate, $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000) }
        });

        if (existingAttendance) {
          // Update existing record
          existingAttendance.checkIn = checkInTime || existingAttendance.checkIn;
          existingAttendance.checkOut = checkOutTime || existingAttendance.checkOut;
          existingAttendance.status = attendanceStatus;
          existingAttendance.notes = notes || existingAttendance.notes;
          
          // Calculate hours worked
          if (checkInTime && checkOutTime) {
            existingAttendance.hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
          }

          await existingAttendance.save();
        } else {
          // Create new record
          const hoursWorked = checkInTime && checkOutTime ? (checkOutTime - checkInTime) / (1000 * 60 * 60) : 0;

          await Attendance.create({
            userId: employee.userId,
            employeeId: employee._id,
            employeeName: employee.firstName + ' ' + employee.lastName,
            date: attendanceDate,
            checkIn: checkInTime,
            checkOut: checkOutTime,
            status: attendanceStatus,
            hoursWorked,
            notes,
            orgId: userOrgId
          });
        }

        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message
        });
      }
    }

    logger.info('Bulk attendance import completed', {
      userId: req.user.userId,
      imported: results.imported,
      failed: results.failed,
      total: records.length
    });

    res.json({
      success: true,
      message: `Imported ${results.imported} records, ${results.failed} failed`,
      data: results
    });
  } catch (error) {
    logger.error('Bulk import error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to import attendance records',
      error: error.message
    });
  }
}));

/**
 * GET /api/attendance/bulk-export
 * Export attendance records as CSV
 * Query params: startDate, endDate, employeeId, status
 */
router.get('/bulk-export', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, employeeId, status } = req.query;
    const userOrgId = req.user.orgId;

    // Build query
    const query = { orgId: userOrgId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (employeeId) {
      query.employeeId = employeeId;
    }

    if (status) {
      query.status = status;
    }

    // Fetch records
    const records = await Attendance.find(query)
      .populate('employeeId', 'employeeCode firstName lastName email')
      .sort({ date: -1 })
      .lean();

    // Convert to CSV format
    const csvHeaders = ['Employee ID', 'Employee Name', 'Email', 'Date', 'Check In', 'Check Out', 'Status', 'Hours Worked', 'Notes'];
    const csvRows = records.map(record => [
      record.employeeId?.employeeCode || '',
      record.employeeName || '',
      record.employeeId?.email || '',
      new Date(record.date).toISOString().split('T')[0],
      record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '',
      record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '',
      record.status || '',
      record.hoursWorked || '',
      record.notes || ''
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-export-${new Date().toISOString().split('T')[0]}.csv"`);

    res.send(csvContent);

    logger.info('Bulk attendance export completed', {
      userId: req.user.userId,
      recordCount: records.length,
      filters: { startDate, endDate, employeeId, status }
    });
  } catch (error) {
    logger.error('Bulk export error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to export attendance records',
      error: error.message
    });
  }
}));

export default router;




