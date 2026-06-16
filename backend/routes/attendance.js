/**
 * Attendance Routes - Simplified Version
 * Only handles check-in, check-out, and basic attendance tracking
 * No breaks, meetings, or complex state management
 */

import express from 'express';
import Attendance from '../models/Attendance.js';
import AttendanceHistory from '../models/AttendanceHistory.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { authorize, authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import logger from '../utils/logger.js';
import EmailNotificationService from '../utils/emailNotificationService.js';
import { emitAttendanceKPIUpdate } from '../utils/kpiUpdater.js';
import { dashboardCache } from '../utils/dashboardCache.js';
import { getUserTimezone, getTodayInTimezone, getTomorrowInTimezone } from '../utils/timezoneHelper.js';
import { findEmployeeForSelfService } from '../utils/employeeSelfService.js';
import {
  buildOrgIdClause,
  buildOrgIdFlexible,
  buildUserIdClause,
  isOpenBreak,
  buildTodayAttendanceQuery,
  withOpenSessionFilter,
  OPEN_CHECKOUT_CONDITION,
  buildLiveStatus,
  recordWorkedHoursForRow,
  sumHoursFromAttendanceRows,
  getCalendarWeekRange,
  calendarWeekKey,
} from '../utils/attendanceQueryHelpers.js';
import { emitOrgRealtime } from '../utils/orgSocketEmit.js';
import { userOrgIdFromReq } from '../utils/orgScopeHelpers.js';
import { syncAttendanceHistoryFromRecord } from '../utils/attendanceHistorySync.js';
import {
  ATTENDANCE_ACTIVITY_ACTIONS,
  eventsFromAttendanceRow,
  mergeActivityLogs,
} from '../utils/attendanceActivityMerge.js';

const router = express.Router();

/** Condition inside $elemMatch: break started and not finished. */
const OPEN_BREAK_INNER = {
  startTime: { $exists: true, $ne: null },
  $or: [{ endTime: { $exists: false } }, { endTime: null }]
};

/** No open break — safe to start another. */
const noOpenBreakFilter = () => ({
  breaks: { $not: { $elemMatch: OPEN_BREAK_INNER } }
});

/** Has an open break (for break-end). */
const hasOpenBreakFilter = () => ({
  breaks: { $elemMatch: OPEN_BREAK_INNER }
});

/**
 * Find the latest completed break record for the attendance entry.
 */
const findLatestCompletedBreak = (breaks = []) => {
  if (!Array.isArray(breaks) || breaks.length === 0) return null;
  for (let index = breaks.length - 1; index >= 0; index -= 1) {
    const item = breaks[index];
    if (item?.startTime && item?.endTime) {
      return { breakItem: item, index };
    }
  }
  return null;
};

/** Fallback when arrayFilters update misses — end the latest open break on the document. */
const endOpenBreakOnDocument = async (attendanceDoc, endTime, notes) => {
  if (!attendanceDoc?.breaks?.length) return null;
  let changed = false;
  for (let i = attendanceDoc.breaks.length - 1; i >= 0; i -= 1) {
    const b = attendanceDoc.breaks[i];
    const open = isOpenBreak(b);
    if (open) {
      attendanceDoc.breaks[i].endTime = endTime;
      if (notes) attendanceDoc.breaks[i].endNotes = notes;
      const mins = Math.round(
        (endTime.getTime() - new Date(b.startTime).getTime()) / (1000 * 60)
      );
      attendanceDoc.breaks[i].duration = Math.max(0, mins);
      changed = true;
      break;
    }
  }
  if (!changed) return null;
  attendanceDoc.markModified('breaks');
  await attendanceDoc.save();
  return attendanceDoc;
};

/** Sum worked hours Mon–Sun (stored in MongoDB; resets each calendar week). */
const sumHoursThisWeekForUser = async (userId, effectiveOrgId, authOrgId, employeeId = null) => {
  const now = new Date();
  const { weekStart, weekEnd } = getCalendarWeekRange(now);
  const orgClause = buildOrgIdClause(effectiveOrgId, authOrgId);
  const dateClause = { date: { $gte: weekStart, $lt: weekEnd } };

  let rows = await Attendance.find({
    ...buildUserIdClause(userId),
    ...orgClause,
    ...dateClause,
  })
    .select('date checkIn checkOut hoursWorked breaks')
    .lean();

  if ((!rows || rows.length === 0) && employeeId) {
    rows = await Attendance.find({
      employeeId,
      ...orgClause,
      ...dateClause,
    })
      .select('date checkIn checkOut hoursWorked breaks')
      .lean();
  }

  return sumHoursFromAttendanceRows(rows, now);
};

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
router.get('/today', authorize('super_admin', 'admin', 'hr', 'manager', 'employee', 'accountant'), asyncHandler(async (req, res) => {
  const userRole = req.user.role;
  const currentUserId = req.user.userId;
  const userOrgId = req.user.orgId;
  const timezone = getUserTimezone(req) || 'Asia/Kolkata';

  let effectiveEmployeeId = null;
  let effectiveOrgId = userOrgId;

  if (userRole === 'employee') {
    const employee = await findEmployeeForSelfService(currentUserId, userOrgId, {
      allowCrossOrgFallback: true,
      createIfMissing: true
    });
    if (employee) {
      effectiveEmployeeId = employee._id;
      effectiveOrgId = employee.orgId || userOrgId;
    }
  }

  const todayQuery = buildTodayAttendanceQuery(
    userRole === 'employee' ? 'employee' : 'admin',
    currentUserId,
    effectiveEmployeeId,
    effectiveOrgId,
    userOrgId,
    new Date(),
    timezone
  );

  // Prefer open session so employees can start a new shift after checkout (multiple sessions/day)
  let attendance = await Attendance.findOne(withOpenSessionFilter(todayQuery))
    .sort({ _id: -1 })
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department')
    .lean();

  const hoursThisWeek = await sumHoursThisWeekForUser(
    currentUserId,
    effectiveOrgId,
    userOrgId,
    effectiveEmployeeId
  );

  res.json({
    success: true,
    data: {
      attendance,
      liveStatus: buildLiveStatus(attendance),
      hoursThisWeek,
      weekKey: calendarWeekKey(),
    },
  });
}));

