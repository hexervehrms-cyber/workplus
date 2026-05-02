/**
 * Payroll Routes with Pagination and Race Condition Prevention
 * P0 CRITICAL FIXES Applied:
 * - Pagination for large datasets
 * - .lean() for read-only queries
 * - Optimistic locking for payroll processing
 * - Idempotency for payroll generation (CRITICAL - prevents duplicate payments)
 * - Transaction-safe payroll operations
 */

import express from 'express';
import mongoose from 'mongoose';
import Payslip from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import idempotencyMiddleware from '../middleware/idempotency.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware
router.use(paginationMiddleware);

/**
 * GET /api/payroll
 * List payslips with pagination
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { employeeId, userId, month, year, status, orgId } = req.query;

  // Build query
  const query = {};
  
  if (orgId) {
    query.orgId = orgId;
  }
  
  if (employeeId) {
    query.employeeId = employeeId;
  }
  
  if (userId) {
    query.userId = userId;
  }
  
  if (month) {
    query.month = month;
  }
  
  if (year) {
    query.year = parseInt(year);
  }
  
  if (status) {
    query.status = status;
  }

  // Get total count
  const total = await Payslip.countDocuments(query);

  // Get paginated results with .lean()
  const payslips = await Payslip.find(query)
    .populate('employeeId', 'employeeCode department designation')
    .populate('userId', 'name email avatar')
    .populate('paidBy', 'name email')
    .sort({ year: -1, month: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  logger.info('Payslips listed', { total, page, limit });

  res.paginate(payslips, total);
}));

/**
 * GET /api/payroll/employee/:employeeId
 * Get payslips for specific employee
 */
router.get('/employee/:employeeId', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { employeeId } = req.params;
  const { year } = req.query;

  const query = { employeeId };
  
  if (year) {
    query.year = parseInt(year);
  }

  const total = await Payslip.countDocuments(query);

  const payslips = await Payslip.find(query)
    .populate('paidBy', 'name email')
    .sort({ year: -1, month: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  res.paginate(payslips, total);
}));

/**
 * GET /api/payroll/:id
 * Get single payslip
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id)
    .populate('employeeId', 'employeeCode department designation phone address')
    .populate('userId', 'name email avatar organization')
    .populate('paidBy', 'name email')
    .lean(); // P0 FIX: Use .lean() for read-only queries

  if (!payslip) {
    return res.status(404).json({
      success: false,
      message: 'Payslip not found'
    });
  }

  res.json({
    success: true,
    data: payslip
  });
}));

/**
 * POST /api/payroll/generate
 * Generate payslip with smart automated payroll system
 */
router.post('/generate', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeId, month, year, orgId } = req.body;

  // Validate required fields
  if (!employeeId || !month || !year || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'employeeId, month, year, and orgId are required'
    });
  }

  // Check if payslip already exists
  const existingPayslip = await Payslip.findOne({
    employeeId,
    month,
    year
  }).lean();

  if (existingPayslip) {
    logger.warn('Duplicate payslip generation attempt prevented', {
      employeeId,
      month,
      year,
      existingPayslipId: existingPayslip._id
    });
    
    return res.status(400).json({
      success: false,
      message: 'Payslip already exists for this employee and period',
      code: 'DUPLICATE_PAYSLIP',
      data: existingPayslip
    });
  }

  // Use Automated Payroll System if available
  if (global.automatedPayrollSystem) {
    try {
      const calculation = await global.automatedPayrollSystem.calculateEmployeePayroll(
        employeeId,
        month,
        year
      );

      const payslip = await global.automatedPayrollSystem.generatePayslip(calculation, false);

      logger.info('Smart payslip generated', {
        payslipId: payslip._id,
        employeeId,
        month,
        year,
        netSalary: calculation.netSalary
      });

      return res.status(201).json({
        success: true,
        message: 'Payslip generated successfully with automated calculations',
        data: {
          payslip,
          calculation: {
            grossSalary: calculation.earnings.grossSalary,
            totalDeductions: calculation.deductions.totalDeductions + calculation.taxes.totalTax,
            netSalary: calculation.netSalary,
            attendanceSummary: calculation.attendanceSummary,
            leaveSummary: calculation.leaveSummary
          }
        }
      });

    } catch (payrollError) {
      logger.warn('Smart payroll generation failed, falling back to basic', {
        error: payrollError.message,
        employeeId
      });
      
      return res.status(400).json({
        success: false,
        message: payrollError.message
      });
    }
  }

  // Fallback to basic payroll generation
  const employee = await Employee.findById(employeeId)
    .populate('userId', 'name email')
    .lean();

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  if (employee.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Cannot generate payslip for inactive employee'
    });
  }

  // Basic salary calculation
  const baseSalary = employee.baseSalary || 0;
  const hra = employee.hra || 0;
  const bonus = employee.bonus || 0;
  const incentives = employee.incentives || 0;
  const allowances = employee.allowances || 0;
  const grossSalary = baseSalary + hra + bonus + incentives + allowances;

  const providentFund = employee.providentFund || 0;
  const tax = employee.tax || 0;
  const insurance = employee.insurance || 0;
  const otherDeductions = employee.otherDeductions || 0;
  const totalDeductions = providentFund + tax + insurance + otherDeductions;
  const netPay = grossSalary - totalDeductions;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payslip = await Payslip.create([{
      employeeId,
      userId: employee.userId._id,
      month,
      year: parseInt(year),
      grossSalary,
      baseSalary,
      hra,
      bonus,
      incentives,
      allowances,
      providentFund,
      tax,
      insurance,
      otherDeductions,
      totalDeductions,
      netPay,
      status: 'draft',
      orgId
    }], { session });

    await session.commitTransaction();
    
    logger.info('Basic payslip generated', {
      payslipId: payslip[0]._id,
      employeeId,
      month,
      year,
      netPay
    });

    const populatedPayslip = await Payslip.findById(payslip[0]._id)
      .populate('employeeId', 'employeeCode department designation')
      .populate('userId', 'name email')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Payslip generated successfully',
      data: { payslip: populatedPayslip }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Payslip generation failed', { error: error.message, employeeId, month, year });
    throw error;
  } finally {
    session.endSession();
  }
}));

