/**
 * Employee ↔ Admin workflow notifications using org SMTP + Microsoft Teams webhooks.
 * Reads Organization.settings.integrations and notificationRouting.
 */

import mongoose from 'mongoose';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import logger from './logger.js';
import EmailNotificationService from './emailNotificationService.js';

const getFrontendUrl = () =>
  process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'https://hexerve.online';

export function buildOrganizationSmtpFromDoc(org) {
  const s = org?.settings?.integrations?.smtp;
  if (!s?.useCustom || !s.host || !s.user || !s.pass) return null;
  return {
    host: s.host,
    port: parseInt(String(s.port), 10) || 587,
    secure: !!s.secure,
    user: s.user,
    pass: s.pass,
    fromEmail: s.fromEmail || s.user,
    fromName: s.fromName || 'WorkPlus'
  };
}

/** Microsoft 365 / Outlook SMTP from environment (Render, .env). */
export function buildEnvSmtp() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return {
    host,
    port: parseInt(String(process.env.SMTP_PORT), 10) || 587,
    secure: String(process.env.SMTP_PORT) === '465',
    user,
    pass,
    fromEmail: process.env.FROM_EMAIL || user,
    fromName: process.env.SMTP_FROM_NAME || 'WorkPlus HR'
  };
}

/** HR inbox for leave/expense alerts (Outlook). */
export function getHrInboxEmail() {
  return (process.env.HR_EMAIL || 'hr@hexerve.com').trim();
}

export async function resolveOrganizationSmtp(orgId) {
  if (!orgId || orgId === 'system' || !mongoose.Types.ObjectId.isValid(String(orgId))) {
    return buildEnvSmtp();
  }
  const org = await Organization.findById(orgId).select('settings.integrations.smtp').lean();
  return buildOrganizationSmtpFromDoc(org) || buildEnvSmtp();
}

export async function postTeamsMessage(org, title, text) {
  const teams = org?.settings?.integrations?.teams;
  if (!teams?.enabled || !teams.webhookUrl?.trim()) return;
  try {
    const res = await fetch(teams.webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `**${title}**\n\n${text}`
      })
    });
    if (!res.ok) {
      logger.warn('Teams webhook non-OK response', { status: res.status, orgId: org?._id });
    }
  } catch (e) {
    logger.error('Teams webhook failed', { error: e.message, orgId: org?._id });
  }
}

async function loadOrg(orgId) {
  if (!orgId || !mongoose.Types.ObjectId.isValid(String(orgId))) return null;
  return Organization.findById(orgId).lean();
}

async function listRoutingAdmins(org) {
  const orgIdStr = String(org._id);
  const routing = org?.settings?.notificationRouting || {};
  const roles =
    Array.isArray(routing.adminRoles) && routing.adminRoles.length > 0
      ? routing.adminRoles
      : ['admin', 'hr', 'manager'];
  return User.find({
    orgId: orgIdStr,
    isActive: true,
    role: { $in: roles }
  })
    .select('_id email name notificationPreferences role')
    .lean();
}

/**
 * After employee submits leave — notify admins (in-app + email) + optional Teams.
 */
