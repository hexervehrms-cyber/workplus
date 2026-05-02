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
import { authorize, requirePermission } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply pagination middleware to all routes
router.use(paginationMiddleware);

/**
 * GET /api/employees
 * List all employees with pagination
 * Query params: page, limit, status, department
 * RBAC: Admin/HR can see all employees in org, Employees can only see basic info
 */
router.get('/', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = req.pagination;
  const { status, department, search } = req.query;
  const userRole = req.user.role;
  const userOrgId = req.user.orgId;

  // Build query based on role
  let query = { orgId: userOrgId };
  
  // Role-based filtering
  if (userRole === 'employee') {
    // Employees can only see basic info of other employees
    // They cannot see salary, personal details, etc.
    query.status = 'active'; // Only active employees
  } else {
    // Admin/HR/Manager can see all employees in their org
    // By default, exclude terminated employees unless explicitly requested
    if (status) {
      query.status = status;
    } else {
      // Default: show only active employees, exclude terminated
      query.status = { $ne: 'terminated' };
    }
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

  // Build projection based on role
  let projection = {};
  if (userRole === 'employee') {
    // Employees see limited fields
    projection = {
      userId: 1,
      employeeCode: 1,
      designation: 1,
      department: 1,
      joiningDate: 1,
      status: 1,
      // Hide salary and personal information
      baseSalary: 0,
      hra: 0,
      bonus: 0,
      phone: 0,
      address: 0
    };
  }

  // Get paginated results with .lean() for performance
  let employeeQuery = Employee.find(query, projection)
    .populate('userId', userRole === 'employee' ? 'name email avatar' : 'name email avatar role isActive')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(); // P0 FIX: Use .lean() for read-only queries

  const employees = await employeeQuery;

  logger.info('Employees listed', { 
    total, 
    page, 
    limit, 
    userRole, 
    orgId: userOrgId,
    userId: req.user.userId 
  });

  res.paginate(employees, total);
}));

/**
 * GET /api/employees/:id
 * Get single employee by ID
 * RBAC: Admin/HR can see all details, Employees can only see limited info
 */
