/**
 * Employee Dashboard Routes - Production Ready
 * 
 * Comprehensive employee dashboard with real-time data:
 * - Profile management with real MongoDB persistence
 * - Attendance tracking with real-time sync
 * - Leave management with approval workflows
 * - Expense management with receipt uploads
 * - Payroll information with real calculations
 * - Document management with secure uploads
 * - Real-time notifications and updates
 * - Complete CRUD operations with validation
 */

import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate, requirePermission, auditLog } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import fileValidator from '../middleware/fileValidator.js';
import { 
  validateBody, 
  validateQuery, 
  sanitizeInput, 
  preventNoSQLInjection,
  validateFileUpload,
  schemas 
} from '../middleware/validation.js';
import logger from '../utils/logger.js';
import EmailNotificationService from '../utils/emailNotificationService.js';
import { notifyAdminsOnLeaveSubmitted, resolveOrganizationSmtp } from '../utils/workflowNotifications.js';

// Import models
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Expense from '../models/Expense.js';
import Payslip from '../models/Payroll.js';
import Document from '../models/Document.js';
import Notification from '../models/Notification.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = file.fieldname === 'receipt' ? 'backend/uploads/receipts' : 
                      file.fieldname === 'avatar' ? 'backend/uploads/avatars' : 
                      'backend/uploads/documents';
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${req.user.userId}-${sanitized}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB for receipts
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, and images are allowed.'));
    }
  }
});

// ============================================================================
// EMPLOYEE DASHBOARD OVERVIEW
// ============================================================================

/**
 * GET /api/employee-dashboard/overview
 * Get comprehensive dashboard overview for employee
 */
router.get('/overview', 
  authenticate,
  sanitizeInput,
  preventNoSQLInjection,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    
    try {
      // Get employee profile
      const employee = await Employee.findOne({ userId, orgId, status: 'active' })
        .populate('userId', 'name email avatar role')
        .lean();
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found or inactive'
        });
      }

      // Get current month attendance summary
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const attendanceSummary = await Attendance.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            orgId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalHours: { $sum: '$hoursWorked' }
          }
        }
      ]);

      // Get leave balance and recent requests
      const leaveBalance = await LeaveRequest.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            orgId,
            status: 'approved',
            startDate: {
              $gte: new Date(currentMonth.getFullYear(), 0, 1), // Start of year
              $lte: new Date(currentMonth.getFullYear(), 11, 31) // End of year
            }
          }
        },
        {
          $group: {
            _id: '$type',
            daysUsed: {
              $sum: {
                $divide: [
                  { $subtract: ['$endDate', '$startDate'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ]);

      // Get recent expenses
      const recentExpenses = await Expense.find({
        userId,
        orgId
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

      // Get pending approvals count
      const pendingApprovals = await Promise.all([
        LeaveRequest.countDocuments({ userId, orgId, status: 'pending' }),
        Expense.countDocuments({ userId, orgId, status: 'pending' })
      ]);

      // Get recent notifications
      const recentNotifications = await Notification.find({
        userId,
        orgId,
        isRead: false
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

      // Calculate attendance statistics
      const attendanceStats = {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        totalHours: 0
      };

      attendanceSummary.forEach(stat => {
        attendanceStats[stat._id.replace('-', '')] = stat.count;
        attendanceStats.totalHours += stat.totalHours || 0;
      });

      // Calculate leave balance (assuming 20 days annual leave)
      const annualLeaveAllowance = employee.leaveAllowance || 20;
      const usedLeave = leaveBalance.reduce((total, leave) => total + leave.daysUsed, 0);
      const remainingLeave = annualLeaveAllowance - usedLeave;

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'dashboard:overview:updated', {
          attendanceStats,
          leaveBalance: { used: usedLeave, remaining: remainingLeave },
          pendingApprovals: pendingApprovals[0] + pendingApprovals[1],
          lastUpdated: new Date()
        });
      }

      res.json({
        success: true,
        data: {
          employee: {
            id: employee._id,
            name: employee.userId.name,
            email: employee.userId.email,
            avatar: employee.userId.avatar,
            designation: employee.designation,
            department: employee.department,
            employeeCode: employee.employeeCode,
            joiningDate: employee.joiningDate
          },
          attendanceStats,
          leaveBalance: {
            allowance: annualLeaveAllowance,
            used: Math.round(usedLeave),
            remaining: Math.round(remainingLeave)
          },
          recentExpenses: recentExpenses.map(expense => ({
            id: expense._id,
            category: expense.category,
            amount: expense.amount,
            date: expense.date,
            status: expense.status
          })),
          pendingApprovals: {
            leaves: pendingApprovals[0],
            expenses: pendingApprovals[1],
            total: pendingApprovals[0] + pendingApprovals[1]
          },
          notifications: recentNotifications.map(notif => ({
            id: notif._id,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            createdAt: notif.createdAt
          })),
          lastUpdated: new Date()
        }
      });

    } catch (error) {
      logger.error('Employee dashboard overview error', {
        userId,
        orgId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        message: 'Failed to load dashboard overview'
      });
    }
  })
);

// ============================================================================
// EMPLOYEE PROFILE MANAGEMENT
// ============================================================================

/**
 * GET /api/employee-dashboard/profile
 * Get complete employee profile
 */
router.get('/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;

    try {
      const user = await User.findById(userId).select('-password').lean();
      const employee = await Employee.findOne({ userId, orgId, status: 'active' }).lean();

      if (!user || !employee) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found or inactive'
        });
      }

      res.json({
        success: true,
        data: {
          personal: {
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            phone: user.contact?.phone,
            address: user.contact?.address,
            emergencyContact: user.contact?.emergencyContact
          },
          professional: {
            employeeCode: employee.employeeCode,
            designation: employee.designation,
            department: employee.department,
            joiningDate: employee.joiningDate,
            status: employee.status
          },
          salary: {
            baseSalary: employee.baseSalary,
            hra: employee.hra,
            allowances: employee.allowances,
            providentFund: employee.providentFund
          },
          preferences: user.preferences || {}
        }
      });

    } catch (error) {
      logger.error('Get profile error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load profile'
      });
    }
  })
);

