import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize, requirePermission } from "../middleware/auth.js";
import { refreshTokenLimiter } from "../middleware/rateLimiter.js";
import { refreshAccessToken } from "../services/authService.js";
import SecurityEvent from "../models/SecurityEvent.js";
import AuthToken from "../models/AuthToken.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * POST /api/security/auth/refresh-token
 * Refresh access token using refresh token
 */
router.post('/auth/refresh-token', refreshTokenLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
    let userId;

    try {
      const decoded = jwt.default.verify(refreshToken, JWT_SECRET);
      if (decoded.type !== 'refresh' || !decoded.userId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Get client IP and user agent for token tracking
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Refresh the access token
    const result = await refreshAccessToken(refreshToken, userId, ipAddress, userAgent);

    logger.info('Access token refreshed successfully', { userId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn
      }
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    res.status(401).json({
      success: false,
      message: error.message || 'Failed to refresh token'
    });
  }
});

/**
 * GET /api/security/dashboard
 * Get security dashboard overview
 */
router.get("/dashboard",
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
      
      // Get security metrics
      const [
        totalEvents,
        criticalEvents,
        highRiskEvents,
        failedLogins,
        successfulLogins,
        accountLockouts,
        passwordChanges,
        twoFactorEvents,
        suspiciousActivities,
        activeUsers,
        activeSessions
      ] = await Promise.all([
        // Total security events
        SecurityEvent.countDocuments(baseFilter),
        
        // Critical events
        SecurityEvent.countDocuments({
          ...baseFilter,
          severity: 'critical'
        }),
        
        // High risk events
        SecurityEvent.countDocuments({
          ...baseFilter,
          riskScore: { $gte: 70 }
        }),
        
        // Failed logins
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: 'login_failed'
        }),
        
        // Successful logins
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: 'login_success'
        }),
        
        // Account lockouts
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: 'account_locked'
        }),
        
        // Password changes
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: 'password_change'
        }),
        
        // 2FA events
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: { $in: ['two_factor_enabled', 'two_factor_disabled'] }
        }),
        
        // Suspicious activities
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: { $in: ['suspicious_login', 'brute_force_attempt', 'unusual_activity'] }
        }),
        
        // Active users (logged in within period)
        User.countDocuments({
          lastLogin: { $gte: since },
          isActive: true,
          ...(isSystemAdmin ? {} : { orgId })
        }),
        
        // Active sessions
        AuthToken.countDocuments({
          tokenType: 'refresh',
          isActive: true,
          isRevoked: false,
          createdAt: { $gte: since },
          ...(isSystemAdmin ? {} : { orgId })
        })
      ]);
      
      // Get event trends (daily breakdown)
      const eventTrends = await SecurityEvent.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              severity: "$severity"
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.date": 1 } }
      ]);
      
      // Get top event types
      const topEventTypes = await SecurityEvent.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: "$eventType",
            count: { $sum: 1 },
            avgRiskScore: { $avg: "$riskScore" }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      // Get recent high-risk events
      const recentHighRiskEvents = await SecurityEvent.find({
        ...baseFilter,
        riskScore: { $gte: 70 }
      })
      .populate('user', 'name email')
      .select('eventType severity riskScore description createdAt user requestInfo')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
      
      // Calculate security score (0-100, higher is better)
      let securityScore = 100;
      
      if (criticalEvents > 0) securityScore -= 30;
      if (highRiskEvents > totalEvents * 0.1) securityScore -= 20; // More than 10% high risk
      if (failedLogins > successfulLogins * 0.2) securityScore -= 15; // More than 20% failure rate
      if (suspiciousActivities > 0) securityScore -= 10;
      if (accountLockouts > activeUsers * 0.05) securityScore -= 10; // More than 5% lockout rate
      
      securityScore = Math.max(0, securityScore);
      
      // Generate alerts
      const alerts = [];
      
      if (criticalEvents > 0) {
        alerts.push({
          type: 'critical_events',
          severity: 'critical',
          message: `${criticalEvents} critical security events detected`,
          count: criticalEvents
        });
      }
      
      if (highRiskEvents > totalEvents * 0.15) {
        alerts.push({
          type: 'high_risk_events',
          severity: 'high',
          message: `High number of risky events (${highRiskEvents})`,
          count: highRiskEvents
        });
      }
      
      if (failedLogins > successfulLogins) {
        alerts.push({
          type: 'failed_logins',
          severity: 'medium',
          message: `Failed logins exceed successful logins`,
          count: failedLogins
        });
      }
      
      if (suspiciousActivities > 5) {
        alerts.push({
          type: 'suspicious_activity',
          severity: 'high',
          message: `${suspiciousActivities} suspicious activities detected`,
          count: suspiciousActivities
        });
      }
      
      res.json({
        success: true,
        data: {
          overview: {
            totalEvents,
            criticalEvents,
            highRiskEvents,
            securityScore,
            period: `${days} days`
          },
          metrics: {
            authentication: {
              successfulLogins,
              failedLogins,
              accountLockouts,
              successRate: successfulLogins + failedLogins > 0 ? 
                Math.round((successfulLogins / (successfulLogins + failedLogins)) * 100) : 0
            },
            security: {
              passwordChanges,
              twoFactorEvents,
              suspiciousActivities
            },
            activity: {
              activeUsers,
              activeSessions
            }
          },
          trends: eventTrends,
          topEventTypes,
          recentHighRiskEvents,
          alerts
        }
      });
      
    } catch (error) {
      logger.error('Security dashboard error', { error: error.message, orgId });
      
      res.status(500).json({
        success: false,
        message: "Failed to load security dashboard"
      });
    }
  })
);

