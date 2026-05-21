/**
 * Leave Allocation Routes
 * Manages leave kitty allocation for employees on monthly basis
 */

import express from 'express';
import LeaveAllocation from '../models/LeaveAllocation.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';
import {
  LEAVE_BALANCE_KEYS,
  allocationHasBalance,
  resolveLeaveAllocation,
} from '../utils/leaveBalanceHelpers.js';
import { authorize } from '../middleware/auth.js';
import { assertEmployeeSelfOrPrivileged } from '../utils/employeeAccessHelpers.js';
import { scopedOrgId } from '../utils/leaveAccessHelpers.js';
import { isSuperAdmin } from '../utils/orgScopeHelpers.js';

const router = express.Router();

async function requireAllocationAccess(req, res, employeeId) {
  const access = await assertEmployeeSelfOrPrivileged(req, employeeId);
  if (!access.ok) {
    res.status(access.status).json({ success: false, message: access.message });
    return false;
  }
  return true;
}

// Apply pagination middleware
router.use(paginationMiddleware);

// Helper function to convert leave type to field name
const getLeaveFieldName = (leaveType) => {
  const mapping = {
    'Vacation': 'vacation',
    'Sick Leave': 'sickLeave',
    'Casual Leave': 'casualLeave',
    'Earned Leave': 'earnedLeave',
    'Medical Leave': 'medicalLeave',
    'Maternity Leave': 'maternityLeave',
    'Paternity Leave': 'paternityLeave',
    'Compensatory Off': 'compensatoryOff',
    'Personal': 'personal',
    'Emergency': 'emergency',
    'NCNS': 'ncns',
    'Sandwich Leave': 'sandwichLeave'
  };
  return mapping[leaveType] || null;
};

/**
 * GET /api/leave-allocation/employee/:employeeId
 * Get leave allocation for employee for current and future months
 */
router.get('/employee/:employeeId', asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  if (!(await requireAllocationAccess(req, res, employeeId))) return;
  const { year, month } = req.query;

  const query = { employeeId };

  if (year && month) {
    query.year = parseInt(year);
    query.month = parseInt(month);
  } else {
    // Get current and next 12 months
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    query.$or = [];
    for (let i = 0; i < 12; i++) {
      let y = currentYear;
      let m = currentMonth + i;
      if (m > 12) {
        y += Math.floor(m / 12);
        m = m % 12 || 12;
      }
      query.$or.push({ year: y, month: m });
    }
  }

  const allocations = await LeaveAllocation.find(query)
    .populate({
      path: 'employeeId',
      select: 'employeeCode name department designation userId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    })
    .populate('userId', 'name email')
    .populate('allocatedBy', 'name email')
    .sort({ year: 1, month: 1 });

  res.json({
    success: true,
    data: allocations
  });
}));

/**
 * GET /api/leave-allocation/organization/:orgId
 * Get all leave allocations for organization
 */
router.get('/organization/:orgId', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { orgId: orgIdParam } = req.params;
  const tenantOrg = scopedOrgId(req);
  if (!tenantOrg && !isSuperAdmin(req)) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'MISSING_ORG_CONTEXT',
    });
  }
  const orgId =
    isSuperAdmin(req) && orgIdParam ? String(orgIdParam) : String(tenantOrg || orgIdParam);
  if (
    !isSuperAdmin(req) &&
    tenantOrg &&
    String(orgIdParam) !== String(tenantOrg)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Cannot access leave allocations for another organization',
    });
  }
  const { page, limit, skip } = req.pagination;
  const { year, month, status } = req.query;

  const query = { orgId };

  if (year && month) {
    query.year = parseInt(year);
    query.month = parseInt(month);
  }

  if (status) {
    query.status = status;
  }

  const total = await LeaveAllocation.countDocuments(query);

  const allocations = await LeaveAllocation.find(query)
    .populate({
      path: 'employeeId',
      select: 'employeeCode name department designation userId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    })
    .populate('userId', 'name email')
    .populate('allocatedBy', 'name email')
    .sort({ year: -1, month: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.paginate(allocations, total);
}));

/**
 * POST /api/leave-allocation
 * Create or update leave allocation for employee
 */
router.post('/', authorize('super_admin', 'admin', 'hr'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const {
    employeeId,
    userId,
    orgId,
    year,
    month,
    allocations,
    notes
  } = req.body;

  const tenantOrg = scopedOrgId(req);
  if (!tenantOrg) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'MISSING_ORG_CONTEXT',
    });
  }
  if (
    req.user.role !== 'super_admin' &&
    String(orgId) !== String(tenantOrg)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Cannot create leave allocation for another organization',
    });
  }

  // Validate required fields
  if (!employeeId || !userId || !orgId || !year || !month || !allocations) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
      received: {
        employeeId: !!employeeId,
        userId: !!userId,
        orgId: !!orgId,
        year: !!year,
        month: !!month,
        allocations: !!allocations
      }
    });
  }

  // Check if allocation already exists
  let allocation = await LeaveAllocation.findOne({
    employeeId,
    orgId: String(tenantOrg),
    year,
    month
  });

  if (allocation) {
    // Update existing allocation
    allocation.allocations = allocations;
    allocation.notes = notes;
    allocation.status = 'allocated';
    allocation.allocatedBy = userId;
    allocation.allocatedDate = new Date();
    await allocation.save();

    logger.info('Leave allocation updated', {
      allocationId: allocation._id,
      employeeId,
      year,
      month
    });

    return res.json({
      success: true,
      message: 'Leave allocation updated successfully',
      data: allocation
    });
  }

  // Create new allocation
  allocation = await LeaveAllocation.create({
    employeeId,
    userId,
    orgId,
    year,
    month,
    allocations,
    notes,
    status: 'allocated',
    allocatedBy: userId,
    allocatedDate: new Date()
  });

  // Emit real-time updates
  if (req.emitLeaveUpdate) {
    req.emitLeaveUpdate('allocation_created', allocation, orgId);
  }

  logger.info('Leave allocation created', {
    allocationId: allocation._id,
    employeeId,
    year,
    month
  });

  res.status(201).json({
    success: true,
    message: 'Leave allocation created successfully',
    data: allocation
  });
}));

