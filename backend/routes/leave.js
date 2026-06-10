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
import { emitLeaveKPIUpdate } from '../utils/kpiUpdater.js';
import { dashboardCache } from '../utils/dashboardCache.js';
import {
  notifyAdminsOnLeaveSubmitted,
  resolveOrganizationSmtp,
  getHrInboxEmail
} from '../utils/workflowNotifications.js';
import {
  computeLeaveRemaining,
  findCurrentLeaveAllocation,
  getLeaveFieldName,
  getAllocatedTotal,
} from '../utils/leaveBalanceHelpers.js';
import {
  syncLeaveAllocationPending,
  syncLeaveAllocationOnApprove,
  syncLeaveAllocationReleasePending,
  computeLeaveDaysFromRequest,
} from '../utils/leaveAllocationSync.js';
import { authorize } from '../middleware/auth.js';
import {
  resolveQueryOrgId,
  denyIfCrossOrg,
  bulkOrgFilter,
  scopedOrgId,
  LEAVE_APPROVER_ROLES,
} from '../utils/leaveAccessHelpers.js';
import { userOrgIdFromReq } from '../utils/orgScopeHelpers.js';
import { findEmployeeForSelfService } from '../utils/employeeSelfService.js';
import { assertEmployeeSelfOrPrivileged } from '../utils/employeeAccessHelpers.js';
import {
  toObjectIdIfValid,
  userIdMatchFilter,
  isSelfServiceUser,
} from '../utils/mongoIdHelpers.js';

const SELF_SERVICE_LEAVE_ROLES = ['employee', 'manager', 'accountant'];

