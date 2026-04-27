/**
 * Attendance Routes with Pagination and Optimistic Locking
 * P0 Critical Fixes Applied:
 * - Pagination for large datasets
 * - .lean() for read-only queries
 * - Optimistic locking for updates
 * - Idempotency for check-in/check-out
 */

import express from 'express';
import Attendance from '../models/Attendance.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware, applyPagination } from '../middleware/pagination.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware
router.use(paginationMiddleware);

/**
 * GET /api/attendance
 * List attendance records with pagination
 * Query params: page, limit, userId, date, status, startDate, endDate
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId, date, status, startDate, endDate, orgId } = req.query;

  // Build query
  const query = {};
  
  if (orgId) {
    query.orgId = orgId;
  }
  
  if (userId) {
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

  logger.info('Attendance listed', { total, page, limit });

  res.paginate(attendance, total);
}));

/**
 * GET /api/attendance/today
 * Get today's attendance for a user
 */
router.get('/today', asyncHandler(async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    userId,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  })
  .populate('userId', 'name email avatar')
  .populate('employeeId', 'employeeCode department')
  .lean(); // P0 FIX: Use .lean() for read-only queries

  res.json({
    success: true,
    data: attendance
  });
}));

/**
 * GET /api/attendance/:id
 * Get single attendance record
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const attendance = await Attendance.findById(req.params.id)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .lean(); // P0 FIX: Use .lean() for read-only queries

  if (!attendance) {
    return res.status(404).json({
      success: false,
      message: 'Attendance record not found'
    });
  }

  res.json({
    success: true,
    data: attendance
  });
}));

/**
 * POST /api/attendance/check-in
 * Check in attendance with idempotency
 * P0 FIX: Idempotency prevents duplicate check-ins
 */
router.post('/check-in', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId, employeeId, employeeName, orgId } = req.body;

  if (!userId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'userId and orgId are required'
    });
  }

  // Check if already checked in today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingAttendance = await Attendance.findOne({
    userId,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  });

  if (existingAttendance) {
    return res.status(400).json({
      success: false,
      message: 'Already checked in today',
      data: existingAttendance
    });
  }

  // Create attendance record
  const attendance = await Attendance.create({
    userId,
    employeeId,
    employeeName,
    date: new Date(),
    checkIn: new Date(),
    status: 'present',
    orgId
  });

  logger.info('Attendance check-in', { attendanceId: attendance._id, userId });

  res.status(201).json({
    success: true,
    message: 'Checked in successfully',
    data: attendance
  });
}));

/**
 * POST /api/attendance/check-out
 * Check out attendance with optimistic locking
 * P0 FIX: Optimistic locking prevents race conditions
 */
router.post('/check-out', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required'
    });
  }

  // Find today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    userId,
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

  // Calculate hours worked
  const checkOutTime = new Date();
  const hoursWorked = (checkOutTime - attendance.checkIn) / (1000 * 60 * 60);

  // P0 FIX: Optimistic locking with version check
  const updated = await Attendance.findOneAndUpdate(
    { 
      _id: attendance._id,
      __v: attendance.__v // Version check
    },
    {
      $set: {
        checkOut: checkOutTime,
        hoursWorked: parseFloat(hoursWorked.toFixed(2))
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

  logger.info('Attendance check-out', { attendanceId: updated._id, userId, hoursWorked });

  res.json({
    success: true,
    message: 'Checked out successfully',
    data: updated
  });
}));

/**
 * POST /api/attendance/break/start
 * Start break
 */
router.post('/break/start', asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required'
    });
  }

  // Find today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    userId,
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

  // Add break start
  const updated = await Attendance.findOneAndUpdate(
    { 
      _id: attendance._id,
      __v: attendance.__v
    },
    {
      $push: {
        breaks: {
          startTime: new Date()
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
 * End break
 */
router.post('/break/end', asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'userId is required'
    });
  }

  // Find today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    userId,
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

  // Find last break without end time
  const lastBreak = attendance.breaks[attendance.breaks.length - 1];
  if (!lastBreak || lastBreak.endTime) {
    return res.status(400).json({
      success: false,
      message: 'No active break found'
    });
  }

  // Calculate break duration
  const endTime = new Date();
  const duration = (endTime - lastBreak.startTime) / (1000 * 60); // minutes

  // Update last break
  attendance.breaks[attendance.breaks.length - 1].endTime = endTime;
  attendance.breaks[attendance.breaks.length - 1].duration = Math.round(duration);
  
  await attendance.save();

  res.json({
    success: true,
    message: 'Break ended',
    data: attendance
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

export default router;