/**
 * PUT /api/employee-dashboard/profile
 * Update employee profile
 */
router.put('/profile',
  authenticate,
  sanitizeInput,
  preventNoSQLInjection,
  validateBody(schemas.employeeProfile),
  auditLog('update_profile', 'employee'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { personal, preferences } = req.body;

    try {
      // Update user information
      const userUpdate = {};
      if (personal?.name) userUpdate.name = personal.name;
      if (personal?.phone) userUpdate['contact.phone'] = personal.phone;
      if (personal?.address) userUpdate['contact.address'] = personal.address;
      if (personal?.emergencyContact) userUpdate['contact.emergencyContact'] = personal.emergencyContact;
      if (preferences) userUpdate.preferences = preferences;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: userUpdate },
        { returnDocument: 'after', runValidators: true }
      ).select('-password');

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'profile:updated', {
          user: updatedUser,
          updatedAt: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });

    } catch (error) {
      logger.error('Update profile error', { 
        userId, 
        error: error.message, 
        stack: error.stack,
        body: req.body 
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  })
);

/**
 * POST /api/employee-dashboard/profile/avatar
 * Upload employee avatar
 */
router.post('/profile/avatar',
  authenticate,
  upload.single('avatar'),
  fileValidator,
  auditLog('upload_avatar', 'employee'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No avatar file provided'
        });
      }

      const avatarPath = `/uploads/avatars/${req.file.filename}`;

      // Update user avatar
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { avatar: avatarPath },
        { new: true }
      ).select('-password');

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'avatar:updated', {
          avatar: avatarPath,
          updatedAt: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Avatar updated successfully',
        data: {
          avatar: avatarPath,
          user: updatedUser
        }
      });

    } catch (error) {
      logger.error('Avatar upload error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to upload avatar'
      });
    }
  })
);

// ============================================================================
// ATTENDANCE MANAGEMENT
// ============================================================================

/**
 * GET /api/employee-dashboard/attendance
 * Get employee attendance records with real-time data
 */
