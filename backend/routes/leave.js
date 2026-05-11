/**
 * Leave Request Routes with Pagination and Optimistic Locking
 * P0 Critical Fixes Applied:
 * - Pagination for large datasets
 * - .lean() for read-only queries
 * - Optimistic locking for approvals/rejections
 * - Idempotency for critical operations
 */

import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';
import EmailNotificationService from '../utils/emailNotificationService.js';

const router = express.Router();

// Apply pagination middleware
router.use(paginationMiddleware);

/**
 * GET /api/leave-requests
 * List leave requests with pagination
 * CRITICAL: Enforce orgId validation - users can only access their organization's data
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId, status, type, startDate, endDate, orgId } = req.query;

  // Build query with CRITICAL orgId validation
  const query = {};
  
  // CRITICAL: Enforce orgId - users can only access their organization's data
  // Super admin can override with orgId parameter, others use their own orgId
  if (req.user.role === 'super_admin' && orgId) {
    query.orgId = orgId;
  } else {
    query.orgId = req.user.orgId;
  }
  
  if (userId) {
    query.userId = userId;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (type) {
    query.type = type;
  }
  
  if (startDate && endDate) {
    query.startDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  logger.info('Fetching leave requests', {
    userId: req.user.userId,
    orgId: req.user.orgId,
    query
  });

  // Get total count
  const total = await LeaveRequest.countDocuments(query);

  // Get paginated results
  const leaveRequests = await LeaveRequest.find(query)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  logger.info('Leave requests listed', { total, page, limit, orgId: req.user.orgId });

  res.paginate(leaveRequests, total);
}));

/**
 * DELETE /api/leave-requests/:id
 * Delete leave request (must come before GET /:id)
 * CRITICAL: Enforce orgId validation
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // CRITICAL: Enforce orgId validation - users can only delete their organization's data
  const leaveRequest = await LeaveRequest.findOne({
    _id: id,
    orgId: req.user.orgId
  });

  if (!leaveRequest) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found or access denied'
    });
  }

  // Only allow deletion of pending requests
  if (leaveRequest.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Only pending leave requests can be deleted'
    });
  }

  await LeaveRequest.findByIdAndDelete(id);

  // Emit real-time updates
  req.emitLeaveUpdate('deleted', leaveRequest, leaveRequest.orgId);
  req.emitDashboardUpdate('delete', 'leave_requests', leaveRequest, leaveRequest.orgId);

  logger.info('Leave request deleted', { 
    leaveRequestId: id,
    orgId: req.user.orgId,
    userId: req.user.userId
  });

  res.json({
    success: true,
    message: 'Leave request deleted successfully',
    data: leaveRequest
  });
}));

/**
 * PATCH /api/leave-requests/:id
 * Update leave request (only for pending requests)
 * CRITICAL: Enforce orgId validation
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { leaveType, startDate, endDate, reason } = req.body;

  // CRITICAL: Enforce orgId validation - users can only update their organization's data
  const leaveRequest = await LeaveRequest.findOne({
    _id: id,
    orgId: req.user.orgId
  });

  if (!leaveRequest) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found or access denied'
    });
  }

  // Only allow editing pending requests
  if (leaveRequest.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Only pending leave requests can be edited'
    });
  }

  // Update the leave request
  if (leaveType) leaveRequest.type = leaveType;
  if (startDate) leaveRequest.startDate = new Date(startDate);
  if (endDate) leaveRequest.endDate = new Date(endDate);
  if (reason) leaveRequest.reason = reason;

  await leaveRequest.save();

  logger.info('Leave request updated', {
    leaveRequestId: id,
    employeeId: leaveRequest.employeeId,
    orgId: req.user.orgId,
    userId: req.user.userId
  });

  res.json({
    success: true,
    message: 'Leave request updated successfully',
    data: { leaveRequest }
  });
}));

/**
 * PATCH /api/leave-requests/:id/approve
 * Approve leave request (must come before GET /:id)
 */
