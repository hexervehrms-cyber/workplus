/**
 * Asset Management Routes
 * 
 * Features:
 * - Create and manage assets
 * - Assign assets to employees/HR
 * - Return assets
 * - Track asset history
 * - Calculate asset costs for FNF deduction
 */

import express from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import AssetAssigned from '../models/AssetAssigned.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { userOrgIdFromReq } from '../utils/orgScopeHelpers.js';
import { assertEmployeeSelfOrPrivileged } from '../utils/employeeAccessHelpers.js';

const router = express.Router();

/**
 * POST /api/assets
 * Create a new asset
 * Accessible by Admin/HR and Employees
 */
router.post('/',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const {
      assetName,
      assetType,
      category,
      specifications,
      financial,
      departmentId
    } = req.body;

    try {
      // Validate required fields
      if (!assetName || !assetType || !category) {
        return res.status(400).json({
          success: false,
          message: 'Asset name, type, and category are required'
        });
      }

      // Generate unique assetTag
      const assetTag = `AST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const asset = await AssetAssigned.create({
        assetTag,
        assetName,
        assetType,
        category,
        specifications: specifications || {},
        financial: financial || {},
        departmentId,
        orgId: req.user.orgId,
        assignment: {
          assignedBy: req.user.userId
        }
      });

      logger.info('Asset created', {
        assetId: asset._id,
        assetTag: asset.assetTag,
        assetName,
        createdBy: req.user.userId,
        orgId: req.user.orgId
      });

      res.status(201).json({
        success: true,
        message: 'Asset created successfully',
        data: asset
      });

    } catch (error) {
      logger.error('Create asset error', {
        error: error.message,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: 'Failed to create asset'
      });
    }
  })
);

/**
 * GET /api/assets
 * Get all assets with filters
 */
router.get('/',
  authenticate,
  authorize('super_admin', 'admin', 'hr', 'manager'),
  asyncHandler(async (req, res) => {
    const { status, assignedTo, search, page = 1, limit = 20 } = req.query;
    const orgId = userOrgIdFromReq(req) || req.validatedOrgId || req.user.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context required',
        code: 'MISSING_ORG_CONTEXT',
      });
    }

    try {
      const query = { orgId: String(orgId), isActive: true };

      if (status) {
        query.status = status;
      }

      if (assignedTo) {
        query['assignment.assignedTo'] = assignedTo;
      }

      if (search) {
        query.$or = [
          { assetName: { $regex: search, $options: 'i' } },
          { 'specifications.serialNumber': { $regex: search, $options: 'i' } },
          { 'specifications.model': { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;

      const [assets, totalCount] = await Promise.all([
        AssetAssigned.find(query)
          .populate('assignment.assignedTo', 'userId designation department')
          .populate('assignment.assignedBy', 'name email')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        AssetAssigned.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          assets,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get assets error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assets'
      });
    }
  })
);

/**
 * POST /api/assets/my
 * Employee self-adds asset to their own portfolio
 * Protected: employee only, uses authenticated user context
 */
router.post('/my',
  authenticate,
  asyncHandler(async (req, res) => {
    const {
      assetName,
      name, // fallback name field
      category,
      serialNumber,
      condition = 'excellent',
      purchasePrice,
      currentValue,
      location,
      description,
      employeeNotes
    } = req.body;

    try {
      // Validate required fields
      const finalAssetName = assetName || name;
      if (!finalAssetName || !category) {
        return res.status(400).json({
          success: false,
          message: 'Asset name and category are required'
        });
      }

      // Validate prices are numeric if provided
      if (purchasePrice && isNaN(parseFloat(purchasePrice))) {
        return res.status(400).json({
          success: false,
          message: 'Purchase price must be a valid number'
        });
      }

      if (currentValue && isNaN(parseFloat(currentValue))) {
        return res.status(400).json({
          success: false,
          message: 'Current value must be a valid number'
        });
      }

      // Get the employee record for the logged-in user
      const employee = await Employee.findOne({ userId: req.user.userId }).select('_id');
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }

      // Generate unique assetTag
      const assetTag = `AST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Map category to valid assetType enum
      const categoryToAssetTypeMap = {
        'IT_Equipment': 'laptop', // Default IT equipment to laptop
        'Office_Furniture': 'furniture',
        'Vehicle': 'vehicle',
        'Software': 'software_license',
        'Security': 'access_card',
        'Other': 'other'
      };
      const assetType = categoryToAssetTypeMap[category] || 'other';

      // Create asset with employee-specific fields
      // Backend enforces protected fields from authenticated user
      const asset = await AssetAssigned.create({
        assetTag,
        assetName: finalAssetName,
        assetType: assetType,
        category: category,
        specifications: {
          serialNumber: serialNumber || ''
        },
        financial: {
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : 0,
          currentValue: currentValue ? parseFloat(currentValue) : (purchasePrice ? parseFloat(purchasePrice) : 0)
        },
        condition: condition,
        assignment: {
          assignedTo: employee._id,
          assignedBy: req.user.userId,
          assignmentDate: new Date(),
          location: location ? { desk: location } : undefined
        },
        description: description,
        employeeNotes: employeeNotes,
        status: 'pending_review',
        orgId: req.user.orgId,
        createdBy: req.user.userId,
        createdByRole: 'employee',
        source: 'employee_self_added'
      });

      logger.info('Employee asset created', {
        assetId: asset._id,
        assetTag: asset.assetTag,
        assetName: finalAssetName,
        createdBy: req.user.userId,
        employeeId: employee._id,
        orgId: req.user.orgId,
        source: 'employee_self_added'
      });

      res.status(201).json({
        success: true,
        message: 'Asset added successfully. Pending admin review.',
        data: asset
      });

    } catch (error) {
      logger.error('Employee create asset error', {
        message: error.message,
        name: error.name,
        errors: error.errors,
        userId: req.user.userId,
        category: req.body.category,
        body: req.body
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add asset'
      });
    }
  })
);

