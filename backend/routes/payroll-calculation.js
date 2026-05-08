import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import PayrollCalculation from '../models/PayrollCalculation.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import LeaveRequest from '../models/LeaveRequest.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Calculate working days between two dates
 */
const calculateWorkingDays = async (fromDate, toDate, employeeId, orgId) => {
  try {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    let totalDays = 0;
    let weekOffs = 0;
    let holidays = 0;
    let leaves = 0;
    let sandwichLeaves = 0;
    let workingDays = 0;

    // Count total days
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      totalDays++;
    }

    // Get holidays in date range
    const holidayRecords = await Holiday.find({
      orgId,
      date: { $gte: from, $lte: to }
    });
    holidays = holidayRecords.length;

    // Get leaves in date range
    const leaveRecords = await LeaveRequest.find({
      employeeId,
      fromDate: { $lte: to },
      toDate: { $gte: from },
      status: 'approved'
    });

    let leaveCount = 0;
    leaveRecords.forEach(leave => {
      const leaveFrom = new Date(Math.max(from, new Date(leave.fromDate)));
      const leaveTo = new Date(Math.min(to, new Date(leave.toDate)));
      const days = Math.ceil((leaveTo - leaveFrom) / (1000 * 60 * 60 * 24)) + 1;
      
      if (leave.leaveType === 'sandwich') {
        sandwichLeaves += days;
      } else {
        leaveCount += days;
      }
    });
    leaves = leaveCount;

    // Count week-offs (Sundays by default)
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) { // Sunday
        weekOffs++;
      }
    }

    // Calculate working days
    workingDays = totalDays - weekOffs - holidays - leaves - sandwichLeaves;

    return {
      totalDays,
      weekOffs,
      holidays,
      leaves,
      sandwichLeaves,
      workingDays
    };
  } catch (error) {
    logger.error('Error calculating working days:', error);
    throw error;
  }
};

/**
 * POST /api/payroll/calculate
 * Calculate payroll for an employee
 */
router.post('/calculate', authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const {
    employeeId,
    fromDate,
    toDate,
    baseSalary,
    components = {},
    deductions = {},
    earnings = {},
    salaryCycleId,
    notes
  } = req.body;

  const orgId = req.user.orgId;

  try {
    // Validate employee
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Calculate per day salary
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const daysInRange = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
    const perDaySalary = baseSalary / 30; // Assuming 30 days in a month

    // Calculate working days
    const workingDaysData = await calculateWorkingDays(fromDate, toDate, employeeId, orgId);

    // Calculate gross salary
    const totalComponents = Object.values(components).reduce((a, b) => a + b, 0);
    const grossSalary = (perDaySalary * workingDaysData.workingDays) + totalComponents;

    // Calculate total deductions
    const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);

    // Calculate total earnings
    const totalEarnings = grossSalary + Object.values(earnings).reduce((a, b) => a + b, 0);

    // Calculate net salary
    const netSalary = totalEarnings - totalDeductions;

    // Create payroll calculation record
    const payrollCalculation = new PayrollCalculation({
      employeeId,
      userId: employee.userId,
      orgId,
      baseSalary,
      perDaySalary,
      fromDate,
      toDate,
      ...workingDaysData,
      components,
      deductions,
      earnings,
      totalEarnings,
      totalDeductions,
      netSalary,
      salaryCycleId,
      notes,
      status: 'calculated'
    });

    await payrollCalculation.save();

    logger.info('Payroll calculated', {
      employeeId,
      payrollId: payrollCalculation._id,
      netSalary,
      orgId
    });

    res.status(201).json({
      success: true,
      message: 'Payroll calculated successfully',
      data: payrollCalculation
    });
  } catch (error) {
    logger.error('Error calculating payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate payroll'
    });
  }
}));

