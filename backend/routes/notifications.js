import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize, auditLog } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/notifications
 * Get user notifications with pagination and filtering
 */
router.get("/",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      status = 'all', // 'all', 'unread', 'read'
      type,
      category,
      priority
    } = req.query;

    try {
      // Schema uses recipientId + isRead (not userId)
      const filter = { recipientId: userId };

      if (status === 'unread') {
        filter.isRead = false;
      } else if (status === 'read') {
        filter.isRead = true;
      }

      if (type) {
        filter.type = type;
      }

      if (category) {
        filter.category = category;
      }

      if (priority) {
        filter.priority = priority;
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get notifications and total count
      const [notifications, totalCount, unreadCount] = await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),

        Notification.countDocuments(filter),

        Notification.countDocuments({ recipientId: userId, isRead: false })
      ]);

      res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / parseInt(limit))
          },
          unreadCount
        }
      });

    } catch (error) {
      logger.error('Get notifications error', {
        error: error.message,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to retrieve notifications"
      });
    }
  })
);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get("/unread-count",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    try {
      const unreadCount = await Notification.countDocuments({
        recipientId: userId,
        isRead: false
      });

      res.json({
        success: true,
        data: { unreadCount }
      });

    } catch (error) {
      logger.error('Get unread count error', {
        error: error.message,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to get unread count"
      });
    }
  })
);

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch("/:id/read",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: id, recipientId: userId },
        {
          isRead: true,
          readAt: new Date()
        },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found"
        });
      }

      // Use global notification manager if available
      if (global.notificationManager) {
        await global.notificationManager.markAsRead(id, userId);
      }

      res.json({
        success: true,
        data: notification
      });

    } catch (error) {
      logger.error('Mark notification as read error', {
        error: error.message,
        notificationId: id,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to mark notification as read"
      });
    }
  })
);

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch("/mark-all-read",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    try {
      const result = await Notification.updateMany(
        { recipientId: userId, isRead: false },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      res.json({
        success: true,
        message: `${result.modifiedCount} notifications marked as read`,
        data: { markedCount: result.modifiedCount }
      });

    } catch (error) {
      logger.error('Mark all notifications as read error', {
        error: error.message,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to mark notifications as read"
      });
    }
  })
);

/**
 * DELETE /api/notifications/clear-all
 * Clear all read notifications (must be registered before "/:id")
 */
router.delete("/clear-all",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    try {
      const result = await Notification.deleteMany({
        recipientId: userId,
        isRead: true
      });

      res.json({
        success: true,
        message: `${result.deletedCount} notifications cleared`,
        data: { deletedCount: result.deletedCount }
      });

    } catch (error) {
      logger.error('Clear all notifications error', {
        error: error.message,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to clear notifications"
      });
    }
  })
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete("/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
      const notification = await Notification.findOneAndDelete({
        _id: id,
        recipientId: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found"
        });
      }

      res.json({
        success: true,
        message: "Notification deleted successfully"
      });

    } catch (error) {
      logger.error('Delete notification error', {
        error: error.message,
        notificationId: id,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to delete notification"
      });
    }
  })
);

/**
 * POST /api/notifications/send
 * Send notification (Admin only)
 */
router.post("/send",
  authenticate,
  authorize('admin', 'super_admin'),
  auditLog('send_notification', 'notifications'),
  asyncHandler(async (req, res) => {
    const {
      type,
      title,
      message,
      recipients,
      priority = 'normal',
      channels = ['in_app'],
      data = {},
      expiresAt,
      actionUrl,
      category = 'general'
    } = req.body;

    const createdBy = req.user.userId;
    const orgId = req.user.orgId;

    try {
      // Validate required fields
      if (!type || !title || !message || !recipients) {
        return res.status(400).json({
          success: false,
          message: "Type, title, message, and recipients are required"
        });
      }

      // Use global notification manager
      if (!global.notificationManager) {
        return res.status(503).json({
          success: false,
          message: "Notification system not available"
        });
      }

      const result = await global.notificationManager.sendNotification({
        type,
        title,
        message,
        recipients,
        priority,
        channels,
        data,
        orgId,
        createdBy,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        actionUrl,
        category
      });

      res.status(201).json({
        success: true,
        message: "Notification sent successfully",
        data: result
      });

    } catch (error) {
      logger.error('Send notification error', {
        error: error.message,
        type,
        recipients,
        createdBy
      });

      res.status(500).json({
        success: false,
        message: "Failed to send notification"
      });
    }
  })
);

