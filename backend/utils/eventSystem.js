/**
 * Business Event System
 * Handles business events, triggers, and automated actions
 */

import logger from "./logger.js";

class EventSystem {
  constructor(notificationManager, workflowEngine, socketManager) {
    this.notificationManager = notificationManager;
    this.workflowEngine = workflowEngine;
    this.socketManager = socketManager;
    
    this.eventListeners = new Map();
    this.eventHistory = [];
    this.eventStats = {
      totalEvents: 0,
      eventsByType: {},
      eventsByOrg: {}
    };
    
    // Initialize default event handlers
    this.initializeDefaultHandlers();
  }

  /**
   * Initialize default event handlers
   */
  initializeDefaultHandlers() {
    // Helper function for safe binding
    const safeOn = (eventType, methodName) => {
      const handler = this[methodName]?.bind(this) || ((data) => {
        logger.debug(`Handler ${methodName} not implemented for event ${eventType}`, data);
      });
      this.on(eventType, handler);
    };

    // Employee Events
    safeOn('employee.created', 'handleEmployeeCreated');
    safeOn('employee.updated', 'handleEmployeeUpdated');
    safeOn('employee.deactivated', 'handleEmployeeDeactivated');

    // Leave Events
    safeOn('leave.requested', 'handleLeaveRequested');
    safeOn('leave.approved', 'handleLeaveApproved');
    safeOn('leave.rejected', 'handleLeaveRejected');
    safeOn('leave.cancelled', 'handleLeaveCancelled');

    // Attendance Events
    safeOn('attendance.checkin', 'handleAttendanceCheckin');
    safeOn('attendance.checkout', 'handleAttendanceCheckout');
    safeOn('attendance.late', 'handleAttendanceLate');
    safeOn('attendance.absent', 'handleAttendanceAbsent');

    // Expense Events
    safeOn('expense.submitted', 'handleExpenseSubmitted');
    safeOn('expense.approved', 'handleExpenseApproved');
    safeOn('expense.rejected', 'handleExpenseRejected');

    // Payroll Events
    safeOn('payroll.generated', 'handlePayrollGenerated');
    safeOn('payroll.processed', 'handlePayrollProcessed');

    // Task Events
    safeOn('task.created', 'handleTaskCreated');
    safeOn('task.assigned', 'handleTaskAssigned');
    safeOn('task.completed', 'handleTaskCompleted');
    safeOn('task.overdue', 'handleTaskOverdue');

    // Performance Events
    safeOn('performance.review_started', 'handlePerformanceReviewStarted');
    safeOn('performance.review_completed', 'handlePerformanceReviewCompleted');

    // System Events
    safeOn('system.user_login', 'handleUserLogin');
    safeOn('system.security_alert', 'handleSecurityAlert');

    logger.info('Default event handlers initialized');
  }

  /**
   * Register an event listener
   */
  on(eventType, handler) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    this.eventListeners.get(eventType).push(handler);
    
