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
 * Create new leave request with idempotency
 * P0 FIX: Idempotency prevents duplicate submissions
 */
router.post('/', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const {
    userId,
    employeeId,
    employeeName,
    type,
    startDate,
    endDate,
    reason,
    orgId
  } = req.body;

  // Validate required fields
  if (!userId || !type || !startDate || !endDate || !reason || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end < start) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date'
    });
  }

  // Check for overlapping leave requests
  const overlapping = await LeaveRequest.findOne({
    userId,
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
    employeeName,
    type,
    startDate: start,
    endDate: end,
    reason,
    status: 'pending',
    orgId
  });

  logger.info('Leave request created', { leaveRequestId: leaveRequest._id, userId });

  res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: leaveRequest
  });
}));

/**
 * PATCH /api/leave-requests/:id/approve
 * Approve leave request with optimistic locking
 * P0 FIX: Optimistic locking prevents race conditions
 */
router.patch('/:id/approve', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approvedBy } = req.body;

  if (!approvedBy) {
    return res.status(400).json({
      success: false,
      message: 'approvedBy is required'
    });
  }

  // Get current leave request
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

  // P0 FIX: Optimistic locking with version check
  const updated = await LeaveRequest.findOneAndUpdate(
    {
      _id: id,
      __v: leaveRequest.__v, // Version check
      status: 'pending' // Double-check status
    },
    {
      $set: {
        status: 'approved',
        approvedBy,
        approvedDate: new Date()
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

  logger.info('Leave request approved', { leaveRequestId: id, approvedBy });

  res.json({
    success: true,
    message: 'Leave request approved successfully',
    data: updated
  });
}));

/**
 * PATCH /api/leave-requests/:id/reject
 * Reject leave request with optimistic locking
 * P0 FIX: Optimistic locking prevents race conditions
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

  // Get current leave request
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

  // P0 FIX: Optimistic locking with version check
  const updated = await LeaveRequest.findOneAndUpdate(
    {
      _id: id,
      __v: leaveRequest.__v, // Version check
      status: 'pending' // Double-check status
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

  logger.info('Leave request rejected', { leaveRequestId: id, rejectedBy });

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

export default router;