/**
 * GET /api/leave-allocation/:id
 * Get single leave allocation
 */
router.get('/:id', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const tenantOrg = scopedOrgId(req);
  const allocation = await LeaveAllocation.findOne({
    _id: req.params.id,
    ...(tenantOrg ? { orgId: String(tenantOrg) } : {}),
  })
    .populate({
      path: 'employeeId',
      select: 'employeeCode name department designation userId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    })
    .populate('userId', 'name email')
    .populate('allocatedBy', 'name email');

  if (!allocation) {
    return res.status(404).json({
      success: false,
      message: 'Leave allocation not found'
    });
  }

  res.json({
    success: true,
    data: allocation
  });
}));

/**
 * PATCH /api/leave-allocation/:id
 * Update leave allocation
 */
router.patch('/:id', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { allocations, notes, status } = req.body;
  const tenantOrg = scopedOrgId(req);

  const allocation = await LeaveAllocation.findOne({
    _id: id,
    ...(tenantOrg ? { orgId: String(tenantOrg) } : {}),
  });

  if (!allocation) {
    return res.status(404).json({
      success: false,
      message: 'Leave allocation not found'
    });
  }

  if (allocations) {
    allocation.allocations = allocations;
  }

  if (notes !== undefined) {
    allocation.notes = notes;
  }

  if (status) {
    allocation.status = status;
  }

  await allocation.save();

  if (req.emitLeaveUpdate) {
    req.emitLeaveUpdate('allocation_created', allocation, allocation.orgId);
  }

  logger.info('Leave allocation updated', {
    allocationId: id
  });

  res.json({
    success: true,
    message: 'Leave allocation updated successfully',
    data: allocation
  });
}));

/**
 * DELETE /api/leave-allocation/:id
 * Delete leave allocation
 */
router.delete('/:id', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantOrg = scopedOrgId(req);

  const allocation = await LeaveAllocation.findOneAndDelete({
    _id: id,
    ...(tenantOrg ? { orgId: String(tenantOrg) } : {}),
  });

  if (!allocation) {
    return res.status(404).json({
      success: false,
      message: 'Leave allocation not found'
    });
  }

  logger.info('Leave allocation deleted', {
    allocationId: id
  });

  res.json({
    success: true,
    message: 'Leave allocation deleted successfully',
    data: allocation
  });
}));

/**
 * GET /api/leave-allocation/balance/:employeeId
 * Get current leave balance for employee
 * Query params: year, month (optional - defaults to current month)
 */