/**
 * GET /api/assets/my
 * Get all assets assigned to logged-in employee (admin-assigned + self-added)
 */
router.get('/my',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      // Get the employee record for the logged-in user
      const employee = await Employee.findOne({ userId: req.user.userId }).select('_id');
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }

      const orgId = String(req.user.orgId);

      // Find all assets assigned to this employee in this org
      const assets = await AssetAssigned.find({
        'assignment.assignedTo': employee._id,
        orgId: orgId,
        isActive: true
      })
        .populate('assignment.assignedBy', 'name email')
        .sort({ 'assignment.assignmentDate': -1 })
        .lean();

      const totalValue = assets.reduce((sum, asset) => {
        return sum + (asset.financial?.currentValue || asset.financial?.purchasePrice || 0);
      }, 0);

      res.json({
        success: true,
        data: {
          assets,
          totalAssets: assets.length,
          totalValue
        }
      });

    } catch (error) {
      logger.error('Get employee my assets error', {
        error: error.message,
        userId: req.user.userId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch your assets'
      });
    }
  })
);

/**
 * PUT /api/assets/my/:id
 * Employee updates their own asset (limited fields only)
 */
router.put('/my/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      condition,
      location,
      description,
      employeeNotes,
      currentValue
    } = req.body;

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      // Get the employee record for the logged-in user
      const employee = await Employee.findOne({ userId: req.user.userId }).select('_id');
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }

      const orgId = String(req.user.orgId);

      // Find asset and verify ownership
      const asset = await AssetAssigned.findById(id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      // Verify asset belongs to logged-in employee AND same org
      if (String(asset.assignment.assignedTo) !== String(employee._id) || String(asset.orgId) !== orgId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this asset'
        });
      }

      // Update only safe fields
      if (condition) asset.condition = condition;
      if (location) {
        asset.assignment.location = { desk: location };
      }
      if (description) asset.description = description;
      if (employeeNotes) asset.employeeNotes = employeeNotes;
      if (currentValue && !isNaN(parseFloat(currentValue))) {
        asset.financial.currentValue = parseFloat(currentValue);
      }

      await asset.save();

      logger.info('Employee updated asset', {
        assetId: id,
        updatedBy: req.user.userId,
        fields: Object.keys({ condition, location, description, employeeNotes, currentValue })
      });

      res.json({
        success: true,
        message: 'Asset updated successfully',
        data: asset
      });

    } catch (error) {
      logger.error('Employee update asset error', {
        error: error.message,
        assetId: req.params.id,
        userId: req.user.userId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update asset'
      });
    }
  })
);