/**
 * Build complete attendance activity feed (DB logs + reconstructed Attendance events).
 */
async function getMergedAttendanceActivityLogs(req, options = {}) {
  let authOrgId =
    userOrgIdFromReq(req) || req.validatedOrgId || req.user?.orgId;

  // Admin/HR JWT sometimes lacks orgId while employee rows use Employee.orgId — resolve from profile
  if ((!authOrgId || authOrgId === 'system') && req.user?.userId && req.user?.role !== 'super_admin') {
    try {
      const emp = await findEmployeeForSelfService(req.user.userId, authOrgId || '', {
        allowCrossOrgFallback: true,
      });
      if (emp?.orgId && String(emp.orgId) !== 'system') {
        authOrgId = String(emp.orgId);
      }
    } catch {
      /* ignore */
    }
    if (!authOrgId || authOrgId === 'system') {
      const u = await User.findById(req.user.userId)
        .select('orgId tenantId organization')
        .lean();
      const fromUser = u?.orgId || u?.tenantId || u?.organization;
      if (fromUser && String(fromUser) !== 'system') authOrgId = String(fromUser);
    }
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 5000);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  const userIdFilter = options.userId || null;

  const hasDateFilter = Boolean(req.query.startDate || req.query.endDate);
  const todayOnly = req.query.today === 'true';

  let rangeStart = null;
  let rangeEnd = null;
  if (hasDateFilter || todayOnly) {
    if (req.query.startDate) {
      rangeStart = new Date(req.query.startDate);
      rangeStart.setHours(0, 0, 0, 0);
    } else {
      rangeStart = new Date();
      rangeStart.setHours(0, 0, 0, 0);
    }
    if (req.query.endDate) {
      rangeEnd = new Date(req.query.endDate);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      rangeEnd = new Date(rangeStart);
      rangeEnd.setHours(23, 59, 59, 999);
    }
  }

  const orgMatch = authOrgId ? buildOrgIdFlexible(authOrgId) : {};
  const logQuery = {
    ...orgMatch,
    action: { $in: ATTENDANCE_ACTIVITY_ACTIONS },
  };
  if (userIdFilter) {
    Object.assign(logQuery, buildUserIdClause(userIdFilter));
  }
  if (rangeStart && rangeEnd) {
    logQuery.createdAt = { $gte: rangeStart, $lte: rangeEnd };
  }

  const dbLogs = await ActivityLog.find(logQuery)
    .select('userId action details ipAddress deviceInfo createdAt entity')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(10000)
    .lean();

  const attendanceQuery = {
    ...orgMatch,
  };
  if (userIdFilter) {
    Object.assign(attendanceQuery, buildUserIdClause(userIdFilter));
  }
  if (rangeStart && rangeEnd) {
    attendanceQuery.date = { $gte: rangeStart, $lte: rangeEnd };
  }

  const attendanceRows = await Attendance.find(attendanceQuery)
    .select('userId employeeId employeeName date checkIn checkOut hoursWorked breaks checkInLocation')
    .populate('userId', 'name email')
    .sort({ date: -1, checkIn: -1 })
    .limit(5000)
    .lean();

  const synthetic = attendanceRows.flatMap((row) => {
    const name =
      row.employeeName ||
      (row.userId?.name ? String(row.userId.name) : 'Employee');
    return eventsFromAttendanceRow(row, name);
  });

  const merged = mergeActivityLogs(dbLogs, synthetic);
  const page = merged.slice(skip, skip + limit);

  return {
    data: page,
    total: merged.length,
    skip,
    limit,
    hasMore: skip + limit < merged.length,
  };
}

function emitAttendanceActivityLog(req, log, orgId) {
  if (!log || !req?.emitActivityUpdate) return;
  const payload = {
    _id: log._id,
    userId: log.userId,
    employeeName: log.details?.employeeName || 'Employee',
    action: log.action,
    timestamp: log.createdAt || new Date(),
    details: log.details || {},
    ipAddress: log.ipAddress,
    deviceInfo: log.deviceInfo,
  };
  req.emitActivityUpdate(payload, orgId);
}

/**
 * GET /api/attendance/activity-logs
 * Full attendance activity for admin (all history unless date range provided)
 */
router.get('/activity-logs', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  const result = await getMergedAttendanceActivityLogs(req);
  res.json({
    success: true,
    ...result,
  });
}));

/**
 * GET /api/attendance/activity-logs/me
 * Full attendance activity for the authenticated employee
 */
router.get('/activity-logs/me', authorize('employee', 'manager', 'accountant'), asyncHandler(async (req, res) => {
  const result = await getMergedAttendanceActivityLogs(req, {
    userId: req.user.userId,
  });
  res.json({
    success: true,
    ...result,
  });
}));

/**
 * POST /api/attendance/check-in
 * Check in for the day
 */
