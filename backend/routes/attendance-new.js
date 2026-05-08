/**
 * Attendance Routes - Simplified Version
 * Only handles check-in, check-out, and basic attendance tracking
 * No breaks, meetings, or complex state management
 */

import express from 'express';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import ActivityLog from '../models/ActivityLog.js';
import { authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import logger from '../utils/logger.js';

const router = express.Router();

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

  // Get today's attendance record
  const attendance = await Attendance.findOne({
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

  if (attendance) {
    const now = new Date();
    
    if (attendance.checkOut) {
      liveStatus = 'checked_out';
      currentHours = (attendance.checkOut - attendance.checkIn) / (1000 * 60 * 60);
    } else if (attendance.checkIn) {
      liveStatus = 'checked_in';
      currentHours = (now - attendance.checkIn) / (1000 * 60 * 60);
    }
  }

  res.json({
    success: true,
    data: {
      attendance,
      liveStatus: {
        status: liveStatus,
        currentHours: Math.round(currentHours * 100) / 100,
        lastUpdated: new Date()
      }
    }
  });
}));

/**
 * POST /api/attendance/check-in
 * Check in for the day
 */
router.post('/check-in', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId, employeeId, employeeName, orgId, location, notes } = req.body;
  
  if (!userId || !employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if already checked in today
  const existingAttendance = await Attendance.findOne({
    userId,
    orgId,
    date: { $gte: today, $lt: tomorrow }
  });

  if (existingAttendance && existingAttendance.checkIn && !existingAttendance.checkOut) {
    return res.status(400).json({
      success: false,
      message: 'Already checked in today. Please check out first.'
    });
  }

  // Create new attendance record
  const attendance = await Attendance.create({
    userId,
    employeeId,
    employeeName,
    date: today,
    checkIn: new Date(),
    status: 'present',
    orgId,
    checkInLocation: location || 'Office',
    checkInIP: req.ip || req.connection.remoteAddress,
    checkInNotes: notes
  });

  // Log activity
  await ActivityLog.logActivity({
    userId,
    orgId,
    action: 'attendance_checkin',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `${employeeName} - Check In`
    },
    details: {
      location: location || 'Office',
      notes,
      employeeName
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user'
  });

  // Emit real-time update
  if (global.socketManager) {
    global.socketManager.broadcastToOrganization(orgId, 'attendance:checkin', {
      attendance,
      employeeName,
      timestamp: new Date()
    });
  }

  res.status(201).json({
    success: true,
    message: 'Checked in successfully',
    data: attendance
  });
}));

/**
 * POST /api/attendance/check-out
 * Check out for the day
 */
router.post('/check-out', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId, employeeId, employeeName, orgId, location, notes } = req.body;
  
  if (!userId || !employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    userId,
    orgId,
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
      message: 'Already checked out today.'
    });
  }

  // Calculate hours worked
  const checkOutTime = new Date();
  const hoursWorked = (checkOutTime - attendance.checkIn) / (1000 * 60 * 60);

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
    userId,
    orgId,
    action: 'attendance_checkout',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `${employeeName} - Check Out`
    },
    details: {
      location: location || 'Office',
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      notes,
      employeeName
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user'
  });

  // Emit real-time update
  if (global.socketManager) {
    global.socketManager.broadcastToOrganization(orgId, 'attendance:checkout', {
      attendance: updatedAttendance,
      employeeName,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    message: 'Checked out successfully',
    data: updatedAttendance
  });
}));

/**
 * GET /api/attendance
 * List all attendance records with pagination
 */
router.get('/', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, orgId, userId, startDate, endDate } = req.query;
  const userOrgId = req.user.orgId;

  const query = { orgId: orgId || userOrgId };

  if (userId) query.userId = userId;
  
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

  const total = await Attendance.countDocuments(query);

  res.json({
    success: true,
    data: records,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
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

export default router;
