import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize, requirePermission, auditLog } from "../middleware/auth.js";
import { passwordResetLimiter } from "../middleware/rateLimiter.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import { assertScopedOrgId } from "../utils/orgScopeHelpers.js";

const router = express.Router();

/**
 * GET /api/users
 * Get all users with filtering and pagination
 */
router.get("/",
  authorize('super_admin', 'admin', 'hr'),
  auditLog('view_users', 'users'),
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userRole = req.user?.role;
    
    const {
      role,
      department,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const isActiveParam = req.query.isActive;
    
    let filter = { orgId, deletedAt: null };
    
    // Role-based filtering
    if (userRole !== 'super_admin') {
      // Non-super admins can't see super admins
      filter.role = { $ne: 'super_admin' };
    }
    
    // Default: active users only. Pass isActive=false to list inactive.
    if (isActiveParam === undefined || isActiveParam === '') {
      filter.isActive = true;
    } else {
      filter.isActive = isActiveParam === 'true' || isActiveParam === true;
    }
    if (role) filter.role = role;
    if (department) filter.departmentId = department;
    
    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter)
      .select('-password -security.passwordHistory -security.twoFactorSecret')
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .populate('roleId', 'name displayName level permissions')
      .sort({ name: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await User.countDocuments(filter);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  })
);

/**
 * GET /api/users/stats
 * Get user statistics
 */
router.get("/stats",
  requirePermission('users', 'read'),
  auditLog('view_user_stats', 'users'),
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      roleStats,
      departmentStats
    ] = await Promise.all([
      User.countDocuments({ orgId, deletedAt: null }),
      User.countDocuments({ orgId, isActive: true, deletedAt: null }),
      User.countDocuments({ orgId, isActive: false, deletedAt: null }),
      User.aggregate([
        { $match: { orgId, deletedAt: null } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      User.aggregate([
        { $match: { orgId, deletedAt: null, departmentId: { $ne: null } } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        roleDistribution: roleStats,
        departmentDistribution: departmentStats
      }
    });
  })
);

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get("/:id",
  requirePermission('users', 'read'),
  auditLog('view_user_details', 'user'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userRole = req.user?.role;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }
    
    let filter = { _id: id, orgId, deletedAt: null };
    
    // Role-based access control
    if (userRole !== 'super_admin') {
      filter.role = { $ne: 'super_admin' };
    }
    
    const user = await User.findOne(filter)
      .select('-password -security.passwordHistory -security.twoFactorSecret')
      .populate('departmentId', 'name description')
      .populate('managerId', 'name email avatar')
      .populate('roleId', 'name displayName level permissions')
      .populate('employeeProfile')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or access denied"
      });
    }
    
    // Get all permissions for this user
    const userDoc = await User.findById(id);
    const allPermissions = await userDoc.getAllPermissions();
    
    res.json({
      success: true,
      data: {
        ...user,
        allPermissions
      }
    });
  })
);

/**
 * POST /api/users
 * Create new user
 */