export async function notifyAdminsOnLeaveSubmitted(orgId, ctx) {
  try {
    const org = await loadOrg(orgId);
    if (!org) return;
    const routing = org.settings?.notificationRouting || {};
    if (routing.notifyAdminsOnLeaveSubmit === false) return;

    const smtp = (await resolveOrganizationSmtp(orgId)) || buildEnvSmtp();
    if (!smtp) {
      logger.warn('Leave submit email skipped: configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    }

    const { leaveRequest, employeeUserId, employeeName, employeeEmail } = ctx;
    const leaveType = leaveRequest.type || leaveRequest.leaveType || 'Leave';
    const days =
      Math.ceil(
        (new Date(leaveRequest.endDate) - new Date(leaveRequest.startDate)) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    const hrInbox = getHrInboxEmail();
    const admins = await listRoutingAdmins(org);
    const emailTargets = new Map();
    emailTargets.set(hrInbox.toLowerCase(), {
      _id: null,
      email: hrInbox,
      name: 'HR',
      notificationPreferences: {}
    });
    for (const admin of admins) {
      if (admin.email) {
        emailTargets.set(admin.email.toLowerCase(), admin);
      }
    }

    const start = new Date(leaveRequest.startDate).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const end = new Date(leaveRequest.endDate).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const htmlBody = `<p>Hello,</p>
<p><strong>${employeeName}</strong> submitted a <strong>${leaveType}</strong> leave request (${days} day(s)).</p>
<div style="margin:12px 0;padding:12px;border-left:4px solid #667eea;background:#f8f9fc">
<p style="margin:4px 0"><strong>Employee email:</strong> ${employeeEmail || '—'}</p>
<p style="margin:4px 0"><strong>Dates:</strong> ${start} → ${end}</p>
<p style="margin:4px 0"><strong>Reason:</strong> ${leaveRequest.reason || '—'}</p>
</div>
<p><a href="${getFrontendUrl()}/admin/leaves">Open leave requests in WorkPlus</a></p>`;

    for (const admin of emailTargets.values()) {
      if (admin._id) {
        await EmailNotificationService.createInAppNotification({
          title: 'New leave request',
          message: `${employeeName} submitted ${leaveType} leave (${days} day(s)).`,
          type: 'leave_request',
          priority: 'high',
          recipientId: admin._id,
          senderId: employeeUserId,
          orgId,
          actionUrl: '/admin/leaves',
          relatedEntity: { entityType: 'leave_request', entityId: leaveRequest._id }
        });
      }
      const emailOk =
        smtp && admin.email && admin.notificationPreferences?.email !== false;
      if (emailOk) {
        await EmailNotificationService.sendEmail({
          to: admin.email,
          fromName: employeeName || 'Employee',
          replyTo: employeeEmail || undefined,
          subject: `New leave request — ${employeeName}: ${leaveType} (${days} days)`,
          html: EmailNotificationService.getEmailTemplate(htmlBody, '📅 New leave request'),
          text: `${employeeName} submitted ${leaveType} leave from ${start} to ${end}.`,
          organizationSmtp: smtp
        });
      }
    }

    await postTeamsMessage(
      org,
      'New leave request',
      `**${employeeName}** · ${leaveType} · ${days} day(s) · ${start} – ${end}\nReason: ${leaveRequest.reason || '—'}`
    );
  } catch (e) {
    logger.error('notifyAdminsOnLeaveSubmitted failed', { error: e.message, orgId });
  }
}

/**
 * After employee submits expense — notify admins.
 */
export async function notifyAdminsOnExpenseSubmitted(orgId, ctx) {
  try {
    const org = await loadOrg(orgId);
    if (!org) return;
    const routing = org.settings?.notificationRouting || {};
    if (routing.notifyAdminsOnExpenseSubmit === false) return;

    const smtp = buildOrganizationSmtpFromDoc(org);
    const { expense, employeeUserId, employeeName, employeeEmail } = ctx;
    const admins = await listRoutingAdmins(org);
    const targets =
      admins.length > 0
        ? admins
        : process.env.HR_EMAIL
          ? [{ _id: null, email: process.env.HR_EMAIL, name: 'HR', notificationPreferences: {} }]
          : [];

    const amt = `₹${Number(expense.amount).toLocaleString()}`;
    const htmlBody = `<p>Hello,</p>
<p><strong>${employeeName}</strong> submitted an expense: <strong>${expense.title || expense.category}</strong> (${amt}).</p>
<p><a href="${getFrontendUrl()}/admin/expenses">Review in WorkPlus</a></p>`;

    for (const admin of targets) {
      if (admin._id) {
        await EmailNotificationService.createInAppNotification({
          title: 'New expense claim',
          message: `${employeeName} submitted ${expense.category} for ${amt}.`,
          type: 'expense_submitted',
          priority: 'high',
          recipientId: admin._id,
          senderId: employeeUserId,
          orgId,
          actionUrl: '/admin/expenses',
          relatedEntity: { entityType: 'expense', entityId: expense._id }
        });
      }
      const emailOk = admin.email && admin.notificationPreferences?.email !== false;
      if (emailOk) {
        await EmailNotificationService.sendEmail({
          to: admin.email,
          replyTo: employeeEmail,
          subject: `New expense — ${employeeName}: ${amt}`,
          html: EmailNotificationService.getEmailTemplate(htmlBody, '💳 New expense'),
          text: `${employeeName} submitted an expense ${amt}.`,
          organizationSmtp: smtp
        });
      }
    }

    await postTeamsMessage(
      org,
      'New expense claim',
      `**${employeeName}** · ${expense.title || expense.category} · ${amt}`
    );
  } catch (e) {
    logger.error('notifyAdminsOnExpenseSubmitted failed', { error: e.message, orgId });
  }
}

/**
 * Post organization announcement to Microsoft Teams webhook when enabled.
 */
export async function notifyTeamsOnAnnouncement(orgId, title, content, audienceLabel = 'All employees') {
  try {
    const org = await loadOrg(orgId);
    if (!org) return;
    await postTeamsMessage(
      org,
      `📢 ${title}`,
      `${content}\n\n_Audience: ${audienceLabel}_`
    );
  } catch (e) {
    logger.error('notifyTeamsOnAnnouncement failed', { error: e.message, orgId });
  }
}