router.patch('/:id/approve', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approvedBy, comments = '' } = req.body;

  if (!approvedBy) {
    return res.status(400).json({
      success: false,
      message: 'approvedBy is required'
    });
  }

  // Use Leave Policy Engine if available
  if (global.leavePolicyEngine) {
    try {
      const result = await global.leavePolicyEngine.approveLeaveRequest(id, approvedBy, comments);

      logger.info('Smart leave approval processed', {
        leaveRequestId: id,
        approvedBy,
        employeeId: result.leaveRequest.employeeId._id
      });

      return res.json({
        success: true,
        message: 'Leave request approved successfully',
        data: result.leaveRequest
      });

    } catch (policyError) {
      logger.warn('Smart leave approval failed, falling back to basic', {
        error: policyError.message,
        leaveRequestId: id
      });
      
      return res.status(400).json({
        success: false,
        message: policyError.message
      });
    }
  }

  // Fallback to basic approval logic
  const leaveRequest = await LeaveRequest.findById(id);

  if (!leaveRequest) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found'
    });
  }

  // Verify orgId - prevent cross-tenant access
  if (leaveRequest.orgId && leaveRequest.orgId !== req.user.orgId && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  if (leaveRequest.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Leave request is already ${leaveRequest.status}`
    });
  }

  // CRITICAL: Validate leave balance before approval
  const LeaveAllocation = (await import('../models/LeaveAllocation.js')).default;
  const allocation = await LeaveAllocation.findOne({
    employeeId: leaveRequest.employeeId,
    leaveType: leaveRequest.type,
    orgId: leaveRequest.orgId
  }).lean();

  if (!allocation) {
    return res.status(400).json({
      success: false,
      message: `No leave allocation found for ${leaveRequest.type} leave type`
    });
  }

  // Calculate days for this leave request
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const days = leaveRequest.isHalfDay ? 0.5 : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const availableBalance = allocation.balance || 0;

  if (availableBalance < days) {
    return res.status(400).json({
      success: false,
      message: `Insufficient leave balance. Available: ${availableBalance} days, Requested: ${days} days`,
      data: {
        availableBalance,
        requestedDays: days,
        leaveType: leaveRequest.type
      }
    });
  }

  const updated = await LeaveRequest.findOneAndUpdate(
    {
      _id: id,
      __v: leaveRequest.__v,
      status: 'pending'
    },
    {
      $set: {
        status: 'approved',
        approvedBy,
        approvedDate: new Date(),
        approverComments: comments
      },
      $inc: { __v: 1 }
    },
    { new: true }
  ).populate('userId', 'name email')
   .populate('approvedBy', 'name email');

  if (!updated) {
    return res.status(409).json({
      success: false,
      message: 'Leave request was modified by another user. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  // Emit business event for approved leave
  if (global.eventSystem) {
    await global.eventSystem.emit('leave.approved', {
      leaveRequest: updated,
      approvedBy,
      employee: { _id: updated.employeeId, userId: updated.userId },
      orgId: updated.orgId
    });
  }

  // Emit real-time updates to dashboards
  req.emitLeaveUpdate('updated', updated, updated.orgId);
  req.emitDashboardUpdate('update', 'leave_requests', updated, updated.orgId);
  req.emitActivityUpdate({
    action: 'leave_approve',
    description: `Leave request approved for ${updated.userId?.name}`,
    userId: approvedBy,
    orgId: updated.orgId,
    severity: 'medium',
    category: 'admin'
  }, updated.orgId);

  // Emit notification to employee
  req.emitNotification({
    title: 'Leave Request Approved',
    message: `Your ${updated.leaveType} leave request has been approved`,
    type: 'success',
    action: 'leave_approved',
    data: { leaveRequestId: updated._id }
  }, updated.userId, updated.orgId);

  // Send email notification
  try {
    const employeeRecord = await Employee.findOne({ userId: updated.userId._id }).select('_id orgId').lean();
    const employee = {
      _id: employeeRecord?._id,
      name: updated.userId?.name || updated.employeeName,
      email: updated.userId?.email,
      orgId: employeeRecord?.orgId || updated.orgId
    };
    const approver = {
      _id: updated.approvedBy?._id,
      name: updated.approvedBy?.name || 'Manager'
    };
    if (employee.email && employeeRecord) {
      await EmailNotificationService.sendLeaveApproved(employee, updated, approver);
      logger.info('Leave approved email sent', { leaveRequestId: id, email: employee.email });
      
      // Send notification to HR/admin
      const hrEmail = process.env.HR_EMAIL;
      if (!hrEmail) {
        logger.warn('HR_EMAIL not configured; skipping leave HR email', { leaveRequestId: id, orgId: updated.orgId });
      }
      if (hrEmail) {
        await EmailNotificationService.sendLeaveApprovedToHR(employee, updated, approver, hrEmail);
        logger.info('Leave approved notification sent to HR', { leaveRequestId: id, hrEmail });
      }
    } else {
      logger.warn('Missing employee data for leave approval notification', { 
        leaveRequestId: id, 
        hasEmail: !!employee.email, 
        hasEmployeeRecord: !!employeeRecord 
      });
    }
  } catch (emailError) {
    logger.error('Failed to send leave approved email', { error: emailError.message, leaveRequestId: id });
  }

  logger.info('Basic leave request approved', { 
    leaveRequestId: id, 
    approvedBy
  });

  res.json({
    success: true,
    message: 'Leave request approved successfully',
    data: updated
  });
}));

/**
 * PATCH /api/leave-requests/:id/reject
 * Reject leave request (must come before GET /:id)
 */
router.patch('/:id/reject', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectedBy, rejectionReason } = req.body;

  if (!rejectedBy || !rejectionReason) {
    return res.status(400).json({
      success: false,
      message: 'rejectedBy and rejectionReason are required'
    });
  }

  // Use Leave Policy Engine if available
  if (global.leavePolicyEngine) {
    try {
      const result = await global.leavePolicyEngine.rejectLeaveRequest(id, rejectedBy, rejectionReason);

      logger.info('Smart leave rejection processed', {
        leaveRequestId: id,
        rejectedBy,
        reason: rejectionReason
      });

      return res.json({
        success: true,
        message: 'Leave request rejected successfully',
        data: result.leaveRequest
      });

    } catch (policyError) {
      logger.warn('Smart leave rejection failed, falling back to basic', {
        error: policyError.message,
        leaveRequestId: id
      });
      
      return res.status(400).json({
        success: false,
        message: policyError.message
      });
    }
  }

  // Fallback to basic rejection logic
  const leaveRequest = await LeaveRequest.findById(id);

  if (!leaveRequest) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found'
    });
  }

  // Verify orgId - prevent cross-tenant access
  if (leaveRequest.orgId && leaveRequest.orgId !== req.user.orgId && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  if (leaveRequest.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Leave request is already ${leaveRequest.status}`
    });
  }

  const updated = await LeaveRequest.findOneAndUpdate(
    {
      _id: id,
      __v: leaveRequest.__v,
      status: 'pending'
    },
    {
      $set: {
        status: 'rejected',
        rejectedBy,
        rejectedDate: new Date(),
        rejectionReason
      },
      $inc: { __v: 1 }
    },
    { new: true }
  ).populate('userId', 'name email')
   .populate('rejectedBy', 'name email');

  if (!updated) {
    return res.status(409).json({
      success: false,
      message: 'Leave request was modified by another user. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  // Emit business event for rejected leave
  if (global.eventSystem) {
    await global.eventSystem.emit('leave.rejected', {
      leaveRequest: updated,
      rejectedBy,
      reason: rejectionReason,
      employee: { _id: updated.employeeId, userId: updated.userId },
      orgId: updated.orgId
    });
  }

  // Emit real-time updates to dashboards
  req.emitLeaveUpdate('updated', updated, updated.orgId);
  req.emitDashboardUpdate('update', 'leave_requests', updated, updated.orgId);
  req.emitActivityUpdate({
    action: 'leave_reject',
    description: `Leave request rejected for ${updated.userId?.name}`,
    userId: rejectedBy,
    orgId: updated.orgId,
    severity: 'medium',
    category: 'admin'
  }, updated.orgId);

  // Emit notification to employee
  req.emitNotification({
    title: 'Leave Request Rejected',
    message: `Your ${updated.leaveType} leave request has been rejected: ${rejectionReason}`,
    type: 'error',
    action: 'leave_rejected',
    data: { leaveRequestId: updated._id, reason: rejectionReason }
  }, updated.userId, updated.orgId);

  // Send email notification
  try {
    const employeeRecord = await Employee.findOne({ userId: updated.userId._id }).select('_id orgId').lean();
    const employee = {
      _id: employeeRecord?._id,
      name: updated.userId?.name || updated.employeeName,
      email: updated.userId?.email,
      orgId: employeeRecord?.orgId || updated.orgId
    };
    const rejector = {
      _id: updated.rejectedBy?._id,
      name: updated.rejectedBy?.name || 'Manager'
    };
    if (employee.email && employeeRecord) {
      await EmailNotificationService.sendLeaveRejected(employee, updated, rejector, rejectionReason);
      logger.info('Leave rejected email sent', { leaveRequestId: id, email: employee.email });
    } else {
      logger.warn('Missing employee data for leave rejection notification', { 
        leaveRequestId: id, 
        hasEmail: !!employee.email, 
        hasEmployeeRecord: !!employeeRecord 
      });
    }
  } catch (emailError) {
    logger.error('Failed to send leave rejected email', { error: emailError.message, leaveRequestId: id });
  }

  logger.info('Basic leave request rejected', { 
    leaveRequestId: id, 
    rejectedBy,
    reason: rejectionReason
  });

  res.json({
    success: true,
    message: 'Leave request rejected successfully',
    data: updated
  });
}));