/**
 * GET /api/notifications/preferences
 * Get user notification preferences
 */
router.get("/preferences",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    try {
      const User = (await import("../models/User.js")).default;
      const user = await User.findById(userId)
        .select('notificationPreferences')
        .lean();

      const preferences = user?.notificationPreferences || {
        email: true,
        sms: false,
        push: true,
        inApp: true,
        categories: {
          general: true,
          leave: true,
          expense: true,
          task: true,
          security: true,
          system: true
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        }
      };

      res.json({
        success: true,
        data: preferences
      });

    } catch (error) {
      logger.error('Get notification preferences error', {
        error: error.message,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to get notification preferences"
      });
    }
  })
);

/**
 * PUT /api/notifications/preferences
 * Update user notification preferences
 */
router.put("/preferences",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const preferences = req.body;

    try {
      const User = (await import("../models/User.js")).default;
      const user = await User.findByIdAndUpdate(
        userId,
        { notificationPreferences: preferences },
        { new: true }
      ).select('notificationPreferences');

      res.json({
        success: true,
        message: "Notification preferences updated successfully",
        data: user.notificationPreferences
      });

    } catch (error) {
      logger.error('Update notification preferences error', {
        error: error.message,
        userId
      });

      res.status(500).json({
        success: false,
        message: "Failed to update notification preferences"
      });
    }
  })
);

/**
 * GET /api/notifications/stats
 * Get notification statistics (Admin only)
 */
router.get("/stats",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';

    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Build base filter
      const baseFilter = { createdAt: { $gte: since } };
      if (!isSystemAdmin) {
        baseFilter.orgId = orgId;
      }

      // Get notification statistics
      const [
        totalNotifications,
        readNotifications,
        unreadNotifications,
        notificationsByType,
        notificationsByPriority
      ] = await Promise.all([
        Notification.countDocuments(baseFilter),
        
        Notification.countDocuments({
          ...baseFilter,
          isRead: true
        }),
        
        Notification.countDocuments({
          ...baseFilter,
          isRead: false
        }),
        
        Notification.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ]),
        
        Notification.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: "$priority",
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      // Get queue stats if notification manager is available
      let queueStats = null;
      if (global.notificationManager) {
        queueStats = global.notificationManager.getQueueStats();
      }

      res.json({
        success: true,
        data: {
          period: `${days} days`,
          summary: {
            total: totalNotifications,
            read: readNotifications,
            unread: unreadNotifications,
            readRate: totalNotifications > 0 ? 
              Math.round((readNotifications / totalNotifications) * 100) : 0
          },
          byType: notificationsByType,
          byPriority: notificationsByPriority,
          queueStats
        }
      });

    } catch (error) {
      logger.error('Get notification stats error', {
        error: error.message,
        orgId
      });

      res.status(500).json({
        success: false,
        message: "Failed to get notification statistics"
      });
    }
  })
);

/**
 * POST /api/notifications/test
 * Send test notification (Admin only)
 */
router.post("/test",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { recipient = req.user.userId } = req.body;
    const createdBy = req.user.userId;
    const orgId = req.user.orgId;

    try {
      if (!global.notificationManager) {
        return res.status(503).json({
          success: false,
          message: "Notification system not available"
        });
      }

      const result = await global.notificationManager.sendNotification({
        type: 'test_notification',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working correctly.',
        recipients: [recipient],
        priority: 'normal',
        channels: ['in_app'],
        data: { isTest: true },
        orgId,
        createdBy,
        category: 'system'
      });

      res.json({
        success: true,
        message: "Test notification sent successfully",
        data: result
      });

    } catch (error) {
      logger.error('Send test notification error', {
        error: error.message,
        recipient,
        createdBy
      });

      res.status(500).json({
        success: false,
        message: "Failed to send test notification"
      });
    }
  })
);

export default router;