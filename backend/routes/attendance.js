/**
 * Attendance Routes with Real-Time Updates and Smart Features
 * Features:
 * - Real-time check-in/check-out with live dashboard updates
 * - Break tracking (start/end)
 * - Meeting mode
 * - Late marking and overtime calculation
 * - Live timer and daily/weekly hours
 * - Attendance history with analytics
 * - Role-based access control
 */

import express from 'express';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware, applyPagination } from '../middleware/pagination.js';
import { authorize, requirePermission } from '../middleware/auth.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware
router.use(paginationMiddleware);

/**
 * GET /api/attendance
 * List attendance records with pagination
 * Query params: page, limit, userId, date, status, startDate, endDate
 * RBAC: Admin/HR can see all, Employees can only see their own
 */
router.get('/', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId, date, status, startDate, endDate } = req.query;
  const userRole = req.user.role;
  const userOrgId = req.user.orgId;
  const currentUserId = req.user.userId;

  // Build query with role-based access control
  let query = { orgId: userOrgId };
  
  // Role-based filtering
  if (userRole === 'employee') {
    // Employees can only see their own attendance
    query.userId = currentUserId;
  } else if (userId) {
    // Admin/HR/Manager can filter by specific user
    query.userId = userId;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (date) {
    // Single date query
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    query.date = {
      $gte: targetDate,
      $lt: nextDay
    };
  } else if (startDate && endDate) {
    // Date range query
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // Get total count
  const total = await Attendance.countDocuments(query);

  // Get paginated results with .lean()
  const attendance = await Attendance.find(query)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .sort({ date: -1, checkIn: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  logger.info('Attendance listed', { 
    total, 
    page, 
    limit, 
    userRole, 
    orgId: userOrgId,
    requestedBy: currentUserId 
  });

  res.paginate(attendance, total);
}));

/**
 * GET /api/attendance/today
 * Get today's attendance for a user with live status
 * RBAC: Employees can only see their own, Admin/HR can see any
 */
router.get('/today', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const { userId } = req.query;
  const userRole = req.user.role;
  const currentUserId = req.user.userId;
  const userOrgId = req.user.orgId;

  // Determine which user's attendance to fetch
  let targetUserId = userId;
  if (userRole === 'employee') {
    // Employees can only see their own attendance
    targetUserId = currentUserId;
  } else if (!userId) {
    // If no userId specified, default to current user
    targetUserId = currentUserId;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    userId: targetUserId,
    orgId: userOrgId,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  })
  .populate('userId', 'name email avatar')
  .populate('employeeId', 'employeeCode department')
  .lean(); // P0 FIX: Use .lean() for read-only queries

  // Calculate live status and hours
  let liveStatus = 'not_checked_in';
  let currentHours = 0;
  let isOnBreak = false;
  let breakDuration = 0;
  let totalBreakTime = 0;

  if (attendance) {
    const now = new Date();
    
    if (attendance.checkOut) {
      liveStatus = 'checked_out';
      currentHours = (attendance.checkOut - attendance.checkIn) / (1000 * 60 * 60);
    } else if (attendance.checkIn) {
      liveStatus = 'checked_in';
      currentHours = (now - attendance.checkIn) / (1000 * 60 * 60);
      
      // Check if currently on break
      if (attendance.breaks && attendance.breaks.length > 0) {
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];
        if (lastBreak.startTime && !lastBreak.endTime) {
          isOnBreak = true;
          breakDuration = (now - lastBreak.startTime) / (1000 * 60);
        }
        
        // Calculate total break time
        totalBreakTime = attendance.breaks.reduce((total, breakItem) => {
          if (breakItem.startTime && breakItem.endTime) {
            return total + (breakItem.endTime - breakItem.startTime);
          }
          return total;
        }, 0) / (1000 * 60); // Convert to minutes
      }
      
      // Check meeting mode
      if (attendance.meetingMode && attendance.meetingMode.isActive) {
        liveStatus = 'in_meeting';
      } else if (isOnBreak) {
        liveStatus = 'on_break';
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
        currentBreakDuration: Math.round(breakDuration),
        totalBreakTime: Math.round(totalBreakTime),
        isInMeeting: attendance?.meetingMode?.isActive || false,
        lastUpdated: new Date()
      }
    }
  });
}));