    logger.debug('Event listener registered', { eventType });
  }

  /**
   * Remove an event listener
   */
  off(eventType, handler) {
    if (this.eventListeners.has(eventType)) {
      const handlers = this.eventListeners.get(eventType);
      const index = handlers.indexOf(handler);
      
      if (index > -1) {
        handlers.splice(index, 1);
      }
      
      if (handlers.length === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  /**
   * Emit an event
   */
  async emit(eventType, eventData) {
    try {
      const event = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: eventType,
        data: eventData,
        timestamp: new Date(),
        orgId: eventData.orgId || 'system'
      };

      // Update statistics
      this.eventStats.totalEvents++;
      this.eventStats.eventsByType[eventType] = 
        (this.eventStats.eventsByType[eventType] || 0) + 1;
      this.eventStats.eventsByOrg[event.orgId] = 
        (this.eventStats.eventsByOrg[event.orgId] || 0) + 1;

      // Add to history (keep last 1000 events)
      this.eventHistory.unshift(event);
      if (this.eventHistory.length > 1000) {
        this.eventHistory = this.eventHistory.slice(0, 1000);
      }

      logger.info('Event emitted', {
        eventId: event.id,
        eventType,
        orgId: event.orgId
      });

      // Execute all listeners for this event type
      const listeners = this.eventListeners.get(eventType) || [];
      
      for (const listener of listeners) {
        try {
          await listener(event);
        } catch (error) {
          logger.error('Event listener error', {
            error: error.message,
            eventType,
            eventId: event.id
          });
        }
      }

      // Broadcast event via Socket.IO if available
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(event.orgId, 'business_event', {
          eventType,
          eventId: event.id,
          timestamp: event.timestamp,
          data: eventData
        });
      }

      return event;

    } catch (error) {
      logger.error('Failed to emit event', {
        error: error.message,
        eventType,
        eventData
      });
      throw error;
    }
  }

  /**
   * Employee Event Handlers
   */
  async handleEmployeeCreated(event) {
    const { employee, createdBy, orgId } = event.data;

    // Start onboarding workflow
    if (this.workflowEngine) {
      await this.workflowEngine.startWorkflow('employee_onboarding', {
        employeeId: employee._id,
        employeeName: employee.name,
        createdBy,
        orgId
      });
    }

    // Send welcome notification
    if (this.notificationManager) {
      await this.notificationManager.sendNotification({
        type: 'employee_welcome',
        title: 'Welcome to the Team!',
        message: `Welcome ${employee.name}! We're excited to have you join our team.`,
        recipients: [employee.userId],
        priority: 'normal',
        channels: ['in_app', 'email'],
        orgId,
        createdBy
      });

      // Notify HR team
      await this.notificationManager.sendNotification({
        type: 'employee_added',
        title: 'New Employee Added',
        message: `${employee.name} has been added to the system`,
        recipients: 'hr',
        priority: 'normal',
        channels: ['in_app'],
        orgId,
        createdBy
      });
    }
  }

  async handleEmployeeUpdated(event) {
    const { employee, changes, updatedBy, orgId } = event.data;

    // Check for significant changes
    const significantChanges = ['department', 'role', 'manager', 'salary'];
    const hasSignificantChanges = significantChanges.some(field => 
      changes.hasOwnProperty(field)
    );

    if (hasSignificantChanges) {
      // Notify employee of changes
      await this.notificationManager.sendNotification({
        type: 'profile_updated',
        title: 'Profile Updated',
        message: 'Your profile has been updated with important changes',
        recipients: [employee.userId],
        priority: 'normal',
        channels: ['in_app', 'email'],
        data: { changes },
        orgId,
        createdBy: updatedBy
      });
    }
  }

  async handleEmployeeDeactivated(event) {
    const { employee, reason, deactivatedBy, orgId } = event.data;

    // Start offboarding workflow
    if (this.workflowEngine) {
      await this.workflowEngine.startWorkflow('employee_offboarding', {
        employeeId: employee._id,
        employeeName: employee.name,
        reason,
        createdBy: deactivatedBy,
        orgId
      });
    }

    // Notify relevant teams
    await this.notificationManager.sendNotification({
      type: 'employee_deactivated',
      title: 'Employee Deactivated',
      message: `${employee.name} has been deactivated`,
      recipients: ['hr', 'managers'],
      priority: 'normal',
      channels: ['in_app'],
      orgId,
      createdBy: deactivatedBy
    });
  }

  /**
   * Leave Event Handlers
   */
  async handleLeaveRequested(event) {
    const { leaveRequest, employee, orgId } = event.data;

    // Start leave approval workflow
    if (this.workflowEngine) {
      await this.workflowEngine.startWorkflow('leave_request', {
        leaveRequestId: leaveRequest._id,
        employeeId: employee._id,
        employeeName: employee.name,
        type: leaveRequest.type,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        days: leaveRequest.days,
        reason: leaveRequest.reason,
        createdBy: employee.userId,
        orgId
      });
    }
  }

  async handleLeaveApproved(event) {
    const { leaveRequest, approvedBy, employee, orgId } = event.data;

    // Notify employee
    await this.notificationManager.sendNotification({
      type: 'leave_approved',
      title: 'Leave Request Approved',
      message: `Your ${leaveRequest.type} leave request has been approved`,
      recipients: [employee.userId],
      priority: 'normal',
      channels: ['in_app', 'email'],
      data: { leaveRequest },
      orgId,
      createdBy: approvedBy
    });

    // Update calendar/scheduling systems
    // TODO: Integrate with calendar systems
  }

  async handleLeaveRejected(event) {
    const { leaveRequest, rejectedBy, reason, employee, orgId } = event.data;

    // Notify employee
    await this.notificationManager.sendNotification({
      type: 'leave_rejected',
      title: 'Leave Request Rejected',
      message: `Your ${leaveRequest.type} leave request has been rejected`,
      recipients: [employee.userId],
      priority: 'normal',
      channels: ['in_app', 'email'],
      data: { leaveRequest, reason },
      orgId,
      createdBy: rejectedBy
    });
  }

  async handleLeaveCancelled(event) {
    const { leaveRequest, cancelledBy, employee, orgId } = event.data;

    // Notify relevant parties
    await this.notificationManager.sendNotification({
      type: 'leave_cancelled',
      title: 'Leave Request Cancelled',
      message: `${employee.name}'s leave request has been cancelled`,
      recipients: 'managers',
      priority: 'normal',
      channels: ['in_app'],
      data: { leaveRequest },
      orgId,
      createdBy: cancelledBy
    });
  }

  /**
   * Attendance Event Handlers
   */
  async handleAttendanceCheckin(event) {
    const { attendance, employee, orgId } = event.data;

    // Check if late
    const scheduledTime = new Date(attendance.date);
    scheduledTime.setHours(9, 0, 0, 0); // Assuming 9 AM start time

    if (attendance.checkIn > scheduledTime) {
      // Emit late attendance event
      await this.emit('attendance.late', {
        attendance,
        employee,
        scheduledTime,
        actualTime: attendance.checkIn,
        orgId
      });
    }

    // Real-time update
    if (this.socketManager) {
      this.socketManager.broadcastToOrganization(orgId, 'attendance_checkin', {
        employeeId: employee._id,
        employeeName: employee.name,
        checkInTime: attendance.checkIn,
        timestamp: new Date()
      });
    }
  }

  async handleAttendanceCheckout(event) {
    const { attendance, employee, orgId } = event.data;

    // Calculate hours worked
    const hoursWorked = (attendance.checkOut - attendance.checkIn) / (1000 * 60 * 60);

    // Check for overtime
    if (hoursWorked > 8) {
      await this.notificationManager.sendNotification({
        type: 'overtime_worked',
        title: 'Overtime Detected',
        message: `${employee.name} worked ${hoursWorked.toFixed(1)} hours today`,
        recipients: 'managers',
        priority: 'normal',
        channels: ['in_app'],
        data: { attendance, hoursWorked },
        orgId
      });
    }

    // Real-time update
    if (this.socketManager) {
      this.socketManager.broadcastToOrganization(orgId, 'attendance_checkout', {
        employeeId: employee._id,
        employeeName: employee.name,
        checkOutTime: attendance.checkOut,
        hoursWorked,
        timestamp: new Date()
      });
    }
  }

  async handleAttendanceLate(event) {
    const { attendance, employee, scheduledTime, actualTime, orgId } = event.data;

    const minutesLate = Math.round((actualTime - scheduledTime) / (1000 * 60));

    // Notify manager if significantly late (>30 minutes)
    if (minutesLate > 30) {
      await this.notificationManager.sendNotification({
        type: 'employee_late',
        title: 'Employee Late Arrival',
        message: `${employee.name} is ${minutesLate} minutes late today`,
        recipients: 'managers',
        priority: 'normal',
        channels: ['in_app'],
        data: { attendance, minutesLate },
        orgId
      });
    }
  }

  async handleAttendanceAbsent(event) {
    const { employee, date, orgId } = event.data;

    // Notify manager
    await this.notificationManager.sendNotification({
      type: 'employee_absent',
      title: 'Employee Absent',
      message: `${employee.name} is absent today without prior notice`,
      recipients: 'managers',
      priority: 'high',
      channels: ['in_app', 'email'],
      data: { employee, date },
      orgId
    });
  }

  /**
   * Expense Event Handlers
   */
  async handleExpenseSubmitted(event) {
    const { expense, employee, orgId } = event.data;

    // Start expense approval workflow
    if (this.workflowEngine) {
      await this.workflowEngine.startWorkflow('expense_approval', {
        expenseId: expense._id,
        employeeId: employee._id,
        employeeName: employee.name,
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        createdBy: employee.userId,
        orgId
      });
    }
  }

  async handleExpenseApproved(event) {
    const { expense, approvedBy, employee, orgId } = event.data;

    // Notify employee
    await this.notificationManager.sendNotification({
      type: 'expense_approved',
      title: 'Expense Approved',
      message: `Your expense of $${expense.amount} has been approved`,
      recipients: [employee.userId],
      priority: 'normal',
      channels: ['in_app', 'email'],
      data: { expense },
      orgId,
      createdBy: approvedBy
    });

    // Notify finance team for reimbursement
    await this.notificationManager.sendNotification({
      type: 'expense_for_reimbursement',
      title: 'Expense Ready for Reimbursement',
      message: `Expense of $${expense.amount} for ${employee.name} is ready for reimbursement`,
      recipients: 'finance',
      priority: 'normal',
      channels: ['in_app'],
      data: { expense, employee },
      orgId,
      createdBy: approvedBy
    });
  }

  async handleExpenseRejected(event) {
    const { expense, rejectedBy, reason, employee, orgId } = event.data;

    // Notify employee
    await this.notificationManager.sendNotification({
      type: 'expense_rejected',
      title: 'Expense Rejected',
      message: `Your expense of $${expense.amount} has been rejected`,
      recipients: [employee.userId],
      priority: 'normal',
      channels: ['in_app', 'email'],
      data: { expense, reason },
      orgId,
      createdBy: rejectedBy
    });
  }

  /**
   * Task Event Handlers
   */
  async handleTaskCreated(event) {
    const { task, createdBy, orgId } = event.data;

    if (task.assigneeId) {
      await this.notificationManager.sendNotification({
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `You have been assigned a new task: ${task.title}`,
        recipients: [task.assigneeId],
        priority: task.priority === 'urgent' ? 'high' : 'normal',
        channels: ['in_app', 'email'],
        data: { task },
        actionUrl: `/tasks/${task._id}`,
        orgId,
        createdBy
      });
    }
  }

  async handleTaskAssigned(event) {
    const { task, assignedBy, assigneeId, orgId } = event.data;

    await this.notificationManager.sendNotification({
      type: 'task_assigned',
      title: 'Task Assigned to You',
      message: `You have been assigned: ${task.title}`,
      recipients: [assigneeId],
      priority: task.priority === 'urgent' ? 'high' : 'normal',
      channels: ['in_app', 'email'],
      data: { task },
      actionUrl: `/tasks/${task._id}`,
      orgId,
      createdBy: assignedBy
    });
  }

  async handleTaskCompleted(event) {
    const { task, completedBy, orgId } = event.data;

    // Notify task creator
    if (task.createdBy !== completedBy) {
      await this.notificationManager.sendNotification({
        type: 'task_completed',
        title: 'Task Completed',
        message: `Task "${task.title}" has been completed`,
        recipients: [task.createdBy],
        priority: 'normal',
        channels: ['in_app'],
        data: { task },
        orgId,
        createdBy: completedBy
      });
    }
  }

  async handleTaskOverdue(event) {
    const { task, orgId } = event.data;

    // Notify assignee and manager
    const recipients = [task.assigneeId];
    
    await this.notificationManager.sendNotification({
      type: 'task_overdue',
      title: 'Task Overdue',
      message: `Task "${task.title}" is overdue`,
      recipients,
      priority: 'high',
      channels: ['in_app', 'email'],
      data: { task },
      actionUrl: `/tasks/${task._id}`,
      orgId
    });
  }

  /**
   * System Event Handlers
   */
  async handleUserLogin(event) {
    const { user, loginInfo, orgId } = event.data;

    // Check for suspicious login patterns
    if (loginInfo.isNewDevice || loginInfo.isNewLocation) {
      await this.emit('system.security_alert', {
        type: 'suspicious_login',
        user,
        loginInfo,
        orgId
      });
    }
  }

  async handleSecurityAlert(event) {
    const { type, user, details, orgId } = event.data;

    // Notify security team/admins
    await this.notificationManager.sendNotification({
      type: 'security_alert',
      title: 'Security Alert',
      message: `Security alert: ${type} for user ${user.name}`,
      recipients: 'admins',
      priority: 'urgent',
      channels: ['in_app', 'email'],
      data: { type, user, details },
      orgId
    });
  }

  /**
   * Get event statistics
   */
  getEventStats() {
    return {
      ...this.eventStats,
      activeListeners: this.eventListeners.size,
      recentEvents: this.eventHistory.slice(0, 10)
    };
  }

  /**
   * Get event history
   */
  getEventHistory(limit = 100, eventType = null, orgId = null) {
    let events = this.eventHistory;

    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    if (orgId) {
      events = events.filter(e => e.orgId === orgId);
    }

    return events.slice(0, limit);
  }

  /**
   * Clear event history
   */
  clearEventHistory() {
    this.eventHistory = [];
    logger.info('Event history cleared');
  }
}

export default EventSystem;