router.get('/attendance',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    try {
      const query = { userId, orgId };
      
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else {
        // Default to current month
        const now = new Date();
        query.date = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0)
        };
      }

      const skip = (page - 1) * limit;
      
      const [attendance, totalCount] = await Promise.all([
        Attendance.find(query)
          .sort({ date: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        Attendance.countDocuments(query)
      ]);

      // Calculate summary statistics
      const summary = await Attendance.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalHours: { $sum: '$hoursWorked' }
          }
        }
      ]);

      const stats = {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        totalHours: 0,
        averageHours: 0
      };

      let totalDays = 0;
      summary.forEach(stat => {
        const status = stat._id.replace('-', '');
        stats[status] = stat.count;
        stats.totalHours += stat.totalHours || 0;
        totalDays += stat.count;
      });

      stats.averageHours = totalDays > 0 ? Math.round((stats.totalHours / totalDays) * 100) / 100 : 0;

      res.json({
        success: true,
        data: {
          attendance: attendance.map(record => ({
            id: record._id,
            date: record.date,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            status: record.status,
            hoursWorked: record.hoursWorked,
            breaks: record.breaks || [],
            notes: record.notes
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          summary: stats
        }
      });

    } catch (error) {
      logger.error('Get attendance error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load attendance records'
      });
    }
  })
);

/**
 * POST /api/employee-dashboard/attendance/checkin
 * Employee check-in with real-time sync
 */
router.post('/attendance/checkin',
  authenticate,
  sanitizeInput,
  preventNoSQLInjection,
  validateBody(schemas.checkIn),
  auditLog('checkin', 'attendance'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { location, notes } = req.body;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if already checked in today
      const existingAttendance = await Attendance.findOne({
        userId,
        orgId,
        date: today
      });

      if (existingAttendance && existingAttendance.checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Already checked in today',
          data: {
            checkIn: existingAttendance.checkIn,
            status: existingAttendance.status
          }
        });
      }

      const checkInTime = new Date();
      const employee = await Employee.findOne({ userId, orgId, status: 'active' })
        .populate('userId', 'name');

      if (!employee) {
        return res.status(403).json({
          success: false,
          message: 'Employee profile not found or inactive'
        });
      }

      // Determine status based on check-in time (9 AM standard)
      const standardTime = new Date(today);
      standardTime.setHours(9, 0, 0, 0);
      const isLate = checkInTime > standardTime;

      // Calculate localDate as YYYY-MM-DD in India timezone
      const localDate = today.toISOString().split('T')[0];
      const timezone = 'Asia/Kolkata';

      const attendanceData = {
        userId,
        employeeId: employee._id,
        employeeName: employee.userId.name,
        // Canonical org ID fields
        orgId,
        organizationId: orgId,
        companyId: orgId,
        date: today,
        localDate,
        // Canonical check-in fields
        checkIn: checkInTime,
        checkInTime: checkInTime,
        checkOut: null,
        checkOutTime: null,
        timezone,
        status: isLate ? 'late' : 'checked_in',
        breaks: [],
        notes: notes || '',
        checkInLocation: location || 'Office'
      };

      let attendance;
      if (existingAttendance) {
        // Update existing record with canonical fields
        attendance = await Attendance.findByIdAndUpdate(
          existingAttendance._id,
          attendanceData,
          { new: true }
        );
      } else {
        // Create new record
        attendance = await Attendance.create(attendanceData);
      }
      
      console.log('[EMPLOYEE-DASHBOARD CHECKIN SAVED]', JSON.stringify({
        _id: attendance._id,
        userId: attendance.userId,
        employeeId: attendance.employeeId,
        employeeName: attendance.employeeName,
        orgId: attendance.orgId,
        organizationId: attendance.organizationId,
        date: attendance.date,
        localDate: attendance.localDate,
        checkIn: attendance.checkIn,
        checkInTime: attendance.checkInTime,
        checkOut: attendance.checkOut,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        breaks: attendance.breaks,
        timezone: attendance.timezone
      }, null, 2));

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToOrg(orgId, 'attendance:checkin', {
          userId,
          employeeName: employee.userId.name,
          checkIn: checkInTime,
          status: attendance.status,
          timestamp: new Date()
        });

        global.socketManager.emitToUser(userId, 'attendance:checkin:success', {
          attendance,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Checked in successfully',
        data: {
          id: attendance._id,
          checkIn: attendance.checkIn,
          status: attendance.status,
          isLate
        }
      });

    } catch (error) {
      logger.error('Check-in error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to check in'
      });
    }
  })
);

/**
 * POST /api/employee-dashboard/attendance/checkout
 * Employee check-out with hours calculation
 */
