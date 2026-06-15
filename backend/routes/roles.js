import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize, requirePermission, auditLog } from "../middleware/auth.js";
import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import User from "../models/User.js";
import { assertScopedOrgId } from "../utils/orgScopeHelpers.js";

const router = express.Router();

/**
 * GET /api/roles
 * Get all roles with filtering and pagination
 */
router.get("/", 
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    try {
      // First try to get roles from database
      const orgId = assertScopedOrgId(req, res);
      if (!orgId) return;
      
      let roles = [];
      try {
        roles = await Role.find({ orgId, isActive: true })
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email')
          .populate('parentRole', 'name displayName level')
          .sort({ level: -1, name: 1 })
          .lean();
      } catch (dbError) {
        console.warn('Database query failed, using default roles:', dbError.message);
      }
      
      // If no roles found in database, return default roles
      if (!roles || roles.length === 0) {
        const defaultRoles = [
          {
            id: 'ADMIN',
            _id: 'ADMIN',
            name: 'Admin',
            displayName: 'Admin',
            description: 'Administrative access with most permissions',
            level: 80,
            permissions: [
              { id: 'VIEW_DASHBOARD', name: 'View Dashboard', description: 'Access to dashboard' },
              { id: 'VIEW_EMPLOYEES', name: 'View Employees', description: 'View employee list' },
              { id: 'ADD_EMPLOYEES', name: 'Add Employees', description: 'Add new employees' }
            ],
            isCustom: false
          },
          {
            id: 'ACCOUNTANT',
            _id: 'ACCOUNTANT',
            name: 'Accountant',
            displayName: 'Accountant',
            description: 'Financial and accounting access',
            level: 70,
            permissions: [
              { id: 'VIEW_DASHBOARD', name: 'View Dashboard', description: 'Access to dashboard' },
              { id: 'VIEW_EMPLOYEES', name: 'View Employees', description: 'View employee list' }
            ],
            isCustom: false
          },
          {
            id: 'HR_SPECIALIST',
            _id: 'HR_SPECIALIST',
            name: 'HR Specialist',
            displayName: 'HR Specialist',
            description: 'Human resources management access',
            level: 50,
            permissions: [
              { id: 'VIEW_DASHBOARD', name: 'View Dashboard', description: 'Access to dashboard' },
              { id: 'VIEW_EMPLOYEES', name: 'View Employees', description: 'View employee list' }
            ],
            isCustom: false
          },
          {
            id: 'EMPLOYEE',
            _id: 'EMPLOYEE',
            name: 'Employee',
            displayName: 'Employee',
            description: 'Basic employee access',
            level: 40,
            permissions: [
              { id: 'VIEW_DASHBOARD', name: 'View Dashboard', description: 'Access to dashboard' }
            ],
            isCustom: false
          }
        ];
        
        return res.json({
          success: true,
          data: defaultRoles,
          message: 'Using default roles'
        });
      }
      
      // Transform database roles to expected format
      const formattedRoles = roles.map(role => ({
        id: role._id?.toString() || role.id || role.name,
        _id: role._id?.toString() || role.id,
        name: role.name,
        displayName: role.displayName || role.name,
        description: role.description,
        level: role.level,
        permissions: role.permissions || [],
        isCustom: role.isCustom || false,
        isSystemRole: role.isSystemRole || false
      }));
      
      res.json({
        success: true,
        data: formattedRoles
      });
    } catch (error) {
      console.error('Error in roles endpoint:', error);
      
      // Return default roles as fallback
      const defaultRoles = [
        {
          id: 'ADMIN',
          _id: 'ADMIN',
          name: 'Admin',
          displayName: 'Admin',
          description: 'Administrative access with most permissions',
          level: 80,
          permissions: [],
          isCustom: false
        },
        {
          id: 'ACCOUNTANT',
          _id: 'ACCOUNTANT',
          name: 'Accountant',
          displayName: 'Accountant',
          description: 'Financial and accounting access',
          level: 70,
          permissions: [],
          isCustom: false
        },
        {
          id: 'HR_SPECIALIST',
          _id: 'HR_SPECIALIST',
          name: 'HR Specialist',
          displayName: 'HR Specialist',
          description: 'Human resources management access',
          level: 50,
          permissions: [],
          isCustom: false
        },
        {
          id: 'EMPLOYEE',
          _id: 'EMPLOYEE',
          name: 'Employee',
          displayName: 'Employee',
          description: 'Basic employee access',
          level: 40,
          permissions: [],
          isCustom: false
        }
      ];
      
      res.json({
        success: true,
        data: defaultRoles,
        message: 'Using fallback roles due to error'
      });
    }
  })
);

/**
 * GET /api/roles/:id
 * Get role by ID with full permissions
 */
