import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authorize, requirePermission, auditLog } from "../middleware/auth.js";
import Permission from "../models/Permission.js";
import Role from "../models/Role.js";

const router = express.Router();

/**
 * GET /api/permissions
 * Get all permissions with filtering
 */
router.get("/",
  requirePermission('roles', 'read'),
  auditLog('view_permissions', 'permissions'),
  asyncHandler(async (req, res) => {
    const {
      module,
      action,
      category,
      riskLevel,
      isSystemPermission,
      isActive = true,
      search,
      page = 1,
      limit = 100
    } = req.query;
    
    const filter = {};
    
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (category) filter.category = category;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (isSystemPermission !== undefined) filter.isSystemPermission = isSystemPermission === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const permissions = await Permission.find(filter)
      .sort({ module: 1, action: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Permission.countDocuments(filter);
    
    res.json({
      success: true,
      data: permissions,
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
 * GET /api/permissions/:id
 * Get permission by ID
 */
router.get("/:id",
  requirePermission('roles', 'read'),
  auditLog('view_permission_details', 'permission'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid permission ID"
      });
    }
    
    const permission = await Permission.findById(id).lean();
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }
    
    res.json({
      success: true,
      data: permission
    });
  })
);

/**
 * POST /api/permissions
 * Create new permission (Super Admin only)
 */
router.post("/",
  authorize('super_admin'),
  auditLog('create_permission', 'permission'),
  asyncHandler(async (req, res) => {
    const {
      name,
      displayName,
      description,
      module,
      action,
      category = 'operational',
      riskLevel = 'medium',
      availableScopes = ['own', 'department', 'organization'],
      defaultScope = 'own',
      dependencies = [],
      conflicts = [],
      conditions = []
    } = req.body;
    
    // Validate required fields
    if (!name || !displayName || !module || !action) {
      return res.status(400).json({
        success: false,
        message: "Name, display name, module, and action are required"
      });
    }
    
    // Check if permission already exists
    const existing = await Permission.findOne({ name: name.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Permission with this name already exists"
      });
    }
    
    // Check for module:action uniqueness
    const moduleActionExists = await Permission.findOne({ module, action });
    if (moduleActionExists) {
      return res.status(400).json({
        success: false,
        message: "Permission for this module and action already exists"
      });
    }
    
    const permission = await Permission.create({
      name: name.toUpperCase(),
      displayName,
      description,
      module,
      action,
      category,
      riskLevel,
      availableScopes,
      defaultScope,
      dependencies,
      conflicts,
      conditions,
      isSystemPermission: false
    });
    
    res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: permission
    });
  })
);

/**
 * PUT /api/permissions/:id
 * Update permission (Super Admin only)
 */
router.put("/:id",
  authorize('super_admin'),
  auditLog('update_permission', 'permission'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid permission ID"
      });
    }
    
    const permission = await Permission.findById(id);
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }
    
    // Prevent modification of system permissions
    if (permission.isSystemPermission) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify system permissions"
      });
    }
    
    const {
      displayName,
      description,
      category,
      riskLevel,
      availableScopes,
      defaultScope,
      dependencies,
      conflicts,
      conditions,
      isActive
    } = req.body;
    
    // Update fields
    if (displayName) permission.displayName = displayName;
    if (description !== undefined) permission.description = description;
    if (category) permission.category = category;
    if (riskLevel) permission.riskLevel = riskLevel;
    if (availableScopes) permission.availableScopes = availableScopes;
    if (defaultScope) permission.defaultScope = defaultScope;
    if (dependencies) permission.dependencies = dependencies;
    if (conflicts) permission.conflicts = conflicts;
    if (conditions) permission.conditions = conditions;
    if (isActive !== undefined) permission.isActive = isActive;
    
    await permission.save();
    
    res.json({
      success: true,
      message: "Permission updated successfully",
      data: permission
    });
  })
);

/**
 * DELETE /api/permissions/:id
 * Delete permission (Super Admin only)
 */