/**
 * POST /api/payroll/bulk-generate
 * Bulk generate payslips with automated payroll system
 */
router.post('/bulk-generate', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { employeeIds, month, year, orgId, autoApprove = false } = req.body;

  if (!month || !year || !orgId) {
    return res.status(400).json({
      success: false,
      message: 'month, year, and orgId are required'
    });
  }

  // Use Automated Payroll System if available
  if (global.automatedPayrollSystem) {
    try {
      const result = await global.automatedPayrollSystem.processOrganizationPayroll(
        orgId,
        month,
        year,
        {
          employeeIds,
          autoApprove,
          generatePayslips: true,
          sendNotifications: true
        }
      );

      logger.info('Smart bulk payroll processed', {
        orgId,
        month,
        year,
        totalEmployees: result.summary.totalEmployees,
        successful: result.summary.successfulProcessing,
        failed: result.summary.failedProcessing
      });

      return res.status(201).json({
        success: true,
        message: `Payroll processed for ${result.summary.successfulProcessing} employees`,
        data: {
          summary: result.summary,
          results: result.results,
          errors: result.errors
        }
      });

    } catch (payrollError) {
      logger.warn('Smart bulk payroll failed, falling back to basic', {
        error: payrollError.message,
        orgId
      });
      
      return res.status(400).json({
        success: false,
        message: payrollError.message
      });
    }
  }

  // Fallback to basic bulk generation
  if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'employeeIds array is required for basic bulk generation'
    });
  }

  // Check for existing payslips
  const existingPayslips = await Payslip.find({
    employeeId: { $in: employeeIds },
    month,
    year: parseInt(year)
  }).lean();

  const existingEmployeeIds = existingPayslips.map(p => p.employeeId.toString());
  const newEmployeeIds = employeeIds.filter(id => !existingEmployeeIds.includes(id));

  if (newEmployeeIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'All employees already have payslips for this period',
      data: {
        existing: existingPayslips.length,
        skipped: employeeIds.length
      }
    });
  }

  const employees = await Employee.find({
    _id: { $in: newEmployeeIds },
    status: 'active'
  }).populate('userId', 'name email').lean();

  if (employees.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No active employees found'
    });
  }

  const payslipsToCreate = employees.map(employee => {
    const baseSalary = employee.baseSalary || 0;
    const hra = employee.hra || 0;
    const bonus = employee.bonus || 0;
    const incentives = employee.incentives || 0;
    const allowances = employee.allowances || 0;
    const grossSalary = baseSalary + hra + bonus + incentives + allowances;

    const providentFund = employee.providentFund || 0;
    const tax = employee.tax || 0;
    const insurance = employee.insurance || 0;
    const otherDeductions = employee.otherDeductions || 0;
    const totalDeductions = providentFund + tax + insurance + otherDeductions;
    const netPay = grossSalary - totalDeductions;

    return {
      employeeId: employee._id,
      userId: employee.userId._id,
      month,
      year: parseInt(year),
      grossSalary,
      baseSalary,
      hra,
      bonus,
      incentives,
      allowances,
      providentFund,
      tax,
      insurance,
      otherDeductions,
      totalDeductions,
      netPay,
      status: 'draft',
      orgId
    };
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payslips = await Payslip.insertMany(payslipsToCreate, { session });
    await session.commitTransaction();

    logger.info('Basic bulk payslips generated', {
      count: payslips.length,
      month,
      year,
      skipped: existingPayslips.length
    });

    res.status(201).json({
      success: true,
      message: `${payslips.length} payslips generated successfully`,
      data: {
        generated: payslips.length,
        skipped: existingPayslips.length,
        total: employeeIds.length
      }
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Basic bulk payslip generation failed', { error: error.message });
    throw error;
  } finally {
    session.endSession();
  }
}));

