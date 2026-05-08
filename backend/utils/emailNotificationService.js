/**
 * Comprehensive Email Notification Service
 * Handles ALL HRMS email notifications for employees, admins, and super admins
 * Sends to real Outlook email addresses
 * Also creates in-app notifications
 */

import logger from './logger.js';
import Notification from '../models/Notification.js';

class EmailNotificationService {
  /**
   * Create in-app notification
   */
  static async createInAppNotification(data) {
    try {
      const notification = await Notification.create({
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority || 'medium',
        recipientId: data.recipientId,
        senderId: data.senderId,
        orgId: data.orgId,
        relatedEntity: data.relatedEntity,
        actionUrl: data.actionUrl,
        actionText: data.actionText
      });

      logger.info('In-app notification created', {
        notificationId: notification._id,
        recipientId: data.recipientId,
        type: data.type
      });

      // Emit real-time notification via Socket.IO
      if (global.io) {
        global.io.to(`user_${data.recipientId}`).emit('notification', {
          id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          createdAt: notification.createdAt,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText
        });
      }

      return notification;
    } catch (error) {
      logger.error('Failed to create in-app notification', {
        error: error.message,
        recipientId: data.recipientId
      });
      return null;
    }
  }

  /**
   * Send email using nodemailer with Microsoft 365 SMTP
   * Supports custom from email address
   */
  static async sendEmail(emailData) {
    try {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        logger.warn('Email service not configured', { to: emailData.to });
        return false;
      }

      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      });

      await transporter.verify();

      // Use custom from email if provided, otherwise use default
      const fromEmail = emailData.from || process.env.FROM_EMAIL || process.env.SMTP_USER;
      const fromName = emailData.fromName || 'WorkPlus HR';

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      });

      logger.info('Email sent', { to: emailData.to, from: fromEmail, subject: emailData.subject, messageId: info.messageId });
      return true;
    } catch (error) {
      logger.error('Email send failed', { error: error.message, to: emailData.to });
      return false;
    }
  }

  /**
   * Email template wrapper
   */
  static getEmailTemplate(content, title) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background-color:#f4f4f4}