/**
 * GET /api/payroll
 * Get all payroll calculations for the organization
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const orgId = req.user.orgId;

  try {
    const payrolls = await PayrollCalculation.find({ orgId })
      .populate('employeeId', 'employeeCode designation department')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: payrolls
    });
  } catch (error) {
    logger.error('Error fetching payrolls:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payrolls'
    });
  }
}));

/**
 * GET /api/payroll/:id
 * Get payroll calculation details
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user.orgId;

  try {
    const payroll = await PayrollCalculation.findById(id)
      .populate('employeeId', 'employeeCode designation department')
      .populate('userId', 'name email')
      .populate('salaryCycleId', 'name startDate endDate paymentDate');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    // Verify organization access
    if (payroll.orgId.toString() !== orgId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    res.json({
      success: true,
      data: payroll
    });
  } catch (error) {
    logger.error('Error fetching payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payroll'
    });
  }
}));

/**
 * GET /api/payroll/employee/:employeeId
 * Get all payroll calculations for an employee
 */
router.get('/employee/:employeeId', authenticate, asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const orgId = req.user.orgId;

  try {
    const payrolls = await PayrollCalculation.find({
      employeeId,
      orgId
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: payrolls
    });
  } catch (error) {
    logger.error('Error fetching employee payrolls:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payrolls'
    });
  }
}));

/**
 * PUT /api/payroll/:id/approve
 * Approve payroll calculation
 */
router.put('/:id/approve', authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user.orgId;

  try {
    const payroll = await PayrollCalculation.findById(id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.orgId.toString() !== orgId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    payroll.status = 'approved';
    payroll.approvedBy = req.user.userId;
    payroll.approvedDate = new Date();
    await payroll.save();

    logger.info('Payroll approved', {
      payrollId: id,
      approvedBy: req.user.userId,
      orgId
    });

    res.json({
      success: true,
      message: 'Payroll approved successfully',
      data: payroll
    });
  } catch (error) {
    logger.error('Error approving payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve payroll'
    });
  }
}));

/**
 * PUT /api/payroll/:id/mark-paid
 * Mark payroll as paid
 */
router.put('/:id/mark-paid', authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user.orgId;

  try {
    const payroll = await PayrollCalculation.findById(id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.orgId.toString() !== orgId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    payroll.status = 'paid';
    payroll.paidDate = new Date();
    await payroll.save();

    logger.info('Payroll marked as paid', {
      payrollId: id,
      orgId
    });

    res.json({
      success: true,
      message: 'Payroll marked as paid',
      data: payroll
    });
  } catch (error) {
    logger.error('Error marking payroll as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark payroll as paid'
    });
  }
}));

/**
 * GET /api/payroll/fnf/calculate/:employeeId
 * Calculate FNF (Full and Final) settlement
 */
router.get('/fnf/calculate/:employeeId', authenticate, authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const orgId = req.user.orgId;

  try {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get all payroll calculations for the employee
    const payrolls = await PayrollCalculation.find({
      employeeId,
      orgId,
      status: { $in: ['calculated', 'approved', 'paid'] }
    });

    // Calculate total earnings
    const totalEarnings = payrolls.reduce((sum, p) => sum + p.totalEarnings, 0);
    const totalDeductions = payrolls.reduce((sum, p) => sum + p.totalDeductions, 0);
    const totalNetSalary = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

    // Get pending leaves
    const pendingLeaves = await LeaveRequest.find({
      employeeId,
      status: 'approved',
      toDate: { $lt: new Date() }
    });

    const leaveEncashment = pendingLeaves.length * (employee.baseSalary / 30);

    // Calculate FNF
    const fnfAmount = totalNetSalary + leaveEncashment;

    res.json({
      success: true,
      data: {
        employeeId,
        employeeName: employee.userId?.name,
        totalEarnings,
        totalDeductions,
        totalNetSalary,
        pendingLeaves: pendingLeaves.length,
        leaveEncashment,
        fnfAmount,
        calculatedDate: new Date()
      }
    });
  } catch (error) {
    logger.error('Error calculating FNF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate FNF'
    });
  }
}));

export default router;