router.get('/:id', authorize('super_admin', 'admin', 'hr', 'manager', 'employee'), asyncHandler(async (req, res) => {
  const userRole = req.user.role;
  const userOrgId = req.user.orgId;
  const userId = req.user.userId;

  // Build projection based on role
  let projection = {};
  if (userRole === 'employee') {
    // Employees can only see basic info and only their own record
    projection = {
      userId: 1,
      employeeCode: 1,
      designation: 1,
      department: 1,
      joiningDate: 1,
      status: 1,
      orgId: 1,
      // Hide salary and personal information
      baseSalary: 0,
      hra: 0,
      bonus: 0,
      phone: 0,
      address: 0
    };
  }

  const employee = await Employee.findOne({ 
    _id: req.params.id, 
    orgId: userOrgId 
  }, projection)
    .populate('userId', userRole === 'employee' ? 'name email avatar' : 'name email avatar role isActive organization')
    .lean(); // P0 FIX: Use .lean() for read-only queries

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Additional check: employees can only view their own record
  if (userRole === 'employee' && employee.userId._id.toString() !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only view your own employee record.'
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
 * Create new employee (Admin/HR only)
 * Creates both User and Employee records with lifecycle management
 * RBAC: Only admin and hr can create employees
 */
router.post('/', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
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
    managerId,
    startOnboarding = true
  } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required'
    });
  }

  // Get organization ID from authenticated user
  const orgId = req.user?.orgId || req.user?.organizationId || 'system';
  
  logger.info('Creating employee', { 
    name, 
    email, 
    orgId, 
    createdBy: req.user?.userId,
    userOrgId: req.user?.orgId,
    userOrganizationId: req.user?.organizationId
  });

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Check if employee code already exists (if provided)
    if (employeeCode) {
      const existingEmployee = await Employee.findOne({ employeeCode }).lean();
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Employee code already exists'
        });
      }
    }

    logger.info('Creating user for employee', { email, name });

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with hashed password
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword, // Already hashed
      role: 'employee',
      orgId: orgId,
      isActive: true
    });

    logger.info('User created successfully', { userId: user._id, email });

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
      orgId: orgId
    });

    logger.info('Employee created successfully', { employeeId: employee._id });

    // Populate user data for response
    const populatedEmployee = await Employee.findById(employee._id)
      .populate('userId', 'name email avatar role')
      .lean();

    // Start onboarding process if requested
    let onboardingResult = null;
    if (startOnboarding && global.employeeLifecycleEngine) {
      try {
        onboardingResult = await global.employeeLifecycleEngine.startOnboarding({
          employeeId: employee._id,
          userId: user._id,
          name: user.name,
          email: user.email,
          department,
          designation,
          joiningDate,
          managerId,
          orgId: orgId,
          createdBy: req.user?.userId || 'system'
        });
      } catch (onboardingError) {
        logger.warn('Failed to start onboarding workflow', {
          error: onboardingError.message,
          employeeId: employee._id
        });
      }
    }

    // Emit employee created event
    if (global.eventSystem) {
      await global.eventSystem.emit('employee.created', {
        employee: populatedEmployee,
        user,
        onboardingStarted: !!onboardingResult,
        createdBy: req.user?.userId || 'system',
        orgId: orgId
      });
    }

    // REAL-TIME UPDATES: Emit socket events for live dashboard updates
    if (global.socketManager) {
      // Broadcast to organization
      global.socketManager.broadcastToOrganization(orgId, 'employee_created', {
        employee: populatedEmployee,
        createdBy: req.user?.name || 'System',
        timestamp: new Date()
      });

      // Broadcast to admins and HR
      global.socketManager.broadcastToRole('admin', 'employee_created', {
        employee: populatedEmployee,
        orgId: orgId,
        createdBy: req.user?.name || 'System'
      });

      global.socketManager.broadcastToRole('hr', 'employee_created', {
        employee: populatedEmployee,
        orgId: orgId,
        createdBy: req.user?.name || 'System'
      });

      // Broadcast dashboard update event
      global.socketManager.broadcastToOrganization(orgId, 'dashboard_update', {
        type: 'employee_count',
        action: 'increment',
        data: { totalEmployees: await Employee.countDocuments({ orgId, status: 'active' }) }
      });
    }

    // Emit real-time updates to dashboards (with fallback for missing methods)
    try {
      if (req.emitEmployeeUpdate) {
        req.emitEmployeeUpdate('created', populatedEmployee, orgId);
      }
      if (req.emitDashboardUpdate) {
        req.emitDashboardUpdate('create', 'employees', populatedEmployee, orgId);
      }
      if (req.emitActivityUpdate) {
        req.emitActivityUpdate({
          action: 'employee_create',
          description: `New employee ${name} created`,
          userId: req.user?.userId || 'system',
          orgId: orgId,
          severity: 'medium',
          category: 'admin'
        }, orgId);
      }
      if (req.emitNotification) {
        req.emitNotification({
          title: 'New Employee Created',
          message: `${name} has been added to ${department || 'the organization'}`,
          type: 'success',
          action: 'employee_created',
          data: { employeeId: employee._id, name, department }
        }, null, orgId);
      }
    } catch (emitError) {
      logger.warn('Failed to emit real-time updates', { error: emitError.message });
    }

    logger.info('Employee created successfully', { 
      employeeId: employee._id, 
      userId: user._id,
      orgId: orgId,
      onboardingStarted: !!onboardingResult
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        employee: populatedEmployee,
        onboarding: onboardingResult
      }
    });
  } catch (error) {
    logger.error('Employee creation error', {
      error: error.message,
      stack: error.stack,
      email,
      name
    });
    throw error;
  }
}));

/**
 * PUT /api/employees/:id
 * Update employee with optimistic locking
 * P0 FIX: Uses version field to prevent race conditions
 * RBAC: Admin/HR can update all fields, Employees can only update limited fields
 */