router.get('/balance/:employeeId', asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  if (!(await requireAllocationAccess(req, res, employeeId))) return;
  const { year, month } = req.query;

  const now = new Date();
  let currentYear = year ? parseInt(year) : now.getFullYear();
  let currentMonth = month ? parseInt(month) : now.getMonth() + 1;

  const { allocation, resolvedMonth, resolvedYear } = await resolveLeaveAllocation(
    LeaveAllocation,
    employeeId,
    currentYear,
    currentMonth
  );

  const buildBreakdown = (allocDoc) => {
    const breakdown = {};
    for (const key of LEAVE_BALANCE_KEYS) {
      const allocated = allocDoc?.allocations?.[key] || 0;
      const carried = allocDoc?.carriedForward?.[key] || 0;
      const used = allocDoc?.used?.[key] || 0;
      const pending = allocDoc?.pending?.[key] || 0;
      const total = allocated + carried;
      breakdown[key] = {
        allocated,
        carried,
        used,
        pending,
        total,
        remaining: Math.max(0, total - used - pending),
      };
    }
    return breakdown;
  };

  if (!allocation || !allocationHasBalance(allocation)) {
    return res.json({
      success: true,
      hasAllocation: false,
      data: buildBreakdown(null),
      resolvedYear: currentYear,
      resolvedMonth: currentMonth,
    });
  }

  res.json({
    success: true,
    hasAllocation: true,
    data: buildBreakdown(allocation),
    allocation,
    resolvedYear: resolvedYear ?? currentYear,
    resolvedMonth: resolvedMonth ?? currentMonth,
    balanceSourceMonth:
      resolvedMonth && resolvedMonth !== currentMonth ? resolvedMonth : undefined,
  });
}));

/**
 * POST /api/leave-allocation/deduct
 * Deduct leaves when leave request is approved
 */
router.post('/deduct', asyncHandler(async (req, res) => {
  const { employeeId, leaveType, days, leaveRequestId } = req.body;

  if (!employeeId || !leaveType || !days) {
    return res.status(400).json({
      success: false,
      message: 'employeeId, leaveType, and days are required'
    });
  }

  if (!(await requireAllocationAccess(req, res, employeeId))) return;

  const fieldName = getLeaveFieldName(leaveType);
  if (!fieldName) {
    return res.status(400).json({
      success: false,
      message: 'Invalid leave type'
    });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const allocation = await LeaveAllocation.findOne({
    employeeId,
    year: currentYear,
    month: currentMonth
  });

  if (!allocation) {
    return res.status(400).json({
      success: false,
      message: 'No leave allocation found for this month'
    });
  }

  const available = (allocation.allocations[fieldName] || 0) + 
                   (allocation.carriedForward[fieldName] || 0) - 
                   (allocation.used[fieldName] || 0) - 
                   (allocation.pending[fieldName] || 0);

  if (available < days) {
    return res.status(400).json({
      success: false,
      message: `Insufficient ${leaveType} balance. Available: ${available} days`,
      available
    });
  }

  // Deduct from allocation
  allocation.used[fieldName] = (allocation.used[fieldName] || 0) + days;
  await allocation.save();

  logger.info('Leaves deducted from allocation', {
    employeeId,
    leaveType,
    days,
    leaveRequestId
  });

  res.json({
    success: true,
    message: 'Leaves deducted successfully',
    data: allocation
  });
}));

/**
 * POST /api/leave-allocation/restore
 * Restore leaves when leave request is rejected
 */
router.post('/restore', asyncHandler(async (req, res) => {
  const { employeeId, leaveType, days, leaveRequestId } = req.body;

  if (!employeeId || !leaveType || !days) {
    return res.status(400).json({
      success: false,
      message: 'employeeId, leaveType, and days are required'
    });
  }

  if (!(await requireAllocationAccess(req, res, employeeId))) return;

  const fieldName = getLeaveFieldName(leaveType);
  if (!fieldName) {
    return res.status(400).json({
      success: false,
      message: 'Invalid leave type'
    });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const allocation = await LeaveAllocation.findOne({
    employeeId,
    year: currentYear,
    month: currentMonth
  });

  if (!allocation) {
    return res.status(400).json({
      success: false,
      message: 'No leave allocation found for this month'
    });
  }

  // Restore to allocation
  allocation.used[fieldName] = Math.max(0, (allocation.used[fieldName] || 0) - days);
  await allocation.save();

  logger.info('Leaves restored to allocation', {
    employeeId,
    leaveType,
    days,
    leaveRequestId
  });

  res.json({
    success: true,
    message: 'Leaves restored successfully',
    data: allocation
  });
}));

/**
 * POST /api/leave-allocation/yearly-allocate
 * Allocate yearly leaves (Casual, Earned, Medical) to employees
 */
router.post('/yearly-allocate', authorize('super_admin', 'admin', 'hr'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { orgId, year, employees, casualLeave, earnedLeave, medicalLeave, allocatedBy } = req.body;
  const tenantOrg = scopedOrgId(req);
  if (!tenantOrg) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'MISSING_ORG_CONTEXT',
    });
  }
  if (req.user.role !== 'super_admin' && String(orgId) !== String(tenantOrg)) {
    return res.status(403).json({
      success: false,
      message: 'Cannot yearly-allocate for another organization',
    });
  }

  if (!orgId || !year || !employees || !allocatedBy) {
    return res.status(400).json({
      success: false,
      message: 'orgId, year, employees, and allocatedBy are required'
    });
  }

  const results = [];
  const errors = [];

  for (const employeeId of employees) {
    try {
      // For yearly allocation, we allocate to January (month 1)
      const month = 1;
      
      let allocation = await LeaveAllocation.findOne({
        employeeId,
        year,
        month
      });

      if (allocation) {
        // Update existing allocation
        allocation.yearlyAllocations = {
          casualLeave: casualLeave || 0,
          earnedLeave: earnedLeave || 0,
          medicalLeave: medicalLeave || 0
        };
        
        // Also update the allocations for the month
        allocation.allocations.casualLeave = (allocation.allocations.casualLeave || 0) + (casualLeave || 0);
        allocation.allocations.earnedLeave = (allocation.allocations.earnedLeave || 0) + (earnedLeave || 0);
        allocation.allocations.medicalLeave = (allocation.allocations.medicalLeave || 0) + (medicalLeave || 0);
        
        allocation.status = 'allocated';
        allocation.allocatedBy = allocatedBy;
        allocation.allocatedDate = new Date();
        await allocation.save();
      } else {
        // Create new allocation
        allocation = await LeaveAllocation.create({
          employeeId,
          orgId,
          year,
          month,
          allocations: {
            vacation: 0,
            sickLeave: 0,
            casualLeave: casualLeave || 0,
            earnedLeave: earnedLeave || 0,
            medicalLeave: medicalLeave || 0,
            maternityLeave: 0,
            paternityLeave: 0,
            compensatoryOff: 0,
            personal: 0,
            emergency: 0,
            ncns: 0,
            sandwichLeave: 0
          },
          yearlyAllocations: {
            casualLeave: casualLeave || 0,
            earnedLeave: earnedLeave || 0,
            medicalLeave: medicalLeave || 0
          },
          status: 'allocated',
          allocatedBy,
          allocatedDate: new Date()
        });
      }

      results.push({
        employeeId,
        success: true,
        allocationId: allocation._id
      });
    } catch (error) {
      errors.push({
        employeeId,
        success: false,
        error: error.message
      });
    }
  }

  logger.info('Yearly leave allocation completed', {
    orgId,
    year,
    successCount: results.length,
    errorCount: errors.length
  });

  res.json({
    success: true,
    message: `Allocated yearly leaves to ${results.length} employees`,
    data: {
      results,
      errors
    }
  });
}));