/**
 * PATCH /api/payroll/:id/mark-paid
 * Mark payslip as paid with optimistic locking
 * P0 CRITICAL: Prevents double payment
 */
router.patch('/:id/mark-paid', idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paidBy } = req.body;

  if (!paidBy) {
    return res.status(400).json({
      success: false,
      message: 'paidBy is required'
    });
  }

  // Get current payslip
  const payslip = await Payslip.findById(id);

  if (!payslip) {
    return res.status(404).json({
      success: false,
      message: 'Payslip not found'
    });
  }

  if (payslip.status === 'paid') {
    logger.warn('Duplicate payment attempt prevented', {
      payslipId: id,
      paidBy
    });
    
    return res.status(400).json({
      success: false,
      message: 'Payslip is already marked as paid',
      code: 'ALREADY_PAID',
      data: payslip
    });
  }

  // P0 CRITICAL: Optimistic locking with version check
  const updated = await Payslip.findOneAndUpdate(
    {
      _id: id,
      __v: payslip.__v, // Version check
      status: { $ne: 'paid' } // Double-check not already paid
    },
    {
      $set: {
        status: 'paid',
        paidBy,
        paidDate: new Date()
      },
      $inc: { __v: 1 }
    },
    { new: true }
  ).populate('employeeId', 'employeeCode department')
   .populate('userId', 'name email')
   .populate('paidBy', 'name email');

  if (!updated) {
    return res.status(409).json({
      success: false,
      message: 'Payslip was modified by another user. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  logger.info('Payslip marked as paid', { payslipId: id, paidBy });

  res.json({
    success: true,
    message: 'Payslip marked as paid successfully',
    data: updated
  });
}));

/**
 * PUT /api/payroll/:id
 * Update payslip (only draft status) with optimistic locking
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove fields that shouldn't be updated
  delete updateData._id;
  delete updateData.employeeId;
  delete updateData.userId;
  delete updateData.status;
  delete updateData.paidBy;
  delete updateData.paidDate;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  // Recalculate totals
  const {
    baseSalary = 0,
    hra = 0,
    bonus = 0,
    incentives = 0,
    allowances = 0,
    providentFund = 0,
    tax = 0,
    insurance = 0,
    otherDeductions = 0,
    advanceDeductions = 0,
    loanDeductions = 0
  } = updateData;

  updateData.grossSalary = baseSalary + hra + bonus + incentives + allowances;
  updateData.totalDeductions = providentFund + tax + insurance + otherDeductions + advanceDeductions + loanDeductions;
  updateData.netPay = updateData.grossSalary - updateData.totalDeductions;

  // P0 FIX: Optimistic locking
  const currentVersion = updateData.__v;
  delete updateData.__v;

  const query = { _id: id, status: 'draft' }; // Only update draft payslips
  if (currentVersion !== undefined) {
    query.__v = currentVersion;
  }

  const payslip = await Payslip.findOneAndUpdate(
    query,
    {
      $set: updateData,
      $inc: { __v: 1 }
    },
    { new: true, runValidators: true }
  ).populate('employeeId', 'employeeCode department')
   .populate('userId', 'name email');

  if (!payslip) {
    return res.status(409).json({
      success: false,
      message: 'Payslip was modified or is no longer in draft status. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  logger.info('Payslip updated', { payslipId: id });

  res.json({
    success: true,
    message: 'Payslip updated successfully',
    data: payslip
  });
}));

/**
 * DELETE /api/payroll/:id
 * Delete payslip (only draft status)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payslip = await Payslip.findOneAndDelete({
    _id: id,
    status: 'draft' // Only delete draft payslips
  });

  if (!payslip) {
    return res.status(404).json({
      success: false,
      message: 'Payslip not found or cannot be deleted'
    });
  }

  logger.info('Payslip deleted', { payslipId: id });

  res.json({
    success: true,
    message: 'Payslip deleted successfully'
  });
}));

/**
 * GET /api/payroll/stats/summary
 * Get payroll statistics
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { orgId, year, month } = req.query;

  const query = {};
  
  if (orgId) {
    query.orgId = orgId;
  }
  
  if (year) {
    query.year = parseInt(year);
  }
  
  if (month) {
    query.month = month;
  }

  const [total, draft, paid, pending, totalPayout, byStatus, byMonth] = await Promise.all([
    Payslip.countDocuments(query),
    Payslip.countDocuments({ ...query, status: 'draft' }),
    Payslip.countDocuments({ ...query, status: 'paid' }),
    Payslip.countDocuments({ ...query, status: 'pending' }),
    Payslip.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$netPay' } } }
    ]),
    Payslip.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$netPay' } } }
    ]),
    Payslip.aggregate([
      { $match: query },
      { $group: { _id: { year: '$year', month: '$month' }, count: { $sum: 1 }, total: { $sum: '$netPay' } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ])
  ]);

  res.json({
    success: true,
    data: {
      total,
      draft,
      paid,
      pending,
      totalPayout: totalPayout[0]?.total || 0,
      byStatus,
      byMonth
    }
  });
}));

/**
 * POST /api/payroll/config
 * Set payroll configuration for organization
 */