/**
 * GET /api/security/events
 * Get security events with filtering and pagination
 */
router.get("/events",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      severity,
      eventType,
      userId,
      startDate,
      endDate,
      minRiskScore,
      search
    } = req.query;
    
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';
    
    try {
      // Build filter
      const filter = {};
      
      if (!isSystemAdmin) {
        filter.orgId = orgId;
      }
      
      if (severity) {
        filter.severity = severity;
      }
      
      if (eventType) {
        filter.eventType = eventType;
      }
      
      if (userId) {
        filter.userId = userId;
      }
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      if (minRiskScore) {
        filter.riskScore = { $gte: parseInt(minRiskScore) };
      }
      
      if (search) {
        filter.$text = { $search: search };
      }
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Get events and total count
      const [events, totalCount] = await Promise.all([
        SecurityEvent.find(filter)
          .populate('user', 'name email')
          .populate('targetUser', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        
        SecurityEvent.countDocuments(filter)
      ]);
      
      res.json({
        success: true,
        data: {
          events,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / parseInt(limit))
          }
        }
      });
      
    } catch (error) {
      logger.error('Get security events error', { error: error.message, orgId });
      
      res.status(500).json({
        success: false,
        message: "Failed to retrieve security events"
      });
    }
  })
);

/**
 * GET /api/security/events/:eventId
 * Get detailed security event
 */
router.get("/events/:eventId",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';
    
    try {
      const filter = { _id: eventId };
      if (!isSystemAdmin) {
        filter.orgId = orgId;
      }
      
      const event = await SecurityEvent.findOne(filter)
        .populate('user', 'name email role')
        .populate('targetUser', 'name email role')
        .populate('relatedEvents')
        .lean();
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Security event not found"
        });
      }
      
      res.json({
        success: true,
        data: event
      });
      
    } catch (error) {
      logger.error('Get security event error', { error: error.message, eventId });
      
      res.status(500).json({
        success: false,
        message: "Failed to retrieve security event"
      });
    }
  })
);

/**
 * PATCH /api/security/events/:eventId/resolve
 * Resolve security event
 */