/**
 * GET /api/assets/employee/:employeeId/total-value
 * (Registered before /:id so paths are not swallowed.)
 */
router.get('/employee/:employeeId/total-value',
  authenticate,
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;

    try {
      const tenantOrg = userOrgIdFromReq(req) || req.user.orgId;
      const assets = await AssetAssigned.find({
        'assignment.assignedTo': employeeId,
        status: { $in: ['assigned', 'in_use'] },
        isActive: true,
        ...(tenantOrg ? { orgId: String(tenantOrg) } : {}),
      }).lean();

      const totalValue = assets.reduce((sum, asset) => {
        return sum + (asset.financial?.currentValue || asset.financial?.purchasePrice || 0);
      }, 0);

      res.json({
        success: true,
        data: {
          totalAssets: assets.length,
          totalValue,
          assets: assets.map(a => ({
            _id: a._id,
            assetName: a.assetName,
            currentValue: a.financial?.currentValue || a.financial?.purchasePrice || 0,
            purchasePrice: a.financial?.purchasePrice,
            serialNumber: a.specifications?.serialNumber
          }))
        }
      });

    } catch (error) {
      logger.error('Get employee asset value error', {
        error: error.message,
        employeeId: req.params.employeeId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to calculate asset value'
      });
    }
  })
);

/**
 * GET /api/assets/employee/:employeeId
 */
router.get('/employee/:employeeId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;

    try {
      const access = await assertEmployeeSelfOrPrivileged(req, employeeId);
      if (!access.ok) {
        return res.status(access.status).json({
          success: false,
          message: access.message,
        });
      }

      const tenantOrg = userOrgIdFromReq(req) || req.user.orgId;
      const employee = await Employee.findById(employeeId).select('userId orgId');
      const userId = employee?.userId;

      const query = {
        isActive: true,
        ...(tenantOrg ? { orgId: String(tenantOrg) } : employee?.orgId ? { orgId: String(employee.orgId) } : {}),
        $or: [
          {
            'assignment.assignedTo': employeeId,
            status: { $in: ['assigned', 'in_use', 'pending_review'] }
          },
          {
            'assignment.assignedBy': userId,
            status: 'available'
          }
        ]
      };

      const assets = await AssetAssigned.find(query)
        .populate('assignment.assignedBy', 'name email')
        .sort({ 'assignment.assignmentDate': -1 })
        .lean();

      res.json({
        success: true,
        data: {
          assets,
          totalAssets: assets.length,
          totalValue: assets.reduce((sum, asset) => sum + (asset.financial?.currentValue || 0), 0)
        }
      });

    } catch (error) {
      logger.error('Get employee assets error', {
        error: error.message,
        employeeId: req.params.employeeId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee assets'
      });
    }
  })
);

/**
 * GET /api/assets/:id
 * Get asset details
 */
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    try {
      const asset = await AssetAssigned.findById(id)
        .populate('assignment.assignedTo', 'userId designation department phone')
        .populate('assignment.assignedBy', 'name email')
        .populate('assignmentHistory.assignedTo', 'userId designation')
        .populate('assignmentHistory.assignedBy', 'name email');

      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      res.json({
        success: true,
        data: asset
      });

    } catch (error) {
      logger.error('Get asset error', {
        error: error.message,
        assetId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch asset'
      });
    }
  })
);

/**
 * PUT /api/assets/:id/assign
 * Assign asset to employee/HR
 */