/**
 * GET /api/leave-requests/user/:userId
 * Get leave requests for specific user
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId } = req.params;
  const { status } = req.query;

  // Enforce tenant/user isolation for leave data
  if (req.user.role === 'employee' && req.user.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  const query = { userId, orgId: req.user.orgId };
  
  if (status) {
    query.status = status;
  }

  const total = await LeaveRequest.countDocuments(query);

  const leaveRequests = await LeaveRequest.find(query)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.paginate(leaveRequests, total);
}));

/**
 * GET /api/leave-requests/stats/summary
 * Get leave request statistics
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { orgId, startDate, endDate } = req.query;

  const query = {};
  
  if (orgId) {
    query.orgId = orgId;
  }
  
  if (startDate && endDate) {
    query.startDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const [total, pending, approved, rejected, byType, byStatus] = await Promise.all([
    LeaveRequest.countDocuments(query),
    LeaveRequest.countDocuments({ ...query, status: 'pending' }),
    LeaveRequest.countDocuments({ ...query, status: 'approved' }),
    LeaveRequest.countDocuments({ ...query, status: 'rejected' }),
    LeaveRequest.aggregate([
      { $match: query },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    LeaveRequest.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      total,
      pending,
      approved,
      rejected,
      byType,
      byStatus
    }
  });
}));

/**
 * GET /api/leave-requests/:id
 * Get single leave request
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const leaveRequest = await LeaveRequest.findById(req.params.id)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email');

  if (!leaveRequest) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found'
    });
  }

  res.json({
    success: true,
    data: leaveRequest
  });
}));

/**
 * POST /api/leave-requests
 * Create new leave request with smart policy validation and workflow automation
 */
