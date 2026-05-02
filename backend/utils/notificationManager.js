/**
 * Advanced Notification Manager
 * Handles push notifications, email notifications, SMS, and in-app notifications
 */

import Notification from "../models/Notification.js";
import User from "../models/User.js";
import logger from "./logger.js";

class NotificationManager {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.emailQueue = [];
    this.smsQueue = [];
    this.pushQueue = [];
    
    // Start processing queues
    this.startQueueProcessing();
  }

  /**
   * Send notification to users
   */
  async sendNotification(notification) {
    try {
      const {
        type,
        title,
        message,
        recipients, // Array of user IDs or 'all' or role-based
        priority = 'normal', // 'low', 'normal', 'high', 'urgent'
        channels = ['in_app'], // 'in_app', 'email', 'sms', 'push'
        data = {},
        orgId,
        createdBy,
        expiresAt,
        actionUrl,
        category = 'general'
      } = notification;

      // Resolve recipients
      const userIds = await this.resolveRecipients(recipients, orgId);

      if (userIds.length === 0) {
        logger.warn('No recipients found for notification', { type, orgId });
        return { success: false, message: 'No recipients found' };
      }

      // Create notification records in database
      const notificationRecords = await this.createNotificationRecords({
        type,
        title,
        message,
        userIds,
        priority,
        data,
        orgId,
        createdBy,
        expiresAt,
        actionUrl,
        category
      });

      // Send via different channels
      const results = {
        inApp: 0,
        email: 0,
        sms: 0,
        push: 0,
        failed: 0
      };

      for (const channel of channels) {
        try {
          switch (channel) {
            case 'in_app':
              await this.sendInAppNotifications(userIds, notificationRecords[0]);
              results.inApp = userIds.length;
              break;

            case 'email':
              await this.queueEmailNotifications(userIds, notification);
              results.email = userIds.length;
              break;

            case 'sms':
              await this.queueSMSNotifications(userIds, notification);
              results.sms = userIds.length;
              break;

            case 'push':
              await this.queuePushNotifications(userIds, notification);
              results.push = userIds.length;
              break;
          }
        } catch (error) {
          logger.error(`Failed to send ${channel} notifications`, {
            error: error.message,
            type,
            userCount: userIds.length
          });
          results.failed++;
        }
      }

      logger.info('Notifications sent', {
        type,
        recipients: userIds.length,
        channels,
        results
      });

      return {
        success: true,
        notificationIds: notificationRecords.map(n => n._id),
        recipients: userIds.length,
        results
      };

    } catch (error) {
      logger.error('Notification sending failed', {
        error: error.message,
        notification: notification.type
      });
      throw error;
    }
  }

  /**
   * Resolve recipients based on criteria
   */
  async resolveRecipients(recipients, orgId) {
    try {
      let userIds = [];

      if (Array.isArray(recipients)) {
        // Direct user IDs
        userIds = recipients;
      } else if (typeof recipients === 'string') {
        switch (recipients) {
          case 'all':
            const allUsers = await User.find({ 
              orgId, 
              isActive: true 
            }).select('_id').lean();
            userIds = allUsers.map(u => u._id.toString());
            break;

          case 'admins':
            const admins = await User.find({ 
              orgId, 
              role: { $in: ['admin', 'super_admin'] },
              isActive: true 
            }).select('_id').lean();
            userIds = admins.map(u => u._id.toString());
            break;

          case 'managers':
            const managers = await User.find({ 
              orgId, 
              role: 'manager',
              isActive: true 
            }).select('_id').lean();
            userIds = managers.map(u => u._id.toString());
            break;

          case 'hr':
            const hrUsers = await User.find({ 
              orgId, 
              role: 'hr',
              isActive: true 
            }).select('_id').lean();
            userIds = hrUsers.map(u => u._id.toString());
            break;

          case 'employees':
            const employees = await User.find({ 
              orgId, 
              role: 'employee',
              isActive: true 
            }).select('_id').lean();
            userIds = employees.map(u => u._id.toString());
            break;

          default:
            // Check if it's a department or custom criteria
            if (recipients.startsWith('dept_')) {
              const deptId = recipients.replace('dept_', '');
              const deptUsers = await User.find({ 
                orgId, 
                departmentId: deptId,
                isActive: true 
              }).select('_id').lean();
              userIds = deptUsers.map(u => u._id.toString());
            }
        }
      } else if (recipients.criteria) {
        // Custom criteria-based selection
        const users = await User.find({ 
          orgId, 
          isActive: true,
          ...recipients.criteria 
        }).select('_id').lean();
        userIds = users.map(u => u._id.toString());
      }

      return userIds;

    } catch (error) {
      logger.error('Failed to resolve recipients', {
        error: error.message,
        recipients,
        orgId
      });
      return [];
    }
  }

  /**
   * Create notification records in database
   */
  async createNotificationRecords(notificationData) {
    try {
      const {
        type,
        title,
        message,
        userIds,
        priority,
        data,
        orgId,
        createdBy,
        expiresAt,
        actionUrl,
        category
      } = notificationData;

      const notifications = userIds.map(userId => ({
        type,
        title,
        message,
        userId,
        priority,
        data,
        orgId,
        createdBy,
        expiresAt,
        actionUrl,
        category,
        status: 'sent',
        channels: ['in_app'],
        readAt: null,
        deliveredAt: new Date()
      }));

      const createdNotifications = await Notification.insertMany(notifications);

      logger.info('Notification records created', {
        count: createdNotifications.length,
        type,
        orgId
      });

      return createdNotifications;

    } catch (error) {
      logger.error('Failed to create notification records', {
        error: error.message,
        type: notificationData.type
      });
      throw error;
    }
  }

  /**
   * Send in-app notifications via Socket.IO
   */
  async sendInAppNotifications(userIds, notificationData) {
    try {
      if (!this.socketManager) {
        logger.warn('Socket manager not available for in-app notifications');
        return;
      }

      const inAppNotification = {
        id: notificationData._id,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority,
        data: notificationData.data,
        actionUrl: notificationData.actionUrl,
        category: notificationData.category,
        createdAt: notificationData.createdAt,
        expiresAt: notificationData.expiresAt
      };

      // Send to each user via Socket.IO
      this.socketManager.broadcastNotification(userIds, inAppNotification);

      logger.info('In-app notifications sent', {
        userCount: userIds.length,
        type: notificationData.type
      });

    } catch (error) {
      logger.error('Failed to send in-app notifications', {
        error: error.message,
        userCount: userIds.length
      });
      throw error;
    }
  }

  /**
   * Queue email notifications
   */
  async queueEmailNotifications(userIds, notification) {
    try {
      // Get user email addresses
      const users = await User.find({
        _id: { $in: userIds },
        isActive: true
      }).select('email name notificationPreferences').lean();

      for (const user of users) {
        // Check if user has email notifications enabled
        const emailEnabled = user.notificationPreferences?.email !== false;
        
        if (emailEnabled && user.email) {
          this.emailQueue.push({
            to: user.email,
            name: user.name,
            userId: user._id,
            subject: notification.title,
            message: notification.message,
            type: notification.type,
            data: notification.data,
            priority: notification.priority,
            actionUrl: notification.actionUrl,
            queuedAt: new Date()
          });
        }
      }

      logger.info('Email notifications queued', {
        count: this.emailQueue.length,
        type: notification.type
      });

    } catch (error) {
      logger.error('Failed to queue email notifications', {
        error: error.message,
        type: notification.type
      });
      throw error;
    }
  }

  /**
   * Queue SMS notifications
   */
  async queueSMSNotifications(userIds, notification) {
    try {
      // Get user phone numbers
      const users = await User.find({
        _id: { $in: userIds },
        isActive: true
      }).select('contact.mobile name notificationPreferences').lean();

      for (const user of users) {
        // Check if user has SMS notifications enabled
        const smsEnabled = user.notificationPreferences?.sms === true;
        
        if (smsEnabled && user.contact?.mobile) {
          this.smsQueue.push({
            to: user.contact.mobile,
            name: user.name,
            userId: user._id,
            message: `${notification.title}: ${notification.message}`,
            type: notification.type,
            priority: notification.priority,
            queuedAt: new Date()
          });
        }
      }

      logger.info('SMS notifications queued', {
        count: this.smsQueue.length,
        type: notification.type
      });

    } catch (error) {
      logger.error('Failed to queue SMS notifications', {
        error: error.message,
        type: notification.type
      });
      throw error;
    }
  }

  /**
   * Queue push notifications
   */
  async queuePushNotifications(userIds, notification) {
    try {
      // Get user push tokens (would be stored in user preferences)
      const users = await User.find({
        _id: { $in: userIds },
        isActive: true
      }).select('pushTokens name notificationPreferences').lean();

      for (const user of users) {
        // Check if user has push notifications enabled
        const pushEnabled = user.notificationPreferences?.push !== false;
        
        if (pushEnabled && user.pushTokens?.length > 0) {
          for (const token of user.pushTokens) {
            this.pushQueue.push({
              token: token.token,
              platform: token.platform, // 'ios', 'android', 'web'
              name: user.name,
              userId: user._id,
              title: notification.title,
              message: notification.message,
              type: notification.type,
              data: notification.data,
              priority: notification.priority,
              actionUrl: notification.actionUrl,
              queuedAt: new Date()
            });
          }
        }
      }

      logger.info('Push notifications queued', {
        count: this.pushQueue.length,
        type: notification.type
      });

    } catch (error) {
      logger.error('Failed to queue push notifications', {
        error: error.message,
        type: notification.type
      });
      throw error;
    }
  }

  /**
   * Start processing notification queues
   */
  startQueueProcessing() {
    // Process email queue every 30 seconds
    setInterval(() => {
      this.processEmailQueue();
    }, 30000);

    // Process SMS queue every 60 seconds
    setInterval(() => {
      this.processSMSQueue();
    }, 60000);

    // Process push queue every 15 seconds
    setInterval(() => {
      this.processPushQueue();
    }, 15000);
  }

  /**
   * Process email queue
   */
  async processEmailQueue() {
    if (this.emailQueue.length === 0) return;

    const batch = this.emailQueue.splice(0, 10); // Process 10 at a time
    
    for (const email of batch) {
      try {
        // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
        await this.sendEmail(email);
        
        logger.info('Email sent', {
          to: email.to,
          type: email.type,
          userId: email.userId
        });

      } catch (error) {
        logger.error('Failed to send email', {
          error: error.message,
          to: email.to,
          type: email.type
        });

        // Re-queue if not too old (retry logic)
        const age = Date.now() - email.queuedAt.getTime();
        if (age < 24 * 60 * 60 * 1000) { // Less than 24 hours
          this.emailQueue.push({
            ...email,
            retryCount: (email.retryCount || 0) + 1
          });
        }
      }
    }
  }

  /**
   * Process SMS queue
   */
  async processSMSQueue() {
    if (this.smsQueue.length === 0) return;

    const batch = this.smsQueue.splice(0, 5); // Process 5 at a time
    
    for (const sms of batch) {
      try {
        // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
        await this.sendSMS(sms);
        
        logger.info('SMS sent', {
          to: sms.to,
          type: sms.type,
          userId: sms.userId
        });

      } catch (error) {
        logger.error('Failed to send SMS', {
          error: error.message,
          to: sms.to,
          type: sms.type
        });

        // Re-queue if not too old
        const age = Date.now() - sms.queuedAt.getTime();
        if (age < 6 * 60 * 60 * 1000) { // Less than 6 hours
          this.smsQueue.push({
            ...sms,
            retryCount: (sms.retryCount || 0) + 1
          });
        }
      }
    }
  }

  /**
   * Process push notification queue
   */
  async processPushQueue() {
    if (this.pushQueue.length === 0) return;

    const batch = this.pushQueue.splice(0, 20); // Process 20 at a time
    
    for (const push of batch) {
      try {
        // TODO: Integrate with push service (FCM, APNS, etc.)
        await this.sendPushNotification(push);
        
        logger.info('Push notification sent', {
          platform: push.platform,
          type: push.type,
          userId: push.userId
        });

      } catch (error) {
        logger.error('Failed to send push notification', {
          error: error.message,
          platform: push.platform,
          type: push.type
        });

        // Re-queue if not too old
        const age = Date.now() - push.queuedAt.getTime();
        if (age < 2 * 60 * 60 * 1000) { // Less than 2 hours
          this.pushQueue.push({
            ...push,
            retryCount: (push.retryCount || 0) + 1
          });
        }
      }
    }
  }

  /**
   * Send email using configured email service
   */
  async sendEmail(emailData) {
    try {
      // Check if email service is configured
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        logger.warn('Email service not configured - email not sent', {
          to: emailData.to,
          subject: emailData.subject,
          type: emailData.type
        });
        return false;
      }

      // Import nodemailer dynamically to avoid startup errors if not configured
      const nodemailer = await import('nodemailer');
      
      // Create transporter
      const transporter = nodemailer.default.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates in development
        }
      });

      // Send email
      const info = await transporter.sendMail({
        from: process.env.FROM_EMAIL || process.env.SMTP_USER,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html || emailData.message,
        text: emailData.text || emailData.message
      });

      logger.info('Email sent successfully', {
        to: emailData.to,
        subject: emailData.subject,
        type: emailData.type,
        messageId: info.messageId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        error: error.message,
        to: emailData.to,
        subject: emailData.subject,
        type: emailData.type
      });
      throw error;
    }
  }

  /**
   * Send SMS using configured SMS service
   */
  async sendSMS(smsData) {
    try {
      // Check if SMS service is configured
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        logger.warn('SMS service not configured - SMS not sent', {
          to: smsData.to,
          message: smsData.message,
          type: smsData.type
        });
        return false;
      }

      // Import Twilio dynamically
      const twilio = await import('twilio');
      const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Send SMS
      const message = await client.messages.create({
        body: smsData.message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: smsData.to
      });

      logger.info('SMS sent successfully', {
        to: smsData.to,
        type: smsData.type,
        sid: message.sid
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SMS', {
        error: error.message,
        to: smsData.to,
        type: smsData.type
      });
      throw error;
    }
  }

  /**
   * Send push notification using Firebase Cloud Messaging
   */
  async sendPushNotification(pushData) {
    try {
      // Check if push service is configured
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
        logger.warn('Push notification service not configured - notification not sent', {
          platform: pushData.platform,
          title: pushData.title,
          type: pushData.type
        });
        return false;
      }

      // Import Firebase Admin dynamically
      const admin = await import('firebase-admin');
      
      // Initialize Firebase Admin if not already initialized
      if (!admin.default.apps.length) {
        admin.default.initializeApp({
          credential: admin.default.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL
          })
        });
      }

      // Send push notification
      const message = {
        notification: {
          title: pushData.title,
          body: pushData.message
        },
        data: pushData.data || {},
        token: pushData.deviceToken
      };

      const response = await admin.default.messaging().send(message);

      logger.info('Push notification sent successfully', {
        platform: pushData.platform,
        title: pushData.title,
        type: pushData.type,
        messageId: response
      });

      return true;
    } catch (error) {
      logger.error('Failed to send push notification', {
        error: error.message,
        platform: pushData.platform,
        title: pushData.title,
        type: pushData.type
      });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { 
          readAt: new Date(),
          status: 'read'
        }
      );

      logger.info('Notification marked as read', {
        notificationId,
        userId
      });

    } catch (error) {
      logger.error('Failed to mark notification as read', {
        error: error.message,
        notificationId,
        userId
      });
    }
  }

  /**
   * Get notification statistics
   */
  getQueueStats() {
    return {
      emailQueue: this.emailQueue.length,
      smsQueue: this.smsQueue.length,
      pushQueue: this.pushQueue.length,
      timestamp: new Date()
    };
  }

  /**
   * Clear old notifications
   */
  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await Notification.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        status: 'read'
      });

      logger.info('Old notifications cleaned up', {
        deletedCount: result.deletedCount
      });

    } catch (error) {
      logger.error('Failed to cleanup old notifications', {
        error: error.message
      });
    }
  }
}

export default NotificationManager;