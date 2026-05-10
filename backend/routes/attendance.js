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
import { emitKPIUpdate } from '../utils/kpiUpdater.js';
import EmailNotificationService from '../utils/emailNotificationService.js';

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

  console.log('GET /today - Fetching attendance for:', { currentUserId, userOrgId });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log('Query date range:', { today, tomorrow });

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

  console.log('Attendance query result (by userId):', {
    found: !!attendance,
    userId: attendance?.userId,
    orgId: attendance?.orgId,
    checkIn: attendance?.checkIn,
    checkOut: attendance?.checkOut,
    status: attendance?.status,
    breaksCount: attendance?.breaks?.length || 0,
    breaks: attendance?.breaks
  });

  // If not found by userId, try to find all records for this date to debug
  if (!attendance) {
    console.log('No attendance found by userId, checking all records for this date...');
    const allRecords = await Attendance.find({
      orgId: userOrgId,
      date: { $gte: today, $lt: tomorrow }
    }).lean();
    console.log('All attendance records for this date:', allRecords.length);
    allRecords.forEach(record => {
      console.log('Record:', {
        userId: record.userId,
        orgId: record.orgId,
        checkIn: record.checkIn,
        status: record.status
      });
    });
  }

  // Calculate live status
  let liveStatus = 'not_checked_in';
  let currentHours = 0;
  let isOnBreak = false;
  let isInMeeting = false;
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
        console.log('📊 [TODAY-ENDPOINT] Checking last break:', {
          startTime: lastBreak.startTime,
          endTime: lastBreak.endTime,
          hasStartTime: !!lastBreak.startTime,
          hasEndTime: !!lastBreak.endTime,
          isActive: !!lastBreak.startTime && !lastBreak.endTime
        });
        
        if (lastBreak.startTime && !lastBreak.endTime) {
          isOnBreak = true;
          currentBreakDuration = (now - lastBreak.startTime) / (1000 * 60);
          liveStatus = 'on_break';
          console.log('📊 [TODAY-ENDPOINT] Employee is ON BREAK');
        } else {
          console.log('📊 [TODAY-ENDPOINT] Employee is NOT on break');
        }
      }

      // Check if in meeting
      if (attendance.meetingMode?.isActive) {
        isInMeeting = true;
        liveStatus = 'in_meeting';
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

  console.log('📊 [TODAY-ENDPOINT] Final response:', {
    hasAttendance: !!attendance,
    liveStatus: liveStatus,
    isOnBreak: isOnBreak,
    currentBreakDuration: Math.round(currentBreakDuration),
    breaksCount: attendance?.breaks?.length
  });

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
        isInMeeting,
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
  
  console.log('CHECK-IN REQUEST:', {
    bodyUserId: userId,
    bodyEmployeeId: employeeId,
    bodyOrgId: orgId,
    authUserId: req.user?.userId,
    authOrgId: req.user?.orgId
  });
  
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

  console.log('CHECK-IN DATE RANGE:', { today, tomorrow });

  // Check if already checked in today
  const existingAttendance = await Attendance.findOne({
    userId,
    orgId,
    date: { $gte: today, $lt: tomorrow }
  });

  console.log('EXISTING ATTENDANCE CHECK:', {
    found: !!existingAttendance,
    checkIn: existingAttendance?.checkIn,
    checkOut: existingAttendance?.checkOut
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

  console.log('ATTENDANCE CREATED:', {
    id: attendance._id,
    userId: attendance.userId,
    orgId: attendance.orgId,
    checkIn: attendance.checkIn,
    date: attendance.date
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

  // Emit KPI update for real-time dashboard refresh
  await emitKPIUpdate(req.io, orgId, 'check_in', {
    employeeId,
    employeeName
  });

  // Send response first to confirm check-in
  res.status(201).json({
    success: true,
    message: 'Checked in successfully',
    data: attendance
  });

  // Send check-in notification to HR AFTER check-in is confirmed
  try {
    const hrEmail = process.env.HR_EMAIL || 'hr@hexerve.com';
    console.log('📧 SENDING CHECK-IN EMAIL TO HR:', { hrEmail, employeeId });
    
    const employee = await Employee.findById(employeeId)
      .select('firstName lastName email employeeCode department userId')
      .populate('userId', 'name email')
      .lean();
    
    console.log('📧 EMPLOYEE DATA FETCHED:', {
      found: !!employee,
      firstName: employee?.firstName,
      lastName: employee?.lastName,
      email: employee?.email,
      userId: employee?.userId,
      userEmail: employee?.userId?.email
    });
    
    if (employee && hrEmail) {
      // Get name from employee - use firstName and lastName
      const empName = employee.firstName && employee.lastName 
        ? `${employee.firstName} ${employee.lastName}`
        : employee.userId?.name || employeeName;
      
      const employeeEmail = employee.userId?.email || employee.email;
      
      console.log('📧 PREPARED EMAIL DATA:', {
        empName,
        employeeEmail,
        hrEmail,
        checkInTime: attendance.checkIn
      });
      
      if (employeeEmail) {
        console.log('📧 SENDING EMAIL FROM:', employeeEmail, 'TO:', hrEmail);
        const result = await EmailNotificationService.sendCheckInNotificationToHR(
          {
            name: empName,
            email: employeeEmail,
            employeeCode: employee.employeeCode,
            department: employee.department
          },
          attendance.checkIn,
          hrEmail
        );
        console.log('📧 EMAIL SEND RESULT:', result);
        logger.info('Check-in notification sent to HR', {
          employeeName: empName,
          employeeEmail: employeeEmail,
          hrEmail,
          checkInTime: attendance.checkIn
        });
      } else {
        console.log('⚠️ NO EMPLOYEE EMAIL FOUND');
      }
    } else {
      console.log('⚠️ EMPLOYEE NOT FOUND OR NO HR EMAIL');
    }
  } catch (emailError) {
    console.log('❌ EMAIL ERROR:', emailError);
    logger.error('Failed to send check-in notification to HR', {
      error: emailError.message,
      employeeName
    });
    // Don't fail the check-in if email fails - it's already confirmed
  }
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

  // Emit KPI update for real-time dashboard refresh
  await emitKPIUpdate(req.io, orgId, 'check_out', {
    employeeId,
    employeeName,
    hoursWorked: Math.round(hoursWorked * 100) / 100
  });

  // Send response first to confirm check-out
  res.json({
    success: true,
    message: 'Checked out successfully',
    data: updatedAttendance
  });

  // Send check-out notification to HR AFTER check-out is confirmed
  try {
    const hrEmail = process.env.HR_EMAIL || 'hr@hexerve.com';
    console.log('📧 SENDING CHECK-OUT EMAIL TO HR:', { hrEmail, employeeId });
    
    const employee = await Employee.findById(employeeId)
      .select('firstName lastName email employeeCode department userId')
      .populate('userId', 'name email')
      .lean();
    
    console.log('📧 EMPLOYEE DATA FETCHED:', {
      found: !!employee,
      firstName: employee?.firstName,
      lastName: employee?.lastName,
      email: employee?.email,
      userId: employee?.userId,
      userEmail: employee?.userId?.email
    });
    
    if (employee && hrEmail) {
      // Get name from employee - use firstName and lastName
      const empName = employee.firstName && employee.lastName 
        ? `${employee.firstName} ${employee.lastName}`
        : employee.userId?.name || employeeName;
      
      const employeeEmail = employee.userId?.email || employee.email;
      
      console.log('📧 PREPARED EMAIL DATA:', {
        empName,
        employeeEmail,
        hrEmail,
        checkOutTime: new Date(),
        hoursWorked: Math.round(hoursWorked * 100) / 100
      });
      
      if (employeeEmail) {
        console.log('📧 SENDING EMAIL FROM:', employeeEmail, 'TO:', hrEmail);
        await EmailNotificationService.sendCheckOutNotificationToHR(
          {
            name: empName,
            email: employeeEmail,
            employeeCode: employee.employeeCode,
            department: employee.department
          },
          new Date(),
          Math.round(hoursWorked * 100) / 100,
          hrEmail
        );
        logger.info('Check-out notification sent to HR', {
          employeeName: empName,
          employeeEmail: employeeEmail,
          hrEmail,
          checkOutTime: new Date(),
          hoursWorked: Math.round(hoursWorked * 100) / 100
        });
      } else {
        console.log('⚠️ NO EMPLOYEE EMAIL FOUND');
      }
    } else {
      console.log('⚠️ EMPLOYEE NOT FOUND OR NO HR EMAIL');
    }
  } catch (emailError) {
    console.log('❌ EMAIL ERROR:', emailError);
    logger.error('Failed to send check-out notification to HR', {
      error: emailError.message,
      employeeName
    });
    // Don't fail the check-out if email fails - it's already confirmed
  }
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
 * Start a break
 */
router.post('/break-start', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, breakType = 'regular', notes, orgId, employeeName } = req.body;
  const currentUserId = req.user.userId;

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    employeeId,
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
      message: 'Already checked out. Cannot start break.'
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

  // Check if in meeting
  if (attendance.meetingMode?.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Cannot start break while in meeting. End meeting first.'
    });
  }

  // Add new break
  const newBreak = {
    startTime: new Date(),
    breakType,
    notes,
    ipAddress: req.ip || req.connection.remoteAddress
  };

  console.log('☕ [BREAK-START] Adding new break:', {
    attendanceId: attendance._id,
    employeeId,
    breakType,
    startTime: newBreak.startTime,
    currentBreaksCount: attendance.breaks?.length || 0
  });

  const updatedAttendance = await Attendance.findByIdAndUpdate(
    attendance._id,
    {
      $push: { breaks: newBreak }
    },
    { new: true }
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  console.log('☕ [BREAK-START] Break saved to database:', {
    attendanceId: updatedAttendance._id,
    totalBreaks: updatedAttendance.breaks?.length,
    lastBreak: updatedAttendance.breaks?.[updatedAttendance.breaks.length - 1],
    hasActiveBreak: updatedAttendance.breaks?.some(b => b.startTime && !b.endTime)
  });

  // Log activity
  await ActivityLog.logActivity({
    userId: currentUserId,
    orgId,
    action: 'attendance_break_start',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `Break Started - ${breakType}`
    },
    details: {
      breakType,
      notes
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user'
  });

  // Emit real-time event to notify admin dashboard
  console.log('☕ [BREAK-START] Emitting attendance update for orgId:', orgId);
  req.emitAttendanceUpdate(updatedAttendance, orgId);
  
  // Emit KPI update for real-time dashboard refresh
  console.log('☕ [BREAK-START] Calling emitKPIUpdate with:', { orgId, employeeId, employeeName, breakType });
  await emitKPIUpdate(req.io, orgId, 'break_start', {
    employeeId,
    employeeName,
    breakType
  });
  console.log('☕ [BREAK-START] emitKPIUpdate completed');
  
  // Also emit a direct Socket.IO event for immediate dashboard refresh
  if (req.io) {
    console.log('☕ [BREAK-START] Emitting break:started event to tenant_' + orgId);
    req.io.to(`tenant_${orgId}`).emit('break:started', {
      employeeId: employeeId,
      employeeName: employeeName,
      breakType: breakType,
      timestamp: new Date()
    });
    console.log('☕ [BREAK-START] break:started event emitted');
  }

  res.status(201).json({
    success: true,
    message: 'Break started successfully',
    data: updatedAttendance
  });
}));

/**
 * POST /api/attendance/break-end
 * End a break
 */
router.post('/break-end', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, notes, orgId, employeeName } = req.body;
  const currentUserId = req.user.userId;

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    employeeId,
    orgId,
    date: { $gte: today, $lt: tomorrow }
  }).sort({ _id: -1 });

  console.log('☕ [BREAK-END] Found attendance record:', {
    found: !!attendance,
    id: attendance?._id,
    employeeId: attendance?.employeeId,
    breaksCount: attendance?.breaks?.length,
    breaks: attendance?.breaks
  });

  if (!attendance) {
    return res.status(400).json({
      success: false,
      message: 'No attendance record found for today.'
    });
  }

  // Find active break
  const activeBreakIndex = attendance.breaks?.findIndex(b => b.startTime && !b.endTime);
  
  console.log('☕ [BREAK-END] Active break search:', {
    activeBreakIndex,
    totalBreaks: attendance.breaks?.length,
    allBreaks: attendance.breaks?.map((b, idx) => ({
      index: idx,
      startTime: b.startTime,
      endTime: b.endTime,
      isActive: !!b.startTime && !b.endTime
    }))
  });
  
  if (activeBreakIndex === -1 || activeBreakIndex === undefined) {
    return res.status(400).json({
      success: false,
      message: 'No active break found to end.'
    });
  }

  // End the break
  const endTime = new Date();
  const breakDuration = (endTime - attendance.breaks[activeBreakIndex].startTime) / (1000 * 60);

  const updateQuery = {
    $set: {
      [`breaks.${activeBreakIndex}.endTime`]: endTime,
      [`breaks.${activeBreakIndex}.duration`]: Math.round(breakDuration),
      [`breaks.${activeBreakIndex}.endNotes`]: notes
    }
  };

  const updatedAttendance = await Attendance.findByIdAndUpdate(
    attendance._id,
    updateQuery,
    { new: true }
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  // Log activity
  await ActivityLog.logActivity({
    userId: currentUserId,
    orgId,
    action: 'attendance_break_end',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `Break Ended - ${Math.round(breakDuration)} minutes`
    },
    details: {
      duration: Math.round(breakDuration),
      notes
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user'
  });

  console.log('☕ [BREAK-END] Updated attendance record:', {
    id: updatedAttendance._id,
    employeeId: updatedAttendance.employeeId,
    breaksCount: updatedAttendance.breaks?.length,
    lastBreak: updatedAttendance.breaks?.[updatedAttendance.breaks.length - 1],
    hasActiveBreak: updatedAttendance.breaks?.some(b => b.startTime && !b.endTime)
  });

  // Emit real-time event to notify admin dashboard
  req.emitAttendanceUpdate(updatedAttendance, orgId);
  
  // Emit KPI update for real-time dashboard refresh
  await emitKPIUpdate(req.io, orgId, 'break_end', {
    employeeId,
    employeeName,
    breakDuration: Math.round(breakDuration)
  });
  
  // Also emit a direct Socket.IO event for immediate dashboard refresh
  if (req.io) {
    console.log('☕ [BREAK-END] Emitting break:ended event');
    req.io.to(`tenant_${orgId}`).emit('break:ended', {
      employeeId: employeeId,
      employeeName: employeeName,
      breakDuration: Math.round(breakDuration),
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    message: 'Break ended successfully',
    data: updatedAttendance
  });
}));

