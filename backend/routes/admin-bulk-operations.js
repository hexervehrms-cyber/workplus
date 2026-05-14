/**
 * Admin Bulk Import/Export Routes
 * 
 * Features:
 * - Bulk import/export employees
 * - Bulk import/export expenses
 * - Bulk import/export assets
 * - CSV and JSON format support
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import Employee from '../models/Employee.js';
import Expense from '../models/Expense.js';
import AssetAssigned from '../models/AssetAssigned.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ============================================================================
// EMPLOYEES BULK OPERATIONS
// ============================================================================

/**
 * GET /api/admin/bulk/employees/export/csv
 * Export all employees as CSV
 */
router.get('/employees/export/csv',
  authenticate,
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;

    try {
      const employees = await Employee.find({ orgId, status: 'active' })
        .populate('userId', 'name email')
        .lean();

      if (employees.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No employees to export'
        });
      }

      // Prepare CSV headers
      const headers = [
        'Employee Code',
        'Name',
        'Email',
        'Designation',
        'Department',
        'Joining Date',
        'Phone',
        'Status',
        'Base Salary',
        'HRA',
        'Bonus'
      ];

      // Prepare CSV rows
      const rows = employees.map(emp => [
        emp.employeeCode || '',
        emp.userId?.name || '',
        emp.userId?.email || '',
        emp.designation || '',
        emp.department || '',
        emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '',
        emp.phone || '',
        emp.status || '',
        emp.baseSalary || '',
        emp.hra || '',
        emp.bonus || ''
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="employees-${Date.now()}.csv"`);

      logger.info('Employees exported to CSV', {
        employeeCount: employees.length,
        exportedBy: req.user.userId,
        orgId
      });

      res.send(csvContent);

    } catch (error) {
      logger.error('Export employees error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to export employees'
      });
    }
  })
);

/**
 * GET /api/admin/bulk/employees/export/json
 * Export all employees as JSON
 */
router.get('/employees/export/json',
  authenticate,
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;

    try {
      const employees = await Employee.find({ orgId, status: 'active' })
        .populate('userId', 'name email')
        .lean();

      if (employees.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No employees to export'
        });
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        organizationId: orgId,
        totalEmployees: employees.length,
        employees: employees.map(emp => ({
          employeeCode: emp.employeeCode,
          name: emp.userId?.name,
          email: emp.userId?.email,
          designation: emp.designation,
          department: emp.department,
          joiningDate: emp.joiningDate,
          phone: emp.phone,
          status: emp.status,
          baseSalary: emp.baseSalary,
          hra: emp.hra,
          bonus: emp.bonus
        }))
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="employees-${Date.now()}.json"`);

      logger.info('Employees exported to JSON', {
        employeeCount: employees.length,
        exportedBy: req.user.userId,
        orgId
      });

      res.send(JSON.stringify(exportData, null, 2));

    } catch (error) {
      logger.error('Export employees error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to export employees'
      });
    }
  })
);

// ============================================================================
// EXPENSES BULK OPERATIONS
// ============================================================================

/**
 * GET /api/admin/bulk/expenses/export/csv
 * Export all expenses as CSV
 */
router.get('/expenses/export/csv',
  authenticate,
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;

    try {
      const expenses = await Expense.find({ orgId })
        .populate('employeeId', 'employeeCode')
        .populate('submittedBy', 'name')
        .lean();

      if (expenses.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No expenses to export'
        });
      }

      // Prepare CSV headers
      const headers = [
        'Date',
        'Employee Code',
        'Category',
        'Description',
        'Amount',
        'Status',
        'Submitted By',
        'Submitted Date'
      ];

      // Prepare CSV rows
      const rows = expenses.map(exp => [
        exp.date ? new Date(exp.date).toLocaleDateString() : '',
        exp.employeeId?.employeeCode || '',
        exp.category || '',
        exp.description || '',
        exp.amount || '',
        exp.status || '',
        exp.submittedBy?.name || '',
        exp.submittedDate ? new Date(exp.submittedDate).toLocaleDateString() : ''
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expenses-${Date.now()}.csv"`);

      logger.info('Expenses exported to CSV', {
        expenseCount: expenses.length,
        exportedBy: req.user.userId,
        orgId
      });

      res.send(csvContent);

    } catch (error) {
      logger.error('Export expenses error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to export expenses'
      });
    }
  })
);

/**
 * GET /api/admin/bulk/expenses/export/json
 * Export all expenses as JSON
 */
router.get('/expenses/export/json',
  authenticate,
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;

    try {
      const expenses = await Expense.find({ orgId })
        .populate('employeeId', 'employeeCode')
        .populate('submittedBy', 'name')
        .lean();

      if (expenses.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No expenses to export'
        });
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        organizationId: orgId,
        totalExpenses: expenses.length,
        expenses: expenses.map(exp => ({
          date: exp.date,
          employeeCode: exp.employeeId?.employeeCode,
          category: exp.category,
          description: exp.description,
          amount: exp.amount,
          status: exp.status,
          submittedBy: exp.submittedBy?.name,
          submittedDate: exp.submittedDate
        }))
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="expenses-${Date.now()}.json"`);

      logger.info('Expenses exported to JSON', {
        expenseCount: expenses.length,
        exportedBy: req.user.userId,
        orgId
      });

      res.send(JSON.stringify(exportData, null, 2));

    } catch (error) {
      logger.error('Export expenses error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to export expenses'
      });
    }
  })
);

// ============================================================================
// ASSETS BULK OPERATIONS
// ============================================================================

/**
 * GET /api/admin/bulk/assets/export/csv
 * Export all assets as CSV
 */
router.get('/assets/export/csv',
  authenticate,
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;

    try {
      const assets = await AssetAssigned.find({ orgId, isActive: true })
        .populate('assignment.assignedTo', 'userId')
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
        'Location'
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
        `${asset.assignment?.location?.office || ''} ${asset.assignment?.location?.desk || ''}`.trim()
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
 * GET /api/admin/bulk/assets/export/json
 * Export all assets as JSON
 */
router.get('/assets/export/json',
  authenticate,
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;

    try {
      const assets = await AssetAssigned.find({ orgId, isActive: true })
        .populate('assignment.assignedTo', 'userId')
        .lean();

      if (assets.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No assets to export'
        });
      }

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

export default router;
