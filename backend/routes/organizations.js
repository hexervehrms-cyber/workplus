import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize } from "../middleware/auth.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import ActivityLog from "../models/ActivityLog.js";

const router = express.Router();

/**
 * GET /api/organizations
 * Get all organizations (Super Admin only)
 */
router.get("/", authorize('super_admin'), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || 'all';
  
  const skip = (page - 1) * limit;
  
  // Build query
  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status !== 'all') {
    query.isActive = status === 'active';
  }
  
  const organizations = await Organization.find(query)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  // Get additional stats for each organization
  const orgsWithStats = await Promise.all(
    organizations.map(async (org) => {
      const [employeeCount, adminCount, activeUsers] = await Promise.all([
        Employee.countDocuments({ orgId: org._id.toString(), status: 'active' }),
        User.countDocuments({ 
          orgId: org._id.toString(), 
          role: { $in: ['admin', 'hr', 'manager'] },
          isActive: true 
        }),
        User.countDocuments({
          orgId: org._id.toString(),
          isActive: true,
          lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);
      
      return {
        ...org,
        employeeCount,
        adminCount,
        activeUsers,
        status: org.isActive ? 'Active' : 'Inactive'
      };
    })
  );
  
  const total = await Organization.countDocuments(query);
  
  res.json({
    success: true,
    data: orgsWithStats,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * GET /api/organizations/:id
 * Get organization by ID (Super Admin only)
 */
router.get("/:id", authorize('super_admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const organization = await Organization.findById(id)
    .populate('createdBy', 'name email')
    .lean();
  
  if (!organization) {
    return res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
  
  // Get organization statistics
  const [employeeCount, adminCount, activeUsers, totalRevenue] = await Promise.all([
    Employee.countDocuments({ orgId: id, status: 'active' }),
    User.countDocuments({ 
      orgId: id, 
      role: { $in: ['admin', 'hr', 'manager'] },
      isActive: true 
    }),
    User.countDocuments({
      orgId: id,
      isActive: true,
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }),
    // Calculate total revenue (sum of payroll costs)
    Employee.aggregate([
      { $match: { orgId: id, status: 'active' } },
      { $group: { _id: null, totalSalary: { $sum: '$baseSalary' } } }
    ])
  ]);
  
  const orgWithStats = {
    ...organization,
    stats: {
      employeeCount,
      adminCount,
      activeUsers,
      monthlyRevenue: totalRevenue[0]?.totalSalary || 0
    }
  };
  
  res.json({
    success: true,
    data: orgWithStats
  });
}));

/**
 * POST /api/organizations
 * Create new organization (Super Admin only)
 */
router.post("/", authorize(['super_admin']), asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    website,
    industry,
    subscriptionPlan = 'free'
  } = req.body;
  
  // Validate required fields
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Organization name and email are required'
    });
  }
  
  // Check if organization with same email exists
  const existingOrg = await Organization.findOne({ email: email.toLowerCase() });
  if (existingOrg) {
    return res.status(400).json({
      success: false,
      message: 'Organization with this email already exists'
    });
  }
  
  // Generate unique organization code
  const code = `ORG-${Date.now().toString().slice(-6)}`;
  
  const organization = await Organization.create({
    name: name.trim(),
    code,
    email: email.toLowerCase().trim(),
    phone: phone?.trim(),
    address,
    website: website?.trim(),
    industry: industry?.trim(),
    subscriptionPlan,
    subscriptionStatus: 'trial',
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
    createdBy: req.user.userId
  });
  
  // Log activity
  await ActivityLog.logActivity({
    userId: req.user.userId,
    orgId: organization._id,
    action: 'org_create',
    entity: {
      entityType: 'organization',
      entityId: organization._id,
      entityName: organization.name
    },
    details: {
      organizationName: organization.name,
      subscriptionPlan: organization.subscriptionPlan
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'medium',
    category: 'admin'
  });
  
  res.status(201).json({
    success: true,
    message: 'Organization created successfully',
    data: organization
  });
}));

/**
 * PUT /api/organizations/:id
 * Update organization (Super Admin only)
 */
router.put("/:id", authorize(['super_admin']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const organization = await Organization.findById(id);
  if (!organization) {
    return res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
  
  // Store original data for audit log
  const originalData = organization.toObject();
  
  // Update organization
  const updatedOrg = await Organization.findByIdAndUpdate(
    id,
    { ...updates, updatedAt: new Date() },
    { new: true, runValidators: true }
  );
  
  // Log activity
  await ActivityLog.logActivity({
    userId: req.user.userId,
    orgId: id,
    action: 'org_update',
    entity: {
      entityType: 'organization',
      entityId: id,
      entityName: updatedOrg.name
    },
    changes: {
      before: originalData,
      after: updatedOrg.toObject()
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'medium',
    category: 'admin'
  });
  
  res.json({
    success: true,
    message: 'Organization updated successfully',
    data: updatedOrg
  });
}));

/**
 * DELETE /api/organizations/:id
 * Delete organization (Super Admin only)
 */
router.delete("/:id", authorize(['super_admin']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const organization = await Organization.findById(id);
  if (!organization) {
    return res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
  
  // Check if organization has active employees
  const employeeCount = await Employee.countDocuments({ orgId: id, status: 'active' });
  if (employeeCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete organization with ${employeeCount} active employees. Please deactivate employees first.`
    });
  }
  
  // Soft delete - just mark as inactive
  await Organization.findByIdAndUpdate(id, { 
    isActive: false,
    updatedAt: new Date()
  });
  
  // Log activity
  await ActivityLog.logActivity({
    userId: req.user.userId,
    orgId: id,
    action: 'org_delete',
    entity: {
      entityType: 'organization',
      entityId: id,
      entityName: organization.name
    },
    details: {
      organizationName: organization.name,
      employeeCount
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    severity: 'high',
    category: 'admin'
  });
  
  res.json({
    success: true,
    message: 'Organization deactivated successfully'
  });
}));

/**
 * GET /api/organizations/:id/stats
 * Get detailed organization statistics (Super Admin only)
 */
router.get("/:id/stats", authorize(['super_admin']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const days = parseInt(req.query.days) || 30;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid organization ID'
    });
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get comprehensive statistics
  const [
    employeeStats,
    attendanceStats,
    leaveStats,
    expenseStats,
    recentActivities
  ] = await Promise.all([
    // Employee statistics
    Employee.aggregate([
      { $match: { orgId: id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgSalary: { $avg: '$baseSalary' }
        }
      }
    ]),
    
    // Attendance statistics
    Attendance.aggregate([
      { 
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $match: { 'employee.orgId': id, date: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgHours: { $avg: '$hoursWorked' }
        }
      }
    ]),
    
    // Leave statistics
    LeaveRequest.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $match: { 'employee.orgId': id, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Expense statistics
    Expense.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $match: { 'employee.orgId': id, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]),
    
    // Recent activities
    ActivityLog.find({ orgId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'name email')
      .lean()
  ]);
  
  res.json({
    success: true,
    data: {
      employees: employeeStats,
      attendance: attendanceStats,
      leaves: leaveStats,
      expenses: expenseStats,
      recentActivities: recentActivities.map(activity => ({
        action: activity.action,
        user: activity.userId?.name || 'System',
        timestamp: activity.createdAt,
        details: activity.details
      }))
    }
  });
}));

export default router;