/**
 * POST /api/leave-allocation/bulk-allocate
 * Bulk allocate leaves to multiple employees
 */
router.post('/bulk-allocate', authorize('super_admin', 'admin', 'hr'), idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { orgId, year, month, employees, allocations, allocatedBy } = req.body;
  const tenantOrg = scopedOrgId(req);
  if (!tenantOrg) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'MISSING_ORG_CONTEXT',
    });
  }
  if (req.user.role !== 'super_admin' && String(orgId) !== String(tenantOrg)) {
    return res.status(403).json({
      success: false,
      message: 'Cannot bulk-allocate for another organization',
    });
  }

  if (!orgId || !year || !month || !employees || !allocations || !allocatedBy) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  const results = [];
  const errors = [];

  for (const employeeId of employees) {
    try {
      let allocation = await LeaveAllocation.findOne({
        employeeId,
        year,
        month
      });

      if (allocation) {
        allocation.allocations = allocations;
        allocation.status = 'allocated';
        allocation.allocatedBy = allocatedBy;
        allocation.allocatedDate = new Date();
        await allocation.save();
      } else {
        allocation = await LeaveAllocation.create({
          employeeId,
          orgId,
          year,
          month,
          allocations,
          status: 'allocated',
          allocatedBy,
          allocatedDate: new Date()
        });
      }

      results.push({
        employeeId,
        success: true,
        allocationId: allocation._id
      });
    } catch (error) {
      errors.push({
        employeeId,
        success: false,
        error: error.message
      });
    }
  }

  logger.info('Bulk leave allocation completed', {
    orgId,
    year,
    month,
    successCount: results.length,
    errorCount: errors.length
  });

  res.json({
    success: true,
    message: `Allocated leaves to ${results.length} employees`,
    data: {
      results,
      errors
    }
  });
}));

export default router;