router.put('/:id', authorize('super_admin', 'admin', 'hr', 'employee'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userRole = req.user.role;
  const userOrgId = req.user.orgId;
  const userId = req.user.userId;

  // Remove fields that shouldn't be updated directly
  delete updateData._id;
  delete updateData.userId;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  // Role-based field restrictions
  if (userRole === 'employee') {
    // Employees can only update limited fields and only their own record
    const allowedFields = ['phone', 'address'];
    const filteredData = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });
    
    // Replace updateData with filtered data
    Object.keys(updateData).forEach(key => delete updateData[key]);
    Object.assign(updateData, filteredData);

    // Check if employee is updating their own record
    const employee = await Employee.findOne({ _id: id, orgId: userOrgId }).populate('userId');
    if (!employee || employee.userId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own employee record.'
      });
    }
  }

  // P0 FIX: Optimistic locking - check version
  const currentVersion = updateData.__v;
  delete updateData.__v;

  const query = { _id: id, orgId: userOrgId };
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

  // REAL-TIME UPDATES: Emit socket events for live updates
  if (global.socketManager) {
    // Broadcast to organization
    global.socketManager.broadcastToOrganization(employee.orgId, 'employee_updated', {
      employee,
      updatedBy: req.user?.name || 'System',
      timestamp: new Date()
    });

    // Broadcast to admins and HR
    global.socketManager.broadcastToRole('admin', 'employee_updated', {
      employee,
      orgId: employee.orgId,
      updatedBy: req.user?.name || 'System'
    });

    global.socketManager.broadcastToRole('hr', 'employee_updated', {
      employee,
      orgId: employee.orgId,
      updatedBy: req.user?.name || 'System'
    });
  }

  // Emit real-time updates to dashboards
  req.emitEmployeeUpdate('updated', employee, employee.orgId);
  req.emitDashboardUpdate('update', 'employees', employee, employee.orgId);
  req.emitActivityUpdate({
    action: 'employee_update',
    description: `Employee ${employee.userId?.name} updated`,
    userId: req.user?.userId || 'system',
    orgId: employee.orgId,
    severity: 'low',
    category: 'admin'
  }, employee.orgId);

  logger.info('Employee updated', { 
    employeeId: id, 
    updatedBy: req.user?.userId,
    userRole,
    fieldsUpdated: Object.keys(updateData)
  });

  res.json({
    success: true,
    message: 'Employee updated successfully',
    data: employee
  });
}));

/**
 * DELETE /api/employees/:id
 * Soft delete employee (set status to terminated)
 * RBAC: Only admin and hr can delete employees
 */
router.delete('/:id', authorize('super_admin', 'admin', 'hr'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userOrgId = req.user.orgId;

  // Soft delete - set status to terminated
  const employee = await Employee.findOneAndUpdate(
    { _id: id, orgId: userOrgId },
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

  // REAL-TIME UPDATES: Emit socket events for live updates
  if (global.socketManager) {
    // Broadcast to organization
    global.socketManager.broadcastToOrganization(employee.orgId, 'employee_deleted', {
      employee,
      deletedBy: req.user?.name || 'System',
      timestamp: new Date()
    });

    // Broadcast to admins and HR
    global.socketManager.broadcastToRole('admin', 'employee_deleted', {
      employee,
      orgId: employee.orgId,
      deletedBy: req.user?.name || 'System'
    });

    global.socketManager.broadcastToRole('hr', 'employee_deleted', {
      employee,
      orgId: employee.orgId,
      deletedBy: req.user?.name || 'System'
    });

    // Broadcast dashboard update event
    global.socketManager.broadcastToOrganization(employee.orgId, 'dashboard_update', {
      type: 'employee_count',
      action: 'decrement',
      data: { totalEmployees: await Employee.countDocuments({ orgId: employee.orgId, status: 'active' }) }
    });
  }

  // Emit real-time updates to dashboards
  req.emitEmployeeUpdate('deleted', employee, employee.orgId);
  req.emitDashboardUpdate('delete', 'employees', employee, employee.orgId);
  req.emitActivityUpdate({
    action: 'employee_delete',
    description: `Employee terminated`,
    userId: req.user?.userId || 'system',
    orgId: employee.orgId,
    severity: 'high',
    category: 'admin'
  }, employee.orgId);

  // Emit notification to admins
  req.emitNotification({
    title: 'Employee Terminated',
    message: `Employee has been terminated`,
    type: 'warning',
    action: 'employee_terminated',
    data: { employeeId: employee._id }
  }, null, employee.orgId);

  logger.info('Employee deleted (soft)', { 
    employeeId: id, 
    deletedBy: req.user?.userId,
    orgId: userOrgId 
  });

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

/**
 * POST /api/employees/:id/start-onboarding
 * Start onboarding process for an employee
 */
router.post('/:id/start-onboarding', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { managerId, customTasks } = req.body;

  const employee = await Employee.findById(id).populate('userId');
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  if (!global.employeeLifecycleEngine) {
    return res.status(503).json({
      success: false,
      message: 'Employee lifecycle system not available'
    });
  }

  const onboardingResult = await global.employeeLifecycleEngine.startOnboarding({
    employeeId: employee._id,
    userId: employee.userId._id,
    name: employee.userId.name,
    email: employee.userId.email,
    department: employee.department,
    designation: employee.designation,
    joiningDate: employee.joiningDate,
    managerId: managerId || employee.managerId,
    orgId: employee.orgId,
    createdBy: req.user.userId,
    customTasks
  });

  res.json({
    success: true,
    message: 'Onboarding process started successfully',
    data: onboardingResult
  });
}));

/**
 * POST /api/employees/:id/start-offboarding
 * Start offboarding process for an employee
 */
router.post('/:id/start-offboarding', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, lastWorkingDay, notes } = req.body;

  if (!reason || !lastWorkingDay) {
    return res.status(400).json({
      success: false,
      message: 'Reason and last working day are required'
    });
  }

  const employee = await Employee.findById(id).populate('userId');
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  if (!global.employeeLifecycleEngine) {
    return res.status(503).json({
      success: false,
      message: 'Employee lifecycle system not available'
    });
  }

  const offboardingResult = await global.employeeLifecycleEngine.startOffboarding({
    employeeId: employee._id,
    userId: employee.userId._id,
    name: employee.userId.name,
    reason,
    lastWorkingDay,
    notes,
    initiatedBy: req.user.userId,
    orgId: employee.orgId
  });

  res.json({
    success: true,
    message: 'Offboarding process started successfully',
    data: offboardingResult
  });
}));