router.post('/', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const {
    userId,
    employeeId,
    leaveType,
    startDate,
    endDate,
    reason,
    isHalfDay = false,
    isHourlyLeave = false,
    startTime,
    endTime,
    orgId
  } = req.body;

  console.log('POST /leave-requests - Request body:', {
    userId,
    employeeId,
    leaveType,
    startDate,
    endDate,
    reason,
    isHalfDay,
    isHourlyLeave,
    startTime,
    endTime,
    orgId
  });

  // Validate required fields
  if (!userId || !employeeId || !leaveType || !startDate || !endDate || !reason || !orgId) {
    console.error('Missing required fields:', {
      userId: !!userId,
      employeeId: !!employeeId,
      leaveType: !!leaveType,
      startDate: !!startDate,
      endDate: !!endDate,
      reason: !!reason,
      orgId: !!orgId
    });
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  // Validate hourly leave fields if applicable
  if (isHourlyLeave && (!startTime || !endTime)) {
    return res.status(400).json({
      success: false,
      message: 'Start time and end time are required for hourly leave'
    });
  }

  // Get employee name from User
  let employeeName = 'Unknown';
  try {
    const user = await User.findById(userId).lean();
    if (user) {
      employeeName = user.name || 'Unknown';
    }
  } catch (error) {
    logger.warn('Could not fetch user name for leave request', { userId });
  }

  // Use Leave Policy Engine if available
  if (global.leavePolicyEngine) {
    try {
      const result = await global.leavePolicyEngine.processLeaveRequest({
        employeeId,
        leaveType,
        startDate,
        endDate,
        reason,
        isHalfDay,
        isHourlyLeave,
        startTime,
        endTime,
        orgId,
        requestedBy: userId
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Leave request validation failed',
          errors: result.errors,
          warnings: result.warnings
        });
      }

      logger.info('Smart leave request processed', {
        leaveRequestId: result.leaveRequest._id,
        employeeId,
        leaveType,
        autoApproved: result.autoApproved,
        workflowId: result.workflowId
      });

      return res.status(201).json({
        success: true,
        message: result.autoApproved ? 'Leave request auto-approved' : 'Leave request submitted successfully',
        data: {
          leaveRequest: result.leaveRequest,
          autoApproved: result.autoApproved,
          workflowId: result.workflowId,
          warnings: result.warnings
        }
      });

    } catch (policyError) {
      logger.warn('Smart leave processing failed, falling back to basic', {
        error: policyError.message,
        employeeId
      });
      
      return res.status(400).json({
        success: false,
        message: policyError.message
      });
    }
  }

  // Fallback to basic leave request logic
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  console.log('Creating leave request:', {
    userId,
    employeeId,
    leaveType,
    startDate,
    endDate,
    start: start.toISOString(),
    end: end.toISOString(),
    reason,
    isHourlyLeave,
    startTime,
    endTime,
    orgId
  });
  
  if (end < start) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date'
    });
  }

  const days = isHalfDay ? 0.5 : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  console.log('Days calculated:', days);

  // Check for overlapping leave requests - FIXED for half-day leaves
  let overlapQuery = {
    employeeId,
    orgId,
    status: { $in: ['pending', 'approved'] }
  };

  if (isHalfDay) {
    // For half-day leaves, only check for overlaps on the same date
    overlapQuery.$or = [
      {
        startDate: { $lte: end },
        endDate: { $gte: start },
        isHalfDay: true  // Only conflict with other half-day leaves on same date
      },
      {
        startDate: { $lte: end },
        endDate: { $gte: start },
        isHalfDay: false  // Or any full-day leave that overlaps
      }
    ];
  } else {
    // For full-day leaves, check for any overlap
    overlapQuery.$or = [
      {
        startDate: { $lte: end },
        endDate: { $gte: start }
      }
    ];
  }

  const overlapping = await LeaveRequest.findOne(overlapQuery).lean();

  console.log('Overlapping check:', {
    employeeId,
    isHalfDay,
    overlappingFound: !!overlapping,
    overlappingData: overlapping
  });

  if (overlapping) {
    return res.status(400).json({
      success: false,
      message: 'You already have a leave request for this period',
      data: overlapping
    });
  }

  // CRITICAL: Check leave balance before creating request
  const LeaveAllocation = (await import('../models/LeaveAllocation.js')).default;
  const allocation = await LeaveAllocation.findOne({
    employeeId,
    leaveType: leaveType,
    orgId
  }).lean();

  if (!allocation) {
    return res.status(400).json({
      success: false,
      message: `No leave allocation found for ${leaveType} leave type`
    });
  }

  const availableBalance = allocation.balance || 0;
  if (availableBalance < days) {
    return res.status(400).json({
      success: false,
      message: `Insufficient leave balance. Available: ${availableBalance} days, Requested: ${days} days`,
      data: {
        availableBalance,
        requestedDays: days,
        leaveType
      }
    });
  }

  // Create leave request
  const leaveRequest = await LeaveRequest.create({
    userId,
    employeeId,
    employeeName: employeeName,
    type: leaveType,
    startDate: start,
    endDate: end,
    reason,
    status: 'pending',
    orgId,
    isHourlyLeave,
    startTime: isHourlyLeave ? startTime : undefined,
    endTime: isHourlyLeave ? endTime : undefined
  });

  // Emit business event for workflow automation
  if (global.eventSystem) {
    await global.eventSystem.emit('leave.requested', {
      leaveRequest,
      employee: { _id: employeeId, userId },
      orgId
    });
  }

  // Emit real-time updates to dashboards
  req.emitLeaveUpdate('created', leaveRequest, orgId);
  req.emitDashboardUpdate('create', 'leave_requests', leaveRequest, orgId);
  req.emitActivityUpdate({
    action: 'leave_request',
    description: `New ${leaveType} leave request submitted`,
    userId: userId,
    orgId: orgId,
    severity: 'low',
    category: 'employee'
  }, orgId);

  // Emit notification to admins
  req.emitNotification({
    title: 'New Leave Request',
    message: `${leaveType} leave request submitted for ${days} day(s)`,
    type: 'info',
    action: 'leave_requested',
    data: { leaveRequestId: leaveRequest._id, leaveType, days }
  }, null, orgId);

  // Send email notification to employee (confirmation)
  try {
    const user = await User.findById(userId).select('name email').lean();
    const employeeRecord = await Employee.findOne({ userId }).select('_id orgId').lean();
    
    if (user && user.email && employeeRecord) {
      await EmailNotificationService.sendLeaveRequestSubmitted(
        { 
          _id: employeeRecord._id,
          name: user.name, 
          email: user.email,
          orgId: employeeRecord.orgId || orgId
        },
        { _id: leaveRequest._id, type: leaveType, startDate: start, endDate: end, reason }
      );
      logger.info('Leave request submitted email sent', { leaveRequestId: leaveRequest._id, email: user.email });
      
      // Send notification to HR/admin
      const hrEmail = process.env.HR_EMAIL;
      if (!hrEmail) {
        logger.warn('HR_EMAIL not configured; skipping leave HR email', { leaveRequestId: leaveRequest._id, orgId });
      }
      if (hrEmail) {
        await EmailNotificationService.sendLeaveRequestSubmittedToHR(
          {
            name: user.name,
            email: user.email,
            employeeCode: employeeRecord.employeeCode,
            department: employeeRecord.department
          },
          { _id: leaveRequest._id, type: leaveType, startDate: start, endDate: end, reason },
          hrEmail
        );
        logger.info('Leave request submitted notification sent to HR', { leaveRequestId: leaveRequest._id, hrEmail });
      }
    } else {
      logger.warn('Missing user or employee data for leave submission notification', { 
        leaveRequestId: leaveRequest._id, 
        hasUser: !!user, 
        hasEmployeeRecord: !!employeeRecord 
      });
    }
  } catch (emailError) {
    logger.error('Failed to send leave request submitted email', { error: emailError.message });
  }

  logger.info('Basic leave request created', { 
    leaveRequestId: leaveRequest._id, 
    employeeId,
    days,
    leaveType,
    isHourlyLeave
  });

  res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: { leaveRequest }
  });
}));

