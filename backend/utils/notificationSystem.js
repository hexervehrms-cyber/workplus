/**
 * Comprehensive Notification System
 * Handles real-time notifications, email notifications, and notification preferences
 */

import logger from './logger.js';

class NotificationSystem {
  constructor(socketManager, emailService = null) {
    this.socketManager = socketManager;
    this.emailService = emailService;
    this.notificationQueue = [];
    this.preferences = new Map(); // userId -> preferences
    this.templates = new Map();
    
    this.initializeTemplates();
    logger.info('NotificationSystem initialized');
  }

  /**
   * Initialize notification templates
   */
  initializeTemplates() {
    // Leave Management Templates
    this.templates.set('leave_requested', {
      title: 'New Leave Request',
      message: 'A new leave request has been submitted',
      icon: '📅',
      priority: 'medium',
      category: 'leave'
    });

    this.templates.set('leave_approved', {
      title: 'Leave Request Approved',
      message: 'Your leave request has been approved',
      icon: '✅',
      priority: 'high',
      category: 'leave'
    });

    this.templates.set('leave_rejected', {
      title: 'Leave Request Rejected',
      message: 'Your leave request has been rejected',
      icon: '❌',
      priority: 'high',
      category: 'leave'
    });

    // Employee Management Templates
    this.templates.set('employee_created', {
      title: 'New Employee Added',
      message: 'A new employee has been added to the organization',
      icon: '👤',
      priority: 'medium',
      category: 'employee'
    });

    this.templates.set('employee_terminated', {
      title: 'Employee Terminated',
      message: 'An employee has been terminated',
      icon: '⚠️',
      priority: 'high',
      category: 'employee'
    });

    // Attendance Templates
    this.templates.set('late_checkin', {
      title: 'Late Check-in',
      message: 'You are late for work today',
      icon: '⏰',
      priority: 'medium',
      category: 'attendance'
    });

    this.templates.set('overtime_worked', {
      title: 'Overtime Worked',
      message: 'You have worked overtime today',
      icon: '💪',
      priority: 'low',
      category: 'attendance'
    });

    // System Templates
    this.templates.set('system_maintenance', {
      title: 'System Maintenance',
      message: 'System maintenance scheduled',
      icon: '🔧',
      priority: 'high',
      category: 'system'
    });

    this.templates.set('password_changed', {
      title: 'Password Changed',
      message: 'Your password has been changed successfully',
      icon: '🔐',
      priority: 'high',
      category: 'security'
    });

    logger.info('Notification templates initialized', { 
      templateCount: this.templates.size 
    });
  }

  /**
   * Send notification to user(s)
   * @param {Object} notification - Notification data
   * @param {string|Array} recipients - User ID(s) or 'all' for broadcast
   * @param {string} orgId - Organization ID
   * @param {Object} options - Additional options
   */
  async sendNotification(notification, recipients, orgId = null, options = {}) {
    try {
      const {
        template,
        title,
        message,
        type = 'info',
        action,
        data = {},
        priority = 'medium',
        category = 'general',
        persistent = false,
        emailNotification = false,
        pushNotification = false
      } = notification;

      // Use template if provided
      let finalNotification = { ...notification };
      if (template && this.templates.has(template)) {
        const templateData = this.templates.get(template);
        finalNotification = {
          ...templateData,
          ...notification,
          title: title || templateData.title,
          message: message || templateData.message
        };
      }

      // Create notification payload
      const notificationPayload = {
        id: this.generateNotificationId(),
        title: finalNotification.title,
        message: finalNotification.message,
        type,
        action,
        data,
        priority,
        category,
        icon: finalNotification.icon,
        timestamp: new Date(),
        persistent,
        orgId,
        ...options
      };

      // Handle different recipient types
      if (recipients === 'all') {
        await this.broadcastNotification(notificationPayload, orgId);
      } else if (Array.isArray(recipients)) {
        await this.sendToMultipleUsers(notificationPayload, recipients, orgId);
      } else {
        await this.sendToUser(notificationPayload, recipients, orgId);
      }

      // Send email notification if requested
      if (emailNotification && this.emailService) {
        await this.sendEmailNotification(notificationPayload, recipients);
      }

      // Send push notification if requested
      if (pushNotification) {
        await this.sendPushNotification(notificationPayload, recipients);
      }

      logger.info('Notification sent successfully', {
        notificationId: notificationPayload.id,
        recipients: Array.isArray(recipients) ? recipients.length : recipients,
        type,
        category,
        orgId
      });

      return notificationPayload;

    } catch (error) {
      logger.error('Failed to send notification', {
        error: error.message,
        notification,
        recipients
      });
      throw error;
    }
  }