router.post('/attendance/checkout',
  authenticate,
  auditLog('checkout', 'attendance'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { notes } = req.body;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendance = await Attendance.findOne({
        userId,
        orgId,
        date: today
      });

      if (!attendance || !attendance.checkIn) {
        return res.status(400).json({
          success: false,
          message: 'No check-in record found for today'
        });
      }

      if (attendance.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Already checked out today',
          data: {
            checkOut: attendance.checkOut,
            hoursWorked: attendance.hoursWorked
          }
        });
      }

      const checkOutTime = new Date();
      
      // Calculate hours worked (excluding breaks)
      const totalBreakTime = (attendance.breaks || []).reduce((total, breakItem) => {
        if (breakItem.startTime && breakItem.endTime) {
          return total + (breakItem.endTime - breakItem.startTime);
        }
        return total;
      }, 0);

      const workTime = checkOutTime - attendance.checkIn - totalBreakTime;
      const hoursWorked = Math.round((workTime / (1000 * 60 * 60)) * 100) / 100;

      // Update attendance record with canonical fields
      const updatedAttendance = await Attendance.findByIdAndUpdate(
        attendance._id,
        {
          checkOut: checkOutTime,
          checkOutTime: checkOutTime,
          hoursWorked,
          notes: notes || attendance.notes
        },
        { new: true }
      );
      
      console.log('[EMPLOYEE-DASHBOARD CHECKOUT SAVED]', JSON.stringify({
        _id: updatedAttendance._id,
        userId: updatedAttendance.userId,
        employeeId: updatedAttendance.employeeId,
        employeeName: updatedAttendance.employeeName,
        date: updatedAttendance.date,
        localDate: updatedAttendance.localDate,
        checkIn: updatedAttendance.checkIn,
        checkInTime: updatedAttendance.checkInTime,
        checkOut: updatedAttendance.checkOut,
        checkOutTime: updatedAttendance.checkOutTime,
        hoursWorked: updatedAttendance.hoursWorked,
        status: updatedAttendance.status
      }, null, 2));

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToOrg(orgId, 'attendance:checkout', {
          userId,
          employeeName: attendance.employeeName,
          checkOut: checkOutTime,
          hoursWorked,
          timestamp: new Date()
        });

        global.socketManager.emitToUser(userId, 'attendance:checkout:success', {
          attendance: updatedAttendance,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Checked out successfully',
        data: {
          id: updatedAttendance._id,
          checkOut: updatedAttendance.checkOut,
          hoursWorked: updatedAttendance.hoursWorked,
          totalHours: hoursWorked
        }
      });

    } catch (error) {
      logger.error('Check-out error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to check out'
      });
    }
  })
);

// ============================================================================
// LEAVE MANAGEMENT
// ============================================================================

/**
 * GET /api/employee-dashboard/leaves
 * Get employee leave requests with real-time status
 */
router.get('/leaves',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { status, page = 1, limit = 20 } = req.query;

    try {
      const query = { userId, orgId };
      if (status) query.status = status;

      const skip = (page - 1) * limit;

      const [leaves, totalCount] = await Promise.all([
        LeaveRequest.find(query)
          .populate('approvedBy', 'name')
          .populate('rejectedBy', 'name')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        LeaveRequest.countDocuments(query)
      ]);

      // Calculate leave balance
      const currentYear = new Date().getFullYear();
      const approvedLeaves = await LeaveRequest.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            orgId,
            status: 'approved',
            startDate: {
              $gte: new Date(currentYear, 0, 1),
              $lte: new Date(currentYear, 11, 31)
            }
          }
        },
        {
          $group: {
            _id: '$type',
            totalDays: {
              $sum: {
                $add: [
                  {
                    $divide: [
                      { $subtract: ['$endDate', '$startDate'] },
                      1000 * 60 * 60 * 24
                    ]
                  },
                  1
                ]
              }
            }
          }
        }
      ]);

      const leaveBalance = {
        annual: 20,
        sick: 10,
        casual: 5,
        used: {}
      };

      approvedLeaves.forEach(leave => {
        const type = leave._id.toLowerCase().replace(' ', '');
        leaveBalance.used[type] = Math.round(leave.totalDays);
      });

      res.json({
        success: true,
        data: {
          leaves: leaves.map(leave => ({
            id: leave._id,
            type: leave.type,
            startDate: leave.startDate,
            endDate: leave.endDate,
            reason: leave.reason,
            status: leave.status,
            approvedBy: leave.approvedBy?.name,
            approvedDate: leave.approvedDate,
            rejectedBy: leave.rejectedBy?.name,
            rejectedDate: leave.rejectedDate,
            rejectionReason: leave.rejectionReason,
            createdAt: leave.createdAt
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          leaveBalance
        }
      });

    } catch (error) {
      logger.error('Get leaves error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load leave requests'
      });
    }
  })
);