router.post("/",
  authorize('super_admin', 'admin', 'hr'),
  auditLog('create_user', 'user'),
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    const {
      name,
      email,
      password,
      role = 'employee',
      roleId,
      departmentId,
      managerId,
      profile = {},
      contact = {},
      isActive = true,
      adminRole,
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      deletedAt: null
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      });
    }
    
    const targetRoleKey = String(role || 'employee').toLowerCase();

    if (userRole !== 'super_admin' && targetRoleKey === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can create super admin accounts',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Role validation — org admin/HR may create peer admin accounts
    if (userRole !== 'super_admin') {
      const currentUserRole = await Role.findOne({
        name: userRole.toUpperCase(),
        orgId
      });
      const targetRole = await Role.findOne({
        name: role.toUpperCase(),
        orgId
      });

      const creatorCanAddOrgAdmin =
        ['admin', 'hr'].includes(userRole) && targetRoleKey === 'admin';

      if (
        !creatorCanAddOrgAdmin &&
        targetRole &&
        currentUserRole &&
        targetRole.level > currentUserRole.level
      ) {
        return res.status(403).json({
          success: false,
          message: 'Cannot create user with role higher than your own',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
    }
    
    // Validate roleId if provided
    let validatedRoleId = null;
    if (roleId) {
      const roleDoc = await Role.findOne({ _id: roleId, orgId, isActive: true });
      if (!roleDoc) {
        return res.status(400).json({
          success: false,
          message: "Invalid role ID"
        });
      }
      validatedRoleId = roleId;
    }
    
    // Validate departmentId if provided
    if (departmentId && !mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID"
      });
    }
    
    // Validate managerId if provided
    if (managerId) {
      const manager = await User.findOne({ 
        _id: managerId, 
        orgId, 
        isActive: true,
        deletedAt: null
      });
      if (!manager) {
        return res.status(400).json({
          success: false,
          message: "Invalid manager ID"
        });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role.toLowerCase(),
      roleId: validatedRoleId,
      departmentId: departmentId || null,
      managerId: managerId || null,
      adminRole: adminRole ? String(adminRole).trim().toLowerCase() : null,
      profile: {
        ...profile,
        firstName: profile.firstName?.trim(),
        lastName: profile.lastName?.trim(),
        title: profile.title?.trim() || (adminRole ? String(adminRole).trim() : undefined),
      },
      contact,
      isActive,
      orgId,
      security: {
        passwordLastChanged: new Date()
      }
    });
    
    // Populate for response
    const populatedUser = await User.findById(user._id)
      .select('-password -security.passwordHistory -security.twoFactorSecret')
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .populate('roleId', 'name displayName level')
      .lean();
    
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: populatedUser
    });
  })
);

/**
 * PUT /api/users/:id
 * Update user
 */
router.put("/:id",
  authorize('super_admin', 'admin', 'hr'),
  auditLog('update_user', 'user'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }
    
    const user = await User.findOne({ 
      _id: id, 
      orgId, 
      deletedAt: null 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Prevent non-super admins from modifying super admins
    if (user.role === 'super_admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Cannot modify super admin users"
      });
    }
    
    const {
      name,
      email,
      password,
      role,
      roleId,
      departmentId,
      managerId,
      profile,
      contact,
      isActive,
      preferences,
      adminRole,
    } = req.body;
    
    // Update basic fields
    if (name) user.name = name.trim();
    if (email) {
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: id },
        deletedAt: null
      });
      
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email is already taken by another user"
        });
      }
      
      user.email = email.toLowerCase().trim();
    }
    
    // Handle password update
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Store old password in history
      if (user.password) {
        user.security.passwordHistory.push({
          passwordHash: user.password,
          createdAt: new Date()
        });
        
        // Keep only last 5 passwords
        if (user.security.passwordHistory.length > 5) {
          user.security.passwordHistory = user.security.passwordHistory.slice(-5);
        }
      }
      
      user.password = hashedPassword;
      user.security.passwordLastChanged = new Date();
    }
    
    // Role validation
    if (role && role !== user.role) {
      if (userRole !== 'super_admin') {
        const currentUserRole = await Role.findOne({ 
          name: userRole.toUpperCase(), 
          orgId 
        });
        const targetRole = await Role.findOne({ 
          name: role.toUpperCase(), 
          orgId 
        });
        
        if (targetRole && currentUserRole && targetRole.level > currentUserRole.level) {
          return res.status(403).json({
            success: false,
            message: "Cannot assign role higher than your own"
          });
        }
      }
      
      user.role = role.toLowerCase();
    }
    
    // Update roleId
    if (roleId !== undefined) {
      if (roleId) {
        const roleDoc = await Role.findOne({ _id: roleId, orgId, isActive: true });
        if (!roleDoc) {
          return res.status(400).json({
            success: false,
            message: "Invalid role ID"
          });
        }
      }
      user.roleId = roleId;
    }
    
    // Update other fields
    if (departmentId !== undefined) user.departmentId = departmentId;
    if (managerId !== undefined) user.managerId = managerId;
    if (isActive !== undefined) user.isActive = isActive;
    if (adminRole !== undefined) {
      user.adminRole = adminRole ? String(adminRole).trim().toLowerCase() : null;
      if (!user.profile) user.profile = {};
      user.profile.title = adminRole ? String(adminRole).trim() : user.profile.title;
    }
    
    // Update nested objects
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }
    if (contact) {
      user.contact = { ...user.contact, ...contact };
    }
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }
    
    await user.save();
    
    // Populate for response
    const updatedUser = await User.findById(user._id)
      .select('-password -security.passwordHistory -security.twoFactorSecret')
      .populate('departmentId', 'name')
      .populate('managerId', 'name email')
      .populate('roleId', 'name displayName level')
      .lean();
    
    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser
    });
  })
);