router.patch("/events/:eventId/resolve",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { resolution, notes } = req.body;
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';
    const resolvedBy = req.user.userId;
    
    try {
      const filter = { _id: eventId };
      if (!isSystemAdmin) {
        filter.orgId = orgId;
      }
      
      const event = await SecurityEvent.findOne(filter);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Security event not found"
        });
      }
      
      await event.resolve(resolvedBy, resolution, notes);
      
      logger.info('Security event resolved', {
        eventId,
        resolvedBy,
        resolution
      });
      
      res.json({
        success: true,
        message: "Security event resolved successfully",
        data: event
      });
      
    } catch (error) {
      logger.error('Resolve security event error', { error: error.message, eventId });
      
      res.status(500).json({
        success: false,
        message: "Failed to resolve security event"
      });
    }
  })
);

/**
 * GET /api/security/users/:userId/activity
 * Get user security activity
 */
router.get("/users/:userId/activity",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';
    
    try {
      // Verify user access
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      if (!isSystemAdmin && targetUser.orgId !== orgId) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
      
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Get user security events
      const securityEvents = await SecurityEvent.find({
        userId,
        createdAt: { $gte: since }
      })
      .select('eventType severity riskScore description createdAt requestInfo')
      .sort({ createdAt: -1 })
      .lean();
      
      // Get user sessions
      const sessions = await AuthToken.find({
        userId,
        tokenType: 'refresh',
        createdAt: { $gte: since }
      })
      .select('deviceInfo createdAt expiresAt isActive isRevoked')
      .sort({ createdAt: -1 })
      .lean();
      
      // Calculate activity summary
      const summary = {
        totalEvents: securityEvents.length,
        highRiskEvents: securityEvents.filter(e => e.riskScore >= 70).length,
        failedLogins: securityEvents.filter(e => e.eventType === 'login_failed').length,
        successfulLogins: securityEvents.filter(e => e.eventType === 'login_success').length,
        activeSessions: sessions.filter(s => s.isActive && !s.isRevoked).length,
        totalSessions: sessions.length
      };
      
      res.json({
        success: true,
        data: {
          user: {
            id: targetUser._id,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role
          },
          summary,
          events: securityEvents,
          sessions,
          period: `${days} days`
        }
      });
      
    } catch (error) {
      logger.error('Get user security activity error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user security activity"
      });
    }
  })
);

/**
 * GET /api/security/reports/summary
 * Generate security summary report
 */
router.get("/reports/summary",
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const orgId = req.user.orgId;
    const isSystemAdmin = req.user.role === 'super_admin';
    
    try {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      // Get comprehensive security summary
      const summary = await SecurityEvent.getSecuritySummary(
        isSystemAdmin ? null : orgId,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24))
      );
      
      // Get additional metrics
      const [userCount, sessionCount, lockedAccounts] = await Promise.all([
        User.countDocuments({
          isActive: true,
          ...(isSystemAdmin ? {} : { orgId })
        }),
        
        AuthToken.countDocuments({
          tokenType: 'refresh',
          isActive: true,
          isRevoked: false,
          ...(isSystemAdmin ? {} : { orgId })
        }),
        
        User.countDocuments({
          'security.lockUntil': { $gt: new Date() },
          ...(isSystemAdmin ? {} : { orgId })
        })
      ]);
      
      res.json({
        success: true,
        data: {
          period: {
            start,
            end,
            days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
          },
          summary: {
            ...summary,
            userCount,
            sessionCount,
            lockedAccounts
          },
          generatedAt: new Date(),
          generatedBy: {
            id: req.user.userId,
            name: req.user.name,
            role: req.user.role
          }
        }
      });
      
    } catch (error) {
      logger.error('Generate security report error', { error: error.message, orgId });
      
      res.status(500).json({
        success: false,
        message: "Failed to generate security report"
      });
    }
  })
);

export default router;