router.get("/:id",
  requirePermission('roles', 'read'),
  auditLog('view_role_details', 'role'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role ID"
      });
    }
    
    const role = await Role.findOne({ _id: id, orgId })
      .populate('createdBy', 'name email avatar')
      .populate('updatedBy', 'name email avatar')
      .populate('parentRole', 'name displayName level permissions')
      .lean();
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }
    
    // Get all permissions including inherited
    const roleDoc = await Role.findById(id);
    const allPermissions = await roleDoc.getAllPermissions();
    
    // Get user count for this role
    const userCount = await User.countDocuments({ 
      role: role.name.toLowerCase(),
      orgId 
    });
    
    res.json({
      success: true,
      data: {
        ...role,
        allPermissions,
        userCount
      }
    });
  })
);

/**
 * POST /api/roles
 * Create new role
 */
router.post("/",
  requirePermission('roles', 'create'),
  auditLog('create_role', 'role'),
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    
    const {
      name,
      displayName,
      description,
      level,
      parentRole,
      inheritsPermissions = true,
      permissions = [],
      restrictions = {},
      isCustom = true
    } = req.body;
    
    // Validate required fields
    if (!name || !displayName || level === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, display name, and level are required"
      });
    }
    
    // Check if role name already exists
    const existingRole = await Role.findOne({ 
      name: name.toUpperCase(), 
      orgId 
    });
    
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "Role with this name already exists"
      });
    }
    
    // Validate level (must be lower than current user's role level)
    const userRole = await Role.findOne({ 
      name: req.user.role.toUpperCase(), 
      orgId 
    });
    
    if (userRole && level >= userRole.level) {
      return res.status(403).json({
        success: false,
        message: "Cannot create role with level equal to or higher than your own"
      });
    }
    
    // Validate parent role if specified
    if (parentRole) {
      const parent = await Role.findOne({ _id: parentRole, orgId });
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent role"
        });
      }
      
      if (level >= parent.level) {
        return res.status(400).json({
          success: false,
          message: "Role level must be lower than parent role level"
        });
      }
    }
    
    const role = await Role.create({
      name: name.toUpperCase(),
      displayName,
      description,
      level,
      parentRole: parentRole || null,
      inheritsPermissions,
      permissions,
      restrictions,
      isCustom,
      orgId,
      createdBy: userId
    });
    
    // Populate for response
    const populatedRole = await Role.findById(role._id)
      .populate('createdBy', 'name email')
      .populate('parentRole', 'name displayName level')
      .lean();
    
    // Ensure response has both _id and id for flexibility
    const responseRole = {
      ...populatedRole,
      id: populatedRole._id?.toString() || populatedRole.id,
      _id: populatedRole._id?.toString() || populatedRole._id
    };
    
    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: responseRole
    });
  })
);

/**
 * PUT /api/roles/:id
 * Update role
 */
router.put("/:id",
  requirePermission('roles', 'update'),
  auditLog('update_role', 'role'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    
    if (!mongoose.Types.ObjectId.isValid(id) && id.match(/^[A-Z_]+$/)) {
      // Allow system role names like ADMIN, HR, etc.
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role ID"
      });
    }
    
    // Try to find by ObjectId first, then by name
    let role = await Role.findOne({ _id: id, orgId });
    if (!role) {
      role = await Role.findOne({ name: id.toUpperCase(), orgId });
    }
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }
    
    // Prevent modification of system roles
    if (role.isSystemRole && !['super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify system roles"
      });
    }
    
    const {
      displayName,
      description,
      level,
      parentRole,
      inheritsPermissions,
      permissions,
      restrictions,
      isActive
    } = req.body;
    
    // Validate level change
    if (level && level !== role.level) {
      const userRole = await Role.findOne({ 
        name: req.user.role.toUpperCase(), 
        orgId 
      });
      
      if (userRole && level >= userRole.level) {
        return res.status(403).json({
          success: false,
          message: "Cannot set role level equal to or higher than your own"
        });
      }
    }
    
    // Update fields
    if (displayName) role.displayName = displayName;
    if (description !== undefined) role.description = description;
    if (level) role.level = level;
    if (parentRole !== undefined) role.parentRole = parentRole;
    if (inheritsPermissions !== undefined) role.inheritsPermissions = inheritsPermissions;
    if (permissions) role.permissions = permissions;
    if (restrictions) role.restrictions = { ...role.restrictions, ...restrictions };
    if (isActive !== undefined) role.isActive = isActive;
    
    role.updatedBy = userId;
    await role.save();
    
    // Populate for response
    const updatedRole = await Role.findById(role._id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('parentRole', 'name displayName level')
      .lean();
    
    // Ensure response has both _id and id for flexibility
    const responseRole = {
      ...updatedRole,
      id: updatedRole._id?.toString() || updatedRole.id,
      _id: updatedRole._id?.toString() || updatedRole._id
    };
    
    res.json({
      success: true,
      message: "Role updated successfully",
      data: responseRole
    });
  })
);