router.put('/:id/assign',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assignedToId, location, reason } = req.body;
    const assignedBy = req.user.userId;

    try {
      // Validate employee exists
      const employee = await Employee.findById(assignedToId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const asset = await AssetAssigned.findById(id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      // Add to history if already assigned
      if (asset.assignment.assignedTo) {
        asset.assignmentHistory.push({
          assignedTo: asset.assignment.assignedTo,
          assignedBy: asset.assignment.assignedBy,
          assignmentDate: asset.assignment.assignmentDate,
          returnDate: new Date(),
          reason: 'returned',
          condition: {
            assigned: 'good',
            returned: asset.condition
          }
        });
      }

      // Update assignment
      asset.assignment = {
        assignedTo: assignedToId,
        assignedBy,
        assignmentDate: new Date(),
        assignmentReason: reason || 'assignment',
        location: location || asset.assignment.location
      };

      asset.status = 'assigned';

      await asset.save();

      logger.info('Asset assigned', {
        assetId: id,
        assignedTo: assignedToId,
        assignedBy,
        orgId: req.user.orgId
      });

      res.json({
        success: true,
        message: 'Asset assigned successfully',
        data: asset
      });

    } catch (error) {
      logger.error('Assign asset error', {
        error: error.message,
        assetId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to assign asset'
      });
    }
  })
);

/**
 * PUT /api/assets/:id/return
 * Return asset from employee
 */
router.put('/:id/return',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { condition, notes, returnedDate } = req.body;
    const returnedBy = req.user.userId;

    try {
      const asset = await AssetAssigned.findById(id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      if (!asset.assignment.assignedTo) {
        return res.status(400).json({
          success: false,
          message: 'Asset is not currently assigned'
        });
      }

      // Add to history
      asset.assignmentHistory.push({
        assignedTo: asset.assignment.assignedTo,
        assignedBy: asset.assignment.assignedBy,
        assignmentDate: asset.assignment.assignmentDate,
        returnDate: returnedDate ? new Date(returnedDate) : new Date(),
        reason: 'returned',
        condition: {
          assigned: 'good',
          returned: condition || asset.condition
        },
        notes
      });

      // Clear assignment
      asset.assignment.assignedTo = null;
      asset.assignment.actualReturnDate = returnedDate ? new Date(returnedDate) : new Date();
      asset.condition = condition || asset.condition;
      asset.status = 'available';

      await asset.save();

      logger.info('Asset returned', {
        assetId: id,
        returnedBy,
        orgId: req.user.orgId
      });

      res.json({
        success: true,
        message: 'Asset returned successfully',
        data: asset
      });

    } catch (error) {
      logger.error('Return asset error', {
        error: error.message,
        assetId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to return asset'
      });
    }
  })
);

/**
 * PUT /api/assets/:id
 * Update asset details
 */
router.put('/:id',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assetName, specifications, financial, location } = req.body;

    try {
      const asset = await AssetAssigned.findByIdAndUpdate(
        id,
        {
          assetName,
          specifications: specifications || undefined,
          financial: financial || undefined,
          'assignment.location': location || undefined
        },
        { new: true, runValidators: true }
      );

      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      logger.info('Asset updated', {
        assetId: id,
        updatedBy: req.user.userId
      });

      res.json({
        success: true,
        message: 'Asset updated successfully',
        data: asset
      });

    } catch (error) {
      logger.error('Update asset error', {
        error: error.message,
        assetId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update asset'
      });
    }
  })
);

/**
 * DELETE /api/assets/:id
 * Soft delete asset
 */
router.delete('/:id',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const asset = await AssetAssigned.findByIdAndUpdate(
        id,
        {
          isActive: false,
          retiredDate: new Date(),
          retiredReason: 'deleted'
        },
        { new: true }
      );

      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      logger.info('Asset deleted', {
        assetId: id,
        deletedBy: req.user.userId
      });

      res.json({
        success: true,
        message: 'Asset deleted successfully'
      });

    } catch (error) {
      logger.error('Delete asset error', {
        error: error.message,
        assetId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to delete asset'
      });
    }
  })
);

/**
 * POST /api/assets/:id/photos
 * Upload multiple photos for an asset
 */