/**
 * DELETE /api/users/:id
 * Delete user (soft delete)
 */
router.delete("/:id",
  authorize('super_admin', 'admin', 'hr'),
  auditLog('delete_user', 'user'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }
    
    const user = await User.findOne({ 
      _id: id, 
      orgId, 
      deletedAt: null 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Prevent deletion of super admins by non-super admins
    if (user.role === 'super_admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Cannot delete super admin users"
      });
    }
    
    // Prevent self-deletion
    if (user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account"
      });
    }
    
    // Soft delete
    user.deletedAt = new Date();
    user.deletedBy = userId;
    user.isActive = false;
    await user.save();
    
    res.json({
      success: true,
      message: "User deleted successfully"
    });
  })
);

/**
 * POST /api/users/:id/reset-password
 * Reset user password
 * PROTECTED: Rate limited to prevent brute force attacks
 */
router.post("/:id/reset-password",
  passwordResetLimiter,
  requirePermission('users', 'update'),
  auditLog('reset_user_password', 'user'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const { newPassword, forceChange = true } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }
    
    const user = await User.findOne({ 
      _id: id, 
      orgId, 
      deletedAt: null 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Store old password in history
    if (user.password) {
      user.security.passwordHistory.push({
        hash: user.password,
        createdAt: user.security.passwordLastChanged || new Date()
      });
      
      // Keep only last 5 passwords
      if (user.security.passwordHistory.length > 5) {
        user.security.passwordHistory = user.security.passwordHistory.slice(-5);
      }
    }
    
    user.password = hashedPassword;
    user.security.passwordLastChanged = new Date();
    
    if (forceChange) {
      user.security.mustChangePassword = true;
    }
    
    await user.save();
    
    logger.info('User password reset', {
      userId: id,
      orgId,
      resetBy: req.user.userId
    });
    
    res.json({
      success: true,
      message: "Password reset successfully"
    });
  })
);

/**
 * POST /api/users/:id/permissions
 * Grant custom permission to user
 */
router.post("/:id/permissions",
  requirePermission('users', 'manage'),
  auditLog('grant_user_permission', 'user'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    const { module, actions, scope = 'own', expiresAt } = req.body;
    
    if (!module || !actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: "Module and actions array are required"
      });
    }
    
    const user = await User.findOne({ 
      _id: id, 
      orgId, 
      deletedAt: null 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    await user.grantPermission(
      module, 
      actions, 
      scope, 
      userId, 
      expiresAt ? new Date(expiresAt) : null
    );
    
    res.json({
      success: true,
      message: "Permission granted successfully",
      data: user.customPermissions
    });
  })
);

/**
 * DELETE /api/users/:id/permissions
 * Revoke custom permission from user
 */
router.delete("/:id/permissions",
  requirePermission('users', 'manage'),
  auditLog('revoke_user_permission', 'user'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const { module, actions, scope } = req.body;
    
    if (!module) {
      return res.status(400).json({
        success: false,
        message: "Module is required"
      });
    }
    
    const user = await User.findOne({ 
      _id: id, 
      orgId, 
      deletedAt: null 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    await user.revokePermission(module, actions, scope);
    
    res.json({
      success: true,
      message: "Permission revoked successfully",
      data: user.customPermissions
    });
  })
);

export default router;