/**
 * POST /api/leave-requests/bulk-approve
 * Bulk approve leave requests with idempotency
 */
router.post('/bulk-approve', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { requestIds, approvedBy } = req.body;

  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'requestIds array is required'
    });
  }

  if (!approvedBy) {
    return res.status(400).json({
      success: false,
      message: 'approvedBy is required'
    });
  }

  // Update all pending requests
  const result = await LeaveRequest.updateMany(
    {
      _id: { $in: requestIds },
      status: 'pending'
    },
    {
      $set: {
        status: 'approved',
        approvedBy,
        approvedDate: new Date()
      },
      $inc: { __v: 1 }
    }
  );

  logger.info('Leave requests bulk approved', { count: result.modifiedCount, approvedBy });

  res.json({
    success: true,
    message: `${result.modifiedCount} leave requests approved successfully`,
    data: {
      modifiedCount: result.modifiedCount
    }
  });
}));

/**
 * POST /api/leave-requests/bulk-reject
 * Bulk reject leave requests with idempotency
 */
router.post('/bulk-reject', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { requestIds, rejectedBy, rejectionReason } = req.body;

  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'requestIds array is required'
    });
  }

  if (!rejectedBy || !rejectionReason) {
    return res.status(400).json({
      success: false,
      message: 'rejectedBy and rejectionReason are required'
    });
  }

  // Update all pending requests
  const result = await LeaveRequest.updateMany(
    {
      _id: { $in: requestIds },
      status: 'pending'
    },
    {
      $set: {
        status: 'rejected',
        rejectedBy,
        rejectedDate: new Date(),
        rejectionReason
      },
      $inc: { __v: 1 }
    }
  );

  logger.info('Leave requests bulk rejected', { count: result.modifiedCount, rejectedBy });

  res.json({
    success: true,
    message: `${result.modifiedCount} leave requests rejected successfully`,
    data: {
      modifiedCount: result.modifiedCount
    }
  });
}));

