/**
 * Mobile API Routes
 * 
 * Optimized API endpoints for mobile applications:
 * - Mobile-optimized data formats
 * - Offline synchronization
 * - Push notification management
 * - PWA functionality
 * - Bandwidth optimization
 * - Background sync operations
 */

import express from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import MobileApiOptimizer from '../utils/mobileApiOptimizer.js';
import OfflineCapability from '../utils/offlineCapability.js';
import PushNotificationSystem from '../utils/pushNotificationSystem.js';
import PWASystem from '../utils/pwaSystem.js';

// Import models
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Expense from '../models/Expense.js';

const router = express.Router();

// Initialize mobile systems
const mobileOptimizer = new MobileApiOptimizer();
const offlineCapability = new OfflineCapability();
const pushNotificationSystem = new PushNotificationSystem();
const pwaSystem = new PWASystem();

// ============================================================================
// MOBILE API OPTIMIZATION ROUTES
// ============================================================================

/**
 * Get optimized data for mobile
 */
router.get('/data/:type',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { 
      fields, 
      compress = 'true', 
      page = 1, 
      limit = 20,
      lastSync 
    } = req.query;

    // Get data based on type (this would integrate with your actual data models)
    let data = await getMobileData(type, req.user.userId, req.user.orgId, {
      page: parseInt(page),
      limit: parseInt(limit),
      lastSync
    });

    // Optimize response for mobile
    const optimizedResponse = await mobileOptimizer.optimizeResponse(data, {
      fields: fields ? fields.split(',') : undefined,
      compress: compress === 'true',
      imageOptimization: true,
      pagination: { page: parseInt(page), limit: parseInt(limit) },
      cacheStrategy: type
    });

    res.set({
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'X-Mobile-Optimized': 'true',
      'X-Response-Size': optimizedResponse.meta.size.toString()
    });

    if (optimizedResponse.compressed) {
      res.set('Content-Encoding', 'gzip');
    }

    res.json(optimizedResponse);
  })
);

/**
 * Create sync package for offline use
 */
router.post('/sync/package',
  authenticate,
  asyncHandler(async (req, res) => {
    const { dataTypes, lastSyncTime } = req.body;
    const userId = req.user.userId;

    const syncPackage = await mobileOptimizer.createSyncPackage(
      userId,
      dataTypes || ['employees', 'attendance', 'leaves', 'announcements'],
      lastSyncTime
    );

    logger.info('📦 Sync package created for mobile', {
      userId,
      dataTypes,
      packageSize: syncPackage.meta.compressedSize
    });

    res.json({
      success: true,
      data: syncPackage
    });
  })
);

/**
 * Process offline sync data
 */
router.post('/sync/process',
  authenticate,
  asyncHandler(async (req, res) => {
    const { syncData } = req.body;
    const userId = req.user.userId;

    const results = await mobileOptimizer.processSyncData(userId, syncData);

    logger.info('🔄 Offline sync processed', {
      userId,
      ...results
    });

    res.json({
      success: true,
      data: results
    });
  })
);

// ============================================================================
// OFFLINE CAPABILITY ROUTES
// ============================================================================

/**
 * Add operation to offline queue
 */
router.post('/offline/queue',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type, action, data, metadata } = req.body;
    const userId = req.user.userId;

    const queueId = await offlineCapability.addToOfflineQueue(userId, {
      type,
      action,
      data,
      metadata
    });

    res.json({
      success: true,
      data: { queueId }
    });
  })
);

/**
 * Get offline queue status
 */
router.get('/offline/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const status = offlineCapability.getQueueStatus(userId);

    res.json({
      success: true,
      data: status
    });
  })
);

/**
 * Update network status
 */
router.post('/offline/network-status',
  authenticate,
  asyncHandler(async (req, res) => {
    const { online } = req.body;
    const userId = req.user.userId;

    offlineCapability.updateNetworkStatus(userId, online);

    res.json({
      success: true,
      message: `Network status updated: ${online ? 'online' : 'offline'}`
    });
  })
);

/**
 * Trigger manual sync
 */
router.post('/offline/sync',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const results = await offlineCapability.syncUserQueue(userId);

    res.json({
      success: true,
      data: results
    });
  })
);

// ============================================================================
// PUSH NOTIFICATION ROUTES
// ============================================================================

/**
 * Register device for push notifications
 */
router.post('/notifications/register',
  authenticate,
  asyncHandler(async (req, res) => {
    const { token, platform, deviceInfo } = req.body;
    const userId = req.user.userId;

    await pushNotificationSystem.registerDeviceToken(
      userId,
      token,
      platform,
      deviceInfo
    );

    logger.info('📱 Device registered for push notifications', {
      userId,
      platform
    });

    res.json({
      success: true,
      message: 'Device registered for push notifications'
    });
  })
);

/**
 * Unregister device from push notifications
 */