/**
 * POST /api/attendance/break-start
 * Start a break with real-time updates
 * RBAC: Employees can only start their own breaks
 */
router.post('/break-start', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { 
    employeeId, 
    breakType = 'regular', // regular, lunch, personal
    notes,
    location 
  } = req.body;
  
  const userRole = req.user.role;
  const currentUserId = req.user.userId;
  const userOrgId = req.user.orgId;

  // Role-based access control
  if (userRole === 'employee') {
    // Verify employee is starting their own break
    const employee = await Employee.findOne({ _id: employeeId, userId: currentUserId, orgId: userOrgId });
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only start your own breaks.'
      });
    }
  }

  // Find today's attendance record
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    employeeId,
    orgId: userOrgId,
    date: { $gte: today, $lt: tomorrow }
  });

  if (!attendance) {
    return res.status(400).json({
      success: false,
      message: 'No attendance record found for today. Please check in first.'
    });
  }

  if (!attendance.checkIn || attendance.checkOut) {
    return res.status(400).json({
      success: false,
      message: 'Cannot start break. Either not checked in or already checked out.'
    });
  }

  // Check if already on break
  const currentBreak = attendance.breaks?.find(b => b.startTime && !b.endTime);
  if (currentBreak) {
    return res.status(400).json({
      success: false,
      message: 'Already on break. Please end current break first.'
    });
  }

  // Add new break
  const newBreak = {
    startTime: new Date(),
    breakType,
    notes,
    location
  };

  const updatedAttendance = await Attendance.findByIdAndUpdate(
    attendance._id,
    {
      $push: { breaks: newBreak },
      $set: { lastBreakStart: new Date() }
    },
    { new: true, runValidators: true }
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  // REAL-TIME UPDATES: Emit socket events
  if (global.socketManager) {
    global.socketManager.broadcastToOrganization(userOrgId, 'attendance_break_started', {
      attendance: updatedAttendance,
      breakType,
      employeeName: updatedAttendance.userId.name,
      timestamp: new Date()
    });

    // Broadcast to managers
    global.socketManager.broadcastToRole('admin', 'attendance_break_started', {
      attendance: updatedAttendance,
      orgId: userOrgId
    });
  }

  // Emit real-time updates
  req.emitAttendanceUpdate(updatedAttendance, userOrgId);
  req.emitActivityUpdate({
    action: 'break_start',
    description: `Started ${breakType} break`,
    userId: attendance.userId,
    orgId: userOrgId,
    severity: 'low',
    category: 'employee'
  }, userOrgId);

  logger.info('Break started', { 
    attendanceId: attendance._id, 
    employeeId, 
    breakType,
    startedBy: req.user.userId 
  });

  res.status(201).json({
    success: true,
    message: 'Break started successfully',
    data: {
      attendance: updatedAttendance,
      currentBreak: newBreak
    }
  });
}));

/**
 * POST /api/attendance/break-end
 * End a break with duration calculation and real-time updates
 */