/**
 * POST /api/employee-dashboard/leaves
 * Apply for leave with real-time workflow
 */
router.post('/leaves',
  authenticate,
  sanitizeInput,
  preventNoSQLInjection,
  validateBody(schemas.leaveRequest),
  auditLog('apply_leave', 'leave'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { type, startDate, endDate, reason } = req.body;

    try {
      // Validation
      if (!type || !startDate || !endDate || !reason) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      if (start < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot apply for past dates'
        });
      }

      // Check for overlapping leaves
      const overlapping = await LeaveRequest.findOne({
        userId,
        orgId,
        status: { $in: ['pending', 'approved'] },
        $or: [
          {
            startDate: { $lte: end },
            endDate: { $gte: start }
          }
        ]
      });

      if (overlapping) {
        return res.status(400).json({
          success: false,
          message: 'Leave dates overlap with existing request'
        });
      }

      const employee = await Employee.findOne({ userId, orgId, status: 'active' })
        .populate('userId', 'name');

      if (!employee) {
        return res.status(403).json({
          success: false,
          message: 'Employee profile not found or inactive'
        });
      }

      const leaveRequest = await LeaveRequest.create({
        userId,
        employeeId: employee._id,
        employeeName: employee.userId.name,
        type,
        startDate: start,
        endDate: end,
        reason,
        orgId
      });

      try {
        const u = await User.findById(userId).select('name email').lean();
        const employeeRec = await Employee.findOne({ userId, orgId }).select('_id orgId').lean();
        if (employeeRec) {
          const orgSmtp = await resolveOrganizationSmtp(orgId);
          const empName = u?.name || employee.userId?.name || 'Employee';
          const empEmail = u?.email || '';
          if (empEmail) {
            await EmailNotificationService.sendLeaveRequestSubmitted(
              {
                userId,
                _id: employeeRec._id,
                name: empName,
                email: empEmail,
                orgId: employeeRec.orgId || orgId
              },
              leaveRequest,
              { organizationSmtp: orgSmtp }
            );
          }
          await notifyAdminsOnLeaveSubmitted(orgId, {
            leaveRequest,
            employeeUserId: userId,
            employeeName: empName,
            employeeEmail: empEmail
          });
        }
      } catch (notifyErr) {
        logger.warn('Leave workflow notifications failed', { error: notifyErr.message, leaveId: leaveRequest._id });
      }

      // Emit real-time notification to managers
      if (global.socketManager && global.notificationManager) {
        // Notify managers
        global.socketManager.emitToRole(orgId, 'manager', 'leave:new_request', {
          leaveId: leaveRequest._id,
          employeeName: employee.userId.name,
          type,
          startDate: start,
          endDate: end,
          timestamp: new Date()
        });

        // Send notification to employee
        global.socketManager.emitToUser(userId, 'leave:submitted', {
          leaveId: leaveRequest._id,
          status: 'pending',
          timestamp: new Date()
        });

        // Queue email notification
        global.notificationManager.queueNotification({
          type: 'leave_application',
          userId,
          title: 'Leave Application Submitted',
          message: `Your ${type} leave application from ${start.toDateString()} to ${end.toDateString()} has been submitted for approval.`,
          channels: ['email', 'push']
        });
      }

      res.status(201).json({
        success: true,
        message: 'Leave application submitted successfully',
        data: {
          id: leaveRequest._id,
          type: leaveRequest.type,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          status: leaveRequest.status,
          createdAt: leaveRequest.createdAt
        }
      });

    } catch (error) {
      logger.error('Apply leave error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to submit leave application'
      });
    }
  })
);

/**
 * DELETE /api/employee-dashboard/leaves/:id
 * Cancel leave request (only if pending)
 */