/**
 * PUT /api/employees/:id/lifecycle-stage
 * Update employee lifecycle stage
 */
router.put('/:id/lifecycle-stage', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stage, metadata } = req.body;

  if (!stage) {
    return res.status(400).json({
      success: false,
      message: 'Lifecycle stage is required'
    });
  }

  if (!global.employeeLifecycleEngine) {
    return res.status(503).json({
      success: false,
      message: 'Employee lifecycle system not available'
    });
  }

  const validStages = Object.values(global.employeeLifecycleEngine.getLifecycleStages());
  if (!validStages.includes(stage)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid lifecycle stage',
      validStages
    });
  }

  const updatedEmployee = await global.employeeLifecycleEngine.updateLifecycleStage(
    id, 
    stage, 
    metadata
  );

  res.json({
    success: true,
    message: 'Lifecycle stage updated successfully',
    data: updatedEmployee
  });
}));

/**
 * PUT /api/employees/:id/checklist/:taskId
 * Update onboarding/offboarding checklist task
 */
router.put('/:id/checklist/:taskId', asyncHandler(async (req, res) => {
  const { id, taskId } = req.params;
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Task status is required'
    });
  }

  if (!global.employeeLifecycleEngine) {
    return res.status(503).json({
      success: false,
      message: 'Employee lifecycle system not available'
    });
  }

  const result = await global.employeeLifecycleEngine.updateChecklistTask(
    id,
    taskId,
    status,
    req.user.userId,
    notes
  );

  res.json({
    success: true,
    message: 'Checklist task updated successfully',
    data: result
  });
}));

/**
 * GET /api/employees/:id/lifecycle
 * Get employee lifecycle information
 */
router.get('/:id/lifecycle', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const employee = await Employee.findById(id)
    .populate('userId', 'name email')
    .select('lifecycleStage onboardingChecklist offboardingChecklist onboardingStatus offboardingStatus')
    .lean();

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  res.json({
    success: true,
    data: {
      employeeId: employee._id,
      employeeName: employee.userId.name,
      lifecycleStage: employee.lifecycleStage,
      onboardingStatus: employee.onboardingStatus,
      offboardingStatus: employee.offboardingStatus,
      onboardingChecklist: employee.onboardingChecklist || [],
      offboardingChecklist: employee.offboardingChecklist || []
    }
  });
}));

/**
 * GET /api/employees/lifecycle/analytics
 * Get lifecycle analytics for organization
 */
router.get('/lifecycle/analytics', asyncHandler(async (req, res) => {
  const { orgId, timeframe = 30 } = req.query;

  if (!global.employeeLifecycleEngine) {
    return res.status(503).json({
      success: false,
      message: 'Employee lifecycle system not available'
    });
  }

  const analytics = await global.employeeLifecycleEngine.getLifecycleAnalytics(
    orgId || req.user.orgId,
    parseInt(timeframe)
  );

  res.json({
    success: true,
    data: analytics
  });
}));

export default router;
