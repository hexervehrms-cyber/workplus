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
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import Employee from '../models/Employee.js';
import Expense from '../models/Expense.js';
import AssetAssigned from '../models/AssetAssigned.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

// FIX #3: Local multer configuration for file uploads (only for import routes)
const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // Accept CSV and JSON files only
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/json' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'), false);
    }
  }
});

// Helper function to parse CSV without external dependency
const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
};

// Helper function to parse a CSV line respecting quoted fields
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

// ============================================================================
// EMPLOYEES BULK OPERATIONS
// ============================================================================

/**
 * POST /api/admin/bulk/employees/import/csv
 * Import employees from CSV file
 * FIX #3: Added employee bulk import endpoint with authentication and file upload
 */
router.post('/employees/import/csv',
  authenticate,
  authorize('super_admin', 'admin'),
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      const csvText = file.buffer.toString('utf-8');
      const rows = parseCSV(csvText);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is empty'
        });
      }

      let recordsSuccessful = 0;
      let recordsFailed = 0;
      const errors = [];

      // Process each row
      for (const row of rows) {
        try {
          // Validate required fields
          if (!row.Email || !row.Name) {
            recordsFailed++;
            errors.push(`Row missing Email or Name: ${JSON.stringify(row)}`);
            continue;
          }

          // Check if user already exists
          let user = await User.findOne({ email: row.Email.trim().toLowerCase() });
          
          if (!user) {
            // Create new user
            user = await User.create({
              name: row.Name.trim(),
              email: row.Email.trim().toLowerCase(),
              role: row.Role || 'employee',
              status: 'active',
              orgId,
              password: '' // Will be set during onboarding
            });
          }

          // Create or update employee
          const employeeData = {
            userId: user._id,
            employeeCode: row['Employee Code'] || `EMP_${Date.now()}`,
            firstName: (row.Name.trim().split(' ')[0]) || '',
            lastName: (row.Name.trim().split(' ').slice(1).join(' ')) || '',
            designation: row.Designation || 'Employee',
            department: row.Department || 'General',
            joiningDate: row['Joining Date'] ? new Date(row['Joining Date']) : new Date(),
            phone: row.Phone || '',
            status: row.Status || 'active',
            baseSalary: parseFloat(row['Base Salary']) || 0,
            hra: parseFloat(row.HRA) || 0,
            bonus: parseFloat(row.Bonus) || 0,
            orgId
          };

          await Employee.updateOne(
            { userId: user._id, orgId },
            { $set: employeeData },
            { upsert: true }
          );

          recordsSuccessful++;
        } catch (error) {
          recordsFailed++;
          errors.push(`Row error: ${error.message}`);
          logger.error('Employee import row error', { error: error.message, row });
        }
      }

      logger.info('Employees imported from CSV', {
        importedBy: req.user.userId,
        orgId,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed
      });

      res.json({
        success: true,
        message: `Imported ${recordsSuccessful} employees, ${recordsFailed} failed`,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed,
        errors: errors.slice(0, 10) // Return first 10 errors
      });

    } catch (error) {
      logger.error('Import employees CSV error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import employees from CSV',
        error: error.message
      });
    }
  })
);

/**
 * POST /api/admin/bulk/employees/import/json
 * Import employees from JSON file
 * FIX #3: Added employee bulk import endpoint with authentication and file upload
 */
router.post('/employees/import/json',
  authenticate,
  authorize('super_admin', 'admin'),
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      const jsonText = file.buffer.toString('utf-8');
      const data = JSON.parse(jsonText);
      const rows = data.employees || (Array.isArray(data) ? data : []);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'JSON file contains no employees'
        });
      }

      let recordsSuccessful = 0;
      let recordsFailed = 0;
      const errors = [];

      // Process each employee
      for (const row of rows) {
        try {
          // Validate required fields
          if (!row.email || !row.name) {
            recordsFailed++;
            errors.push(`Record missing email or name: ${JSON.stringify(row)}`);
            continue;
          }

          // Check if user already exists
          let user = await User.findOne({ email: row.email.trim().toLowerCase() });
          
          if (!user) {
            // Create new user
            user = await User.create({
              name: row.name.trim(),
              email: row.email.trim().toLowerCase(),
              role: row.role || 'employee',
              status: 'active',
              orgId,
              password: '' // Will be set during onboarding
            });
          }

          // Create or update employee
          const employeeData = {
            userId: user._id,
            employeeCode: row.employeeCode || `EMP_${Date.now()}`,
            firstName: (row.name.trim().split(' ')[0]) || '',
            lastName: (row.name.trim().split(' ').slice(1).join(' ')) || '',
            designation: row.designation || 'Employee',
            department: row.department || 'General',
            joiningDate: row.joiningDate ? new Date(row.joiningDate) : new Date(),
            phone: row.phone || '',
            status: row.status || 'active',
            baseSalary: parseFloat(row.baseSalary) || 0,
            hra: parseFloat(row.hra) || 0,
            bonus: parseFloat(row.bonus) || 0,
            orgId
          };

          await Employee.updateOne(
            { userId: user._id, orgId },
            { $set: employeeData },
            { upsert: true }
          );

          recordsSuccessful++;
        } catch (error) {
          recordsFailed++;
          errors.push(`Record error: ${error.message}`);
          logger.error('Employee import row error', { error: error.message, row });
        }
      }

      logger.info('Employees imported from JSON', {
        importedBy: req.user.userId,
        orgId,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed
      });

      res.json({
        success: true,
        message: `Imported ${recordsSuccessful} employees, ${recordsFailed} failed`,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed,
        errors: errors.slice(0, 10) // Return first 10 errors
      });

    } catch (error) {
      logger.error('Import employees JSON error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import employees from JSON',
        error: error.message
      });
    }
  })
);