.email-container{max-width:600px;margin:20px auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center}
.header h1{margin:0;font-size:28px}.header p{margin:10px 0 0 0;opacity:0.9}
.content{padding:30px}
.card{background:#f9f9f9;padding:20px;margin:20px 0;border-radius:8px;border-left:4px solid #667eea}
.info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee}
.info-row:last-child{border-bottom:none}
.label{color:#666;font-weight:500}.value{font-weight:bold;color:#333}
.highlight{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;border-radius:8px;text-align:center;margin:20px 0}
.highlight .amount{font-size:36px;font-weight:bold;margin:10px 0}
.button{display:inline-block;background:#667eea;color:white!important;padding:14px 32px;text-decoration:none;border-radius:6px;margin:20px 0;font-weight:600}
.button:hover{background:#5568d3}
.alert{background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0;border-radius:4px}
.success{background:#d4edda;border-left:4px solid #28a745;padding:15px;margin:20px 0;border-radius:4px}
.footer{background:#f9f9f9;padding:20px;text-align:center;color:#666;font-size:12px;border-top:1px solid #eee}
.footer a{color:#667eea;text-decoration:none}
@media only screen and (max-width:600px){.email-container{margin:0;border-radius:0}.content{padding:20px}.info-row{flex-direction:column}}
</style></head><body>
<div class="email-container"><div class="header"><h1>${title}</h1></div>
<div class="content">${content}</div>
<div class="footer"><p><strong>WorkPlus HRMS</strong></p>
<p>This is an automated notification. Please do not reply.</p>
<p>Support: <a href="mailto:${process.env.FROM_EMAIL}">${process.env.FROM_EMAIL}</a></p>
<p>&copy; ${new Date().getFullYear()} WorkPlus. All rights reserved.</p></div></div></body></html>`;
  }

  // ============================================
  // PAYROLL NOTIFICATIONS
  // ============================================

  static async sendSalarySlipApprovedEmail(employee, salarySlip) {
    const monthName = new Date(salarySlip.year, salarySlip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your salary slip for <strong>${monthName}</strong> has been approved.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">💰 Salary Summary</h3>
<div class="info-row"><span class="label">Gross Earnings:</span><span class="value">₹${salarySlip.grossEarnings.toLocaleString()}</span></div>
<div class="info-row"><span class="label">Deductions:</span><span class="value">₹${(salarySlip.grossEarnings - salarySlip.netSalary).toLocaleString()}</span></div></div>
<div class="highlight"><div style="font-size:14px;opacity:0.9">Net Salary</div><div class="amount">₹${salarySlip.netSalary.toLocaleString()}</div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/payroll" class="button">📄 View Payslip</a></div>
<div class="success"><strong>✓</strong> Review your payslip and report discrepancies within 7 days.</div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: `Salary Slip Approved - ${monthName}`,
      message: `Your salary slip for ${monthName} has been approved. Net Salary: ₹${salarySlip.netSalary.toLocaleString()}`,
      type: 'payroll_generated',
      priority: 'high',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/payroll',
      actionText: 'View Payslip',
      relatedEntity: {
        entityType: 'payroll',
        entityId: salarySlip._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Salary Slip Approved - ${monthName}`,
      html: this.getEmailTemplate(content, `💰 Salary Slip - ${monthName}`),
      text: `Salary slip for ${monthName} approved. Net: ₹${salarySlip.netSalary.toLocaleString()}`
    });
  }

  // ============================================
  // LEAVE NOTIFICATIONS
  // ============================================

  static async sendLeaveRequestSubmitted(employee, leaveRequest) {
    const start = new Date(leaveRequest.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const end = new Date(leaveRequest.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your leave request has been submitted successfully.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">📅 Leave Details</h3>
<div class="info-row"><span class="label">Type:</span><span class="value">${leaveRequest.type}</span></div>
<div class="info-row"><span class="label">From:</span><span class="value">${start}</span></div>
<div class="info-row"><span class="label">To:</span><span class="value">${end}</span></div>
<div class="info-row"><span class="label">Reason:</span><span class="value">${leaveRequest.reason}</span></div>
<div class="info-row"><span class="label">Status:</span><span class="value" style="color:#ffc107">⏳ Pending</span></div></div>
<div class="alert"><strong>⏰</strong> Pending approval from manager/HR.</div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Leave Request Submitted',
      message: `Your ${leaveRequest.type} leave request from ${start} to ${end} has been submitted and is pending approval.`,
      type: 'leave_request',
      priority: 'medium',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/leave',
      actionText: 'View Leave',
      relatedEntity: {
        entityType: 'leave_request',
        entityId: leaveRequest._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Leave Request Submitted - ${start} to ${end}`,
      html: this.getEmailTemplate(content, '📅 Leave Request Submitted'),
      text: `Leave request from ${start} to ${end} submitted.`
    });
  }

  static async sendLeaveApproved(employee, leaveRequest, approver) {
    const start = new Date(leaveRequest.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const end = new Date(leaveRequest.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your leave request has been <strong style="color:#28a745">approved</strong>!</p>
<div class="success"><strong>✓ Leave Approved</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">📅 Approved Leave</h3>
<div class="info-row"><span class="label">Type:</span><span class="value">${leaveRequest.type}</span></div>
<div class="info-row"><span class="label">From:</span><span class="value">${start}</span></div>
<div class="info-row"><span class="label">To:</span><span class="value">${end}</span></div>
<div class="info-row"><span class="label">Approved By:</span><span class="value">${approver.name}</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/leave" class="button">📋 View Leaves</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Leave Request Approved',
      message: `Your ${leaveRequest.type} leave request from ${start} to ${end} has been approved by ${approver.name}.`,
      type: 'leave_approved',
      priority: 'high',
      recipientId: employee._id,
      senderId: approver._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/leave',
      actionText: 'View Leave',
      relatedEntity: {
        entityType: 'leave_request',
        entityId: leaveRequest._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Leave Approved - ${start} to ${end}`,
      html: this.getEmailTemplate(content, '✅ Leave Approved'),
      text: `Leave from ${start} to ${end} approved.`
    });
  }

  static async sendLeaveRejected(employee, leaveRequest, rejector, reason) {
    const start = new Date(leaveRequest.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const end = new Date(leaveRequest.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your leave request has been <strong style="color:#dc3545">rejected</strong>.</p>
<div class="alert" style="background:#f8d7da;border-left-color:#dc3545"><strong>✗ Leave Rejected</strong></div>
<div class="card"><h3 style="margin-top:0;color:#dc3545">📅 Leave Details</h3>
<div class="info-row"><span class="label">Type:</span><span class="value">${leaveRequest.type}</span></div>
<div class="info-row"><span class="label">From:</span><span class="value">${start}</span></div>
<div class="info-row"><span class="label">To:</span><span class="value">${end}</span></div>
<div class="info-row"><span class="label">Rejected By:</span><span class="value">${rejector.name}</span></div>
<div class="info-row"><span class="label">Reason:</span><span class="value">${reason || 'Not specified'}</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/leave" class="button">📋 Submit New Request</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Leave Request Rejected',
      message: `Your ${leaveRequest.type} leave request from ${start} to ${end} has been rejected. Reason: ${reason || 'Not specified'}`,
      type: 'leave_rejected',
      priority: 'high',
      recipientId: employee._id,
      senderId: rejector._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/leave',
      actionText: 'View Leave',
      relatedEntity: {
        entityType: 'leave_request',
        entityId: leaveRequest._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Leave Rejected - ${start} to ${end}`,
      html: this.getEmailTemplate(content, '❌ Leave Rejected'),
      text: `Leave from ${start} to ${end} rejected. Reason: ${reason || 'Not specified'}`
    });
  }

  // ============================================
  // EXPENSE NOTIFICATIONS
  // ============================================

  static async sendExpenseSubmitted(employee, expense) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your expense claim has been submitted.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">💳 Expense Details</h3>
<div class="info-row"><span class="label">Title:</span><span class="value">${expense.title || expense.category}</span></div>
<div class="info-row"><span class="label">Category:</span><span class="value">${expense.category}</span></div>
<div class="info-row"><span class="label">Amount:</span><span class="value">₹${expense.amount.toLocaleString()}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${new Date(expense.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
<div class="info-row"><span class="label">Status:</span><span class="value" style="color:#ffc107">⏳ Pending</span></div></div>
<div class="alert"><strong>⏰</strong> Under review. You'll be notified once processed.</div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Expense Claim Submitted',
      message: `Your expense claim of ₹${expense.amount.toLocaleString()} for ${expense.category} has been submitted and is under review.`,
      type: 'expense_submitted',
      priority: 'medium',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/expenses',
      actionText: 'View Expense',
      relatedEntity: {
        entityType: 'expense',
        entityId: expense._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Expense Submitted - ₹${expense.amount.toLocaleString()}`,
      html: this.getEmailTemplate(content, '💳 Expense Submitted'),
      text: `Expense of ₹${expense.amount.toLocaleString()} submitted.`
    });
  }

  static async sendExpenseApproved(employee, expense, approver) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your expense claim has been <strong style="color:#28a745">approved</strong>!</p>
<div class="success"><strong>✓ Expense Approved</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">💳 Approved Expense</h3>
<div class="info-row"><span class="label">Title:</span><span class="value">${expense.title || expense.category}</span></div>
<div class="info-row"><span class="label">Amount:</span><span class="value">₹${expense.amount.toLocaleString()}</span></div>
<div class="info-row"><span class="label">Approved By:</span><span class="value">${approver.name}</span></div></div>
<div class="highlight"><div style="font-size:14px;opacity:0.9">Reimbursement</div><div class="amount">₹${expense.amount.toLocaleString()}</div></div>
<div class="alert" style="background:#d4edda;border-left-color:#28a745"><strong>💰</strong> Amount will be credited in next payroll.</div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Expense Claim Approved',
      message: `Your expense claim of ₹${expense.amount.toLocaleString()} has been approved by ${approver.name}. Amount will be credited in next payroll.`,
      type: 'expense_approved',
      priority: 'high',
      recipientId: employee._id,
      senderId: approver._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/expenses',
      actionText: 'View Expense',
      relatedEntity: {
        entityType: 'expense',
        entityId: expense._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Expense Approved - ₹${expense.amount.toLocaleString()}`,
      html: this.getEmailTemplate(content, '✅ Expense Approved'),
      text: `Expense of ₹${expense.amount.toLocaleString()} approved.`
    });
  }

  // ============================================
  // ATTENDANCE NOTIFICATIONS
  // ============================================

  static async sendAttendanceReminder(employee) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Reminder to mark your attendance for today.</p>
<div class="alert"><strong>⏰ Reminder:</strong> Please check in to mark attendance.</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/attendance" class="button">✓ Mark Attendance</a></div>`;
    
    await this.sendEmail({
      to: employee.email,
      subject: 'Attendance Reminder - Please Check In',
      html: this.getEmailTemplate(content, '⏰ Attendance Reminder'),
      text: 'Please mark your attendance for today.'
    });
  }

  static async sendCheckInNotification(employee, checkInTime) {
    const time = new Date(checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your check-in has been recorded.</p>
<div class="success"><strong>✓ Check-In Successful</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">🕐 Check-In Details</h3>
<div class="info-row"><span class="label">Time:</span><span class="value">${time}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${new Date(checkInTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/attendance" class="button">📊 View Attendance</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Check-In Recorded',
      message: `You checked in at ${time}`,
      type: 'attendance_checkin',
      priority: 'low',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/attendance',
      actionText: 'View Attendance'
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Check-In Recorded - ${time}`,
      html: this.getEmailTemplate(content, '🕐 Check-In Recorded'),
      text: `Check-in recorded at ${time}`
    });
  }

  static async sendCheckInNotificationToHR(employee, checkInTime, hrEmail) {
    const time = new Date(checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = new Date(checkInTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const content = `<p>Dear HR Team,</p>
<p>An employee has checked in.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">🕐 Check-In Details</h3>
<div class="info-row"><span class="label">Employee Name:</span><span class="value">${employee.name}</span></div>
<div class="info-row"><span class="label">Employee Email:</span><span class="value">${employee.email}</span></div>
<div class="info-row"><span class="label">Check-In Time:</span><span class="value">${time}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${date}</span></div>
${employee.employeeCode ? `<div class="info-row"><span class="label">Employee Code:</span><span class="value">${employee.employeeCode}</span></div>` : ''}
${employee.department ? `<div class="info-row"><span class="label">Department:</span><span class="value">${employee.department}</span></div>` : ''}</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/admin/attendance" class="button">📊 View Attendance</a></div>`;
    
    // Send email to HR FROM employee's email
    await this.sendEmail({
      to: hrEmail,
      from: employee.email,
      fromName: employee.name,
      subject: `Employee Check-In: ${employee.name} - ${time}`,
      html: this.getEmailTemplate(content, '🕐 Employee Check-In Notification'),
      text: `${employee.name} checked in at ${time}`
    });
  }

  static async sendCheckOutNotification(employee, checkOutTime, workHours) {
    const time = new Date(checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your check-out has been recorded.</p>
<div class="success"><strong>✓ Check-Out Successful</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">🕐 Check-Out Details</h3>
<div class="info-row"><span class="label">Time:</span><span class="value">${time}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${new Date(checkOutTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
<div class="info-row"><span class="label">Work Hours:</span><span class="value">${workHours} hours</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/attendance" class="button">📊 View Attendance</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Check-Out Recorded',
      message: `You checked out at ${time}. Work hours: ${workHours}`,
      type: 'attendance_checkout',
      priority: 'low',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/attendance',
      actionText: 'View Attendance'
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Check-Out Recorded - ${time}`,
      html: this.getEmailTemplate(content, '🕐 Check-Out Recorded'),
      text: `Check-out recorded at ${time}. Work hours: ${workHours}`
    });
  }

  static async sendCheckOutNotificationToHR(employee, checkOutTime, workHours, hrEmail) {
    const time = new Date(checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = new Date(checkOutTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const content = `<p>Dear HR Team,</p>
<p>An employee has checked out.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">🕐 Check-Out Details</h3>
<div class="info-row"><span class="label">Employee Name:</span><span class="value">${employee.name}</span></div>
<div class="info-row"><span class="label">Employee Email:</span><span class="value">${employee.email}</span></div>
<div class="info-row"><span class="label">Check-Out Time:</span><span class="value">${time}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${date}</span></div>
<div class="info-row"><span class="label">Work Hours:</span><span class="value">${workHours} hours</span></div>
${employee.employeeCode ? `<div class="info-row"><span class="label">Employee Code:</span><span class="value">${employee.employeeCode}</span></div>` : ''}
${employee.department ? `<div class="info-row"><span class="label">Department:</span><span class="value">${employee.department}</span></div>` : ''}</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/admin/attendance" class="button">📊 View Attendance</a></div>`;
    
    // Send email to HR FROM employee's email
    await this.sendEmail({
      to: hrEmail,
      from: employee.email,
      fromName: employee.name,
      subject: `Employee Check-Out: ${employee.name} - ${time} (${workHours}h)`,
      html: this.getEmailTemplate(content, '🕐 Employee Check-Out Notification'),
      text: `${employee.name} checked out at ${time}. Work hours: ${workHours}`
    });
  }

  static async sendBreakNotification(employee, breakType, breakTime, duration) {
    const time = new Date(breakTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your ${breakType} break has been recorded.</p>
<div class="success"><strong>✓ Break Recorded</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">☕ Break Details</h3>
<div class="info-row"><span class="label">Type:</span><span class="value">${breakType}</span></div>
<div class="info-row"><span class="label">Time:</span><span class="value">${time}</span></div>
<div class="info-row"><span class="label">Duration:</span><span class="value">${duration} minutes</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/attendance" class="button">📊 View Attendance</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: `${breakType} Break Recorded`,
      message: `Your ${breakType} break of ${duration} minutes has been recorded at ${time}`,
      type: 'attendance_break',
      priority: 'low',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/attendance',
      actionText: 'View Attendance'
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `${breakType} Break Recorded - ${duration} minutes`,
      html: this.getEmailTemplate(content, `☕ ${breakType} Break Recorded`),
      text: `${breakType} break of ${duration} minutes recorded at ${time}`
    });
  }

  static async sendBreakNotificationToHR(employee, breakType, breakTime, duration, hrEmail) {
    const time = new Date(breakTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(breakTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const content = `<p>Dear HR Team,</p>
<p>An employee has taken a break.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">☕ Break Details</h3>
<div class="info-row"><span class="label">Employee Name:</span><span class="value">${employee.name}</span></div>
<div class="info-row"><span class="label">Employee Email:</span><span class="value">${employee.email}</span></div>
<div class="info-row"><span class="label">Break Type:</span><span class="value">${breakType}</span></div>
<div class="info-row"><span class="label">Time:</span><span class="value">${time}</span></div>
<div class="info-row"><span class="label">Duration:</span><span class="value">${duration} minutes</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${date}</span></div>
${employee.employeeCode ? `<div class="info-row"><span class="label">Employee Code:</span><span class="value">${employee.employeeCode}</span></div>` : ''}
${employee.department ? `<div class="info-row"><span class="label">Department:</span><span class="value">${employee.department}</span></div>` : ''}</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/admin/attendance" class="button">📊 View Attendance</a></div>`;
    
    // Send email to HR
    await this.sendEmail({
      to: hrEmail,
      subject: `Employee Break: ${employee.name} - ${breakType} (${duration}m)`,
      html: this.getEmailTemplate(content, `☕ Employee Break Notification`),
      text: `${employee.name} took a ${breakType} break of ${duration} minutes at ${time}`
    });
  }

  static async sendMeetingNotification(employee, meeting) {
    const startTime = new Date(meeting.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(meeting.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>You have been scheduled for a meeting.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">📅 Meeting Details</h3>
<div class="info-row"><span class="label">Title:</span><span class="value">${meeting.title}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${new Date(meeting.startTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
<div class="info-row"><span class="label">Time:</span><span class="value">${startTime} - ${endTime}</span></div>
<div class="info-row"><span class="label">Organizer:</span><span class="value">${meeting.organizer || 'HR'}</span></div>
${meeting.location ? `<div class="info-row"><span class="label">Location:</span><span class="value">${meeting.location}</span></div>` : ''}
${meeting.description ? `<div class="info-row"><span class="label">Description:</span><span class="value">${meeting.description}</span></div>` : ''}</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/attendance" class="button">📋 View Meeting</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: `Meeting Scheduled: ${meeting.title}`,
      message: `Meeting "${meeting.title}" scheduled for ${startTime} - ${endTime}`,
      type: 'meeting_scheduled',
      priority: 'high',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/attendance',
      actionText: 'View Meeting'
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Meeting Scheduled: ${meeting.title}`,
      html: this.getEmailTemplate(content, '📅 Meeting Scheduled'),
      text: `Meeting "${meeting.title}" scheduled for ${startTime} - ${endTime}`
    });
  }

  static async sendMeetingNotificationToHR(employee, meeting, hrEmail) {
    const startTime = new Date(meeting.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(meeting.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(meeting.startTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const content = `<p>Dear HR Team,</p>
<p>An employee has been scheduled for a meeting.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">📅 Meeting Details</h3>
<div class="info-row"><span class="label">Employee Name:</span><span class="value">${employee.name}</span></div>
<div class="info-row"><span class="label">Employee Email:</span><span class="value">${employee.email}</span></div>
<div class="info-row"><span class="label">Meeting Title:</span><span class="value">${meeting.title}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${date}</span></div>
<div class="info-row"><span class="label">Time:</span><span class="value">${startTime} - ${endTime}</span></div>
<div class="info-row"><span class="label">Organizer:</span><span class="value">${meeting.organizer || 'HR'}</span></div>
${meeting.location ? `<div class="info-row"><span class="label">Location:</span><span class="value">${meeting.location}</span></div>` : ''}
${meeting.description ? `<div class="info-row"><span class="label">Description:</span><span class="value">${meeting.description}</span></div>` : ''}
${employee.employeeCode ? `<div class="info-row"><span class="label">Employee Code:</span><span class="value">${employee.employeeCode}</span></div>` : ''}
${employee.department ? `<div class="info-row"><span class="label">Department:</span><span class="value">${employee.department}</span></div>` : ''}</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/admin/attendance" class="button">📊 View Attendance</a></div>`;
    
    // Send email to HR
    await this.sendEmail({
      to: hrEmail,
      subject: `Employee Meeting: ${employee.name} - ${meeting.title}`,
      html: this.getEmailTemplate(content, '📅 Employee Meeting Notification'),
      text: `${employee.name} scheduled for meeting "${meeting.title}" at ${startTime}`
    });
  }

  // ============================================
  // DOCUMENT NOTIFICATIONS
  // ============================================

  static async sendDocumentUploadedNotification(employee, document) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>A new document has been uploaded for you.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">📄 Document Details</h3>
<div class="info-row"><span class="label">Document:</span><span class="value">${document.name}</span></div>
<div class="info-row"><span class="label">Type:</span><span class="value">${document.type}</span></div>
<div class="info-row"><span class="label">Uploaded By:</span><span class="value">${document.uploadedBy}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${new Date(document.uploadDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
${document.description ? `<div class="info-row"><span class="label">Description:</span><span class="value">${document.description}</span></div>` : ''}</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/documents" class="button">📥 View Document</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Document Uploaded',
      message: `Document "${document.name}" has been uploaded for you`,
      type: 'document_uploaded',
      priority: 'medium',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/documents',
      actionText: 'View Document',
      relatedEntity: {
        entityType: 'document',
        entityId: document._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Document Uploaded: ${document.name}`,
      html: this.getEmailTemplate(content, '📄 Document Uploaded'),
      text: `Document "${document.name}" has been uploaded for you`
    });
  }

  static async sendDocumentApprovalRequiredNotification(employee, document) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>A document requires your approval.</p>
<div class="alert"><strong>⏰ Action Required:</strong> Please review and approve the document.</div>
<div class="card"><h3 style="margin-top:0;color:#667eea">📄 Document Details</h3>
<div class="info-row"><span class="label">Document:</span><span class="value">${document.name}</span></div>
<div class="info-row"><span class="label">Type:</span><span class="value">${document.type}</span></div>
<div class="info-row"><span class="label">Submitted By:</span><span class="value">${document.submittedBy}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${new Date(document.submissionDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
${document.description ? `<div class="info-row"><span class="label">Description:</span><span class="value">${document.description}</span></div>` : ''}</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/admin/documents" class="button">✓ Review & Approve</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Document Approval Required',
      message: `Document "${document.name}" requires your approval`,
      type: 'document_approval_required',
      priority: 'high',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/admin/documents',
      actionText: 'Review Document',
      relatedEntity: {
        entityType: 'document',
        entityId: document._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Document Approval Required: ${document.name}`,
      html: this.getEmailTemplate(content, '📄 Document Approval Required'),
      text: `Document "${document.name}" requires your approval`
    });
  }

  static async sendDocumentApprovedNotification(employee, document, approver) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your document has been <strong style="color:#28a745">approved</strong>!</p>
<div class="success"><strong>✓ Document Approved</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">📄 Document Details</h3>
<div class="info-row"><span class="label">Document:</span><span class="value">${document.name}</span></div>
<div class="info-row"><span class="label">Type:</span><span class="value">${document.type}</span></div>
<div class="info-row"><span class="label">Approved By:</span><span class="value">${approver.name}</span></div>
<div class="info-row"><span class="label">Date:</span><span class="value">${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/documents" class="button">📥 View Document</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Document Approved',
      message: `Your document "${document.name}" has been approved by ${approver.name}`,
      type: 'document_approved',
      priority: 'high',
      recipientId: employee._id,
      senderId: approver._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/documents',
      actionText: 'View Document',
      relatedEntity: {
        entityType: 'document',
        entityId: document._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Document Approved: ${document.name}`,
      html: this.getEmailTemplate(content, '✅ Document Approved'),
      text: `Document "${document.name}" has been approved`
    });
  }

  // ============================================
  // PAYSLIP NOTIFICATIONS
  // ============================================

  static async sendPayslipGeneratedNotification(employee, payslip) {
    const monthName = new Date(payslip.year, payslip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your payslip for <strong>${monthName}</strong> has been generated and is ready for download.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">💰 Payslip Summary</h3>
<div class="info-row"><span class="label">Month:</span><span class="value">${monthName}</span></div>
<div class="info-row"><span class="label">Gross Earnings:</span><span class="value">₹${payslip.grossEarnings.toLocaleString()}</span></div>
<div class="info-row"><span class="label">Deductions:</span><span class="value">₹${(payslip.grossEarnings - payslip.netSalary).toLocaleString()}</span></div></div>
<div class="highlight"><div style="font-size:14px;opacity:0.9">Net Salary</div><div class="amount">₹${payslip.netSalary.toLocaleString()}</div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/payroll" class="button">📄 Download Payslip</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: `Payslip Generated - ${monthName}`,
      message: `Your payslip for ${monthName} has been generated. Net Salary: ₹${payslip.netSalary.toLocaleString()}`,
      type: 'payslip_generated',
      priority: 'high',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/payroll',
      actionText: 'Download Payslip',
      relatedEntity: {
        entityType: 'payslip',
        entityId: payslip._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Payslip Generated - ${monthName}`,
      html: this.getEmailTemplate(content, `💰 Payslip - ${monthName}`),
      text: `Payslip for ${monthName} generated. Net: ₹${payslip.netSalary.toLocaleString()}`
    });
  }

  // ============================================
  // ASSET NOTIFICATIONS
  // ============================================

  static async sendAssetAllocatedNotification(employee, asset) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>An asset has been allocated to you.</p>
<div class="success"><strong>✓ Asset Allocated</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">🖥️ Asset Details</h3>
<div class="info-row"><span class="label">Asset Name:</span><span class="value">${asset.name}</span></div>
<div class="info-row"><span class="label">Type:</span><span class="value">${asset.type}</span></div>
<div class="info-row"><span class="label">Serial Number:</span><span class="value">${asset.serialNumber}</span></div>
<div class="info-row"><span class="label">Model:</span><span class="value">${asset.model || 'N/A'}</span></div>
<div class="info-row"><span class="label">Allocated Date:</span><span class="value">${new Date(asset.allocationDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
${asset.description ? `<div class="info-row"><span class="label">Description:</span><span class="value">${asset.description}</span></div>` : ''}</div>
<div class="alert" style="background:#d4edda;border-left-color:#28a745"><strong>📋</strong> Please acknowledge receipt of this asset.</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/assets" class="button">✓ Acknowledge Asset</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Asset Allocated',
      message: `Asset "${asset.name}" (${asset.type}) has been allocated to you`,
      type: 'asset_allocated',
      priority: 'high',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/assets',
      actionText: 'View Asset',
      relatedEntity: {
        entityType: 'asset',
        entityId: asset._id
      }
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Asset Allocated: ${asset.name}`,
      html: this.getEmailTemplate(content, '🖥️ Asset Allocated'),
      text: `Asset "${asset.name}" has been allocated to you`
    });
  }

  static async sendAssetReturnReminderNotification(employee, asset) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Reminder to return the allocated asset.</p>
<div class="alert"><strong>⏰ Action Required:</strong> Please return this asset as soon as possible.</div>
<div class="card"><h3 style="margin-top:0;color:#dc3545">🖥️ Asset Details</h3>
<div class="info-row"><span class="label">Asset Name:</span><span class="value">${asset.name}</span></div>
<div class="info-row"><span class="label">Type:</span><span class="value">${asset.type}</span></div>
<div class="info-row"><span class="label">Serial Number:</span><span class="value">${asset.serialNumber}</span></div>
<div class="info-row"><span class="label">Allocated Date:</span><span class="value">${new Date(asset.allocationDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/assets" class="button">📋 View Assets</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Asset Return Reminder',
      message: `Please return the asset "${asset.name}" as soon as possible`,
      type: 'asset_return_reminder',
      priority: 'high',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/assets',
      actionText: 'View Assets'
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Asset Return Reminder: ${asset.name}`,
      html: this.getEmailTemplate(content, '🖥️ Asset Return Reminder'),
      text: `Please return the asset "${asset.name}"`
    });
  }

  static async sendAssetReturnedNotification(employee, asset, returnedBy) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your asset return has been recorded.</p>
<div class="success"><strong>✓ Asset Return Confirmed</strong></div>
<div class="card"><h3 style="margin-top:0;color:#28a745">🖥️ Asset Details</h3>
<div class="info-row"><span class="label">Asset Name:</span><span class="value">${asset.name}</span></div>
<div class="info-row"><span class="label">Type:</span><span class="value">${asset.type}</span></div>
<div class="info-row"><span class="label">Serial Number:</span><span class="value">${asset.serialNumber}</span></div>
<div class="info-row"><span class="label">Return Date:</span><span class="value">${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
<div class="info-row"><span class="label">Received By:</span><span class="value">${returnedBy}</span></div></div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/employee/assets" class="button">📋 View Assets</a></div>`;
    
    // Create in-app notification
    await this.createInAppNotification({
      title: 'Asset Return Confirmed',
      message: `Your asset "${asset.name}" return has been confirmed`,
      type: 'asset_returned',
      priority: 'medium',
      recipientId: employee._id,
      orgId: employee.orgId || 'system',
      actionUrl: '/employee/assets',
      actionText: 'View Assets'
    });

    // Send email
    await this.sendEmail({
      to: employee.email,
      subject: `Asset Return Confirmed: ${asset.name}`,
      html: this.getEmailTemplate(content, '✅ Asset Return Confirmed'),
      text: `Asset "${asset.name}" return has been confirmed`
    });
  }

  // ============================================
  // ACCOUNT NOTIFICATIONS
  // ============================================

  static async sendWelcomeEmail(employee, tempPassword) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Welcome to <strong>WorkPlus HRMS</strong>! Your account is ready.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">🔐 Login Credentials</h3>
<div class="info-row"><span class="label">Email:</span><span class="value">${employee.email}</span></div>
<div class="info-row"><span class="label">Password:</span><span class="value" style="font-family:monospace;background:#f0f0f0;padding:5px 10px;border-radius:4px">${tempPassword}</span></div></div>
<div class="alert" style="background:#fff3cd;border-left-color:#ffc107"><strong>🔒</strong> Change password after first login.</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/login" class="button">🚀 Login Now</a></div>`;
    
    await this.sendEmail({
      to: employee.email,
      subject: 'Welcome to WorkPlus HRMS',
      html: this.getEmailTemplate(content, '🎉 Welcome to WorkPlus'),
      text: `Welcome! Email: ${employee.email}, Password: ${tempPassword}`
    });
  }

  static async sendPasswordResetEmail(employee, newPassword, resetBy) {
    const content = `<p>Dear <strong>${employee.name}</strong>,</p>
<p>Your password has been reset by <strong>${resetBy}</strong>.</p>
<div class="card"><h3 style="margin-top:0;color:#667eea">🔐 New Login Credentials</h3>
<div class="info-row"><span class="label">Email:</span><span class="value">${employee.email}</span></div>
<div class="info-row"><span class="label">New Password:</span><span class="value" style="font-family:monospace;background:#f0f0f0;padding:5px 10px;border-radius:4px">${newPassword}</span></div></div>
<div class="alert" style="background:#fff3cd;border-left-color:#ffc107"><strong>🔒 Security:</strong> Change this password immediately after login.</div>
<div style="text-align:center"><a href="${process.env.VITE_APP_URL || 'http://localhost:5173'}/login" class="button">🔑 Login Now</a></div>`;
    
    await this.sendEmail({
      to: employee.email,
      subject: 'Password Reset - WorkPlus HRMS',
      html: this.getEmailTemplate(content, '🔑 Password Reset'),
      text: `Your password has been reset. Email: ${employee.email}, New Password: ${newPassword}`
    });
  }
}

export default EmailNotificationService;