/**
 * POST /api/attendance/meeting-start
 * Start a meeting
 */
router.post('/meeting-start', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, meetingTitle = 'Meeting', meetingType = 'internal', notes, orgId } = req.body;
  const currentUserId = req.user.userId;

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    employeeId,
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
      message: 'Already checked out. Cannot start meeting.'
    });
  }

  // Check if already in meeting
  if (attendance.meetingMode?.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Already in a meeting. Please end current meeting first.'
    });
  }

  // Check if on break - cannot start meeting while on break
  const currentBreak = attendance.breaks?.find(b => b.startTime && !b.endTime);
  if (currentBreak) {
    // Try to auto-end the break
    console.log('Active break found, attempting to auto-end it...');
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
        console.log('Break auto-ended successfully');
      } catch (error) {
        console.error('Failed to auto-end break:', error);
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
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  // Log activity
  await ActivityLog.logActivity({
    userId: currentUserId,
    orgId,
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
  });

  res.status(201).json({
    success: true,
    message: 'Meeting started successfully',
    data: updatedAttendance
  });
}));

/**
 * POST /api/attendance/meeting-end
 * End a meeting
 */
router.post('/meeting-end', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, notes, orgId } = req.body;
  const currentUserId = req.user.userId;

  if (!employeeId || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeId, orgId'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find today's attendance record
  const attendance = await Attendance.findOne({
    employeeId,
    orgId,
    date: { $gte: today, $lt: tomorrow }
  }).sort({ _id: -1 });

  if (!attendance || !attendance.meetingMode?.isActive) {
    return res.status(400).json({
      success: false,
      message: 'No active meeting found to end.'
    });
  }

  // End the meeting
  const endTime = new Date();
  const meetingDuration = (endTime - attendance.meetingMode.startTime) / (1000 * 60);

  // Find the index of the last meeting (which should be the active one)
  const meetingIndex = attendance.meetings?.length ? attendance.meetings.length - 1 : -1;

  const updateFields = {
    'meetingMode.isActive': false,
    'meetingMode.endTime': endTime,
    'meetingMode.duration': Math.round(meetingDuration),
    'meetingMode.endNotes': notes
  };

  if (meetingIndex !== -1) {
    updateFields[`meetings.${meetingIndex}.endTime`] = endTime;
    updateFields[`meetings.${meetingIndex}.duration`] = Math.round(meetingDuration);
  }

  const updatedAttendance = await Attendance.findByIdAndUpdate(
    attendance._id,
    { $set: updateFields },
    { new: true }
  ).populate('userId', 'name email avatar')
   .populate('employeeId', 'employeeCode department');

  // Log activity
  await ActivityLog.logActivity({
    userId: currentUserId,
    orgId,
    action: 'attendance_meeting_end',
    entity: {
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: `Meeting Ended - ${Math.round(meetingDuration)} minutes`
    },
    details: {
      meetingTitle: attendance.meetingMode.meetingTitle,
      duration: Math.round(meetingDuration),
      notes
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'low',
    category: 'user'
  });

  res.json({
    success: true,
    message: 'Meeting ended successfully',
    data: updatedAttendance
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

  console.log('🔍 [ON-BREAK] Fetching employees on break for org:', userOrgId);
  console.log('🔍 [ON-BREAK] Date range:', { today, tomorrow });

  // Find all attendance records for today
  const attendanceRecords = await Attendance.find({
    orgId: userOrgId,
    date: { $gte: today, $lt: tomorrow },
    checkIn: { $exists: true, $ne: null },
    checkOut: { $exists: false }
  })
  .populate('userId', 'name email avatar')
  .populate('employeeId', 'employeeCode department designation')
  .lean();

  console.log('🔍 [ON-BREAK] Total attendance records found:', attendanceRecords.length);
  console.log('🔍 [ON-BREAK] Attendance records:', attendanceRecords.map(r => ({
    employeeName: r.userId?.name,
    breaks: r.breaks,
    checkIn: r.checkIn,
    checkOut: r.checkOut
  })));

  // Filter employees currently on break
  const employeesOnBreak = attendanceRecords
    .filter(record => {
      if (!record.breaks || record.breaks.length === 0) {
        console.log('🔍 [ON-BREAK] Employee', record.userId?.name, 'has no breaks');
        return false;
      }
      
      // Check if the last break has no end time (currently on break)
      const lastBreak = record.breaks[record.breaks.length - 1];
      const isOnBreak = lastBreak.startTime && !lastBreak.endTime;
      console.log('🔍 [ON-BREAK] Employee', record.userId?.name, 'last break:', lastBreak, 'isOnBreak:', isOnBreak);
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

  console.log('🔍 [ON-BREAK] Employees on break:', employeesOnBreak.length);

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