router.post('/break-end', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { 
    employeeId, 
    notes,
    location 
  } = req.body;
  
  const userRole = req.user.role;
  const currentUserId = req.user.userId;
  const userOrgId = req.user.orgId;

  // Role-based access control
  if (userRole === 'employee') {
    const employee = await Employee.findOne({ _id: employeeId, userId: currentUserId, orgId: userOrgId });
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only end your own breaks.'
      });
    }
  }

  // Find today's attendance record
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    employeeId,
    orgId: userOrgId,
    date: { $gte: today, $lt: tomorrow }
  });

  if (!attendance) {
    return res.status(400).json({
      success: false,
      message: 'No attendance record found for today.'
    });
  }

  // Find active break
  const activeBreakIndex = attendance.breaks?.findIndex(b => b.startTime && !b.endTime);
  if (activeBreakIndex === -1) {
    return res.status(400).json({
      success: false,
      message: 'No active break found to end.'
    });
  }

  // End the break
  const endTime = new Date();
  const breakDuration = (endTime - attendance.breaks[activeBreakIndex].startTime) / (1000 * 60); // minutes

  const updateQuery = {
    $set: {
      [`breaks.${activeBreakIndex}.endTime`]: endTime,
      [`breaks.${activeBreakIndex}.duration`]: Math.round(breakDuration),
      [`breaks.${activeBreakIndex}.endNotes`]: notes,
      [`breaks.${activeBreakIndex}.endLocation`]: location,
      lastBreakEnd: endTime
    }
  };

  const updatedAttendance = await Attendance.findByIdAndUpdate(
    attendance._id,
    updateQuery,
    { new: true, runValidators: true }
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  // REAL-TIME UPDATES: Emit socket events
  if (global.socketManager) {
    global.socketManager.broadcastToOrganization(userOrgId, 'attendance_break_ended', {
      attendance: updatedAttendance,
      breakDuration: Math.round(breakDuration),
      employeeName: updatedAttendance.userId.name,
      timestamp: new Date()
    });

    global.socketManager.broadcastToRole('admin', 'attendance_break_ended', {
      attendance: updatedAttendance,
      orgId: userOrgId
    });
  }

  // Emit real-time updates
  req.emitAttendanceUpdate(updatedAttendance, userOrgId);
  req.emitActivityUpdate({
    action: 'break_end',
    description: `Ended break (${Math.round(breakDuration)} minutes)`,
    userId: attendance.userId,
    orgId: userOrgId,
    severity: 'low',
    category: 'employee'
  }, userOrgId);

  logger.info('Break ended', { 
    attendanceId: attendance._id, 
    employeeId, 
    duration: Math.round(breakDuration),
    endedBy: req.user.userId 
  });

  res.json({
    success: true,
    message: 'Break ended successfully',
    data: {
      attendance: updatedAttendance,
      breakDuration: Math.round(breakDuration)
    }
  });
}));

/**
 * POST /api/attendance/meeting-mode
 * Toggle meeting mode for an employee
 */
