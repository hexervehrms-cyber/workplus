/**
 * Push Notification System
 * 
 * Comprehensive push notification service supporting:
 * - Firebase Cloud Messaging (FCM) for Android
 * - Apple Push Notification Service (APNS) for iOS
 * - Web Push Notifications for PWA
 * - Multi-device token management
 * - Notification scheduling and batching
 * - Delivery tracking and analytics
 * - Rich notifications with actions
 * 
 * Features:
 * - Cross-platform notification delivery
 * - Device token management
 * - Notification templates and personalization
 * - Delivery status tracking
 * - A/B testing capabilities
 * - Notification analytics
 */

import logger from './logger.js';
import admin from 'firebase-admin';
import apn from 'apn';
import webpush from 'web-push';
import EventEmitter from 'events';

class PushNotificationSystem extends EventEmitter {
  constructor() {
    super();
    
    this.deviceTokens = new Map(); // userId -> device tokens
    this.notificationQueue = new Map(); // Scheduled notifications
    this.deliveryStatus = new Map(); // Notification delivery tracking
    this.templates = new Map(); // Notification templates
    this.analytics = new Map(); // Notification analytics
    
    // Provider configurations
    this.providers = {
      fcm: null,
      apns: null,
      webpush: null
    };
    
    // Statistics
    this.stats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      clicked: 0,
      dismissed: 0
    };
    