const router = express.Router();
const leaveApprovers = authorize(...LEAVE_APPROVER_ROLES);

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

  const tenantOrg = scopedOrgId(req);
  if (!tenantOrg) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'MISSING_ORG_CONTEXT',
    });
  }

  const query = { orgId: String(tenantOrg) };

  if (SELF_SERVICE_LEAVE_ROLES.includes(req.user.role)) {
    Object.assign(query, userIdMatchFilter(req.user.userId));
  } else if (userId) {
    Object.assign(query, userIdMatchFilter(userId));
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
  const tenantOrg = scopedOrgId(req);
  const leaveRequest = await LeaveRequest.findOne({
    _id: id,
    ...(tenantOrg ? { orgId: String(tenantOrg) } : {}),
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

  const privileged = LEAVE_APPROVER_ROLES.includes(req.user.role);
  if (!privileged) {
    const emp = await findEmployeeForSelfService(req.user.userId, tenantOrg, {
      allowCrossOrgFallback: true,
    });
    if (
      !emp ||
      String(leaveRequest.userId) !== String(req.user.userId) ||
      String(leaveRequest.employeeId) !== String(emp._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own pending leave requests',
      });
    }
  }

  if (leaveRequest.status === 'pending') {
    const LeaveAllocation = (await import('../models/LeaveAllocation.js')).default;
    await syncLeaveAllocationReleasePending(LeaveAllocation, leaveRequest);
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
  const {
    leaveType,
    startDate,
    endDate,
    reason,
    isHalfDay,
    halfDaySession,
    isHourlyLeave,
    isShortLeave,
    leaveDuration,
    startTime,
    endTime
  } = req.body;

  // CRITICAL: Enforce orgId validation - users can only update their organization's data
  const tenantOrg = scopedOrgId(req);
  const leaveRequest = await LeaveRequest.findOne({
    _id: id,
    ...(tenantOrg ? { orgId: String(tenantOrg) } : {}),
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

  const privileged = LEAVE_APPROVER_ROLES.includes(req.user.role);
  if (!privileged) {
    const emp = await findEmployeeForSelfService(req.user.userId, tenantOrg, {
      allowCrossOrgFallback: true,
    });
    if (
      !emp ||
      !isSelfServiceUser(req, leaveRequest.userId) ||
      String(leaveRequest.employeeId) !== String(emp._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own pending leave requests',
      });
    }
  }

  let resolvedHourly =
    typeof isHourlyLeave === 'boolean'
      ? isHourlyLeave
      : typeof isShortLeave === 'boolean'
        ? isShortLeave
        : leaveRequest.isHourlyLeave;
  let resolvedHalfDay =
    typeof isHalfDay === 'boolean' ? isHalfDay : leaveRequest.isHalfDay;
  let resolvedHalfSession =
    halfDaySession === 'first_half' || halfDaySession === 'second_half'
      ? halfDaySession
      : leaveRequest.halfDaySession || 'none';

  if (leaveDuration === 'first_half') {
    resolvedHalfDay = true;
    resolvedHalfSession = 'first_half';
    resolvedHourly = false;
  } else if (leaveDuration === 'second_half') {
    resolvedHalfDay = true;
    resolvedHalfSession = 'second_half';
    resolvedHourly = false;
  } else if (leaveDuration === 'hourly') {
    resolvedHourly = true;
    resolvedHalfDay = false;
    resolvedHalfSession = 'none';
  } else if (leaveDuration === 'full') {
    resolvedHalfDay = false;
    resolvedHalfSession = 'none';
    resolvedHourly = false;
  }

  const patchSet = {
    isHalfDay: resolvedHalfDay,
    halfDaySession: resolvedHalfSession,
    isHourlyLeave: resolvedHourly,
  };
  if (leaveType) patchSet.type = leaveType;
  if (startDate) patchSet.startDate = new Date(startDate);
  if (endDate) patchSet.endDate = new Date(endDate);
  if (reason) patchSet.reason = reason;
  if (resolvedHourly) {
    if (startTime) patchSet.startTime = startTime;
    if (endTime) patchSet.endTime = endTime;
  } else {
    patchSet.startTime = undefined;
    patchSet.endTime = undefined;
  }

  const version = leaveRequest.__v;
  const recordOrg = String(tenantOrg || leaveRequest.orgId || '');
  const updated = await LeaveRequest.findOneAndUpdate(
    {
      _id: id,
      ...(recordOrg ? { orgId: recordOrg } : {}),
      status: 'pending',
      __v: version,
    },
    {
      $set: patchSet,
      $inc: { __v: 1 },
    },
    { new: true }
  );

  if (!updated) {
    return res.status(409).json({
      success: false,
      message: 'Leave request was modified by another user. Please refresh and try again.',
      code: 'VERSION_CONFLICT',
    });
  }

  const LeaveAllocation = (await import('../models/LeaveAllocation.js')).default;
  const oldDays = computeLeaveDaysFromRequest(leaveRequest);
  const newDays = computeLeaveDaysFromRequest(updated);
  const oldType = leaveRequest.type;
  const newType = updated.type;
  if (oldDays > 0) {
    await syncLeaveAllocationReleasePending(LeaveAllocation, leaveRequest);
  }
  if (newDays > 0) {
    await syncLeaveAllocationPending(LeaveAllocation, {
      employeeId: updated.employeeId,
      orgId: updated.orgId,
      leaveType: newType,
      days: newDays,
      when: updated.startDate,
      action: 'add',
    });
  }

  logger.info('Leave request updated', {
    leaveRequestId: id,
    employeeId: updated.employeeId,
    orgId: recordOrg,
    userId: req.user.userId
  });

  res.json({
    success: true,
    message: 'Leave request updated successfully',
    data: { leaveRequest: updated }
  });
}));

/**
 * PATCH /api/leave-requests/:id/approve
 * Approve leave request (must come before GET /:id)
 */
router.patch('/:id/approve', leaveApprovers, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comments = '' } = req.body;
  const approvedBy = req.user.userId;

  const leaveForAuth = await LeaveRequest.findById(id).select('orgId').lean();
  if (!leaveForAuth) {
    return res.status(404).json({ success: false, message: 'Leave request not found' });
  }
  if (denyIfCrossOrg(req, res, leaveForAuth.orgId)) return;

  // Use Leave Policy Engine if available
  if (global.leavePolicyEngine) {
    try {
      const result = await global.leavePolicyEngine.approveLeaveRequest(id, approvedBy, comments);

      logger.info('Smart leave approval processed', {
        leaveRequestId: id,
        approvedBy,
        employeeId: result.leaveRequest.employeeId._id
      });

      try {
        const lr = result.leaveRequest;
        const populated = await LeaveRequest.findById(lr._id || id)
          .populate('userId', 'name email')
          .populate('approvedBy', 'name email');
        if (populated?.userId?.email) {
          const employeeRecord = await Employee.findOne({ userId: populated.userId._id })
            .select('_id orgId')
            .lean();
          const orgSmtp = await resolveOrganizationSmtp(populated.orgId);
          const employee = {
            userId: populated.userId._id,
            _id: employeeRecord?._id,
            name: populated.userId.name || populated.employeeName,
            email: populated.userId.email,
            orgId: employeeRecord?.orgId || populated.orgId
          };
          const approver = {
            _id: populated.approvedBy?._id || approvedBy,
            name: populated.approvedBy?.name || 'Manager'
          };
          await EmailNotificationService.sendLeaveApproved(employee, populated, approver, {
            organizationSmtp: orgSmtp
          });
          await EmailNotificationService.sendLeaveApprovedToHR(
            employee,
            populated,
            approver,
            getHrInboxEmail(),
            { organizationSmtp: orgSmtp }
          );
        }
      } catch (notifyErr) {
        logger.warn('Smart leave approval emails failed', { error: notifyErr.message, leaveRequestId: id });
      }

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

  if (denyIfCrossOrg(req, res, leaveRequest.orgId)) return;

  if (leaveRequest.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Leave request is already ${leaveRequest.status}`
    });
  }

  // CRITICAL: Validate leave balance before approval
  const LeaveAllocation = (await import('../models/LeaveAllocation.js')).default;
  const allocation = await findCurrentLeaveAllocation(
    LeaveAllocation,
    leaveRequest.employeeId,
    leaveRequest.orgId
  );

  if (!allocation || !getLeaveFieldName(leaveRequest.type)) {
    return res.status(400).json({
      success: false,
      message: `No leave allocation found for ${leaveRequest.type} leave type`
    });
  }

  // Calculate days for this leave request
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const days = leaveRequest.isHalfDay ? 0.5 : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const availableBalance = computeLeaveRemaining(allocation, leaveRequest.type);

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

  await syncLeaveAllocationOnApprove(LeaveAllocation, updated);

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
    const orgSmtp = await resolveOrganizationSmtp(updated.orgId);
    const employee = {
      userId: updated.userId?._id || updated.userId,
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
      await EmailNotificationService.sendLeaveApproved(employee, updated, approver, { organizationSmtp: orgSmtp });
      logger.info('Leave approved email sent', { leaveRequestId: id, email: employee.email });

      const hrEmail = getHrInboxEmail();
      if (hrEmail) {
        await EmailNotificationService.sendLeaveApprovedToHR(employee, updated, approver, hrEmail, {
          organizationSmtp: orgSmtp
        });
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

  // Invalidate dashboard cache for this organization
  dashboardCache.invalidateEndpoint('/dashboard/quick-stats', updated.orgId);
  dashboardCache.invalidateEndpoint('/dashboard/stats', updated.orgId);

  // Emit KPI update to admin dashboard
  if (global.io) {
    emitLeaveKPIUpdate(global.io, updated.orgId, {
      action: 'approve',
      _id: updated._id,
      status: 'approved',
      employeeId: updated.employeeId
    }).catch(err => logger.error('Failed to emit KPI update on leave approval', { error: err.message }));
  }
}));

/**
 * PATCH /api/leave-requests/:id/reject
 * Reject leave request (must come before GET /:id)
 */
router.patch('/:id/reject', leaveApprovers, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;
  const rejectedBy = req.user.userId;

  const leaveForAuth = await LeaveRequest.findById(id).select('orgId').lean();
  if (!leaveForAuth) {
    return res.status(404).json({ success: false, message: 'Leave request not found' });
  }
  if (denyIfCrossOrg(req, res, leaveForAuth.orgId)) return;

  if (!rejectionReason) {
    return res.status(400).json({
      success: false,
      message: 'rejectionReason is required'
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

      try {
        const lr = result.leaveRequest;
        const populated = await LeaveRequest.findById(lr._id || id)
          .populate('userId', 'name email')
          .populate('rejectedBy', 'name email');
        if (populated?.userId?.email) {
          const employeeRecord = await Employee.findOne({ userId: populated.userId._id })
            .select('_id orgId')
            .lean();
          const orgSmtp = await resolveOrganizationSmtp(populated.orgId);
          const employee = {
            userId: populated.userId._id,
            _id: employeeRecord?._id,
            name: populated.userId.name || populated.employeeName,
            email: populated.userId.email,
            orgId: employeeRecord?.orgId || populated.orgId
          };
          const rejector = {
            _id: populated.rejectedBy?._id || rejectedBy,
            name: populated.rejectedBy?.name || 'Manager'
          };
          await EmailNotificationService.sendLeaveRejected(
            employee,
            populated,
            rejector,
            rejectionReason,
            { organizationSmtp: orgSmtp }
          );
        }
      } catch (notifyErr) {
        logger.warn('Smart leave rejection emails failed', { error: notifyErr.message, leaveRequestId: id });
      }

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

  const LeaveAllocationReject = (await import('../models/LeaveAllocation.js')).default;
  await syncLeaveAllocationReleasePending(LeaveAllocationReject, leaveRequest);

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
    const orgSmtp = await resolveOrganizationSmtp(updated.orgId);
    const employee = {
      userId: updated.userId?._id || updated.userId,
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
      await EmailNotificationService.sendLeaveRejected(employee, updated, rejector, rejectionReason, {
        organizationSmtp: orgSmtp
      });
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

  // Invalidate dashboard cache for this organization
  dashboardCache.invalidateEndpoint('/dashboard/quick-stats', updated.orgId);
  dashboardCache.invalidateEndpoint('/dashboard/stats', updated.orgId);

  // Emit KPI update to admin dashboard
  if (global.io) {
    emitLeaveKPIUpdate(global.io, updated.orgId, {
      action: 'reject',
      _id: updated._id,
      status: 'rejected',
      employeeId: updated.employeeId
    }).catch(err => logger.error('Failed to emit KPI update on leave rejection', { error: err.message }));
  }
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
  let tenantOrg = scopedOrgId(req);
  if (!tenantOrg) {
    const emp = await findEmployeeForSelfService(req.user.userId, null, {
      allowCrossOrgFallback: true,
    });
    if (emp?.orgId) tenantOrg = String(emp.orgId);
  }
  if (!tenantOrg) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'MISSING_ORG_CONTEXT',
    });
  }

  if (
    ['employee', 'manager', 'accountant'].includes(req.user.role) &&
    !isSelfServiceUser(req, userId)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  const query = { orgId: String(tenantOrg) };

  if (
    ['employee', 'manager', 'accountant'].includes(req.user.role) &&
    isSelfServiceUser(req, userId)
  ) {
    const emp = await findEmployeeForSelfService(req.user.userId, tenantOrg, {
      allowCrossOrgFallback: true,
    });
    const userFilters = userIdMatchFilter(req.user.userId);
    if (emp?._id) {
      query.$or = [
        ...(userFilters.$or ? userFilters.$or : [userFilters]),
        { employeeId: emp._id },
      ];
    } else {
      Object.assign(query, userFilters);
    }
  } else {
    Object.assign(query, userIdMatchFilter(userId));
  }
  
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
router.get('/stats/summary', leaveApprovers, asyncHandler(async (req, res) => {
  const { orgId, startDate, endDate } = req.query;
  const scoped = resolveQueryOrgId(req, orgId);
  if (!scoped) {
    return res.status(400).json({
      success: false,
      message: 'Organization context is required',
    });
  }

  const query = { orgId: String(scoped) };
  
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

  if (denyIfCrossOrg(req, res, leaveRequest.orgId)) return;

  if (SELF_SERVICE_LEAVE_ROLES.includes(req.user.role)) {
    const tenantOrg = scopedOrgId(req);
    const emp = await findEmployeeForSelfService(req.user.userId, tenantOrg, {
      allowCrossOrgFallback: true,
    });
    if (
      !emp ||
      !isSelfServiceUser(req, leaveRequest.userId) ||
      String(leaveRequest.employeeId) !== String(emp._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }
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
    isShortLeave = false,
    halfDaySession: bodyHalfDaySession,
    leaveDuration,
    startTime,
    endTime,
    orgId
  } = req.body;

  let resolvedHourly = Boolean(isHourlyLeave) || Boolean(isShortLeave);
  let resolvedHalfDay = Boolean(isHalfDay);
  let resolvedHalfSession =
    bodyHalfDaySession === "first_half" || bodyHalfDaySession === "second_half"
      ? bodyHalfDaySession
      : "none";

  if (leaveDuration === "first_half") {
    resolvedHalfDay = true;
    resolvedHalfSession = "first_half";
    resolvedHourly = false;
  } else if (leaveDuration === "second_half") {
    resolvedHalfDay = true;
    resolvedHalfSession = "second_half";
    resolvedHourly = false;
  } else if (leaveDuration === "hourly") {
    resolvedHourly = true;
    resolvedHalfDay = false;
    resolvedHalfSession = "none";
  } else if (leaveDuration === "full") {
    resolvedHalfDay = false;
    resolvedHalfSession = "none";
    resolvedHourly = false;
  }

  // Validate required fields (orgId resolved from JWT / body below)
  if (!userId || !employeeId || !leaveType || !startDate || !endDate || !reason) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  const tenantOrg =
    scopedOrgId(req) || userOrgIdFromReq(req) || String(orgId || '').trim() || null;
  const resolvedOrgId = tenantOrg || String(orgId || '').trim();
  if (!resolvedOrgId) {
    return res.status(400).json({
      success: false,
      message: 'Organization context is required',
    });
  }
  const isPrivilegedCreator = ['admin', 'hr', 'manager', 'super_admin'].includes(req.user.role);
  let effectiveUserId = userId;
  let effectiveEmployeeId = employeeId;
  let effectiveOrgId = resolvedOrgId;

  if (!isPrivilegedCreator) {
    const emp = await findEmployeeForSelfService(req.user.userId, resolvedOrgId, {
      allowCrossOrgFallback: false,
      createIfMissing: true,
    });
    if (!emp) {
      return res.status(403).json({
        success: false,
        message: 'Employee profile not found for your account',
      });
    }
    effectiveUserId = req.user.userId;
    effectiveEmployeeId = emp._id;
    effectiveOrgId = String(emp.orgId || resolvedOrgId);
  } else if (
    req.user.role !== 'super_admin' &&
    tenantOrg &&
    String(orgId) !== String(tenantOrg)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Cannot create leave for another organization',
    });
  }

  if (resolvedHourly && (!startTime || !endTime)) {
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

  // Smart policy engine is for HR/admin only — employees always get pending requests for approval
  if (global.leavePolicyEngine && isPrivilegedCreator) {
    try {
      const result = await global.leavePolicyEngine.processLeaveRequest({
        employeeId,
        leaveType,
        startDate,
        endDate,
        reason,
        isHalfDay: resolvedHalfDay,
        halfDaySession: resolvedHalfSession,
        isHourlyLeave: resolvedHourly,
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

      try {
        const submitter = await User.findById(userId).select('name email').lean();
        const employeeRecord = await Employee.findOne({ userId }).select('_id orgId').lean();
        const orgSmtp = await resolveOrganizationSmtp(orgId);
        if (submitter) {
          const empName = submitter.name || employeeName || 'Employee';
          const empEmail = submitter.email || '';
          if (empEmail && employeeRecord) {
            await EmailNotificationService.sendLeaveRequestSubmitted(
              {
                userId,
                _id: employeeRecord._id,
                name: empName,
                email: empEmail,
                orgId: employeeRecord.orgId || orgId
              },
              result.leaveRequest,
              { organizationSmtp: orgSmtp }
            );
          }
          await notifyAdminsOnLeaveSubmitted(orgId, {
            leaveRequest: result.leaveRequest,
            employeeUserId: userId,
            employeeName: empName,
            employeeEmail: empEmail
          });
        }
      } catch (notifyErr) {
        logger.warn('Smart leave notification emails failed', {
          error: notifyErr.message,
          leaveRequestId: result.leaveRequest._id
        });
      }

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
    }
  }

  // Fallback to basic leave request logic
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end < start) {
    return res.status(400).json({
      success: false,
      message: 'End date must be on or after start date'
    });
  }

  if (resolvedHalfDay && !resolvedHourly && start.toDateString() !== end.toDateString()) {
    return res.status(400).json({
      success: false,
      message: 'First-half or second-half leave must use the same start and end date'
    });
  }

  let days;
  if (resolvedHourly) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const totalMinutes = eh * 60 + em - (sh * 60 + sm);
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time for hourly leave'
      });
    }
    days = totalMinutes / 60 / 8;
  } else if (resolvedHalfDay) {
    days = 0.5;
  } else {
    days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }

  // Check for overlapping leave requests - FIXED for half-day leaves
  // Store under JWT tenant org for employees so admin leave list (scoped by org) always matches
  const allocationOrgId = String(
    !isPrivilegedCreator && tenantOrg
      ? tenantOrg
      : effectiveOrgId || tenantOrg || orgId || ''
  ).trim();

  let overlapQuery = {
    employeeId: effectiveEmployeeId,
    orgId: allocationOrgId,
    status: { $in: ['pending', 'approved'] }
  };

  if (resolvedHalfDay) {
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

  if (overlapping) {
    return res.status(400).json({
      success: false,
      message: 'You already have a leave request for this period',
      data: overlapping
    });
  }

  // CRITICAL: Check leave balance before creating request
  const LeaveAllocation = (await import('../models/LeaveAllocation.js')).default;
  const allocation = await findCurrentLeaveAllocation(
    LeaveAllocation,
    effectiveEmployeeId,
    allocationOrgId,
    start
  );

  const leaveField = getLeaveFieldName(leaveType);
  if (allocation && leaveField) {
    const allocatedTotal = getAllocatedTotal(allocation, leaveType);
    const availableBalance = computeLeaveRemaining(allocation, leaveType);
    if (allocatedTotal > 0 && availableBalance < days) {
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
  } else {
    logger.warn('Leave submitted without monthly allocation — pending for HR', {
      employeeId,
      leaveType,
      orgId: tenantOrg || orgId,
    });
  }

  const userObjectId = toObjectIdIfValid(effectiveUserId) || effectiveUserId;
  const employeeObjectId = toObjectIdIfValid(effectiveEmployeeId) || effectiveEmployeeId;

  // Create leave request
  const leaveRequest = await LeaveRequest.create({
    userId: userObjectId,
    employeeId: employeeObjectId,
    employeeName: employeeName,
    type: leaveType,
    startDate: start,
    endDate: end,
    reason,
    status: 'pending',
    orgId: allocationOrgId,
    isHalfDay: resolvedHalfDay,
    halfDaySession: resolvedHalfSession,
    isHourlyLeave: resolvedHourly,
    startTime: resolvedHourly ? startTime : undefined,
    endTime: resolvedHourly ? endTime : undefined
  });

  if (allocation && leaveField) {
    await syncLeaveAllocationPending(LeaveAllocation, {
      employeeId: employeeObjectId,
      orgId: allocationOrgId,
      leaveType,
      days,
      when: start,
      action: 'add',
    });
  }

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

  // Send email notification to employee (confirmation) + admins / Teams
  try {
    const user = await User.findById(userId).select('name email').lean();
    const employeeRecord = await Employee.findOne({ userId }).select('_id orgId employeeCode department').lean();

    const orgSmtp = await resolveOrganizationSmtp(orgId);

    if (employeeRecord) {
      const empName = user?.name || 'Employee';
      const empEmail = user?.email || '';
      if (empEmail) {
        await EmailNotificationService.sendLeaveRequestSubmitted(
          {
            userId,
            _id: employeeRecord._id,
            name: empName,
            email: empEmail,
            orgId: employeeRecord.orgId || orgId
          },
          { _id: leaveRequest._id, type: leaveType, startDate: start, endDate: end, reason },
          { organizationSmtp: orgSmtp }
        );
        logger.info('Leave request submitted email sent', { leaveRequestId: leaveRequest._id, email: empEmail });
      }

      await notifyAdminsOnLeaveSubmitted(orgId, {
        leaveRequest,
        employeeUserId: userId,
        employeeName: empName,
        employeeEmail: empEmail
      });
    } else {
      logger.warn('Missing employee record for leave submission notification', {
        leaveRequestId: leaveRequest._id,
        userId
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
router.post('/bulk-approve', leaveApprovers, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { requestIds } = req.body;
  const approvedBy = req.user.userId;

  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'requestIds array is required'
    });
  }

  // Update all pending requests
  const result = await LeaveRequest.updateMany(
    {
      _id: { $in: requestIds },
      status: 'pending',
      ...bulkOrgFilter(req),
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

  const LeaveAllocationBulk = (await import('../models/LeaveAllocation.js')).default;
  const approvedLeaves = await LeaveRequest.find({
    _id: { $in: requestIds },
    status: 'approved',
    ...bulkOrgFilter(req),
  }).lean();
  for (const lr of approvedLeaves) {
    await syncLeaveAllocationOnApprove(LeaveAllocationBulk, lr);
  }

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
router.post('/bulk-reject', leaveApprovers, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { requestIds, rejectionReason } = req.body;
  const rejectedBy = req.user.userId;

  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'requestIds array is required'
    });
  }

  if (!rejectionReason) {
    return res.status(400).json({
      success: false,
      message: 'rejectionReason is required'
    });
  }

  const LeaveAllocationBulkReject = (await import('../models/LeaveAllocation.js')).default;
  const pendingBeforeReject = await LeaveRequest.find({
    _id: { $in: requestIds },
    status: 'pending',
    ...bulkOrgFilter(req),
  }).lean();

  // Update all pending requests
  const result = await LeaveRequest.updateMany(
    {
      _id: { $in: requestIds },
      status: 'pending',
      ...bulkOrgFilter(req),
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

  for (const lr of pendingBeforeReject) {
    await syncLeaveAllocationReleasePending(LeaveAllocationBulkReject, lr);
  }

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
router.post('/policy', leaveApprovers, asyncHandler(async (req, res) => {
  const { policy } = req.body;
  const orgId =
    req.user.role === 'super_admin' && req.body.orgId ? req.body.orgId : req.user.orgId;

  if (!orgId || !policy) {
    return res.status(400).json({
      success: false,
      message: 'orgId and policy are required'
    });
  }

  if (req.user.role !== 'super_admin' && String(req.body.orgId || orgId) !== String(req.user.orgId)) {
    return res.status(403).json({
      success: false,
      message: 'Cannot update policy for another organization',
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

  if (
    req.user.role !== 'super_admin' &&
    String(orgId) !== String(req.user.orgId)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access',
    });
  }

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

  const balanceAccess = await assertEmployeeSelfOrPrivileged(req, employeeId);
  if (!balanceAccess.ok) {
    return res.status(balanceAccess.status).json({
      success: false,
      message: balanceAccess.message,
    });
  }

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
  const leaveRequestData = req.body || {};
  const { employeeId, userId } = leaveRequestData;

  if (SELF_SERVICE_LEAVE_ROLES.includes(req.user.role)) {
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required for validation',
      });
    }
    const access = await assertEmployeeSelfOrPrivileged(req, employeeId);
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }
    if (userId && !isSelfServiceUser(req, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot validate leave for another user',
      });
    }
    const tenantOrg = scopedOrgId(req);
    const emp = await findEmployeeForSelfService(req.user.userId, tenantOrg, {
      allowCrossOrgFallback: true,
    });
    if (!emp || String(employeeId) !== String(emp._id)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot validate leave for another employee',
      });
    }
  }

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
  const { reason } = req.body;
  const cancelledBy = req.user.userId;

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'reason is required'
    });
  }

  const tenantOrg = scopedOrgId(req);
  const leaveRequest = await LeaveRequest.findOne({
    _id: id,
    ...(tenantOrg ? { orgId: String(tenantOrg) } : {}),
  }).lean();

  if (!leaveRequest) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found',
    });
  }

  const privileged = LEAVE_APPROVER_ROLES.includes(req.user.role);
  if (!privileged) {
    const emp = await findEmployeeForSelfService(req.user.userId, tenantOrg, {
      allowCrossOrgFallback: true,
    });
    if (
      !emp ||
      !isSelfServiceUser(req, leaveRequest.userId) ||
      String(leaveRequest.employeeId) !== String(emp._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own leave requests',
      });
    }
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
router.get('/analytics', leaveApprovers, asyncHandler(async (req, res) => {
  const { timeframe = 30 } = req.query;
  const orgId = resolveQueryOrgId(req, req.query.orgId);

  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: 'Organization context is required'
    });
  }

  if (denyIfCrossOrg(req, res, orgId)) return;

  if (!global.leavePolicyEngine) {
    return res.status(503).json({
      success: false,
      message: 'Leave policy engine not available'
    });
  }

  const analytics = await global.leavePolicyEngine.getLeaveAnalytics(
    orgId,
    parseInt(timeframe, 10)
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
router.get('/system/stats', leaveApprovers, asyncHandler(async (req, res) => {
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
