import express from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import Organization from '../models/Organization.js';
import logger from '../utils/logger.js';
import { invalidateSmtpTransports } from '../utils/smtpService.js';

const router = express.Router();

function sanitizeIntegrationsResponse(settings) {
  const integ = settings?.integrations || {};
  const smtp = integ.smtp || {};
  const teams = integ.teams || {};
  return {
    smtp: {
      useCustom: !!smtp.useCustom,
      host: smtp.host || '',
      port: smtp.port || 587,
      secure: !!smtp.secure,
      user: smtp.user || '',
      passConfigured: !!(smtp.pass && String(smtp.pass).length > 0),
      fromEmail: smtp.fromEmail || '',
      fromName: smtp.fromName || ''
    },
    teams: {
      enabled: !!teams.enabled,
      webhookConfigured: !!(teams.webhookUrl && String(teams.webhookUrl).trim().length > 0)
    }
  };
}

/**
 * GET /api/admin/notification-integrations
 */
router.get(
  '/notification-integrations',
  authenticate,
  authorize('admin', 'hr', 'super_admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    if (!mongoose.Types.ObjectId.isValid(String(orgId))) {
      return res.status(400).json({ success: false, message: 'Invalid organization on account' });
    }

    const org = await Organization.findById(orgId).select('settings.integrations settings.notificationRouting name').lean();
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.json({
      success: true,
      data: {
        organizationName: org.name,
        integrations: sanitizeIntegrationsResponse(org.settings),
        notificationRouting: org.settings?.notificationRouting || {}
      }
    });
  })
);

/**
 * PATCH /api/admin/notification-integrations
 */
router.patch(
  '/notification-integrations',
  authenticate,
  authorize('admin', 'hr', 'super_admin'),
  asyncHandler(async (req, res) => {
    const orgId = req.user.orgId;
    if (!mongoose.Types.ObjectId.isValid(String(orgId))) {
      return res.status(400).json({ success: false, message: 'Invalid organization on account' });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const { integrations, notificationRouting } = req.body || {};
    if (!org.settings) org.settings = {};

    if (integrations) {
      org.settings.integrations = org.settings.integrations || {};
      if (integrations.smtp) {
        const cur = org.settings.integrations.smtp || {};
        const s = integrations.smtp;
        org.settings.integrations.smtp = {
          useCustom: s.useCustom !== undefined ? !!s.useCustom : !!cur.useCustom,
          host: s.host !== undefined ? String(s.host) : cur.host || '',
          port: s.port !== undefined ? Number(s.port) || 587 : cur.port || 587,
          secure: s.secure !== undefined ? !!s.secure : !!cur.secure,
          user: s.user !== undefined ? String(s.user) : cur.user || '',
          pass:
            s.pass !== undefined && String(s.pass).length > 0
              ? String(s.pass)
              : cur.pass || '',
          fromEmail: s.fromEmail !== undefined ? String(s.fromEmail) : cur.fromEmail || '',
          fromName: s.fromName !== undefined ? String(s.fromName) : cur.fromName || ''
        };
      }
      if (integrations.teams) {
        const cur = org.settings.integrations.teams || {};
        const t = integrations.teams;
        org.settings.integrations.teams = {
          enabled: t.enabled !== undefined ? !!t.enabled : !!cur.enabled,
          webhookUrl:
            t.webhookUrl !== undefined && String(t.webhookUrl).trim().length > 0
              ? String(t.webhookUrl).trim()
              : cur.webhookUrl || ''
        };
      }
    }

    if (notificationRouting && typeof notificationRouting === 'object') {
      org.settings.notificationRouting = {
        ...(org.settings.notificationRouting || {}),
        ...notificationRouting
      };
    }

    org.markModified('settings');
    await org.save();

    if (integrations?.smtp) {
      invalidateSmtpTransports();
    }

    logger.info('Notification integrations updated', { orgId, by: req.user.userId });

    const fresh = await Organization.findById(orgId).select('settings.integrations settings.notificationRouting').lean();
    res.json({
      success: true,
      message: 'Settings saved',
      data: {
        integrations: sanitizeIntegrationsResponse(fresh.settings),
        notificationRouting: fresh.settings?.notificationRouting || {}
      }
    });
  })
);

export default router;