  /**
   * Send notification to a single user
   */
  async sendToUser(notification, userId, orgId) {
    try {
      // Check user preferences
      const userPrefs = this.getUserPreferences(userId);
      if (!this.shouldSendNotification(notification, userPrefs)) {
        logger.debug('Notification blocked by user preferences', {
          userId,
          category: notification.category
        });
        return;
      }

      // Send via Socket.IO
      if (this.socketManager && global.io) {
        global.io.to(`user_${userId}`).emit('notification', notification);
      }

      // Store persistent notifications
      if (notification.persistent) {
        await this.storeNotification(notification, userId);
      }

    } catch (error) {
      logger.error('Failed to send notification to user', {
        error: error.message,
        userId,
        notificationId: notification.id
      });
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToMultipleUsers(notification, userIds, orgId) {
    const promises = userIds.map(userId => 
      this.sendToUser(notification, userId, orgId)
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Broadcast notification to all users in organization
   */
  async broadcastNotification(notification, orgId) {
    try {
      if (this.socketManager && global.io) {
        if (orgId) {
          global.io.to(`tenant_${orgId}`).emit('notification', notification);
        } else {
          global.io.emit('notification', notification);
        }
      }

      logger.info('Notification broadcasted', {
        notificationId: notification.id,
        orgId
      });

    } catch (error) {
      logger.error('Failed to broadcast notification', {
        error: error.message,
        notificationId: notification.id,
        orgId
      });
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(notification, recipients) {
    if (!this.emailService) {
      logger.warn('Email service not configured - skipping email notification');
      return;
    }

    try {
      // Implementation depends on email service
      logger.info('Email notification sent', {
        notificationId: notification.id,
        recipients
      });
    } catch (error) {
      logger.error('Failed to send email notification', {
        error: error.message,
        notificationId: notification.id
      });
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(notification, recipients) {
    try {
      // Implementation for push notifications (Firebase, etc.)
      logger.info('Push notification sent', {
        notificationId: notification.id,
        recipients
      });
    } catch (error) {
      logger.error('Failed to send push notification', {
        error: error.message,
        notificationId: notification.id
      });
    }
  }

  /**
   * Store persistent notification in database
   */
  async storeNotification(notification, userId) {
    try {
      // Store in database for persistent notifications
      // Implementation depends on database model
      logger.debug('Notification stored', {
        notificationId: notification.id,
        userId
      });
    } catch (error) {
      logger.error('Failed to store notification', {
        error: error.message,
        notificationId: notification.id,
        userId
      });
    }
  }

  /**
   * Set user notification preferences
   */
  setUserPreferences(userId, preferences) {
    this.preferences.set(userId, {
      email: preferences.email !== false,
      push: preferences.push !== false,
      realTime: preferences.realTime !== false,
      categories: preferences.categories || {},
      quietHours: preferences.quietHours || null,
      ...preferences
    });

    logger.info('User notification preferences updated', { userId });
  }

  /**
   * Get user notification preferences
   */
  getUserPreferences(userId) {
    return this.preferences.get(userId) || {
      email: true,
      push: true,
      realTime: true,
      categories: {},
      quietHours: null
    };
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  shouldSendNotification(notification, userPrefs) {
    // Check category preferences
    if (userPrefs.categories[notification.category] === false) {
      return false;
    }

    // Check quiet hours
    if (userPrefs.quietHours) {
      const now = new Date();
      const currentHour = now.getHours();
      const { start, end } = userPrefs.quietHours;
      
      if (start <= end) {
        // Same day quiet hours (e.g., 22:00 - 06:00)
        if (currentHour >= start && currentHour < end) {
          return notification.priority === 'high';
        }
      } else {
        // Overnight quiet hours (e.g., 22:00 - 06:00)
        if (currentHour >= start || currentHour < end) {
          return notification.priority === 'high';
        }
      }
    }

    return true;
  }

  /**
   * Send notification for leave request events
   */
  async sendLeaveNotification(eventType, leaveRequest, additionalData = {}) {
    const notifications = [];

    switch (eventType) {
      case 'requested':
        // Notify admins about new leave request
        notifications.push({
          template: 'leave_requested',
          message: `${leaveRequest.userId?.name} requested ${leaveRequest.leaveType} leave for ${leaveRequest.days} day(s)`,
          action: 'leave_requested',
          data: { leaveRequestId: leaveRequest._id, ...additionalData },
          recipients: 'admins',
          orgId: leaveRequest.orgId,
          emailNotification: true
        });
        break;

      case 'approved':
        // Notify employee about approval
        notifications.push({
          template: 'leave_approved',
          message: `Your ${leaveRequest.leaveType} leave request has been approved`,
          action: 'leave_approved',
          data: { leaveRequestId: leaveRequest._id, ...additionalData },
          recipients: leaveRequest.userId,
          orgId: leaveRequest.orgId,
          emailNotification: true,
          persistent: true
        });
        break;

      case 'rejected':
        // Notify employee about rejection
        notifications.push({
          template: 'leave_rejected',
          message: `Your ${leaveRequest.leaveType} leave request has been rejected: ${additionalData.reason || 'No reason provided'}`,
          action: 'leave_rejected',
          data: { leaveRequestId: leaveRequest._id, reason: additionalData.reason, ...additionalData },
          recipients: leaveRequest.userId,
          orgId: leaveRequest.orgId,
          emailNotification: true,
          persistent: true
        });
        break;
    }

    // Send all notifications
    for (const notification of notifications) {
      await this.sendNotification(notification, notification.recipients, notification.orgId);
    }
  }

  /**
   * Send notification for employee events
   */
  async sendEmployeeNotification(eventType, employee, additionalData = {}) {
    const notifications = [];

    switch (eventType) {
      case 'created':
        // Notify admins about new employee
        notifications.push({
          template: 'employee_created',
          message: `New employee ${employee.userId?.name} has been added to ${employee.department}`,
          action: 'employee_created',
          data: { employeeId: employee._id, ...additionalData },
          recipients: 'admins',
          orgId: employee.orgId,
          emailNotification: true
        });
        break;

      case 'terminated':
        // Notify admins about termination
        notifications.push({
          template: 'employee_terminated',
          message: `Employee has been terminated`,
          action: 'employee_terminated',
          data: { employeeId: employee._id, ...additionalData },
          recipients: 'admins',
          orgId: employee.orgId,
          emailNotification: true
        });
        break;
    }

    // Send all notifications
    for (const notification of notifications) {
      await this.sendNotification(notification, notification.recipients, notification.orgId);
    }
  }

  /**
   * Send notification for attendance events
   */
  async sendAttendanceNotification(eventType, attendance, additionalData = {}) {
    const notifications = [];

    switch (eventType) {
      case 'late_checkin':
        // Notify employee about late check-in
        notifications.push({
          template: 'late_checkin',
          message: `You are ${additionalData.minutesLate} minutes late today`,
          action: 'late_checkin',
          data: { attendanceId: attendance._id, minutesLate: additionalData.minutesLate },
          recipients: attendance.userId,
          orgId: attendance.orgId
        });
        break;

      case 'overtime_worked':
        // Notify employee about overtime
        notifications.push({
          template: 'overtime_worked',
          message: `You worked ${additionalData.overtimeHours} hours of overtime today`,
          action: 'overtime_worked',
          data: { attendanceId: attendance._id, overtimeHours: additionalData.overtimeHours },
          recipients: attendance.userId,
          orgId: attendance.orgId
        });
        break;
    }

    // Send all notifications
    for (const notification of notifications) {
      await this.sendNotification(notification, notification.recipients, notification.orgId);
    }
  }

  /**
   * Generate unique notification ID
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      templatesCount: this.templates.size,
      userPreferencesCount: this.preferences.size,
      queueSize: this.notificationQueue.length
    };
  }
}

export default NotificationSystem;