router.post('/config', asyncHandler(async (req, res) => {
  const { orgId, config } = req.body;

  if (!orgId || !config) {
    return res.status(400).json({
      success: false,
      message: 'orgId and config are required'
    });
  }

  if (!global.automatedPayrollSystem) {
    return res.status(503).json({
      success: false,
      message: 'Automated payroll system not available'
    });
  }

  const updatedConfig = global.automatedPayrollSystem.setOrganizationConfig(orgId, config);

  logger.info('Payroll configuration updated', { orgId });

  res.json({
    success: true,
    message: 'Payroll configuration updated successfully',
    data: updatedConfig
  });
}));

/**
 * GET /api/payroll/config/:orgId
 * Get payroll configuration for organization
 */
router.get('/config/:orgId', asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  if (!global.automatedPayrollSystem) {
    return res.status(503).json({
      success: false,
      message: 'Automated payroll system not available'
    });
  }

  const config = global.automatedPayrollSystem.getOrganizationConfig(orgId);

  res.json({
    success: true,
    data: config
  });
}));

/**
 * POST /api/payroll/calculate
 * Calculate payroll for employee without generating payslip
 */
router.post('/calculate', asyncHandler(async (req, res) => {
  const { employeeId, month, year } = req.body;

  if (!employeeId || !month || !year) {
    return res.status(400).json({
      success: false,
      message: 'employeeId, month, and year are required'
    });
  }

  if (!global.automatedPayrollSystem) {
    return res.status(503).json({
      success: false,
      message: 'Automated payroll system not available'
    });
  }

  const calculation = await global.automatedPayrollSystem.calculateEmployeePayroll(
    employeeId,
    month,
    year
  );

  res.json({
    success: true,
    message: 'Payroll calculated successfully',
    data: calculation
  });
}));

/**
 * GET /api/payroll/analytics/:orgId/:year
 * Get payroll analytics for organization
 */
router.get('/analytics/:orgId/:year', asyncHandler(async (req, res) => {
  const { orgId, year } = req.params;

  if (!global.automatedPayrollSystem) {
    return res.status(503).json({
      success: false,
      message: 'Automated payroll system not available'
    });
  }

  const analytics = await global.automatedPayrollSystem.getPayrollAnalytics(
    orgId,
    parseInt(year)
  );

  res.json({
    success: true,
    data: analytics
  });
}));

/**
 * GET /api/payroll/system/stats
 * Get payroll system statistics
 */
router.get('/system/stats', asyncHandler(async (req, res) => {
  if (!global.automatedPayrollSystem) {
    return res.status(503).json({
      success: false,
      message: 'Automated payroll system not available'
    });
  }

  const stats = global.automatedPayrollSystem.getSystemStats();

  res.json({
    success: true,
    data: stats
  });
}));

export default router;