/**
 * POST /api/admin/bulk/expenses/import/csv
 * Import expenses from CSV file
 * FIX #3: Added expenses bulk import endpoint with authentication and file upload
 */
router.post('/expenses/import/csv',
  authenticate,
  authorize('super_admin', 'admin'),
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      const csvText = file.buffer.toString('utf-8');
      const rows = parseCSV(csvText);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is empty'
        });
      }

      let recordsSuccessful = 0;
      let recordsFailed = 0;
      const errors = [];

      // Process each row
      for (const row of rows) {
        try {
          // Validate required fields
          if (!row['Employee Code'] || !row.Amount || !row.Category) {
            recordsFailed++;
            errors.push(`Row missing Employee Code, Amount, or Category: ${JSON.stringify(row)}`);
            continue;
          }

          // Find employee by code
          const employee = await Employee.findOne({
            employeeCode: row['Employee Code'].trim(),
            orgId
          });

          if (!employee) {
            recordsFailed++;
            errors.push(`Employee not found: ${row['Employee Code']}`);
            continue;
          }

          // Create expense
          const expenseData = {
            employeeId: employee._id,
            date: row.Date ? new Date(row.Date) : new Date(),
            category: row.Category.trim(),
            description: row.Description || '',
            amount: parseFloat(row.Amount),
            status: row.Status || 'pending',
            orgId,
            submittedBy: req.user.userId,
            submittedDate: new Date()
          };

          await Expense.create(expenseData);
          recordsSuccessful++;
        } catch (error) {
          recordsFailed++;
          errors.push(`Row error: ${error.message}`);
          logger.error('Expense import row error', { error: error.message, row });
        }
      }

      logger.info('Expenses imported from CSV', {
        importedBy: req.user.userId,
        orgId,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed
      });

      res.json({
        success: true,
        message: `Imported ${recordsSuccessful} expenses, ${recordsFailed} failed`,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed,
        errors: errors.slice(0, 10)
      });

    } catch (error) {
      logger.error('Import expenses CSV error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import expenses from CSV',
        error: error.message
      });
    }
  })
);

/**
 * POST /api/admin/bulk/expenses/import/json
 * Import expenses from JSON file
 * FIX #3: Added expenses bulk import endpoint with authentication and file upload
 */
router.post('/expenses/import/json',
  authenticate,
  authorize('super_admin', 'admin'),
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      const jsonText = file.buffer.toString('utf-8');
      const data = JSON.parse(jsonText);
      const rows = data.expenses || (Array.isArray(data) ? data : []);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'JSON file contains no expenses'
        });
      }

      let recordsSuccessful = 0;
      let recordsFailed = 0;
      const errors = [];

      // Process each expense
      for (const row of rows) {
        try {
          // Validate required fields
          if (!row.employeeCode || !row.amount || !row.category) {
            recordsFailed++;
            errors.push(`Record missing employeeCode, amount, or category: ${JSON.stringify(row)}`);
            continue;
          }

          // Find employee by code
          const employee = await Employee.findOne({
            employeeCode: row.employeeCode.trim(),
            orgId
          });

          if (!employee) {
            recordsFailed++;
            errors.push(`Employee not found: ${row.employeeCode}`);
            continue;
          }

          // Create expense
          const expenseData = {
            employeeId: employee._id,
            date: row.date ? new Date(row.date) : new Date(),
            category: row.category.trim(),
            description: row.description || '',
            amount: parseFloat(row.amount),
            status: row.status || 'pending',
            orgId,
            submittedBy: req.user.userId,
            submittedDate: new Date()
          };

          await Expense.create(expenseData);
          recordsSuccessful++;
        } catch (error) {
          recordsFailed++;
          errors.push(`Record error: ${error.message}`);
          logger.error('Expense import row error', { error: error.message, row });
        }
      }

      logger.info('Expenses imported from JSON', {
        importedBy: req.user.userId,
        orgId,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed
      });

      res.json({
        success: true,
        message: `Imported ${recordsSuccessful} expenses, ${recordsFailed} failed`,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed,
        errors: errors.slice(0, 10)
      });

    } catch (error) {
      logger.error('Import expenses JSON error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import expenses from JSON',
        error: error.message
      });
    }
  })
);