/**
 * DELETE /api/roles/:id
 * Delete role (soft delete)
 */
router.delete("/:id",
  requirePermission('roles', 'delete'),
  auditLog('delete_role', 'role'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    
    if (!mongoose.Types.ObjectId.isValid(id) && !id.match(/^[A-Z_]+$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role ID"
      });
    }
    
    // Try to find by ObjectId first, then by name
    let role = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      role = await Role.findOne({ _id: id, orgId });
    }
    if (!role) {
      role = await Role.findOne({ name: id.toUpperCase(), orgId });
    }
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }
    
    // Prevent deletion of system roles
    if (role.isSystemRole) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete system roles"
      });
    }
    
    // Check if role is in use
    const userCount = await User.countDocuments({ 
      role: role.name.toLowerCase(),
      orgId 
    });
    
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. ${userCount} user(s) are assigned to this role.`
      });
    }
    
    // Soft delete
    role.isActive = false;
    role.updatedBy = req.user.userId;
    await role.save();
    
    res.json({
      success: true,
      message: "Role deleted successfully"
    });
  })
);

/**
 * POST /api/roles/:id/permissions
 * Add permission to role
 */
router.post("/:id/permissions",
  requirePermission('roles', 'update'),
  auditLog('add_role_permission', 'role'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const { module, actions, scope = 'own', conditions = [] } = req.body;
    
    if (!module || !actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: "Module and actions array are required"
      });
    }
    
    const role = await Role.findOne({ _id: id, orgId });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }
    
    await role.addPermission(module, actions, scope, conditions);
    
    res.json({
      success: true,
      message: "Permission added to role successfully",
      data: role.permissions
    });
  })
);

/**
 * DELETE /api/roles/:id/permissions
 * Remove permission from role
 */
router.delete("/:id/permissions",
  requirePermission('roles', 'update'),
  auditLog('remove_role_permission', 'role'),
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
    
    const role = await Role.findOne({ _id: id, orgId });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }
    
    await role.removePermission(module, actions, scope);
    
    res.json({
      success: true,
      message: "Permission removed from role successfully",
      data: role.permissions
    });
  })
);

/**
 * GET /api/roles/:id/users
 * Get users assigned to role
 */
router.get("/:id/users",
  requirePermission('roles', 'read'),
  auditLog('view_role_users', 'role'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const { page = 1, limit = 50 } = req.query;
    
    const role = await Role.findOne({ _id: id, orgId });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }
    
    const users = await User.find({ 
      role: role.name.toLowerCase(),
      orgId,
      isActive: true
    })
    .select('name email avatar profile.title departmentId lastLogin')
    .populate('departmentId', 'name')
    .sort({ name: 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();
    
    const total = await User.countDocuments({ 
      role: role.name.toLowerCase(),
      orgId,
      isActive: true
    });
    
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
 * POST /api/roles/initialize-system-roles
 * Initialize system roles for organization
 */
router.post("/initialize-system-roles",
  authorize('super_admin', 'admin'),
  auditLog('initialize_system_roles', 'roles'),
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user?.userId;
    
    try {
      const systemRoles = await Role.createSystemRoles(orgId, userId);
      
      res.json({
        success: true,
        message: "System roles initialized successfully",
        data: {
          created: systemRoles.length,
          roles: systemRoles.map(r => ({ name: r.name, displayName: r.displayName }))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to initialize system roles",
        error: error.message
      });
    }
  })
);

/**
 * GET /api/roles/hierarchy
 * Get role hierarchy for organization
 */
router.get("/hierarchy",
  requirePermission('roles', 'read'),
  auditLog('view_role_hierarchy', 'roles'),
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    
    const roles = await Role.find({ orgId, isActive: true })
      .populate('parentRole', 'name displayName level')
      .sort({ level: -1 })
      .lean();
    
    // Build hierarchy tree
    const roleMap = new Map();
    const rootRoles = [];
    
    roles.forEach(role => {
      roleMap.set(role._id.toString(), { ...role, children: [] });
    });
    
    roles.forEach(role => {
      if (role.parentRole) {
        const parent = roleMap.get(role.parentRole._id.toString());
        if (parent) {
          parent.children.push(roleMap.get(role._id.toString()));
        }
      } else {
        rootRoles.push(roleMap.get(role._id.toString()));
      }
    });
    
    res.json({
      success: true,
      data: {
        hierarchy: rootRoles,
        totalRoles: roles.length
      }
    });
  })
);

export default router;