/**
 * POST /api/leave-requests/policy
 * Set leave policy for organization
 */
router.post('/policy', asyncHandler(async (req, res) => {
  const { orgId, policy } = req.body;

  if (!orgId || !policy) {
    return res.status(400).json({
      success: false,
      message: 'orgId and policy are required'
    });
  }

  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const updatedPolicy = global.leavePolicyEngine.setOrganizationPolicy(orgId, policy);

  logger.info('Leave policy updated', { orgId });

  res.json({
    success: true,
    message: 'Leave policy updated successfully',
    data: updatedPolicy
  });
}));

/**
 * GET /api/leave-requests/policy/:orgId
 * Get leave policy for organization
 */
router.get('/policy/:orgId', asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const policy = global.leavePolicyEngine.getOrganizationPolicy(orgId);

  res.json({
    success: true,
    data: policy
  });
}));

/**
 * GET /api/leave-requests/balance/:employeeId
 * Get leave balances for employee
 */
router.get('/balance/:employeeId', asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { asOfDate } = req.query;

  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const balances = await global.leavePolicyEngine.getEmployeeLeaveBalances(
    employeeId,
    asOfDate ? new Date(asOfDate) : new Date()
  );

  res.json({
    success: true,
    data: balances
  });
}));

/**
 * POST /api/leave-requests/validate
 * Validate leave request before submission
 */