router.post('/check-in', authorize('super_admin', 'admin', 'hr', 'manager', 'employee', 'accountant'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId, employeeId, employeeName, orgId, location, notes } = req.body;
  const authUserId = req.user?.userId;
  const authOrgId = req.user?.orgId;
  const authRole = req.user?.role;
  
  // Enforce tenant/user isolation. Employee check-in is always for authenticated user.
  let effectiveUserId = userId;
  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId || authOrgId;
  let effectiveEmployeeName = employeeName;

  // CRITICAL: Reject if req.body.orgId differs from authenticated user's org
  if (orgId && String(orgId) !== String(authOrgId) && authRole !== 'super_admin') {
    logger.warn('Organization scope violation attempted on check-in', {
      requestOrgId: orgId,
      authOrgId,
      role: authRole,
      userId: authUserId
    });
    return res.status(403).json({
      success: false,
      message: 'Organization mismatch. Cannot check in for different organization.',
      code: 'ORG_MISMATCH'
    });
  }

  if (authRole === 'employee') {
    const employee = await findEmployeeForSelfService(authUserId, authOrgId, {
      allowCrossOrgFallback: false,
      createIfMissing: true
    });
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Employee profile not found or inactive for authenticated user',
        code: 'EMPLOYEE_NOT_FOUND',
      });
    }
    effectiveUserId = authUserId;
    effectiveEmployeeId = employee._id;
    effectiveOrgId = String(employee.orgId || authOrgId);
    effectiveEmployeeName =
      `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
      employeeName ||
      'Employee';
  } else {
    if (!effectiveUserId || !effectiveEmployeeId || !effectiveOrgId) {
      logger.warn('Missing required fields for non-employee check-in', {
        effectiveUserId,
        effectiveEmployeeId,
        effectiveOrgId,
        authRole
      });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, employeeId, orgId',
        code: 'MISSING_FIELDS'
      });
    }
    // Non-employee actors cannot write attendance for another org
    if (effectiveOrgId !== authOrgId && authRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized org access',
        code: 'UNAUTHORIZED_ORG'
      });
    }
  }

  // Validate effective values
  if (!effectiveUserId || !effectiveEmployeeId || !effectiveOrgId) {
    logger.error('Check-in validation failed - missing effective values', {
      effectiveUserId,
      effectiveEmployeeId,
      effectiveOrgId
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid check-in request - missing required data',
      code: 'INVALID_REQUEST'
    });
  }

  // Get timezone for consistent date handling
  const timezone = getUserTimezone(req) || 'Asia/Kolkata';

  const todayQuery = buildTodayAttendanceQuery(
    authRole === 'employee' ? 'employee' : 'admin',
    effectiveUserId,
    effectiveEmployeeId,
    effectiveOrgId,
    authOrgId,
    new Date(),
    timezone
  );

  // Get today's date for storing in attendance record
  const today = getTodayInTimezone(timezone);
  const tomorrow = getTomorrowInTimezone(timezone);

  // Open session for today (not latest closed row — allows check-in again after checkout)
  const openSession = await Attendance.findOne(withOpenSessionFilter(todayQuery)).sort({ _id: -1 });

  if (openSession?.checkIn) {
    const hoursThisWeek = await sumHoursThisWeekForUser(
      effectiveUserId,
      effectiveOrgId,
      authOrgId
    );
    return res.status(200).json({
      success: true,
      message: 'Already checked in for this session.',
      data: {
        attendance: openSession,
        hoursThisWeek,
        weekKey: calendarWeekKey(),
      },
    });
  }

  const existingAttendance = await Attendance.findOne(todayQuery).sort({ _id: -1 });

  // IMPORTANT: Close any open breaks from previous days to prevent stale break status
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEnd = new Date(today);
  
  const previousAttendance = await Attendance.findOne({
    userId: effectiveUserId,
    ...buildOrgIdClause(effectiveOrgId, authOrgId),
    date: { $gte: yesterday, $lt: today },
  });

  if (previousAttendance && previousAttendance.breaks && previousAttendance.breaks.length > 0) {
    const lastBreak = previousAttendance.breaks[previousAttendance.breaks.length - 1];
    if (isOpenBreak(lastBreak)) {
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

  // Create new attendance record (or re-entry after earlier checkout today)
  let attendance;
  const isReEntry = Boolean(existingAttendance?.checkOut);
  try {
    const timezone = getUserTimezone(req) || 'Asia/Kolkata';
    
    attendance = await Attendance.create({
      userId: effectiveUserId,
      employeeId: effectiveEmployeeId,
      employeeName: effectiveEmployeeName,
      date: today,
      checkIn: new Date(),
      timezone,
      status: 'present',
      orgId: effectiveOrgId,
      checkInLocation: location || 'Office',
      checkInIP: req.ip || req.connection.remoteAddress,
      checkInNotes: notes,
      ...(isReEntry
        ? { isReEntry: true, previousAttendanceId: existingAttendance._id }
        : {}),
    });

    logger.info('Attendance check-in created successfully', {
      attendanceId: attendance._id,
      userId: effectiveUserId,
      employeeId: effectiveEmployeeId,
      orgId: effectiveOrgId,
      timezone,
      isReEntry,
    });
  } catch (createError) {
    const dupCode = createError?.code === 11000 || createError?.cause?.code === 11000;
    if (dupCode) {
      const recovered = await Attendance.findOne(withOpenSessionFilter(todayQuery)).sort({ _id: -1 });
      if (recovered?.checkIn) {
        const hoursThisWeek = await sumHoursThisWeekForUser(
          effectiveUserId,
          effectiveOrgId,
          authOrgId
        );
        return res.status(200).json({
          success: true,
          message: 'Already checked in for this session.',
          data: {
            attendance: recovered,
            hoursThisWeek,
            weekKey: calendarWeekKey(),
          },
        });
      }
    }
    logger.error('Failed to create attendance record', {
      userId: effectiveUserId,
      employeeId: effectiveEmployeeId,
      orgId: effectiveOrgId,
      error: createError.message
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to create attendance record',
      code: 'ATTENDANCE_CREATE_FAILED',
      details: createError.message
    });
  }

  await syncAttendanceHistoryFromRecord(attendance, {
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    employeeId: effectiveEmployeeId,
    updatedBy: effectiveUserId,
    isInsert: true,
  });

  const checkInSourceKey = `${attendance._id}-checkin-${new Date(attendance.checkIn).getTime()}`;
  try {
    const log = await ActivityLog.logActivity({
      userId: effectiveUserId,
      orgId: effectiveOrgId,
      action: 'attendance_checkin',
      entity: {
        entityType: 'attendance',
        entityId: attendance._id,
        entityName: `${effectiveEmployeeName} - Check In`,
      },
      details: {
        location: location || 'Office',
        notes,
        employeeName: effectiveEmployeeName,
        attendanceId: String(attendance._id),
        sourceKey: checkInSourceKey,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'low',
      category: 'user',
    });
    emitAttendanceActivityLog(req, log, effectiveOrgId);
  } catch (logError) {
    logger.warn('Failed to log check-in activity', { error: logError.message });
  }

  // Emit real-time update (this also emits KPI update internally)
  if (req.emitAttendanceUpdate) {
    req.emitAttendanceUpdate(attendance, effectiveOrgId);
  }

  const hoursThisWeek = await sumHoursThisWeekForUser(
    effectiveUserId,
    effectiveOrgId,
    authOrgId
  );

  res.status(201).json({
    success: true,
    message: 'Checked in successfully',
    data: {
      attendance,
      hoursThisWeek,
      weekKey: calendarWeekKey(),
    },
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
      checkInTime: attendance.checkIn,
      employeeName: effectiveEmployeeName
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
router.post('/check-out', authorize('super_admin', 'admin', 'hr', 'manager', 'employee', 'accountant'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { userId, employeeId, employeeName, orgId, location, notes } = req.body;
  const authUserId = req.user?.userId;
  const authOrgId = req.user?.orgId;
  const authRole = req.user?.role;

  let effectiveUserId = userId;
  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId || authOrgId;
  let effectiveEmployeeName = employeeName;

  if (authRole === 'employee') {
    const employee = await findEmployeeForSelfService(authUserId, authOrgId, {
      allowCrossOrgFallback: false,
      createIfMissing: true
    });
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Employee profile not found or inactive for authenticated user',
      });
    }
    effectiveUserId = authUserId;
    effectiveEmployeeId = employee._id;
    effectiveOrgId = String(employee.orgId || authOrgId);
    effectiveEmployeeName =
      `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
      employeeName ||
      'Employee';
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

  const timezone = getUserTimezone(req) || 'Asia/Kolkata';
  const todayQuery = buildTodayAttendanceQuery(
    authRole === 'employee' ? 'employee' : 'admin',
    effectiveUserId,
    effectiveEmployeeId,
    effectiveOrgId,
    authOrgId,
    new Date(),
    timezone
  );

  const hoursThisWeekBefore = await sumHoursThisWeekForUser(
    effectiveUserId,
    effectiveOrgId,
    authOrgId
  );

  let attendance = await Attendance.findOne(withOpenSessionFilter(todayQuery)).sort({ _id: -1 });
  // note: may be reassigned when auto-closing open breaks at checkout

  if (!attendance || !attendance.checkIn) {
    const lastClosed = await Attendance.findOne(todayQuery).sort({ _id: -1 });
    if (lastClosed?.checkOut) {
      return res.status(200).json({
        success: true,
        message: 'Already checked out. You can check in again to start a new session.',
        data: {
          attendance: lastClosed,
          hoursThisWeek: hoursThisWeekBefore,
          weekKey: calendarWeekKey(),
        },
      });
    }
    return res.status(400).json({
      success: false,
      message: 'No check-in found for today. Please check in first.',
    });
  }

  const checkOutTime = new Date();

  // Auto-close any open break at checkout so hours are accurate
  if (attendance.breaks?.some((b) => isOpenBreak(b))) {
    attendance = await endOpenBreakOnDocument(attendance, checkOutTime, 'Auto-ended at check-out');
    if (!attendance) {
      return res.status(500).json({
        success: false,
        message: 'Failed to close active break before check-out',
      });
    }
  }

  let hoursWorked = (checkOutTime - attendance.checkIn) / (1000 * 60 * 60);
  if (attendance.breaks?.length) {
    let totalBreakTime = 0;
    for (const breakItem of attendance.breaks) {
      if (breakItem.startTime && breakItem.endTime) {
        totalBreakTime +=
          (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60 * 60);
      }
    }
    hoursWorked -= totalBreakTime;
  }
  hoursWorked = Math.max(0, Math.round(hoursWorked * 100) / 100);

  // Atomic check-out — only succeeds if session is still open (prevents double checkout races)
  const updatedAttendance = await Attendance.findOneAndUpdate(
    {
      _id: attendance._id,
      ...OPEN_CHECKOUT_CONDITION,
    },
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
  )
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department');

  if (!updatedAttendance) {
    const closed = await Attendance.findById(attendance._id).lean();
    if (closed?.checkOut) {
      return res.status(200).json({
        success: true,
        message: 'Already checked out. You can check in again to start a new session.',
        data: {
          attendance: closed,
          hoursThisWeek: hoursThisWeekBefore,
          weekKey: calendarWeekKey(),
        },
      });
    }
    return res.status(409).json({
      success: false,
      message: 'Check-out conflict. Please refresh and try again.',
      code: 'CHECKOUT_CONFLICT',
    });
  }

  await syncAttendanceHistoryFromRecord(updatedAttendance, {
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    employeeId: effectiveEmployeeId,
    updatedBy: effectiveUserId,
  });

  const checkoutSourceKey = `${attendance._id}-checkout-${checkOutTime.getTime()}`;
  const checkoutLog = await ActivityLog.logActivity({
    userId: effectiveUserId,
    orgId: effectiveOrgId,
    action: 'attendance_checkout',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `${effectiveEmployeeName} - Check Out`,
    },
    details: {
      location: location || 'Office',
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      notes,
      employeeName: effectiveEmployeeName,
      attendanceId: String(attendance._id),
      sourceKey: checkoutSourceKey,
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user',
  });
  emitAttendanceActivityLog(req, checkoutLog, effectiveOrgId);

  // Emit real-time update (this also emits KPI update internally)
  if (req.emitAttendanceUpdate) {
    req.emitAttendanceUpdate(updatedAttendance, effectiveOrgId);
  }

  const hoursThisWeekAfterCheckout = await sumHoursThisWeekForUser(
    effectiveUserId,
    effectiveOrgId,
    authOrgId
  );

  res.json({
    success: true,
    message: 'Checked out successfully',
    data: {
      attendance: updatedAttendance,
      hoursThisWeek: hoursThisWeekAfterCheckout,
      weekKey: calendarWeekKey(),
    },
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
router.get('/', authorize('super_admin', 'admin', 'hr', 'manager', 'employee', 'accountant'), asyncHandler(async (req, res) => {
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
router.post('/break-start', authorize('super_admin', 'admin', 'hr', 'manager', 'employee', 'accountant'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, breakType = 'regular', notes, orgId, employeeName, idempotencyKey } = req.body;
  const currentUserId = req.user.userId;
  const authOrgId = req.user.orgId;
  const authRole = req.user.role;

  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId;
  let effectiveEmployeeName = employeeName;

  if (authRole === 'employee') {
    const employee = await findEmployeeForSelfService(currentUserId, authOrgId, {
      allowCrossOrgFallback: false,
      createIfMissing: true
    });
    if (!employee) {
      return res.status(403).json({ success: false, message: 'Employee profile not found or inactive for authenticated user' });
    }
    effectiveEmployeeId = employee._id;
    effectiveOrgId = String(employee.orgId || authOrgId);
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

  // ATOMIC OPERATION: Find and update in one operation to prevent race conditions
  const newBreak = {
    startTime: new Date(),
    breakType,
    notes,
    ipAddress: req.ip || req.connection.remoteAddress,
    idempotencyKey
  };

  try {
    const timezone = getUserTimezone(req) || 'Asia/Kolkata';
    const dayQuery = buildTodayAttendanceQuery(
      authRole,
      currentUserId,
      effectiveEmployeeId,
      effectiveOrgId,
      authOrgId,
      new Date(),
      timezone
    );

    const attendanceMatch = {
      ...withOpenSessionFilter(dayQuery),
      ...noOpenBreakFilter(),
      'meetingMode.isActive': { $ne: true },
    };

    const updatedAttendance = await Attendance.findOneAndUpdate(
      attendanceMatch,
      {
        $push: { breaks: newBreak }
      },
      { new: true, runValidators: false }
    ).select('_id employeeId orgId breaks meetingMode checkIn checkOut');

    if (!updatedAttendance) {
      const attendance = await Attendance.findOne(dayQuery)
        .sort({ _id: -1 })
        .select('_id checkIn checkOut breaks meetingMode');

      if (!attendance) {
        return res.status(400).json({
          success: false,
          message: 'No check-in found for today. Please check in first.'
        });
      }

      if (attendance.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'No active session. Check in again before starting a break.',
        });
      }

      if (attendance.breaks?.some((b) => isOpenBreak(b))) {
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

    const liveStatus = buildLiveStatus(updatedAttendance);
    const hoursThisWeek = await sumHoursThisWeekForUser(
      currentUserId,
      effectiveOrgId,
      authOrgId,
      effectiveEmployeeId
    );

    await syncAttendanceHistoryFromRecord(updatedAttendance, {
      userId: currentUserId,
      orgId: effectiveOrgId,
      employeeId: effectiveEmployeeId,
      updatedBy: currentUserId,
    });

    const openBreak = updatedAttendance.breaks?.find((b) => isOpenBreak(b));
    const breakStartTs = openBreak?.startTime ? new Date(openBreak.startTime).getTime() : Date.now();
    const breakIdx = updatedAttendance.breaks?.length ? updatedAttendance.breaks.length - 1 : 0;
    const breakSourceKey = `${updatedAttendance._id}-break-start-${breakIdx}-${breakStartTs}`;

    try {
      const breakLog = await ActivityLog.logActivity({
        userId: currentUserId,
        orgId: effectiveOrgId,
        action: 'attendance_break_start',
        entity: {
          entityType: 'attendance',
          entityId: updatedAttendance._id,
          entityName: `Break Started - ${breakType}`,
        },
        details: {
          breakType,
          notes,
          idempotencyKey,
          employeeName: effectiveEmployeeName,
          attendanceId: String(updatedAttendance._id),
          sourceKey: breakSourceKey,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'low',
        category: 'user',
      });
      emitAttendanceActivityLog(req, breakLog, effectiveOrgId);
    } catch (logErr) {
      logger.error('Failed to log break start activity', { error: logErr.message });
    }

    if (req.emitAttendanceUpdate) {
      req.emitAttendanceUpdate(updatedAttendance, effectiveOrgId);
    }

    if (global.io) {
      emitOrgRealtime(global.io, [effectiveOrgId, authOrgId], 'break:started', {
        employeeId: effectiveEmployeeId,
        userId: currentUserId,
        employeeName: effectiveEmployeeName,
        breakType,
        breakStartTime: openBreak?.startTime || newBreak.startTime,
        timestamp: new Date().toISOString(),
        attendance: updatedAttendance,
        liveStatus,
      });
      emitAttendanceKPIUpdate(global.io, effectiveOrgId, {
        action: 'break_start',
        employeeId: effectiveEmployeeId,
        status: 'on_break',
      }).catch((err) => logger.error('Failed to emit KPI update', { error: err.message }));
    }

    res.status(201).json({
      success: true,
      message: 'Break started successfully',
      data: {
        attendance: updatedAttendance,
        liveStatus,
        hoursThisWeek,
        weekKey: calendarWeekKey(),
      },
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
router.post('/break-end', authorize('super_admin', 'admin', 'hr', 'manager', 'employee', 'accountant'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, notes, orgId, employeeName, idempotencyKey } = req.body;
  const currentUserId = req.user.userId;
  const authOrgId = req.user.orgId;
  const authRole = req.user.role;

  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = orgId;
  let effectiveEmployeeName = employeeName;

  if (authRole === 'employee') {
    const employee = await findEmployeeForSelfService(currentUserId, authOrgId, {
      allowCrossOrgFallback: false,
      createIfMissing: true
    });
    if (!employee) {
      return res.status(403).json({ success: false, message: 'Employee profile not found or inactive for authenticated user' });
    }
    effectiveEmployeeId = employee._id;
    effectiveOrgId = String(employee.orgId || authOrgId);
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

  effectiveOrgId = String(effectiveOrgId);

  try {
    // SAFE BREAK-END LOGIC: Use JavaScript to safely close the open break
    // Avoids fragile arrayFilters syntax that can cause query errors
    const endTime = new Date();

    const timezone = getUserTimezone(req) || 'Asia/Kolkata';
    const dayQuery = buildTodayAttendanceQuery(
      authRole,
      currentUserId,
      effectiveEmployeeId,
      effectiveOrgId,
      authOrgId,
      new Date(),
      timezone
    );

    logger.info('Break-end: Finding attendance record', {
      userId: currentUserId,
      employeeId: effectiveEmployeeId,
      orgId: effectiveOrgId
    });

    // Find today's attendance record
    let attendance = await Attendance.findOne(dayQuery).sort({ _id: -1 });

    if (!attendance) {
      logger.warn('Break-end: No attendance record found', {
        userId: currentUserId,
        employeeId: effectiveEmployeeId,
        orgId: effectiveOrgId
      });
      return res.status(400).json({
        success: false,
        message: 'No attendance record found for today.',
      });
    }

    logger.debug('Break-end: Found attendance record', {
      attendanceId: attendance._id,
      breaksCount: attendance.breaks?.length || 0
    });

    // Check if there's an open break
    const openBreakIndex = attendance.breaks?.findIndex(b => isOpenBreak(b)) ?? -1;
    
    if (openBreakIndex < 0) {
      // No open break to end
      logger.info('Break-end: No open break found', {
        attendanceId: attendance._id,
        breaksCount: attendance.breaks?.length || 0
      });
      const liveStatus = buildLiveStatus(attendance);
      return res.status(200).json({
        success: true,
        message: 'No active break found to end.',
        data: { attendance, liveStatus },
      });
    }

    logger.info('Break-end: Found open break', {
      attendanceId: attendance._id,
      breakIndex: openBreakIndex,
      breakStartTime: attendance.breaks[openBreakIndex].startTime
    });

    // Close the open break
    attendance.breaks[openBreakIndex].endTime = endTime;
    const breakDurationMins = Math.round(
      (endTime.getTime() - new Date(attendance.breaks[openBreakIndex].startTime).getTime()) / (1000 * 60)
    );
    attendance.breaks[openBreakIndex].duration = Math.max(0, breakDurationMins);
    
    logger.debug('Break-end: Updated break object', {
      duration: breakDurationMins,
      endTime: endTime.toISOString()
    });

    // Save the document
    attendance.markModified('breaks');
    logger.debug('Break-end: Marked breaks as modified, calling save()');
    
    const updatedAttendance = await attendance.save();

    logger.info('Break-end: Attendance saved successfully', {
      attendanceId: updatedAttendance._id
    });

    // Re-fetch with populated fields for response
    const attendanceForResponse = await Attendance.findById(updatedAttendance._id)
      .populate('userId', 'name email avatar')
      .populate('employeeId', 'employeeCode department');

    if (!attendanceForResponse) {
      logger.error('Break-end: Failed to fetch updated attendance after save', {
        attendanceId: updatedAttendance._id
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve updated attendance record.',
      });
    }

    const liveStatus = buildLiveStatus(attendanceForResponse);

    // Get the closed break info
    const closedBreak = attendanceForResponse.breaks[openBreakIndex];
    const breakDurationMins2 = closedBreak?.duration || 0;

    await syncAttendanceHistoryFromRecord(attendanceForResponse, {
      userId: currentUserId,
      orgId: effectiveOrgId,
      employeeId: effectiveEmployeeId,
      updatedBy: currentUserId,
    });

    const breakEndTs = closedBreak?.endTime
      ? new Date(closedBreak.endTime).getTime()
      : endTime.getTime();
    const breakEndSourceKey = `${attendanceForResponse._id}-break-end-${openBreakIndex}-${breakEndTs}`;

    try {
      const breakEndLog = await ActivityLog.logActivity({
        userId: currentUserId,
        orgId: effectiveOrgId,
        action: 'attendance_break_end',
        entity: {
          entityType: 'attendance',
          entityId: attendanceForResponse._id,
          entityName: `Break Ended - ${breakDurationMins2} minutes`,
        },
        details: {
          duration: breakDurationMins2,
          notes,
          idempotencyKey,
          employeeName: effectiveEmployeeName,
          attendanceId: String(attendanceForResponse._id),
          sourceKey: breakEndSourceKey,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'low',
        category: 'user',
      });
      emitAttendanceActivityLog(req, breakEndLog, effectiveOrgId);
    } catch (logErr) {
      logger.error('Failed to log break end activity', { error: logErr.message });
    }

    if (req.emitAttendanceUpdate) {
      req.emitAttendanceUpdate(attendanceForResponse, effectiveOrgId);
    }

    if (global.io) {
      emitOrgRealtime(global.io, [effectiveOrgId, authOrgId], 'break:ended', {
        employeeId: effectiveEmployeeId,
        userId: currentUserId,
        employeeName: effectiveEmployeeName,
        breakType: closedBreak?.breakType || 'regular',
        breakStartTime: closedBreak?.startTime,
        breakEndTime: closedBreak?.endTime || endTime,
        timestamp: new Date().toISOString(),
        breakDuration: breakDurationMins2,
        attendance: attendanceForResponse,
        liveStatus,
      });
      emitAttendanceKPIUpdate(global.io, effectiveOrgId, {
        action: 'break_end',
        employeeId: effectiveEmployeeId,
        status: 'checked_in',
      }).catch((err) => logger.error('Failed to emit KPI update', { error: err.message }));
    }

    const hoursThisWeekAfterBreak = await sumHoursThisWeekForUser(
      currentUserId,
      effectiveOrgId,
      authOrgId
    );

    res.json({
      success: true,
      message: 'Break ended successfully',
      data: {
        attendance: attendanceForResponse,
        liveStatus,
        hoursThisWeek: hoursThisWeekAfterBreak,
        weekKey: calendarWeekKey(),
      },
    });

  } catch (err) {
    logger.error('Break end operation failed', { 
      error: err.message,
      errorName: err.name,
      errorStack: err.stack?.split('\n')[0],
      employeeId: effectiveEmployeeId,
      orgId: effectiveOrgId
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to end break. Please try again.',
      error: err.message
    });
  }
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
  const orgMatch = buildOrgIdFlexible(userOrgId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Fetch only records that are likely on active break
  const attendanceRecords = await Attendance.find({
    ...orgMatch,
    date: { $gte: today, $lt: tomorrow },
    checkIn: { $exists: true, $ne: null },
    $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
    breaks: {
      $elemMatch: {
        startTime: { $exists: true, $ne: null },
        $or: [{ endTime: { $exists: false } }, { endTime: null }]
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
        breakEndTime: lastBreak.endTime || null,
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
 * GET /api/attendance/today-breaks
 * All break start/end events for today (admin dashboard table)
 */
router.get('/today-breaks', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const orgMatch = buildOrgIdFlexible(req.user.orgId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendanceRecords = await Attendance.find({
    ...orgMatch,
    date: { $gte: today, $lt: tomorrow },
    'breaks.0': { $exists: true },
  })
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .select('userId employeeId breaks')
    .lean();

  const rows = [];
  for (const record of attendanceRecords) {
    const employeeName = record.userId?.name || 'Unknown';
    const department = record.employeeId?.department || 'N/A';
    const designation = record.employeeId?.designation || 'N/A';

    (record.breaks || []).forEach((b, breakIndex) => {
      if (!b?.startTime) return;
      const start = new Date(b.startTime);
      const end = b.endTime ? new Date(b.endTime) : null;
      const duration =
        typeof b.duration === 'number'
          ? b.duration
          : end
            ? Math.round((end.getTime() - start.getTime()) / (1000 * 60))
            : null;

      rows.push({
        attendanceId: record._id,
        employeeId: record.employeeId?._id,
        employeeName,
        department,
        designation,
        breakIndex,
        breakType: b.breakType || 'regular',
        startTime: b.startTime,
        endTime: b.endTime || null,
        duration,
        status: end ? 'ended' : 'active',
      });
    });
  }

  rows.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  res.json({
    success: true,
    data: rows,
    count: rows.length,
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
router.get('/bulk-export', authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, employeeId, status } = req.query;
    const userOrgId = userOrgIdFromReq(req) || req.validatedOrgId || req.user.orgId;
    if (!userOrgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context required',
        code: 'ORG_REQUIRED',
      });
    }

    // Build query
    const query = { orgId: String(userOrgId) };

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
      .populate({
        path: 'employeeId',
        select: 'employeeCode firstName lastName userId',
        populate: { path: 'userId', select: 'email' },
      })
      .sort({ date: -1 })
      .lean();

    // Validate records exist
    if (!records || records.length === 0) {
      logger.warn('No attendance records found for export', {
        userId: req.user.userId,
        filters: { startDate, endDate, employeeId, status }
      });
      
      // Still return CSV with just headers
      const csvHeaders = ['Employee ID', 'Employee Name', 'Email', 'Date', 'Check In', 'Check Out', 'Status', 'Hours Worked', 'Break Count', 'Total Break Minutes', 'Notes'];
      const csvContent = csvHeaders.join(',');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-export-${new Date().toISOString().split('T')[0]}-empty.csv"`);
      res.send(csvContent);
      return;
    }

    // Convert to CSV format
    const csvHeaders = ['Employee ID', 'Employee Name', 'Email', 'Date', 'Check In', 'Check Out', 'Status', 'Hours Worked', 'Break Count', 'Total Break Minutes', 'Notes'];
    const csvRows = records.map(record => {
      const breaks = record.breaks || [];
      const completedBreaks = breaks.filter(b => b.startTime && b.endTime);
      const totalBreakMinutes = completedBreaks.reduce((sum, b) => {
        const start = new Date(b.startTime);
        const end = new Date(b.endTime);
        return sum + Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      }, 0);
      
      return [
        record.employeeId?.employeeCode || '',
        record.employeeName || '',
        record.employeeId?.userId?.email || record.employeeEmail || '',
        new Date(record.date).toISOString().split('T')[0],
        record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '',
        record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '',
        record.status || '',
        record.hoursWorked || '',
        completedBreaks.length || 0,
        totalBreakMinutes || 0,
        record.notes || ''
      ];
    });

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

/**
 * POST /api/attendance/:attendanceId/status
 * Update attendance status (admin, hr, super_admin only)
 * Request body: { status, reason }
 * Allowed statuses: "present", "absent", "on-leave", "approved-leave", "lwp", "comp-off", "ncns", "sandwich-leave"
 */
router.post('/:attendanceId/status', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const attendanceId = req.params.attendanceId;
  const currentUserId = req.user.userId;
  const authOrgId = req.user.orgId;
  const authRole = req.user.role;

  // Validate status
  const allowedStatuses = ['present', 'absent', 'on-leave', 'approved-leave', 'lwp', 'comp-off', 'ncns', 'sandwich-leave'];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
      code: 'INVALID_STATUS'
    });
  }

  try {
    // Find the attendance record
    const attendance = await Attendance.findById(attendanceId);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
        code: 'RECORD_NOT_FOUND'
      });
    }

    // Validate org isolation - user can only update attendance in their org
    if (String(attendance.orgId) !== String(authOrgId) && authRole !== 'super_admin') {
      logger.warn('Organization scope violation attempted on attendance status update', {
        recordOrgId: attendance.orgId,
        authOrgId,
        role: authRole,
        userId: currentUserId,
        attendanceId
      });
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update attendance in this organization',
        code: 'ORG_MISMATCH'
      });
    }

    // Update attendance record
    const now = new Date();
    attendance.status = status;
    attendance.statusChangedBy = currentUserId;
    attendance.statusChangedAt = now;
    attendance.statusChangeReason = reason || null;
    
    await attendance.save();

    // Log activity
    try {
      const employeeName = attendance.employeeName || 'Employee';
      const log = await ActivityLog.logActivity({
        userId: currentUserId,
        orgId: attendance.orgId,
        action: 'attendance_status_updated',
        entity: {
          entityType: 'attendance',
          entityId: attendance._id,
          entityName: `${employeeName} - Status Updated to ${status}`,
        },
        details: {
          previousStatus: attendance.status,
          newStatus: status,
          reason: reason || null,
          employeeName: employeeName,
          attendanceId: String(attendance._id),
          date: attendance.date,
          changedBy: currentUserId,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'medium',
        category: 'admin',
      });
      
      // Emit activity log in real-time
      if (req.emitActivityUpdate) {
        req.emitActivityUpdate(log, attendance.orgId);
      }
    } catch (logError) {
      logger.warn('Failed to log attendance status update activity', { error: logError.message });
    }

    // Sync to attendance history
    try {
      await syncAttendanceHistoryFromRecord(attendance, {
        userId: attendance.userId,
        orgId: attendance.orgId,
        employeeId: attendance.employeeId,
        updatedBy: currentUserId,
      });
    } catch (syncError) {
      logger.warn('Failed to sync attendance history after status update', { error: syncError.message });
    }

    // Emit real-time update
    if (req.emitAttendanceUpdate) {
      req.emitAttendanceUpdate(attendance, attendance.orgId);
    }

    // Emit KPI update to admin dashboard
    if (global.io) {
      emitAttendanceKPIUpdate(global.io, attendance.orgId, {
        action: 'status_updated',
        employeeId: attendance.employeeId,
        status: status
      }).catch(err => logger.error('Failed to emit KPI update on status change', { error: err.message }));
    }

    logger.info('Attendance status updated successfully', {
      attendanceId: attendance._id,
      newStatus: status,
      changedBy: currentUserId,
      orgId: attendance.orgId,
      reason: reason || null
    });

    // Return updated attendance record (populated)
    const updatedRecord = await Attendance.findById(attendanceId)
      .populate('userId', 'name email')
      .populate('employeeId', 'employeeCode department')
      .populate('statusChangedBy', 'name email')
      .lean();

    res.json({
      success: true,
      message: `Attendance status updated to ${status}`,
      data: updatedRecord
    });

  } catch (error) {
    logger.error('Failed to update attendance status', {
      error: error.message,
      attendanceId,
      userId: currentUserId,
      orgId: authOrgId
    });
    res.status(500).json({
      success: false,
      message: 'Failed to update attendance status',
      code: 'STATUS_UPDATE_FAILED',
      details: error.message
    });
  }
}));

/**
 * GET /api/attendance/record/:id
 * Full attendance record for admin view dialog
 */
router.get('/record/:id', authorize('super_admin', 'admin', 'hr', 'manager'), asyncHandler(async (req, res) => {
  const userOrgId = req.user.orgId;
  const record = await Attendance.findOne({ _id: req.params.id, orgId: userOrgId })
    .populate('userId', 'name email')
    .populate('employeeId', 'employeeCode department')
    .lean();

  if (!record) {
    return res.status(404).json({
      success: false,
      message: 'Attendance record not found',
    });
  }

  let hoursWorked = record.hoursWorked ?? 0;
  if (record.checkIn && record.checkOut) {
    let calculatedHours =
      (new Date(record.checkOut) - new Date(record.checkIn)) / (1000 * 60 * 60);
    if (record.breaks?.length) {
      record.breaks.forEach((breakItem) => {
        if (breakItem.startTime && breakItem.endTime) {
          calculatedHours -=
            (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60 * 60);
        }
      });
    }
    hoursWorked = Math.max(0, Math.round(calculatedHours * 100) / 100);
  }

  res.json({
    success: true,
    data: {
      ...record,
      employeeName:
        record.employeeName ||
        record.userId?.name ||
        'Employee',
      employeeEmail: record.userId?.email,
      department: record.employeeId?.department,
      employeeCode: record.employeeId?.employeeCode,
      hoursWorked,
    },
  });
}));

export default router;