router.post('/:id/photos',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { photos } = req.body; // Array of { photoData, fileName, description }

    try {
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one photo is required'
        });
      }

      // Validate max 10 photos per upload
      if (photos.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 photos can be uploaded at once'
        });
      }

      const asset = await AssetAssigned.findById(id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      // Add photos to asset
      const uploadedPhotos = [];
      photos.forEach((photo, index) => {
        if (!photo.photoData) {
          throw new Error(`Photo ${index + 1} is missing photoData`);
        }

        const photoObj = {
          photoData: photo.photoData,
          fileName: photo.fileName || `asset-photo-${Date.now()}-${index + 1}`,
          mimeType: photo.mimeType || 'image/jpeg',
          uploadedBy: req.user.userId,
          description: photo.description || '',
          isMainPhoto: photos.length === 1 || (index === 0 && !asset.photos.some(p => p.isMainPhoto))
        };

        asset.photos.push(photoObj);
        uploadedPhotos.push(photoObj);
      });

      await asset.save();

      logger.info('Asset photos uploaded', {
        assetId: id,
        photoCount: photos.length,
        uploadedBy: req.user.userId
      });

      res.status(201).json({
        success: true,
        message: `${photos.length} photo(s) uploaded successfully`,
        data: {
          assetId: id,
          totalPhotos: asset.photos.length,
          uploadedPhotos
        }
      });

    } catch (error) {
      logger.error('Upload asset photos error', {
        error: error.message,
        assetId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to upload photos'
      });
    }
  })
);

/**
 * GET /api/assets/:id/photos
 * Get all photos for an asset
 */
router.get('/:id/photos',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const asset = await AssetAssigned.findById(id)
        .select('photos')
        .populate('photos.uploadedBy', 'name email');

      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      res.json({
        success: true,
        data: {
          assetId: id,
          totalPhotos: asset.photos.length,
          photos: asset.photos
        }
      });

    } catch (error) {
      logger.error('Get asset photos error', {
        error: error.message,
        assetId: req.params.id
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch photos'
      });
    }
  })
);

/**
 * DELETE /api/assets/:id/photos/:photoId
 * Delete a specific photo from an asset
 */
router.delete('/:id/photos/:photoId',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id, photoId } = req.params;

    try {
      const asset = await AssetAssigned.findById(id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      const photoIndex = asset.photos.findIndex(p => p._id.toString() === photoId);
      if (photoIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Photo not found'
        });
      }

      // If deleting main photo, set another as main
      if (asset.photos[photoIndex].isMainPhoto && asset.photos.length > 1) {
        asset.photos[0].isMainPhoto = true;
      }

      asset.photos.splice(photoIndex, 1);
      await asset.save();

      logger.info('Asset photo deleted', {
        assetId: id,
        photoId,
        deletedBy: req.user.userId
      });

      res.json({
        success: true,
        message: 'Photo deleted successfully',
        data: {
          assetId: id,
          totalPhotos: asset.photos.length
        }
      });

    } catch (error) {
      logger.error('Delete asset photo error', {
        error: error.message,
        assetId: req.params.id,
        photoId: req.params.photoId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to delete photo'
      });
    }
  })
);

/**
 * PUT /api/assets/:id/photos/:photoId/set-main
 * Set a photo as the main/thumbnail photo
 */
router.put('/:id/photos/:photoId/set-main',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { id, photoId } = req.params;

    try {
      const asset = await AssetAssigned.findById(id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          message: 'Asset not found'
        });
      }

      const photoIndex = asset.photos.findIndex(p => p._id.toString() === photoId);
      if (photoIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Photo not found'
        });
      }

      // Remove main photo flag from all photos
      asset.photos.forEach(photo => {
        photo.isMainPhoto = false;
      });

      // Set selected photo as main
      asset.photos[photoIndex].isMainPhoto = true;
      await asset.save();

      logger.info('Asset main photo updated', {
        assetId: id,
        photoId,
        updatedBy: req.user.userId
      });

      res.json({
        success: true,
        message: 'Main photo updated successfully',
        data: asset.photos
      });

    } catch (error) {
      logger.error('Set main photo error', {
        error: error.message,
        assetId: req.params.id,
        photoId: req.params.photoId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to set main photo'
      });
    }
  })
);

