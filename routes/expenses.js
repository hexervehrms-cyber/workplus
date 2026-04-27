/**
 * Expense Routes with Pagination and Optimistic Locking
 * P0 Critical Fixes Applied:
 * - Pagination for large datasets
 * - .lean() for read-only queries
 * - Optimistic locking for approvals/rejections
 * - Idempotency for critical operations
 */

import express from 'express';
import Expense from '../models/Expense.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware
router.use(paginationMiddleware);

/**
 * GET /api/expenses
 * List expenses with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId, status, category, startDate, endDate, orgId } = req.query;

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
  
  if (category) {
    query.category = category;
  }
  
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // Get total count
  const total = await Expense.countDocuments(query);

  // Get paginated results with .lean()
  const expenses = await Expense.find(query)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  logger.info('Expenses listed', { total, page, limit });

  res.paginate(expenses, total);
}));

/**
 * GET /api/expenses/user/:userId
 * Get expenses for specific user
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { userId } = req.params;
  const { status } = req.query;

  const query = { userId };
  
  if (status) {
    query.status = status;
  }

  const total = await Expense.countDocuments(query);

  const expenses = await Expense.find(query)
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  res.paginate(expenses, total);
}));

/**
 * GET /api/expenses/:id
 * Get single expense
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id)
    .populate('userId', 'name email avatar')
    .populate('employeeId', 'employeeCode department designation')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email')
    .lean(); // P0 FIX: Use .lean() for read-only queries

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }

  res.json({
    success: true,
    data: expense
  });
}));

/**
 * POST /api/expenses
 * Create new expense with idempotency
 * P0 FIX: Idempotency prevents duplicate submissions
 */
router.post('/', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const {
    userId,
    employeeId,
    employeeName,
    category,
    amount,
    date,
    description,
    receipt,
    orgId
  } = req.body;

  // Validate required fields
  if (!userId || !category || !amount || !date || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'userId, category, amount, date, and orgId are required'
    });
  }

  // Validate amount
  if (amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be greater than 0'
    });
  }

  // Create expense
  const expense = await Expense.create({
    userId,
    employeeId,
    employeeName,
    category,
    amount,
    date: new Date(date),
    description,
    receipt,
    status: 'pending',
    orgId
  });

  logger.info('Expense created', { expenseId: expense._id, userId, amount });

  res.status(201).json({
    success: true,
    message: 'Expense submitted successfully',
    data: expense
  });
}));

/**
 * PUT /api/expenses/:id
 * Update expense with optimistic locking
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove fields that shouldn't be updated
  delete updateData._id;
  delete updateData.userId;
  delete updateData.status;
  delete updateData.approvedBy;
  delete updateData.rejectedBy;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  // P0 FIX: Optimistic locking
  const currentVersion = updateData.__v;
  delete updateData.__v;

  const query = { _id: id, status: 'pending' }; // Only update pending expenses
  if (currentVersion !== undefined) {
    query.__v = currentVersion;
  }

  const expense = await Expense.findOneAndUpdate(
    query,
    {
      $set: updateData,
      $inc: { __v: 1 }
    },
    { new: true, runValidators: true }
  );

  if (!expense) {
    return res.status(409).json({
      success: false,
      message: 'Expense was modified or is no longer pending. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  logger.info('Expense updated', { expenseId: id });

  res.json({
    success: true,
    message: 'Expense updated successfully',
    data: expense
  });
}));

/**
 * DELETE /api/expenses/:id
 * Delete expense (only if pending)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expense = await Expense.findOneAndDelete({
    _id: id,
    status: 'pending' // Only delete pending expenses
  });

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found or cannot be deleted'
    });
  }

  logger.info('Expense deleted', { expenseId: id });

  res.json({
    success: true,
    message: 'Expense deleted successfully'
  });
}));

/**
 * PATCH /api/expenses/:id/approve
 * Approve expense with optimistic locking
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

  // Get current expense
  const expense = await Expense.findById(id);

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }

  if (expense.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Expense is already ${expense.status}`
    });
  }

  // P0 FIX: Optimistic locking with version check
  const updated = await Expense.findOneAndUpdate(
    {
      _id: id,
      __v: expense.__v, // Version check
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
      message: 'Expense was modified by another user. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  logger.info('Expense approved', { expenseId: id, approvedBy });

  res.json({
    success: true,
    message: 'Expense approved successfully',
    data: updated
  });
}));

/**
 * PATCH /api/expenses/:id/reject
 * Reject expense with optimistic locking
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

  // Get current expense
  const expense = await Expense.findById(id);

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }

  if (expense.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Expense is already ${expense.status}`
    });
  }

  // P0 FIX: Optimistic locking with version check
  const updated = await Expense.findOneAndUpdate(
    {
      _id: id,
      __v: expense.__v, // Version check
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
      message: 'Expense was modified by another user. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  logger.info('Expense rejected', { expenseId: id, rejectedBy });

  res.json({
    success: true,
    message: 'Expense rejected successfully',
    data: updated
  });
}));

/**
 * POST /api/expenses/bulk-approve
 * Bulk approve expenses with idempotency
 */
router.post('/bulk-approve', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { expenseIds, approvedBy } = req.body;

  if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'expenseIds array is required'
    });
  }

  if (!approvedBy) {
    return res.status(400).json({
      success: false,
      message: 'approvedBy is required'
    });
  }

  // Update all pending expenses
  const result = await Expense.updateMany(
    {
      _id: { $in: expenseIds },
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

  logger.info('Expenses bulk approved', { count: result.modifiedCount, approvedBy });

  res.json({
    success: true,
    message: `${result.modifiedCount} expenses approved successfully`,
    data: {
      modifiedCount: result.modifiedCount
    }
  });
}));

/**
 * POST /api/expenses/bulk-reject
 * Bulk reject expenses with idempotency
 */
router.post('/bulk-reject', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { expenseIds, rejectedBy, rejectionReason } = req.body;

  if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'expenseIds array is required'
    });
  }

  if (!rejectedBy || !rejectionReason) {
    return res.status(400).json({
      success: false,
      message: 'rejectedBy and rejectionReason are required'
    });
  }

  // Update all pending expenses
  const result = await Expense.updateMany(
    {
      _id: { $in: expenseIds },
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

  logger.info('Expenses bulk rejected', { count: result.modifiedCount, rejectedBy });

  res.json({
    success: true,
    message: `${result.modifiedCount} expenses rejected successfully`,
    data: {
      modifiedCount: result.modifiedCount
    }
  });
}));

/**
 * GET /api/expenses/stats/summary
 * Get expense statistics
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

  const [total, pending, approved, rejected, totalAmount, byCategory, byStatus] = await Promise.all([
    Expense.countDocuments(query),
    Expense.countDocuments({ ...query, status: 'pending' }),
    Expense.countDocuments({ ...query, status: 'approved' }),
    Expense.countDocuments({ ...query, status: 'rejected' }),
    Expense.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Expense.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]),
    Expense.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      total,
      pending,
      approved,
      rejected,
      totalAmount: totalAmount[0]?.total || 0,
      byCategory,
      byStatus
    }
  });
}));

export default router;