router.delete('/leaves/:id',
  authenticate,
  auditLog('cancel_leave', 'leave'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { id } = req.params;

    try {
      const leaveRequest = await LeaveRequest.findOne({
        _id: id,
        userId,
        orgId
      });

      if (!leaveRequest) {
        return res.status(404).json({
          success: false,
          message: 'Leave request not found'
        });
      }

      if (leaveRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Can only cancel pending leave requests'
        });
      }

      await LeaveRequest.findByIdAndDelete(id);

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'leave:cancelled', {
          leaveId: id,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Leave request cancelled successfully'
      });

    } catch (error) {
      logger.error('Cancel leave error', { userId, leaveId: id, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to cancel leave request'
      });
    }
  })
);
// ============================================================================
// EXPENSE MANAGEMENT
// ============================================================================

/**
 * GET /api/employee-dashboard/expenses
 * Get employee expenses with real-time status updates
 */
router.get('/expenses',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { status, category, startDate, endDate, page = 1, limit = 20 } = req.query;

    try {
      const query = { userId, orgId };
      
      if (status) query.status = status;
      if (category) query.category = category;
      
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const skip = (page - 1) * limit;

      const [expenses, totalCount] = await Promise.all([
        Expense.find(query)
          .populate('approvedBy', 'name')
          .populate('rejectedBy', 'name')
          .sort({ date: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        Expense.countDocuments(query)
      ]);

      // Calculate expense summary
      const summary = await Expense.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), orgId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const expenseSummary = {
        pending: { count: 0, amount: 0 },
        approved: { count: 0, amount: 0 },
        rejected: { count: 0, amount: 0 }
      };

      summary.forEach(item => {
        expenseSummary[item._id] = {
          count: item.count,
          amount: item.totalAmount
        };
      });

      res.json({
        success: true,
        data: {
          expenses: expenses.map(expense => ({
            id: expense._id,
            category: expense.category,
            amount: expense.amount,
            date: expense.date,
            description: expense.description,
            receipt: expense.receipt,
            status: expense.status,
            approvedBy: expense.approvedBy?.name,
            approvedDate: expense.approvedDate,
            rejectedBy: expense.rejectedBy?.name,
            rejectedDate: expense.rejectedDate,
            rejectionReason: expense.rejectionReason,
            createdAt: expense.createdAt
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          summary: expenseSummary
        }
      });

    } catch (error) {
      logger.error('Get expenses error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load expenses'
      });
    }
  })
);

/**
 * POST /api/employee-dashboard/expenses
 * Submit expense with receipt upload
 */
router.post('/expenses',
  authenticate,
  upload.single('receipt'),
  sanitizeInput,
  preventNoSQLInjection,
  validateBody(schemas.expense),
  validateFileUpload({
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
    required: false
  }),
  auditLog('submit_expense', 'expense'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { category, amount, date, description } = req.body;

    try {
      // Validation
      if (!category || !amount || !date) {
        return res.status(400).json({
          success: false,
          message: 'Category, amount, and date are required'
        });
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be a positive number'
        });
      }

      const expenseDate = new Date(date);
      if (expenseDate > new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Expense date cannot be in the future'
        });
      }

      const employee = await Employee.findOne({ userId, orgId, status: 'active' })
        .populate('userId', 'name');

      if (!employee) {
        return res.status(403).json({
          success: false,
          message: 'Employee profile not found or inactive'
        });
      }

      const expenseData = {
        userId,
        employeeId: employee._id,
        employeeName: employee.userId.name,
        category,
        amount: parseFloat(amount),
        date: expenseDate,
        description: description || '',
        orgId
      };

      // Add receipt if uploaded
      if (req.file) {
        expenseData.receipt = `/uploads/receipts/${req.file.filename}`;
      }

      const expense = await Expense.create(expenseData);

      // Emit real-time notification to managers
      if (global.socketManager && global.notificationManager) {
        global.socketManager.emitToRole(orgId, 'manager', 'expense:new_submission', {
          expenseId: expense._id,
          employeeName: employee.userId.name,
          category,
          amount: parseFloat(amount),
          timestamp: new Date()
        });

        global.socketManager.emitToUser(userId, 'expense:submitted', {
          expenseId: expense._id,
          status: 'pending',
          timestamp: new Date()
        });

        // Queue notification
        global.notificationManager.queueNotification({
          type: 'expense_submission',
          userId,
          title: 'Expense Submitted',
          message: `Your ${category} expense of $${amount} has been submitted for approval.`,
          channels: ['email', 'push']
        });
      }

      res.status(201).json({
        success: true,
        message: 'Expense submitted successfully',
        data: {
          id: expense._id,
          category: expense.category,
          amount: expense.amount,
          date: expense.date,
          status: expense.status,
          receipt: expense.receipt,
          createdAt: expense.createdAt
        }
      });

    } catch (error) {
      logger.error('Submit expense error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to submit expense'
      });
    }
  })
);