/**
 * GET /api/assets/export/csv
 * Export all assets as CSV
 */
router.get('/export/csv',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const orgId = userOrgIdFromReq(req) || req.validatedOrgId || req.user.orgId;

    try {
      const assets = await AssetAssigned.find({ orgId, isActive: true })
        .populate('assignment.assignedTo', 'userId designation')
        .lean();

      if (assets.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No assets to export'
        });
      }

      // Prepare CSV headers
      const headers = [
        'Asset Name',
        'Asset Type',
        'Category',
        'Model',
        'Serial Number',
        'Brand',
        'Purchase Price',
        'Current Value',
        'Purchase Date',
        'Status',
        'Condition',
        'Assigned To',
        'Assignment Date',
        'Location',
        'Vendor',
        'Invoice Number'
      ];

      // Prepare CSV rows
      const rows = assets.map(asset => [
        asset.assetName,
        asset.assetType,
        asset.category,
        asset.specifications?.model || '',
        asset.specifications?.serialNumber || '',
        asset.specifications?.brand || '',
        asset.financial?.purchasePrice || '',
        asset.financial?.currentValue || '',
        asset.financial?.purchaseDate ? new Date(asset.financial.purchaseDate).toLocaleDateString() : '',
        asset.status,
        asset.condition,
        asset.assignment?.assignedTo?.userId?.name || '',
        asset.assignment?.assignmentDate ? new Date(asset.assignment.assignmentDate).toLocaleDateString() : '',
        `${asset.assignment?.location?.office || ''} ${asset.assignment?.location?.desk || ''}`.trim(),
        asset.financial?.vendor || '',
        asset.financial?.invoiceNumber || ''
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="assets-${Date.now()}.csv"`);

      logger.info('Assets exported to CSV', {
        assetCount: assets.length,
        exportedBy: req.user.userId,
        orgId
      });

      res.send(csvContent);

    } catch (error) {
      logger.error('Export assets error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to export assets'
      });
    }
  })
);

/**
 * POST /api/assets/import/csv
 * Import assets from CSV
 */
router.post('/import/csv',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { csvData } = req.body;
    const orgId = userOrgIdFromReq(req) || req.validatedOrgId || req.user.orgId;
    const userId = req.user.userId;

    try {
      if (!csvData) {
        return res.status(400).json({
          success: false,
          message: 'CSV data is required'
        });
      }

      // Parse CSV data
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'CSV must contain headers and at least one data row'
        });
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      // Expected headers
      const expectedHeaders = [
        'Asset Name', 'Asset Type', 'Category', 'Model', 'Serial Number',
        'Brand', 'Purchase Price', 'Current Value', 'Purchase Date',
        'Status', 'Condition', 'Assigned To', 'Assignment Date', 'Location',
        'Vendor', 'Invoice Number'
      ];

      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required headers: ${missingHeaders.join(', ')}`
        });
      }

      // Parse data rows
      const createdAssets = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });

          // Validate required fields
          if (!rowData['Asset Name'] || !rowData['Asset Type'] || !rowData['Category']) {
            errors.push(`Row ${i + 1}: Missing required fields (Asset Name, Asset Type, Category)`);
            continue;
          }

          // Generate unique assetTag
          const assetTag = `AST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

          // Create asset
          const asset = await AssetAssigned.create({
            assetTag,
            assetName: rowData['Asset Name'],
            assetType: rowData['Asset Type'].toLowerCase(),
            category: rowData['Category'],
            specifications: {
              model: rowData['Model'],
              serialNumber: rowData['Serial Number'],
              brand: rowData['Brand']
            },
            financial: {
              purchasePrice: parseFloat(rowData['Purchase Price']) || 0,
              currentValue: parseFloat(rowData['Current Value']) || parseFloat(rowData['Purchase Price']) || 0,
              purchaseDate: rowData['Purchase Date'] ? new Date(rowData['Purchase Date']) : null,
              vendor: rowData['Vendor'],
              invoiceNumber: rowData['Invoice Number']
            },
            status: rowData['Status'] || 'available',
            condition: rowData['Condition'] || 'excellent',
            orgId,
            assignment: {
              assignedBy: userId
            }
          });

          createdAssets.push(asset);
        } catch (rowError) {
          errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
      }

      logger.info('Assets imported from CSV', {
        assetCount: createdAssets.length,
        errorCount: errors.length,
        importedBy: userId,
        orgId
      });

      res.status(201).json({
        success: true,
        message: `${createdAssets.length} asset(s) imported successfully`,
        data: {
          createdAssets,
          errors,
          summary: {
            total: lines.length - 1,
            successful: createdAssets.length,
            failed: errors.length
          }
        }
      });

    } catch (error) {
      logger.error('Import assets error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import assets'
      });
    }
  })
);

/**
 * GET /api/assets/export/json
 * Export all assets as JSON
 */
router.get('/export/json',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const orgId = userOrgIdFromReq(req) || req.validatedOrgId || req.user.orgId;

    try {
      const assets = await AssetAssigned.find({ orgId, isActive: true })
        .populate('assignment.assignedTo', 'userId designation')
        .lean();

      if (assets.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No assets to export'
        });
      }

      // Prepare export data
      const exportData = {
        exportDate: new Date().toISOString(),
        organizationId: orgId,
        totalAssets: assets.length,
        assets: assets.map(asset => ({
          assetName: asset.assetName,
          assetType: asset.assetType,
          category: asset.category,
          specifications: asset.specifications,
          financial: asset.financial,
          status: asset.status,
          condition: asset.condition,
          assignment: {
            assignedTo: asset.assignment?.assignedTo?.userId?.name,
            assignmentDate: asset.assignment?.assignmentDate,
            location: asset.assignment?.location
          }
        }))
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="assets-${Date.now()}.json"`);

      logger.info('Assets exported to JSON', {
        assetCount: assets.length,
        exportedBy: req.user.userId,
        orgId
      });

      res.send(JSON.stringify(exportData, null, 2));

    } catch (error) {
      logger.error('Export assets error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to export assets'
      });
    }
  })
);

