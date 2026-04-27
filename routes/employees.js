/**
 * Employee Routes with Pagination and Optimistic Locking
 * P0 Critical Fixes Applied:
 * - Pagination for large datasets
 * - .lean() for read-only queries
 * - Optimistic locking for updates
 * - Proper error handling
 */

import express from 'express';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paginationMiddleware, applyPagination } from '../middleware/pagination.js';
import bcrypt from 'bcrypt';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware to all routes
router.use(paginationMiddleware);

/**
 * GET /api/employees
 * List all employees with pagination
 * Query params: page, limit, status, department
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { status, department, search } = req.query;

  // Build query
  const query = {};
  
  if (status) {
    query.status = status;
  }
  
  if (department) {
    query.department = department;
  }
  
  if (search) {
    // Search in employee code or populated user name/email
    query.$or = [
      { employeeCode: { $regex: search, $options: 'i' } },
      { department: { $regex: search, $options: 'i' } },
      { designation: { $regex: search, $options: 'i' } }
    ];
  }

  // Get total count for pagination
  const total = await Employee.countDocuments(query);

  // Get paginated results with .lean() for performance
  const employees = await Employee.find(query)
    .populate('userId', 'name email avatar role isActive')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  logger.info('Employees listed', { total, page, limit });

  res.paginate(employees, total);
}));

/**
 * GET /api/employees/:id
 * Get single employee by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id)
    .populate('userId', 'name email avatar role isActive organization')
    .lean(); // P0 FIX: Use .lean() for read-only queries

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  res.json({
    success: true,
    data: employee
  });
}));

/**
 * GET /api/employees/user/:userId
 * Get employee by user ID
 */
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.params.userId })
    .populate('userId', 'name email avatar role isActive organization')
    .lean(); // P0 FIX: Use .lean() for read-only queries

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  res.json({
    success: true,
    data: employee
  });
}));

/**
 * POST /api/employees
 * Create new employee (Admin only)
 * Creates both User and Employee records
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    employeeCode,
    designation,
    department,
    baseSalary,
    hra,
    bonus,
    incentives,
    allowances,
    providentFund,
    tax,
    insurance,
    otherDeductions,
    joiningDate,
    phone,
    address,
    orgId
  } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required'
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Check if employee code already exists
  if (employeeCode) {
    const existingEmployee = await Employee.findOne({ employeeCode }).lean();
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee code already exists'
      });
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role: 'employee',
    orgId: orgId || 'system',
    isActive: true
  });

  // Create employee
  const employee = await Employee.create({
    userId: user._id,
    employeeCode,
    designation,
    department,
    baseSalary: baseSalary || 0,
    hra: hra || 0,
    bonus: bonus || 0,
    incentives: incentives || 0,
    allowances: allowances || 0,
    providentFund: providentFund || 0,
    tax: tax || 0,
    insurance: insurance || 0,
    otherDeductions: otherDeductions || 0,
    joiningDate: joiningDate || new Date(),
    phone,
    address,
    status: 'active',
    orgId: orgId || 'system'
  });

  // Populate user data for response
  const populatedEmployee = await Employee.findById(employee._id)
    .populate('userId', 'name email avatar role')
    .lean();

  logger.info('Employee created', { employeeId: employee._id, userId: user._id });

  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: populatedEmployee
  });
}));

/**
 * PUT /api/employees/:id
 * Update employee with optimistic locking
 * P0 FIX: Uses version field to prevent race conditions
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove fields that shouldn't be updated directly
  delete updateData._id;
  delete updateData.userId;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  // P0 FIX: Optimistic locking - check version
  const currentVersion = updateData.__v;
  delete updateData.__v;

  const query = { _id: id };
  if (currentVersion !== undefined) {
    query.__v = currentVersion; // Only update if version matches
  }

  // Update employee with version increment
  const employee = await Employee.findOneAndUpdate(
    query,
    { 
      $set: updateData,
      $inc: { __v: 1 } // Increment version
    },
    { 
      new: true,
      runValidators: true
    }
  ).populate('userId', 'name email avatar role');

  if (!employee) {
    return res.status(409).json({
      success: false,
      message: 'Employee was modified by another user. Please refresh and try again.',
      code: 'VERSION_CONFLICT'
    });
  }

  logger.info('Employee updated', { employeeId: id });

  res.json({
    success: true,
    message: 'Employee updated successfully',
    data: employee
  });
}));

/**
 * DELETE /api/employees/:id
 * Soft delete employee (set status to terminated)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Soft delete - set status to terminated
  const employee = await Employee.findByIdAndUpdate(
    id,
    { 
      status: 'terminated',
      $inc: { __v: 1 }
    },
    { new: true }
  );

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Also deactivate user account
  await User.findByIdAndUpdate(employee.userId, { isActive: false });

  logger.info('Employee deleted (soft)', { employeeId: id });

  res.json({
    success: true,
    message: 'Employee deleted successfully'
  });
}));

/**
 * GET /api/employees/stats/summary
 * Get employee statistics
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { orgId } = req.query;

  const query = orgId ? { orgId } : {};

  const [total, active, inactive, terminated, byDepartment] = await Promise.all([
    Employee.countDocuments(query),
    Employee.countDocuments({ ...query, status: 'active' }),
    Employee.countDocuments({ ...query, status: 'inactive' }),
    Employee.countDocuments({ ...query, status: 'terminated' }),
    Employee.aggregate([
      { $match: query },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  res.json({
    success: true,
    data: {
      total,
      active,
      inactive,
      terminated,
      byDepartment
    }
  });
}));

export default router;