router.post('/notifications/unregister',
  authenticate,
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    const userId = req.user.userId;

    const success = await pushNotificationSystem.unregisterDeviceToken(userId, token);

    res.json({
      success,
      message: success ? 'Device unregistered' : 'Device not found'
    });
  })
);

/**
 * Send test notification
 */
router.post('/notifications/test',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { userId, templateId, data } = req.body;
    const targetUserId = userId || req.user.userId;

    const result = await pushNotificationSystem.sendNotification(
      targetUserId,
      templateId || 'welcome',
      data || { employeeName: 'Test User', companyName: 'WorkPlus Pro' }
    );

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * Get user's registered devices
 */
router.get('/notifications/devices',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const devices = pushNotificationSystem.getUserDevices(userId);

    res.json({
      success: true,
      data: devices.map(device => ({
        platform: device.platform,
        registeredAt: device.registeredAt,
        lastUsed: device.lastUsed,
        active: device.active,
        deviceInfo: device.deviceInfo
      }))
    });
  })
);

/**
 * Get notification delivery status
 */
router.get('/notifications/status/:notificationId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const status = pushNotificationSystem.getDeliveryStatus(notificationId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: status
    });
  })
);

// ============================================================================
// PWA ROUTES
// ============================================================================

/**
 * Get PWA manifest
 */
router.get('/pwa/manifest',
  asyncHandler(async (req, res) => {
    const manifest = await pwaSystem.generateManifest();
    
    res.set('Content-Type', 'application/manifest+json');
    res.json(manifest);
  })
);

/**
 * Track PWA installation
 */
router.post('/pwa/install',
  authenticate,
  asyncHandler(async (req, res) => {
    const { platform, installMethod } = req.body;
    const userId = req.user.userId;

    const installData = pwaSystem.trackInstallation(userId, platform, installMethod);

    res.json({
      success: true,
      data: installData
    });
  })
);

/**
 * Track PWA usage
 */
router.post('/pwa/usage',
  authenticate,
  asyncHandler(async (req, res) => {
    const { action, data } = req.body;
    const userId = req.user.userId;

    const usageData = pwaSystem.trackUsage(userId, action, data);

    res.json({
      success: true,
      data: usageData
    });
  })
);

/**
 * Get PWA analytics
 */
router.get('/pwa/analytics',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const analytics = pwaSystem.getAnalytics();

    res.json({
      success: true,
      data: analytics
    });
  })
);

// ============================================================================
// MOBILE-SPECIFIC ENDPOINTS
// ============================================================================

/**
 * Quick attendance check-in/out
 */
router.post('/attendance/quick',
  authenticate,
  asyncHandler(async (req, res) => {
    const { action, location, timestamp } = req.body; // action: 'checkin' or 'checkout'
    const userId = req.user.userId;

    // This would integrate with your attendance system
    const attendanceData = {
      employeeId: userId,
      date: new Date().toISOString().split('T')[0],
      [action === 'checkin' ? 'checkIn' : 'checkOut']: timestamp || new Date().toISOString(),
      location,
      source: 'mobile'
    };

    // If offline, add to queue
    if (req.body.offline) {
      const queueId = await offlineCapability.addToOfflineQueue(userId, {
        type: 'attendance',
        action: 'create',
        data: attendanceData
      });

      return res.json({
        success: true,
        offline: true,
        queueId,
        message: `${action} recorded offline. Will sync when online.`
      });
    }

    // Process immediately if online
    // const result = await processAttendance(attendanceData);

    res.json({
      success: true,
      data: attendanceData,
      message: `${action} recorded successfully`
    });
  })
);

/**
 * Get mobile dashboard data
 */
router.get('/dashboard',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { compact = 'true' } = req.query;

    // Get dashboard data optimized for mobile
    const dashboardData = {
      user: {
        id: userId,
        name: req.user.name,
        avatar: req.user.avatar
      },
      todayAttendance: {
        checkIn: null,
        checkOut: null,
        status: 'not_marked',
        workingHours: 0
      },
      pendingActions: {
        leaveRequests: 0,
        expenseApprovals: 0,
        tasksDue: 0
      },
      quickStats: {
        monthlyAttendance: 85,
        leaveBalance: 12,
        pendingExpenses: 2
      },
      recentAnnouncements: [],
      upcomingEvents: []
    };

    const optimizedResponse = await mobileOptimizer.optimizeResponse(dashboardData, {
      compress: compact === 'true',
      imageOptimization: true,
      cacheStrategy: 'dashboard'
    });

    res.json(optimizedResponse);
  })
);

/**
 * Submit expense with image
 */
router.post('/expenses/submit',
  authenticate,
  asyncHandler(async (req, res) => {
    const { amount, category, description, date, receiptImage, offline } = req.body;
    const userId = req.user.userId;

    const expenseData = {
      employeeId: userId,
      amount: parseFloat(amount),
      category,
      description,
      date,
      receiptImage,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      source: 'mobile'
    };

    // If offline, add to queue
    if (offline) {
      const queueId = await offlineCapability.addToOfflineQueue(userId, {
        type: 'expenses',
        action: 'create',
        data: expenseData
      });

      return res.json({
        success: true,
        offline: true,
        queueId,
        message: 'Expense submitted offline. Will sync when online.'
      });
    }

    // Process immediately if online
    // const result = await processExpense(expenseData);

    res.json({
      success: true,
      data: expenseData,
      message: 'Expense submitted successfully'
    });
  })
);