router.post('/meeting-mode', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const { 
    employeeId, 
    isActive, 
    meetingTitle,
    meetingType = 'internal', // internal, external, client
    notes 
  } = req.body;
  
  const userRole = req.user.role;
  const currentUserId = req.user.userId;
  const userOrgId = req.user.orgId;

  // Role-based access control
  if (userRole === 'employee') {
    const employee = await Employee.findOne({ _id: employeeId, userId: currentUserId, orgId: userOrgId });
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only toggle your own meeting mode.'
      });
    }
  }

  // Find today's attendance record
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    employeeId,
    orgId: userOrgId,
    date: { $gte: today, $lt: tomorrow }
  });

  if (!attendance) {
    return res.status(400).json({
      success: false,
      message: 'No attendance record found for today. Please check in first.'
    });
  }

  if (!attendance.checkIn || attendance.checkOut) {
    return res.status(400).json({
      success: false,
      message: 'Cannot toggle meeting mode. Either not checked in or already checked out.'
    });
  }

  // Update meeting mode
  const meetingMode = {
    isActive,
    meetingTitle,
    meetingType,
    notes,
    toggledAt: new Date(),
    toggledBy: req.user.userId
  };

  const updatedAttendance = await Attendance.findByIdAndUpdate(
    attendance._id,
    { $set: { meetingMode } },
    { new: true, runValidators: true }
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  // REAL-TIME UPDATES: Emit socket events
  if (global.socketManager) {
    global.socketManager.broadcastToOrganization(userOrgId, 'attendance_meeting_mode_toggled', {
      attendance: updatedAttendance,
      isActive,
      meetingTitle,
      employeeName: updatedAttendance.userId.name,
      timestamp: new Date()
    });
  }

  // Emit real-time updates
  req.emitAttendanceUpdate(updatedAttendance, userOrgId);
  req.emitActivityUpdate({
    action: 'meeting_mode_toggle',
    description: `${isActive ? 'Entered' : 'Exited'} meeting mode${meetingTitle ? `: ${meetingTitle}` : ''}`,
    userId: attendance.userId,
    orgId: userOrgId,
    severity: 'low',
    category: 'employee'
  }, userOrgId);

  logger.info('Meeting mode toggled', { 
    attendanceId: attendance._id, 
    employeeId, 
    isActive,
    meetingTitle,
    toggledBy: req.user.userId 
  });

  res.json({
    success: true,
    message: `Meeting mode ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      attendance: updatedAttendance,
      meetingMode
    }
  });
}));

/**
 * POST /api/attendance/check-in
 * Smart check-in with policy enforcement and location validation
 */
router.post('/check-in', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { 
    userId, 
    employeeId, 
    location, 
    deviceInfo, 
    notes,
    orgId 
  } = req.body;

  if (!userId || !employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'userId, employeeId, and orgId are required'
    });
  }

  // Use Smart Attendance System if available
  if (global.smartAttendanceSystem) {
    try {
      const result = await global.smartAttendanceSystem.processCheckIn({
        employeeId,
        timestamp: new Date(),
        location,
        deviceInfo,
        ipAddress: req.ip,
        notes,
        orgId
      });

      logger.info('Smart check-in processed', { 
        employeeId, 
        isLate: result.isLate,
        violations: result.policyViolations.length
      });

      // Emit real-time updates to dashboards
      req.emitAttendanceUpdate(result.attendance, orgId);
      req.emitDashboardUpdate('create', 'attendance', result.attendance, orgId);
      req.emitActivityUpdate({
        action: 'attendance_checkin',
        description: `Employee checked in${result.isLate ? ' (Late)' : ''}`,
        userId: userId,
        orgId: orgId,
        severity: result.isLate ? 'medium' : 'low',
        category: 'employee'
      }, orgId);

      // Emit notification if late
      if (result.isLate) {
        req.emitNotification({
          title: 'Late Check-in',
          message: `You are ${result.minutesLate} minutes late today`,
          type: 'warning',
          action: 'late_checkin',
          data: { minutesLate: result.minutesLate }
        }, userId, orgId);
      }

      return res.status(201).json({
        success: true,
        message: 'Checked in successfully',
        data: {
          attendance: result.attendance,
          isLate: result.isLate,
          minutesLate: result.minutesLate,
          policyViolations: result.policyViolations
        }
      });

    } catch (smartError) {
      logger.warn('Smart attendance check-in failed, falling back to basic', {
        error: smartError.message,
        employeeId
      });
      
      // Fall back to basic check-in if smart system fails
      return res.status(400).json({
        success: false,
        message: smartError.message
      });
    }
  }

  // Fallback to basic check-in logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingAttendance = await Attendance.findOne({
    employeeId,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  });

  if (existingAttendance && existingAttendance.checkIn) {
    return res.status(400).json({
      success: false,
      message: 'Already checked in today',
      data: existingAttendance
    });
  }

  const attendance = await Attendance.create({
    userId,
    employeeId,
    date: today,
    checkIn: new Date(),
    status: 'present',
    orgId,
    checkInLocation: location,
    checkInDevice: deviceInfo,
    checkInIP: req.ip,
    checkInNotes: notes
  });

  // Emit real-time updates to dashboards
  req.emitAttendanceUpdate(attendance, orgId);
  req.emitDashboardUpdate('create', 'attendance', attendance, orgId);
  req.emitActivityUpdate({
    action: 'attendance_checkin',
    description: `Employee checked in`,
    userId: userId,
    orgId: orgId,
    severity: 'low',
    category: 'employee'
  }, orgId);

  logger.info('Basic attendance check-in', { attendanceId: attendance._id, employeeId });

  res.status(201).json({
    success: true,
    message: 'Checked in successfully',
    data: { attendance }
  });
}));

/**
 * POST /api/attendance/check-out
 * Smart check-out with hours calculation and overtime detection
 */
router.post('/check-out', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { 
    userId, 
    employeeId, 
    location, 
    deviceInfo, 
    notes,
    orgId 
  } = req.body;

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'employeeId and orgId are required'
    });
  }

  // Use Smart Attendance System if available
  if (global.smartAttendanceSystem) {
    try {
      const result = await global.smartAttendanceSystem.processCheckOut({
        employeeId,
        timestamp: new Date(),
        location,
        deviceInfo,
        ipAddress: req.ip,
        notes,
        orgId
      });

      logger.info('Smart check-out processed', { 
        employeeId, 
        hoursWorked: result.hoursWorked,
        isOvertime: result.isOvertime,
        violations: result.policyViolations.length
      });

      // Emit real-time updates to dashboards
      req.emitAttendanceUpdate(result.attendance, orgId);
      req.emitDashboardUpdate('update', 'attendance', result.attendance, orgId);
      req.emitActivityUpdate({
        action: 'attendance_checkout',
        description: `Employee checked out (${result.hoursWorked}h worked)${result.isOvertime ? ' - Overtime' : ''}`,
        userId: userId,
        orgId: orgId,
        severity: result.isOvertime ? 'medium' : 'low',
        category: 'employee'
      }, orgId);

      // Emit notification for overtime
      if (result.isOvertime) {
        req.emitNotification({
          title: 'Overtime Worked',
          message: `You worked ${result.overtimeHours} hours of overtime today`,
          type: 'info',
          action: 'overtime_worked',
          data: { overtimeHours: result.overtimeHours, totalHours: result.hoursWorked }
        }, userId, orgId);
      }

      return res.json({
        success: true,
        message: 'Checked out successfully',
        data: {
          attendance: result.attendance,
          hoursWorked: result.hoursWorked,
          isOvertime: result.isOvertime,
          overtimeHours: result.overtimeHours,
          isUndertime: result.isUndertime,
          policyViolations: result.policyViolations
        }
      });

    } catch (smartError) {
      logger.warn('Smart attendance check-out failed, falling back to basic', {
        error: smartError.message,
        employeeId
      });
      
      return res.status(400).json({
        success: false,
        message: smartError.message
      });
    }
  }

  // Fallback to basic check-out logic
  const today = new Date();
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

  if (!attendance) {
    return res.status(404).json({
      success: false,
      message: 'No check-in found for today'
    });
  }

  if (attendance.checkOut) {
    return res.status(400).json({
      success: false,
      message: 'Already checked out today',
      data: attendance
    });
  }

  const checkOutTime = new Date();
  const hoursWorked = (checkOutTime - attendance.checkIn) / (1000 * 60 * 60);

  const updated = await Attendance.findOneAndUpdate(
    { 
      _id: attendance._id,
      __v: attendance.__v
    },
    {
      $set: {
        checkOut: checkOutTime,
        hoursWorked: parseFloat(hoursWorked.toFixed(2)),
        checkOutLocation: location,
        checkOutDevice: deviceInfo,
        checkOutIP: req.ip,
        checkOutNotes: notes
      },
      $inc: { __v: 1 }
    },
    { new: true }
  );

  if (!updated) {
    return res.status(409).json({
      success: false,
      message: 'Attendance was modified by another process. Please try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  // Emit real-time updates to dashboards
  req.emitAttendanceUpdate(updated, orgId);
  req.emitDashboardUpdate('update', 'attendance', updated, orgId);
  req.emitActivityUpdate({
    action: 'attendance_checkout',
    description: `Employee checked out (${hoursWorked.toFixed(2)}h worked)`,
    userId: userId,
    orgId: orgId,
    severity: 'low',
    category: 'employee'
  }, orgId);

  logger.info('Basic attendance check-out', { attendanceId: updated._id, employeeId, hoursWorked });

  res.json({
    success: true,
    message: 'Checked out successfully',
    data: { attendance: updated, hoursWorked }
  });
}));

/**
 * POST /api/attendance/break/start
 * Smart break start with policy validation
 */
router.post('/break/start', asyncHandler(async (req, res) => {
  const { 
    userId, 
    employeeId, 
    breakType = 'general', 
    notes,
    orgId 
  } = req.body;

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'employeeId and orgId are required'
    });
  }

  // Use Smart Attendance System if available
  if (global.smartAttendanceSystem) {
    try {
      const result = await global.smartAttendanceSystem.processBreakStart({
        employeeId,
        timestamp: new Date(),
        breakType,
        notes,
        orgId
      });

      logger.info('Smart break start processed', { 
        employeeId, 
        breakType,
        violations: result.violations.length
      });

      return res.json({
        success: true,
        message: 'Break started successfully',
        data: {
          breakRecord: result.breakRecord,
          violations: result.violations
        }
      });

    } catch (smartError) {
      logger.warn('Smart break start failed, falling back to basic', {
        error: smartError.message,
        employeeId
      });
      
      return res.status(400).json({
        success: false,
        message: smartError.message
      });
    }
  }

  // Fallback to basic break logic
  const today = new Date();
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

  if (!attendance) {
    return res.status(404).json({
      success: false,
      message: 'No check-in found for today'
    });
  }

  const updated = await Attendance.findOneAndUpdate(
    { 
      _id: attendance._id,
      __v: attendance.__v
    },
    {
      $push: {
        breaks: {
          startTime: new Date(),
          breakType,
          notes
        }
      },
      $inc: { __v: 1 }
    },
    { new: true }
  );

  if (!updated) {
    return res.status(409).json({
      success: false,
      message: 'Attendance was modified. Please try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  res.json({
    success: true,
    message: 'Break started',
    data: updated
  });
}));

/**
 * POST /api/attendance/break/end
 * Smart break end with duration tracking
 */
router.post('/break/end', asyncHandler(async (req, res) => {
  const { 
    userId, 
    employeeId, 
    notes,
    orgId 
  } = req.body;

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'employeeId and orgId are required'
    });
  }

  // Use Smart Attendance System if available
  if (global.smartAttendanceSystem) {
    try {
      const result = await global.smartAttendanceSystem.processBreakEnd({
        employeeId,
        timestamp: new Date(),
        notes,
        orgId
      });

      logger.info('Smart break end processed', { 
        employeeId, 
        duration: result.duration
      });

      return res.json({
        success: true,
        message: 'Break ended successfully',
        data: {
          breakRecord: result.breakRecord,
          duration: result.duration
        }
      });

    } catch (smartError) {
      logger.warn('Smart break end failed, falling back to basic', {
        error: smartError.message,
        employeeId
      });
      
      return res.status(400).json({
        success: false,
        message: smartError.message
      });
    }
  }

  // Fallback to basic break logic
  const today = new Date();
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

  if (!attendance) {
    return res.status(404).json({
      success: false,
      message: 'No check-in found for today'
    });
  }

  const lastBreak = attendance.breaks[attendance.breaks.length - 1];
  if (!lastBreak || lastBreak.endTime) {
    return res.status(400).json({
      success: false,
      message: 'No active break found'
    });
  }

  const endTime = new Date();
  const duration = (endTime - lastBreak.startTime) / (1000 * 60);

  attendance.breaks[attendance.breaks.length - 1].endTime = endTime;
  attendance.breaks[attendance.breaks.length - 1].duration = Math.round(duration);
  attendance.breaks[attendance.breaks.length - 1].endNotes = notes;
  
  await attendance.save();

  res.json({
    success: true,
    message: 'Break ended',
    data: { attendance, duration: Math.round(duration) }
  });
}));

/**
 * GET /api/attendance/stats/summary
 * Get attendance statistics
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { orgId, startDate, endDate } = req.query;

  const query = {};
  
  if (orgId) {
    query.orgId = orgId;
  }
  
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const [total, present, absent, late, halfDay, byStatus] = await Promise.all([
    Attendance.countDocuments(query),
    Attendance.countDocuments({ ...query, status: 'present' }),
    Attendance.countDocuments({ ...query, status: 'absent' }),
    Attendance.countDocuments({ ...query, status: 'late' }),
    Attendance.countDocuments({ ...query, status: 'half-day' }),
    Attendance.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      total,
      present,
      absent,
      late,
      halfDay,
      byStatus
    }
  });
}));

/**
 * POST /api/attendance/policy
 * Set attendance policy for organization
 */
router.post('/policy', asyncHandler(async (req, res) => {
  const { orgId, policy } = req.body;

  if (!orgId || !policy) {
    return res.status(400).json({
      success: false,
      message: 'orgId and policy are required'
    });
  }

  if (!global.smartAttendanceSystem) {
    return res.status(503).json({
      success: false,
      message: 'Smart attendance system not available'
    });
  }

  const updatedPolicy = global.smartAttendanceSystem.setOrganizationPolicy(orgId, policy);

  logger.info('Attendance policy updated', { orgId });

  res.json({
    success: true,
    message: 'Attendance policy updated successfully',
    data: updatedPolicy
  });
}));

/**
 * GET /api/attendance/policy/:orgId
 * Get attendance policy for organization
 */
router.get('/policy/:orgId', asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  if (!global.smartAttendanceSystem) {
    return res.status(503).json({
      success: false,
      message: 'Smart attendance system not available'
    });
  }

  const policy = global.smartAttendanceSystem.getOrganizationPolicy(orgId);

  res.json({
    success: true,
    data: policy
  });
}));

/**
 * GET /api/attendance/analytics
 * Get attendance analytics
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  const { orgId, timeframe = 30 } = req.query;

  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: 'orgId is required'
    });
  }

  if (!global.smartAttendanceSystem) {
    return res.status(503).json({
      success: false,
      message: 'Smart attendance system not available'
    });
  }

  const analytics = await global.smartAttendanceSystem.getAttendanceAnalytics(
    orgId,
    parseInt(timeframe)
  );

  res.json({
    success: true,
    data: analytics
  });
}));

/**
 * GET /api/attendance/report
 * Generate attendance report
 */
router.get('/report', asyncHandler(async (req, res) => {
  const { orgId, startDate, endDate, employeeIds } = req.query;

  if (!orgId || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'orgId, startDate, and endDate are required'
    });
  }

  if (!global.smartAttendanceSystem) {
    return res.status(503).json({
      success: false,
      message: 'Smart attendance system not available'
    });
  }

  const employeeIdArray = employeeIds ? employeeIds.split(',') : null;

  const report = await global.smartAttendanceSystem.generateAttendanceReport(
    orgId,
    startDate,
    endDate,
    employeeIdArray
  );

  res.json({
    success: true,
    data: report
  });
}));

/**
 * GET /api/attendance/system/stats
 * Get smart attendance system statistics
 */
router.get('/system/stats', asyncHandler(async (req, res) => {
  if (!global.smartAttendanceSystem) {
    return res.status(503).json({
      success: false,
      message: 'Smart attendance system not available'
    });
  }

  const stats = global.smartAttendanceSystem.getSystemStats();

  res.json({
    success: true,
    data: stats
  });
}));

export default router;