/**
 * POST /api/admin/bulk/assets/import/csv
 * Import assets from CSV file
 * FIX #3: Added assets bulk import endpoint with authentication and file upload
 */
router.post('/assets/import/csv',
  authenticate,
  authorize('super_admin', 'admin'),
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      const csvText = file.buffer.toString('utf-8');
      const rows = parseCSV(csvText);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is empty'
        });
      }

      let recordsSuccessful = 0;
      let recordsFailed = 0;
      const errors = [];

      // Process each row
      for (const row of rows) {
        try {
          // Validate required fields
          if (!row['Asset Name'] || !row['Asset Type']) {
            recordsFailed++;
            errors.push(`Row missing Asset Name or Asset Type: ${JSON.stringify(row)}`);
            continue;
          }

          // Create asset
          const assetData = {
            assetName: row['Asset Name'].trim(),
            assetType: row['Asset Type'].trim(),
            category: row.Category || 'General',
            status: row.Status || 'available',
            condition: row.Condition || 'good',
            orgId,
            specifications: {
              model: row.Model || '',
              serialNumber: row['Serial Number'] || '',
              brand: row.Brand || ''
            },
            financial: {
              purchasePrice: parseFloat(row['Purchase Price']) || 0,
              currentValue: parseFloat(row['Current Value']) || 0,
              purchaseDate: row['Purchase Date'] ? new Date(row['Purchase Date']) : new Date()
            },
            isActive: true
          };

          await AssetAssigned.create(assetData);
          recordsSuccessful++;
        } catch (error) {
          recordsFailed++;
          errors.push(`Row error: ${error.message}`);
          logger.error('Asset import row error', { error: error.message, row });
        }
      }

      logger.info('Assets imported from CSV', {
        importedBy: req.user.userId,
        orgId,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed
      });

      res.json({
        success: true,
        message: `Imported ${recordsSuccessful} assets, ${recordsFailed} failed`,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed,
        errors: errors.slice(0, 10)
      });

    } catch (error) {
      logger.error('Import assets CSV error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import assets from CSV',
        error: error.message
      });
    }
  })
);

/**
 * POST /api/admin/bulk/assets/import/json
 * Import assets from JSON file
 * FIX #3: Added assets bulk import endpoint with authentication and file upload
 */
router.post('/assets/import/json',
  authenticate,
  authorize('super_admin', 'admin'),
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      const jsonText = file.buffer.toString('utf-8');
      const data = JSON.parse(jsonText);
      const rows = data.assets || (Array.isArray(data) ? data : []);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'JSON file contains no assets'
        });
      }

      let recordsSuccessful = 0;
      let recordsFailed = 0;
      const errors = [];

      // Process each asset
      for (const row of rows) {
        try {
          // Validate required fields
          if (!row.assetName || !row.assetType) {
            recordsFailed++;
            errors.push(`Record missing assetName or assetType: ${JSON.stringify(row)}`);
            continue;
          }

          // Create asset
          const assetData = {
            assetName: row.assetName.trim(),
            assetType: row.assetType.trim(),
            category: row.category || 'General',
            status: row.status || 'available',
            condition: row.condition || 'good',
            orgId,
            specifications: row.specifications || {
              model: '',
              serialNumber: '',
              brand: ''
            },
            financial: row.financial || {
              purchasePrice: 0,
              currentValue: 0,
              purchaseDate: new Date()
            },
            isActive: true
          };

          await AssetAssigned.create(assetData);
          recordsSuccessful++;
        } catch (error) {
          recordsFailed++;
          errors.push(`Record error: ${error.message}`);
          logger.error('Asset import row error', { error: error.message, row });
        }
      }

      logger.info('Assets imported from JSON', {
        importedBy: req.user.userId,
        orgId,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed
      });

      res.json({
        success: true,
        message: `Imported ${recordsSuccessful} assets, ${recordsFailed} failed`,
        recordsProcessed: rows.length,
        recordsSuccessful,
        recordsFailed,
        errors: errors.slice(0, 10)
      });

    } catch (error) {
      logger.error('Import assets JSON error', {
        error: error.message,
        orgId: req.user.orgId
      });
      res.status(500).json({
        success: false,
        message: 'Failed to import assets from JSON',
        error: error.message
      });
    }
  })
);
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