    this.initialize();
  }

  async initialize() {
    logger.info('🔔 Initializing Push Notification System');
    
    await this.setupProviders();
    this.setupTemplates();
    this.startNotificationProcessor();
    this.startAnalyticsProcessor();
    
    logger.info('✅ Push Notification System initialized');
  }

  /**
   * Setup notification providers
   */
  async setupProviders() {
    try {
      // Initialize Firebase Admin SDK for FCM
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
          });
        }
        
        this.providers.fcm = admin.messaging();
        logger.info('✅ FCM provider initialized');
      }

      // Initialize APNS for iOS
      if (process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_PATH) {
        this.providers.apns = new apn.Provider({
          token: {
            key: process.env.APNS_KEY_PATH,
            keyId: process.env.APNS_KEY_ID,
            teamId: process.env.APNS_TEAM_ID
          },
          production: process.env.NODE_ENV === 'production'
        });
        logger.info('✅ APNS provider initialized');
      }

      // Initialize Web Push
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || 'mailto:admin@workpluspro.com',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
        this.providers.webpush = webpush;
        logger.info('✅ Web Push provider initialized');
      }

    } catch (error) {
      logger.error('❌ Push notification provider setup failed', {
        error: error.message
      });
    }
  }

  /**
   * Setup notification templates
   */
  setupTemplates() {
    // Welcome notification
    this.templates.set('welcome', {
      title: 'Welcome to {{companyName}}!',
      body: 'Hi {{employeeName}}, welcome to the team! Complete your onboarding to get started.',
      icon: '/icons/welcome.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'onboarding',
          title: 'Complete Onboarding',
          icon: '/icons/onboarding.png'
        },
        {
          action: 'dismiss',
          title: 'Later',
          icon: '/icons/dismiss.png'
        }
      ],
      data: {
        type: 'welcome',
        url: '/onboarding'
      }
    });

    // Attendance reminder
    this.templates.set('attendance_reminder', {
      title: 'Attendance Reminder',
      body: 'Don\'t forget to mark your attendance for today!',
      icon: '/icons/attendance.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'checkin',
          title: 'Check In',
          icon: '/icons/checkin.png'
        },
        {
          action: 'view',
          title: 'View Attendance',
          icon: '/icons/view.png'
        }
      ],
      data: {
        type: 'attendance_reminder',
        url: '/attendance'
      }
    });

    // Leave approval
    this.templates.set('leave_approved', {
      title: 'Leave Request Approved',
      body: 'Your leave request from {{fromDate}} to {{toDate}} has been approved.',
      icon: '/icons/leave.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icons/view.png'
        }
      ],
      data: {
        type: 'leave_approved',
        url: '/leaves'
      }
    });

    // Leave rejection
    this.templates.set('leave_rejected', {
      title: 'Leave Request Rejected',
      body: 'Your leave request from {{fromDate}} to {{toDate}} has been rejected.',
      icon: '/icons/leave.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icons/view.png'
        },
        {
          action: 'reapply',
          title: 'Apply Again',
          icon: '/icons/reapply.png'
        }
      ],
      data: {
        type: 'leave_rejected',
        url: '/leaves'
      }
    });

    // Payslip available
    this.templates.set('payslip_available', {
      title: 'Payslip Available',
      body: 'Your payslip for {{month}} {{year}} is now available for download.',
      icon: '/icons/payslip.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'download',
          title: 'Download',
          icon: '/icons/download.png'
        },
        {
          action: 'view',
          title: 'View Online',
          icon: '/icons/view.png'
        }
      ],
      data: {
        type: 'payslip_available',
        url: '/payroll'
      }
    });

    // Task assigned
    this.templates.set('task_assigned', {
      title: 'New Task Assigned',
      body: 'You have been assigned a new task: {{taskTitle}}',
      icon: '/icons/task.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'view',
          title: 'View Task',
          icon: '/icons/view.png'
        },
        {
          action: 'accept',
          title: 'Accept',
          icon: '/icons/accept.png'
        }
      ],
      data: {
        type: 'task_assigned',
        url: '/tasks',
        taskId: '{{taskId}}'
      }
    });

    // Announcement
    this.templates.set('announcement', {
      title: 'New Announcement',
      body: '{{title}}',
      icon: '/icons/announcement.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'view',
          title: 'Read More',
          icon: '/icons/view.png'
        }
      ],
      data: {
        type: 'announcement',
        url: '/announcements',
        announcementId: '{{announcementId}}'
      }
    });

    // Expense approved
    this.templates.set('expense_approved', {
      title: 'Expense Approved',
      body: 'Your expense of ₹{{amount}} has been approved and will be processed.',
      icon: '/icons/expense.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icons/view.png'
        }
      ],
      data: {
        type: 'expense_approved',
        url: '/expenses'
      }
    });

    // Birthday wishes
    this.templates.set('birthday_wishes', {
      title: 'Happy Birthday! 🎉',
      body: 'Wishing you a wonderful birthday, {{employeeName}}! Have a great day!',
      icon: '/icons/birthday.png',
      badge: '/icons/badge.png',
      actions: [
        {
          action: 'thanks',
          title: 'Thank You',
          icon: '/icons/thanks.png'
        }
      ],
      data: {
        type: 'birthday_wishes',
        url: '/profile'
      }
    });

    logger.info('✅ Notification templates configured', {
      templates: Array.from(this.templates.keys())
    });
  }

  /**
   * Register device token for user
   */
  async registerDeviceToken(userId, token, platform, deviceInfo = {}) {
    try {
      if (!this.deviceTokens.has(userId)) {
        this.deviceTokens.set(userId, []);
      }

      const userTokens = this.deviceTokens.get(userId);
      
      // Check if token already exists
      const existingToken = userTokens.find(t => t.token === token);
      
      if (existingToken) {
        // Update existing token info
        existingToken.lastUsed = new Date().toISOString();
        existingToken.deviceInfo = { ...existingToken.deviceInfo, ...deviceInfo };
      } else {
        // Add new token
        userTokens.push({
          token,
          platform, // 'android', 'ios', 'web'
          deviceInfo,
          registeredAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          active: true
        });
      }

      logger.info('📱 Device token registered', {
        userId,
        platform,
        tokenCount: userTokens.length
      });

      return true;
    } catch (error) {
      logger.error('❌ Device token registration failed', {
        userId,
        platform,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(userId, token) {
    try {
      const userTokens = this.deviceTokens.get(userId);
      if (!userTokens) {
        return false;
      }

      const tokenIndex = userTokens.findIndex(t => t.token === token);
      if (tokenIndex !== -1) {
        userTokens.splice(tokenIndex, 1);
        
        logger.info('📱 Device token unregistered', {
          userId,
          remainingTokens: userTokens.length
        });
        
        return true;
      }

      return false;
    } catch (error) {
      logger.error('❌ Device token unregistration failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send notification using template
   */
  async sendNotification(userId, templateId, data = {}, options = {}) {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Render template with data
      const notification = this.renderTemplate(template, data);
      
      // Get user's device tokens
      const userTokens = this.deviceTokens.get(userId) || [];
      const activeTokens = userTokens.filter(t => t.active);

      if (activeTokens.length === 0) {
        logger.warn('📱 No active device tokens for user', { userId, templateId });
        return { sent: 0, failed: 0, results: [] };
      }

      // Send to all user devices
      const results = await Promise.allSettled(
        activeTokens.map(tokenInfo => 
          this.sendToDevice(tokenInfo, notification, options)
        )
      );

      // Process results
      const summary = {
        sent: 0,
        failed: 0,
        results: []
      };

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const tokenInfo = activeTokens[i];

        if (result.status === 'fulfilled') {
          summary.sent++;
          summary.results.push({
            token: this.maskToken(tokenInfo.token),
            platform: tokenInfo.platform,
            success: true,
            messageId: result.value.messageId
          });
        } else {
          summary.failed++;
          summary.results.push({
            token: this.maskToken(tokenInfo.token),
            platform: tokenInfo.platform,
            success: false,
            error: result.reason.message
          });

          // Mark token as inactive if it's invalid
          if (this.isInvalidTokenError(result.reason)) {
            tokenInfo.active = false;
            logger.warn('📱 Marked token as inactive', {
              userId,
              platform: tokenInfo.platform,
              error: result.reason.message
            });
          }
        }
      }

      // Update statistics
      this.stats.sent += summary.sent;
      this.stats.failed += summary.failed;

      // Track notification
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.deliveryStatus.set(notificationId, {
        id: notificationId,
        userId,
        templateId,
        sentAt: new Date().toISOString(),
        ...summary
      });

      logger.info('🔔 Notification sent', {
        userId,
        templateId,
        notificationId,
        ...summary
      });

      // Emit event
      this.emit('notification_sent', {
        userId,
        templateId,
        notificationId,
        summary
      });

      return {
        notificationId,
        ...summary
      };
    } catch (error) {
      logger.error('❌ Notification send failed', {
        userId,
        templateId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send notification to specific device
   */
  async sendToDevice(tokenInfo, notification, options = {}) {
    const { token, platform } = tokenInfo;

    try {
      switch (platform) {
        case 'android':
          return await this.sendFCM(token, notification, options);
        case 'ios':
          return await this.sendAPNS(token, notification, options);
        case 'web':
          return await this.sendWebPush(token, notification, options);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      logger.error('❌ Device notification failed', {
        platform,
        token: this.maskToken(token),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send FCM notification (Android)
   */
  async sendFCM(token, notification, options = {}) {
    if (!this.providers.fcm) {
      throw new Error('FCM provider not initialized');
    }

    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.image
      },
      data: {
        ...notification.data,
        click_action: notification.data.url || '/'
      },
      android: {
        notification: {
          icon: notification.icon,
          color: '#007bff',
          sound: 'default',
          channelId: 'workplus_notifications',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          defaultLightSettings: true
        },
        priority: 'high'
      },
      webpush: {
        notification: {
          icon: notification.icon,
          badge: notification.badge,
          actions: notification.actions
        }
      }
    };

    if (options.timeToLive) {
      message.android.ttl = options.timeToLive * 1000;
    }

    const response = await this.providers.fcm.send(message);
    
    return {
      messageId: response,
      platform: 'android'
    };
  }

  /**
   * Send APNS notification (iOS)
   */
  async sendAPNS(token, notification, options = {}) {
    if (!this.providers.apns) {
      throw new Error('APNS provider not initialized');
    }

    const apnNotification = new apn.Notification({
      alert: {
        title: notification.title,
        body: notification.body
      },
      badge: 1,
      sound: 'default',
      category: notification.data.type || 'default',
      payload: notification.data,
      topic: process.env.APNS_BUNDLE_ID || 'com.workpluspro.app'
    });

    if (options.timeToLive) {
      apnNotification.expiry = Math.floor(Date.now() / 1000) + options.timeToLive;
    }

    const result = await this.providers.apns.send(apnNotification, token);
    
    if (result.failed && result.failed.length > 0) {
      throw new Error(result.failed[0].error || 'APNS send failed');
    }

    return {
      messageId: result.sent[0]?.messageId || 'apns_' + Date.now(),
      platform: 'ios'
    };
  }

  /**
   * Send Web Push notification
   */
  async sendWebPush(subscription, notification, options = {}) {
    if (!this.providers.webpush) {
      throw new Error('Web Push provider not initialized');
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      image: notification.image,
      actions: notification.actions,
      data: notification.data,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false
    });

    const webPushOptions = {
      TTL: options.timeToLive || 86400, // 24 hours default
      urgency: options.urgency || 'normal'
    };

    const result = await this.providers.webpush.sendNotification(
      JSON.parse(subscription),
      payload,
      webPushOptions
    );

    return {
      messageId: 'webpush_' + Date.now(),
      platform: 'web',
      statusCode: result.statusCode
    };
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(recipients, templateId, data = {}, options = {}) {
    try {
      logger.info('📤 Starting bulk notification send', {
        templateId,
        recipientCount: recipients.length
      });

      const results = await Promise.allSettled(
        recipients.map(async (recipient) => {
          const userId = typeof recipient === 'object' ? recipient.userId : recipient;
          const recipientData = typeof recipient === 'object' ? { ...data, ...recipient.data } : data;
          
          return await this.sendNotification(userId, templateId, recipientData, options);
        })
      );

      const summary = {
        total: recipients.length,
        successful: 0,
        failed: 0,
        totalSent: 0,
        totalFailed: 0,
        results: []
      };

      for (const result of results) {
        if (result.status === 'fulfilled') {
          summary.successful++;
          summary.totalSent += result.value.sent;
          summary.totalFailed += result.value.failed;
          summary.results.push(result.value);
        } else {
          summary.failed++;
          summary.results.push({
            success: false,
            error: result.reason.message
          });
        }
      }

      logger.info('✅ Bulk notification send completed', {
        templateId,
        ...summary
      });

      return summary;
    } catch (error) {
      logger.error('❌ Bulk notification send failed', {
        templateId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(userId, templateId, data, scheduledTime, options = {}) {
    try {
      const notificationId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const scheduledNotification = {
        id: notificationId,
        userId,
        templateId,
        data,
        scheduledTime: new Date(scheduledTime).toISOString(),
        options,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };

      this.notificationQueue.set(notificationId, scheduledNotification);

      logger.info('⏰ Notification scheduled', {
        notificationId,
        userId,
        templateId,
        scheduledTime: scheduledNotification.scheduledTime
      });

      return notificationId;
    } catch (error) {
      logger.error('❌ Notification scheduling failed', {
        userId,
        templateId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel scheduled notification
   */
  cancelScheduledNotification(notificationId) {
    const notification = this.notificationQueue.get(notificationId);
    if (notification && notification.status === 'scheduled') {
      notification.status = 'cancelled';
      logger.info('❌ Scheduled notification cancelled', { notificationId });
      return true;
    }
    return false;
  }

  /**
   * Render notification template
   */
  renderTemplate(template, data) {
    const rendered = { ...template };

    // Simple template rendering
    const render = (text) => {
      if (!text) return text;
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] || match;
      });
    };

    rendered.title = render(template.title);
    rendered.body = render(template.body);
    
    if (template.data) {
      rendered.data = {};
      for (const [key, value] of Object.entries(template.data)) {
        rendered.data[key] = render(value);
      }
    }

    return rendered;
  }

  /**
   * Check if error indicates invalid token
   */
  isInvalidTokenError(error) {
    const invalidTokenErrors = [
      'registration-token-not-registered',
      'invalid-registration-token',
      'BadDeviceToken',
      'Unregistered',
      'InvalidRegistration'
    ];

    return invalidTokenErrors.some(errorType => 
      error.message.includes(errorType) || error.code === errorType
    );
  }

  /**
   * Mask token for logging
   */
  maskToken(token) {
    if (!token || token.length < 10) return token;
    return token.substring(0, 8) + '...' + token.substring(token.length - 4);
  }

  /**
   * Start notification processor for scheduled notifications
   */
  startNotificationProcessor() {
    setInterval(async () => {
      const now = new Date();
      
      for (const [id, notification] of this.notificationQueue.entries()) {
        if (notification.status === 'scheduled' && 
            new Date(notification.scheduledTime) <= now) {
          
          try {
            notification.status = 'sending';
            
            await this.sendNotification(
              notification.userId,
              notification.templateId,
              notification.data,
              notification.options
            );
            
            notification.status = 'sent';
            notification.sentAt = new Date().toISOString();
            
            logger.info('⏰ Scheduled notification sent', {
              notificationId: id,
              userId: notification.userId,
              templateId: notification.templateId
            });
          } catch (error) {
            notification.status = 'failed';
            notification.error = error.message;
            
            logger.error('❌ Scheduled notification failed', {
              notificationId: id,
              error: error.message
            });
          }
        }
      }

      // Clean up old notifications (older than 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      for (const [id, notification] of this.notificationQueue.entries()) {
        if (new Date(notification.createdAt) < sevenDaysAgo) {
          this.notificationQueue.delete(id);
        }
      }
    }, 60000); // Check every minute

    logger.info('⏰ Notification processor started');
  }

  /**
   * Start analytics processor
   */
  startAnalyticsProcessor() {
    setInterval(() => {
      // Process notification analytics
      // This could include click tracking, delivery rates, etc.
      
      // Clean up old delivery status records (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      for (const [id, status] of this.deliveryStatus.entries()) {
        if (new Date(status.sentAt) < thirtyDaysAgo) {
          this.deliveryStatus.delete(id);
        }
      }
    }, 24 * 60 * 60 * 1000); // Run daily

    logger.info('📊 Analytics processor started');
  }

  /**
   * Get notification statistics
   */
  getStats() {
    const totalDevices = Array.from(this.deviceTokens.values())
      .reduce((total, tokens) => total + tokens.length, 0);
    
    const activeDevices = Array.from(this.deviceTokens.values())
      .reduce((total, tokens) => total + tokens.filter(t => t.active).length, 0);

    return {
      ...this.stats,
      totalUsers: this.deviceTokens.size,
      totalDevices,
      activeDevices,
      scheduledNotifications: Array.from(this.notificationQueue.values())
        .filter(n => n.status === 'scheduled').length,
      templates: this.templates.size,
      deliveryRecords: this.deliveryStatus.size
    };
  }

  /**
   * Get user's device tokens
   */
  getUserDevices(userId) {
    return this.deviceTokens.get(userId) || [];
  }

  /**
   * Get notification delivery status
   */
  getDeliveryStatus(notificationId) {
    return this.deliveryStatus.get(notificationId) || null;
  }
}

export default PushNotificationSystem;