/**
 * PUT /api/employee-dashboard/expenses/:id
 * Update expense (only if pending)
 */
router.put('/expenses/:id',
  authenticate,
  upload.single('receipt'),
  auditLog('update_expense', 'expense'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { id } = req.params;
    const { category, amount, date, description } = req.body;

    try {
      const expense = await Expense.findOne({
        _id: id,
        userId,
        orgId
      });

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        });
      }

      if (expense.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Can only update pending expenses'
        });
      }

      const updateData = {};
      if (category) updateData.category = category;
      if (amount) updateData.amount = parseFloat(amount);
      if (date) updateData.date = new Date(date);
      if (description !== undefined) updateData.description = description;

      // Update receipt if new file uploaded
      if (req.file) {
        updateData.receipt = `/uploads/receipts/${req.file.filename}`;
      }

      const updatedExpense = await Expense.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'expense:updated', {
          expenseId: id,
          expense: updatedExpense,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Expense updated successfully',
        data: updatedExpense
      });

    } catch (error) {
      logger.error('Update expense error', { userId, expenseId: id, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to update expense'
      });
    }
  })
);

/**
 * DELETE /api/employee-dashboard/expenses/:id
 * Delete expense (only if pending)
 */
router.delete('/expenses/:id',
  authenticate,
  auditLog('delete_expense', 'expense'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { id } = req.params;

    try {
      const expense = await Expense.findOne({
        _id: id,
        userId,
        orgId
      });

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found'
        });
      }

      if (expense.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Can only delete pending expenses'
        });
      }

      await Expense.findByIdAndDelete(id);

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'expense:deleted', {
          expenseId: id,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Expense deleted successfully'
      });

    } catch (error) {
      logger.error('Delete expense error', { userId, expenseId: id, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to delete expense'
      });
    }
  })
);

// ============================================================================
// PAYROLL INFORMATION
// ============================================================================

/**
 * GET /api/employee-dashboard/payroll
 * Get employee payroll information and payslips
 */
router.get('/payroll',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { year, month, page = 1, limit = 12 } = req.query;

    try {
      const employee = await Employee.findOne({ userId, orgId, status: 'active' }).lean();
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee record not found or inactive'
        });
      }

      // Build query for payslips
      const query = { employeeId: employee._id, orgId };
      
      if (year) {
        const startDate = new Date(parseInt(year), month ? parseInt(month) - 1 : 0, 1);
        const endDate = month ? 
          new Date(parseInt(year), parseInt(month), 0) : 
          new Date(parseInt(year) + 1, 0, 0);
        
        query.payPeriodStart = { $gte: startDate };
        query.payPeriodEnd = { $lte: endDate };
      }

      const skip = (page - 1) * limit;

      const [payslips, totalCount] = await Promise.all([
        Payslip.find(query)
          .sort({ payPeriodStart: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        Payslip.countDocuments(query)
      ]);

      // Calculate current salary breakdown
      const salaryBreakdown = {
        baseSalary: employee.baseSalary || 0,
        hra: employee.hra || 0,
        allowances: employee.allowances || 0,
        bonus: employee.bonus || 0,
        incentives: employee.incentives || 0,
        grossSalary: 0,
        providentFund: employee.providentFund || 0,
        tax: employee.tax || 0,
        insurance: employee.insurance || 0,
        otherDeductions: employee.otherDeductions || 0,
        totalDeductions: 0,
        netSalary: 0
      };

      // Calculate totals
      salaryBreakdown.grossSalary = 
        salaryBreakdown.baseSalary + 
        salaryBreakdown.hra + 
        salaryBreakdown.allowances + 
        salaryBreakdown.bonus + 
        salaryBreakdown.incentives;

      salaryBreakdown.totalDeductions = 
        salaryBreakdown.providentFund + 
        salaryBreakdown.tax + 
        salaryBreakdown.insurance + 
        salaryBreakdown.otherDeductions;

      salaryBreakdown.netSalary = 
        salaryBreakdown.grossSalary - salaryBreakdown.totalDeductions;

      // Calculate YTD totals
      const currentYear = new Date().getFullYear();
      const ytdPayslips = await Payslip.find({
        employeeId: employee._id,
        orgId,
        payPeriodStart: {
          $gte: new Date(currentYear, 0, 1),
          $lte: new Date(currentYear, 11, 31)
        }
      }).lean();

      const ytdTotals = ytdPayslips.reduce((totals, payslip) => {
        totals.grossSalary += payslip.grossSalary || 0;
        totals.totalDeductions += payslip.totalDeductions || 0;
        totals.netSalary += payslip.netSalary || 0;
        return totals;
      }, { grossSalary: 0, totalDeductions: 0, netSalary: 0 });

      res.json({
        success: true,
        data: {
          employee: {
            id: employee._id,
            name: employee.userId?.name,
            employeeCode: employee.employeeCode,
            designation: employee.designation,
            department: employee.department
          },
          salaryBreakdown,
          ytdTotals,
          payslips: payslips.map(payslip => ({
            id: payslip._id,
            payPeriodStart: payslip.payPeriodStart,
            payPeriodEnd: payslip.payPeriodEnd,
            grossSalary: payslip.grossSalary,
            totalDeductions: payslip.totalDeductions,
            netSalary: payslip.netSalary,
            status: payslip.status,
            paidDate: payslip.paidDate,
            createdAt: payslip.createdAt
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get payroll error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load payroll information'
      });
    }
  })
);

/**
 * GET /api/employee-dashboard/payroll/payslip/:id
 * Get detailed payslip information
 */
router.get('/payroll/payslip/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { id } = req.params;

    try {
      const employee = await Employee.findOne({ userId, orgId, status: 'active' }).lean();
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee record not found or inactive'
        });
      }

      const payslip = await Payslip.findOne({
        _id: id,
        employeeId: employee._id,
        orgId
      }).lean();

      if (!payslip) {
        return res.status(404).json({
          success: false,
          message: 'Payslip not found'
        });
      }

      res.json({
        success: true,
        data: payslip
      });

    } catch (error) {
      logger.error('Get payslip error', { userId, payslipId: id, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load payslip'
      });
    }
  })
);

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================

