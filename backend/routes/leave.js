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
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware
router.use(paginationMiddleware);

/**
 * GET /api/leave-requests
 * List leave requests with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId, status, type, startDate, endDate, orgId } = req.query;

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
  
  if (type) {
    query.type = type;
  }
  
  if (startDate && endDate) {
    query.startDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // Get total count
  const total = await LeaveRequest.countDocuments(query);

  // Get paginated results with .lean()
  const leaveRequests = await LeaveRequest.find(query)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  logger.info('Leave requests listed', { total, page, limit });

  res.paginate(leaveRequests, total);
}));

/**
 * GET /api/leave-requests/user/:userId
 * Get leave requests for specific user
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId } = req.params;
  const { status } = req.query;

  const query = { userId };
  
  if (status) {
    query.status = status;
  }

  const total = await LeaveRequest.countDocuments(query);

  const leaveRequests = await LeaveRequest.find(query)
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  res.paginate(leaveRequests, total);
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
    .populate('rejectedBy', 'name email')
    .lean(); // P0 FIX: Use .lean() for read-only queries

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
    orgId
  } = req.body;

  // Validate required fields
  if (!userId || !employeeId || !leaveType || !startDate || !endDate || !reason || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
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
  
  if (end < start) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date'
    });
  }

  const days = isHalfDay ? 0.5 : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // Check for overlapping leave requests
  const overlapping = await LeaveRequest.findOne({
    employeeId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      {
        startDate: { $lte: end },
        endDate: { $gte: start }
      }
    ]
  }).lean();

  if (overlapping) {
    return res.status(400).json({
      success: false,
      message: 'You already have a leave request for this period',
      data: overlapping
    });
  }

  // Create leave request
  const leaveRequest = await LeaveRequest.create({
    userId,
    employeeId,
    leaveType,
    startDate: start,
    endDate: end,
    days,
    reason,
    isHalfDay,
    status: 'pending',
    orgId
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

  logger.info('Basic leave request created', { 
    leaveRequestId: leaveRequest._id, 
    employeeId,
    days,
    leaveType
  });

  res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: { leaveRequest }
  });
}));

/**
 * PATCH /api/leave-requests/:id/approve
 * Approve leave request with smart policy engine integration
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
 * Reject leave request with smart policy engine integration
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