router.post('/validate', asyncHandler(async (req, res) => {
  const leaveRequestData = req.body;

  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const validation = await global.leavePolicyEngine.validateLeaveRequest(leaveRequestData);

  res.json({
    success: true,
    data: validation
  });
}));

/**
 * PATCH /api/leave-requests/:id/cancel
 * Cancel leave request
 */
router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cancelledBy, reason } = req.body;

  if (!cancelledBy || !reason) {
    return res.status(400).json({
      success: false,
      message: 'cancelledBy and reason are required'
    });
  }

  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const result = await global.leavePolicyEngine.cancelLeaveRequest(id, cancelledBy, reason);

  res.json({
    success: true,
    message: 'Leave request cancelled successfully',
    data: result.leaveRequest
  });
}));

/**
 * GET /api/leave-requests/analytics
 * Get leave analytics
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  const { orgId, timeframe = 30 } = req.query;

  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: 'orgId is required'
    });
  }

  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const analytics = await global.leavePolicyEngine.getLeaveAnalytics(
    orgId,
    parseInt(timeframe)
  );

  res.json({
    success: true,
    data: analytics
  });
}));

/**
 * GET /api/leave-requests/system/stats
 * Get leave system statistics
 */
router.get('/system/stats', asyncHandler(async (req, res) => {
  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const stats = global.leavePolicyEngine.getSystemStats();

  res.json({
    success: true,
    data: stats
  });
}));

export default router;