/**
 * GET /api/employee-dashboard/documents
 * Get employee documents
 */
router.get('/documents',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { type, page = 1, limit = 20 } = req.query;

    try {
      const query = { userId, orgId };
      if (type) query.type = type;

      const skip = (page - 1) * limit;

      const [documents, totalCount] = await Promise.all([
        Document.find(query)
          .sort({ uploadedAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        Document.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          documents: documents.map(doc => ({
            id: doc._id,
            name: doc.name,
            type: doc.type,
            fileName: doc.fileName,
            filePath: doc.filePath,
            size: doc.size,
            status: doc.status,
            uploadedAt: doc.uploadedAt
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get documents error', { userId, error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load documents'
      });
    }
  })
);

/**
 * POST /api/employee-dashboard/documents
 * Upload employee document
 */
router.post('/documents',
  authenticate,
  (req, res, next) => {
    upload.single('document')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        logger.error('Multer upload error', { 
          userId: req.user?.userId,
          error: err.message,
          stack: err.stack
        });
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  },
  fileValidator,
  auditLog('upload_document', 'document'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const { name, type } = req.body;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No document file provided'
        });
      }

      if (!name || !type) {
        return res.status(400).json({
          success: false,
          message: 'Document name and type are required'
        });
      }

      const document = await Document.create({
        userId,
        orgId,
        name,
        type,
        fileName: req.file.originalname,
        filePath: `/uploads/documents/${req.file.filename}`,
        size: `${(req.file.size / 1024).toFixed(1)} KB`,
        status: 'uploaded'
      });

      // Emit real-time update
      if (global.socketManager) {
        global.socketManager.emitToUser(userId, 'document:uploaded', {
          documentId: document._id,
          name: document.name,
          type: document.type,
          timestamp: new Date()
        });
      }

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          id: document._id,
          name: document.name,
          type: document.type,
          fileName: document.fileName,
          filePath: document.filePath,
          size: document.size,
          status: document.status,
          uploadedAt: document.uploadedAt
        }
      });

    } catch (error) {
      logger.error('Upload document error', { 
        userId, 
        error: error.message,
        stack: error.stack,
        file: req.file ? { name: req.file.originalname, size: req.file.size } : null
      });
      res.status(500).json({
        success: false,
        message: 'Failed to upload document'
      });
    }
  })
);

export default router;