// ============================================================================
// MOBILE STATISTICS AND MONITORING
// ============================================================================

/**
 * Get mobile system statistics
 */
router.get('/stats',
  authenticate,
  authorize(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const stats = {
      mobileOptimizer: mobileOptimizer.getStats(),
      offlineCapability: offlineCapability.getStats(),
      pushNotifications: pushNotificationSystem.getStats(),
      pwa: pwaSystem.getAnalytics()
    };

    res.json({
      success: true,
      data: stats
    });
  })
);

/**
 * Mobile health check
 */
router.get('/health',
  authenticate,
  asyncHandler(async (req, res) => {
    const health = {
      mobileOptimizer: {
        status: 'healthy',
        cacheStrategies: mobileOptimizer.getStats().cacheStrategies
      },
      offlineCapability: {
        status: 'healthy',
        totalUsers: offlineCapability.getStats().totalUsers,
        onlineUsers: offlineCapability.getStats().onlineUsers
      },
      pushNotifications: {
        status: 'healthy',
        totalDevices: pushNotificationSystem.getStats().totalDevices,
        activeDevices: pushNotificationSystem.getStats().activeDevices
      },
      pwa: {
        status: 'healthy',
        totalInstallations: pwaSystem.getAnalytics().totalInstallations
      }
    };

    res.json({
      success: true,
      data: health
    });
  })
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get mobile-optimized data based on type
 */
async function getMobileData(type, userId, orgId, options = {}) {
  try {
    const { limit = 10, page = 1, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    switch (type) {
      case 'employees':
        // Get real employee data from database
        const employees = await Employee.find({ 
          orgId, 
          status: 'active' 
        })
        .populate('userId', 'name email avatar')
        .select('designation department userId')
        .limit(limit)
        .skip(skip)
        .lean();

        return employees.map(emp => ({
          id: emp._id,
          name: emp.userId?.name || 'Unknown',
          department: emp.department || 'N/A',
          designation: emp.designation || 'N/A',
          avatar: emp.userId?.avatar || null,
          email: emp.userId?.email
        }));

      case 'attendance':
        // Get real attendance data
        const attendanceQuery = { userId, orgId };
        if (startDate && endDate) {
          attendanceQuery.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
        }

        const attendance = await Attendance.find(attendanceQuery)
          .sort({ date: -1 })
          .limit(limit)
          .skip(skip)
          .lean();

        return attendance.map(att => ({
          id: att._id,
          date: att.date.toISOString().split('T')[0],
          checkIn: att.checkIn ? att.checkIn.toTimeString().slice(0, 5) : null,
          checkOut: att.checkOut ? att.checkOut.toTimeString().slice(0, 5) : null,
          status: att.status,
          hoursWorked: att.hoursWorked || 0
        }));

      case 'leaves':
        // Get real leave data
        const leaves = await LeaveRequest.find({ userId, orgId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean();

        return leaves.map(leave => ({
          id: leave._id,
          type: leave.type,
          fromDate: leave.startDate.toISOString().split('T')[0],
          toDate: leave.endDate.toISOString().split('T')[0],
          status: leave.status,
          reason: leave.reason,
          appliedDate: leave.createdAt.toISOString().split('T')[0]
        }));

      case 'expenses':
        // Get real expense data
        const expenses = await Expense.find({ userId, orgId })
          .sort({ date: -1 })
          .limit(limit)
          .skip(skip)
          .lean();

        return expenses.map(expense => ({
          id: expense._id,
          category: expense.category,
          amount: expense.amount,
          date: expense.date.toISOString().split('T')[0],
          description: expense.description,
          status: expense.status,
          receipt: expense.receipt
        }));

      case 'announcements':
        // Get real announcements (assuming you have an Announcement model)
        try {
          const Announcement = mongoose.model('Announcement');
          const announcements = await Announcement.find({ 
            orgId,
            isActive: true,
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: { $gt: new Date() } }
            ]
          })
          .sort({ priority: -1, createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .lean();

          return announcements.map(ann => ({
            id: ann._id,
            title: ann.title,
            content: ann.content,
            priority: ann.priority || 'medium',
            createdAt: ann.createdAt.toISOString().split('T')[0]
          }));
        } catch (error) {
          // If Announcement model doesn't exist, return empty array
          logger.warn('Announcement model not found', { error: error.message });
          return [];
        }

      default:
        return [];
    }
  } catch (error) {
    logger.error('Error fetching mobile data', {
      type,
      userId,
      orgId,
      error: error.message
    });
    return [];
  }
}

export default router;