/**
 * POST /api/assets/import/json
 * Import assets from JSON
 */
router.post('/import/json',
  authenticate,
  authorize('super_admin', 'admin', 'hr'),
  asyncHandler(async (req, res) => {
    const { assets } = req.body;
    const orgId = userOrgIdFromReq(req) || req.validatedOrgId || req.user.orgId;
    const userId = req.user.userId;

    try {
      if (!Array.isArray(assets) || assets.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assets array is required and must not be empty'
        });
      }

      const createdAssets = [];
      const errors = [];

      for (let i = 0; i < assets.length; i++) {
        try {
          const assetData = assets[i];

          // Validate required fields
          if (!assetData.assetName || !assetData.assetType || !assetData.category) {
            errors.push(`Asset ${i + 1}: Missing required fields (assetName, assetType, category)`);
            continue;
          }

          // Generate unique assetTag
          const assetTag = `AST-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

          // Create asset
          const asset = await AssetAssigned.create({
            assetTag,
            assetName: assetData.assetName,
            assetType: assetData.assetType.toLowerCase(),
            category: assetData.category,
            specifications: assetData.specifications || {},
            financial: assetData.financial || {},
            status: assetData.status || 'available',
            condition: assetData.condition || 'excellent',
            orgId,
            assignment: {
              assignedBy: userId
            }
          });

          createdAssets.push(asset);
        } catch (assetError) {
          errors.push(`Asset ${i + 1}: ${assetError.message}`);
        }
      }

      logger.info('Assets imported from JSON', {
        assetCount: createdAssets.length,
        errorCount: errors.length,
        importedBy: userId,
        orgId
      });

      res.status(201).json({
        success: true,
        message: `${createdAssets.length} asset(s) imported successfully`,
        data: {
          createdAssets,
          errors,
          summary: {
            total: assets.length,
            successful: createdAssets.length,
            failed: errors.length
          }
        }
      });

    } catch (error) {
      logger.error('Import assets error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import assets'
      });
    }
  })
);

export default router;