router.delete("/:id",
  authorize('super_admin'),
  auditLog('delete_permission', 'permission'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid permission ID"
      });
    }
    
    const permission = await Permission.findById(id);
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }
    
    // Prevent deletion of system permissions
    if (permission.isSystemPermission) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete system permissions"
      });
    }
    
    // Check if permission is in use by any roles
    const rolesUsingPermission = await Role.find({
      'permissions.module': permission.module,
      'permissions.actions': permission.action
    });
    
    if (rolesUsingPermission.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete permission. It is used by ${rolesUsingPermission.length} role(s).`
      });
    }
    
    await Permission.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: "Permission deleted successfully"
    });
  })
);

/**
 * GET /api/permissions/modules
 * Get all available modules
 */
router.get("/modules",
  requirePermission('roles', 'read'),
  auditLog('view_permission_modules', 'permissions'),
  asyncHandler(async (req, res) => {
    const modules = await Permission.distinct('module', { isActive: true });
    
    // Get permission count per module
    const moduleStats = await Permission.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$module', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    const moduleData = modules.map(module => {
      const stats = moduleStats.find(s => s._id === module);
      return {
        name: module,
        displayName: module.charAt(0).toUpperCase() + module.slice(1),
        permissionCount: stats ? stats.count : 0
      };
    });
    
    res.json({
      success: true,
      data: moduleData
    });
  })
);

/**
 * GET /api/permissions/by-module/:module
 * Get permissions by module
 */
router.get("/by-module/:module",
  requirePermission('roles', 'read'),
  auditLog('view_module_permissions', 'permissions'),
  asyncHandler(async (req, res) => {
    const { module } = req.params;
    
    const permissions = await Permission.find({ 
      module, 
      isActive: true 
    }).sort({ action: 1 }).lean();
    
    res.json({
      success: true,
      data: permissions
    });
  })
);

/**
 * GET /api/permissions/by-category/:category
 * Get permissions by category
 */
router.get("/by-category/:category",
  requirePermission('roles', 'read'),
  auditLog('view_category_permissions', 'permissions'),
  asyncHandler(async (req, res) => {
    const { category } = req.params;
    
    const permissions = await Permission.find({ 
      category, 
      isActive: true 
    }).sort({ module: 1, action: 1 }).lean();
    
    res.json({
      success: true,
      data: permissions
    });
  })
);

/**
 * POST /api/permissions/initialize-system-permissions
 * Initialize system permissions (Super Admin only)
 */
router.post("/initialize-system-permissions",
  authorize('super_admin'),
  auditLog('initialize_system_permissions', 'permissions'),
  asyncHandler(async (req, res) => {
    try {
      const systemPermissions = await Permission.createSystemPermissions();
      
      res.json({
        success: true,
        message: "System permissions initialized successfully",
        data: {
          created: systemPermissions.length,
          permissions: systemPermissions.map(p => ({ 
            name: p.name, 
            displayName: p.displayName,
            module: p.module,
            action: p.action
          }))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to initialize system permissions",
        error: error.message
      });
    }
  })
);

/**
 * GET /api/permissions/categories
 * Get all permission categories with stats
 */
router.get("/categories",
  requirePermission('roles', 'read'),
  auditLog('view_permission_categories', 'permissions'),
  asyncHandler(async (req, res) => {
    const categoryStats = await Permission.aggregate([
      { $match: { isActive: true } },
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 },
          riskLevels: { $push: '$riskLevel' }
        } 
      },
      { $sort: { _id: 1 } }
    ]);
    
    const categories = categoryStats.map(cat => ({
      name: cat._id,
      displayName: cat._id.charAt(0).toUpperCase() + cat._id.slice(1),
      permissionCount: cat.count,
      riskDistribution: {
        low: cat.riskLevels.filter(r => r === 'low').length,
        medium: cat.riskLevels.filter(r => r === 'medium').length,
        high: cat.riskLevels.filter(r => r === 'high').length,
        critical: cat.riskLevels.filter(r => r === 'critical').length
      }
    }));
    
    res.json({
      success: true,
      data: categories
    });
  })
);

/**
 * POST /api/permissions/validate-dependencies
 * Validate permission dependencies for a role
 */
router.post("/validate-dependencies",
  requirePermission('roles', 'read'),
  auditLog('validate_permission_dependencies', 'permissions'),
  asyncHandler(async (req, res) => {
    const { permissions: requestedPermissions } = req.body;
    
    if (!Array.isArray(requestedPermissions)) {
      return res.status(400).json({
        success: false,
        message: "Permissions array is required"
      });
    }
    
    const validationResults = [];
    
    for (const permName of requestedPermissions) {
      const permission = await Permission.findOne({ name: permName });
      
      if (!permission) {
        validationResults.push({
          permission: permName,
          valid: false,
          error: 'Permission not found'
        });
        continue;
      }
      
      // Check dependencies
      const missingDependencies = await permission.checkDependencies(
        requestedPermissions.map(p => ({ name: p }))
      );
      
      // Check conflicts
      const conflicts = permission.checkConflicts(
        requestedPermissions.map(p => ({ name: p }))
      );
      
      validationResults.push({
        permission: permName,
        valid: missingDependencies.length === 0 && conflicts.length === 0,
        missingDependencies,
        conflicts
      });
    }
    
    const isValid = validationResults.every(r => r.valid);
    
    res.json({
      success: true,
      data: {
        isValid,
        results: validationResults
      }
    });
  })
);

export default router;