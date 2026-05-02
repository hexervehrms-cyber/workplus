import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, auditLog } from "../middleware/auth.js";
import AuthToken from "../models/AuthToken.js";
import SecurityEvent from "../models/SecurityEvent.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/sessions
 * Get all active sessions for current user
 */
router.get("/",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    
    try {
      // Get all active refresh tokens (sessions) for user
      const sessions = await AuthToken.find({
        userId,
        tokenType: 'refresh',
        isActive: true,
        isRevoked: false
      })
      .select('deviceInfo createdAt expiresAt usedAt usageCount restrictions')
      .sort({ createdAt: -1 })
      .lean();
      
      // Enhance session data
      const enhancedSessions = sessions.map(session => ({
        id: session._id,
        deviceInfo: {
          deviceName: session.deviceInfo?.deviceName || 'Unknown Device',
          platform: session.deviceInfo?.platform || 'Unknown',
          browser: session.deviceInfo?.browser || 'Unknown',
          ip: session.deviceInfo?.ip || 'Unknown',
          location: session.deviceInfo?.location || {}
        },
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastUsed: session.usedAt || session.createdAt,
        usageCount: session.usageCount || 0,
        isCurrent: false, // Will be determined by comparing tokens
        restrictions: session.restrictions || {}
      }));
      
      res.json({
        success: true,
        data: {
          sessions: enhancedSessions,
          total: enhancedSessions.length
        }
      });
      
    } catch (error) {
      logger.error('Get sessions error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Failed to retrieve sessions"
      });
    }
  })
);

/**
 * DELETE /api/sessions/:sessionId
 * Revoke a specific session
 */
router.delete("/:sessionId",
  authenticate,
  auditLog('revoke_session', 'auth'),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.userId;
    
    try {
      // Find the session
      const session = await AuthToken.findOne({
        _id: sessionId,
        userId,
        tokenType: 'refresh',
        isActive: true,
        isRevoked: false
      });
      
      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session not found or already revoked"
        });
      }
      
      // Revoke the session
      await session.revoke(userId, 'user_request');
      
      // Log security event
      await SecurityEvent.createEvent({
        eventType: 'token_revoked',
        severity: 'low',
        userId: userId,
        description: 'User revoked session',
        details: { 
          sessionId: sessionId,
          deviceInfo: session.deviceInfo 
        },
        requestInfo: { 
          ip: req.ip, 
          userAgent: req.get('User-Agent') 
        },
        orgId: req.user.orgId
      });
      
      res.json({
        success: true,
        message: "Session revoked successfully"
      });
      
    } catch (error) {
      logger.error('Revoke session error', { error: error.message, userId, sessionId });
      
      res.status(500).json({
        success: false,
        message: "Failed to revoke session"
      });
    }
  })
);

/**
 * DELETE /api/sessions/all
 * Revoke all sessions except current one
 */
router.delete("/all",
  authenticate,
  auditLog('revoke_all_sessions', 'auth'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { keepCurrent = true } = req.body;
    
    try {
      let revokedCount = 0;
      
      if (keepCurrent) {
        // Get current session token from header
        const authHeader = req.headers.authorization;
        const currentToken = authHeader ? authHeader.substring(7) : null;
        
        if (currentToken) {
          // Find current session to exclude it
          const currentSession = await AuthToken.findByToken(currentToken);
          
          if (currentSession) {
            // Revoke all sessions except current
            const result = await AuthToken.updateMany(
              {
                userId,
                tokenType: 'refresh',
                isActive: true,
                isRevoked: false,
                _id: { $ne: currentSession._id }
              },
              {
                $set: {
                  isRevoked: true,
                  isActive: false,
                  revokedAt: new Date(),
                  revokedBy: userId,
                  revokedReason: 'user_request'
                }
              }
            );
            
            revokedCount = result.modifiedCount;
          } else {
            // Current session not found, revoke all
            const result = await AuthToken.updateMany(
              {
                userId,
                tokenType: 'refresh',
                isActive: true,
                isRevoked: false
              },
              {
                $set: {
                  isRevoked: true,
                  isActive: false,
                  revokedAt: new Date(),
                  revokedBy: userId,
                  revokedReason: 'user_request'
                }
              }
            );
            
            revokedCount = result.modifiedCount;
          }
        } else {
          // No current token, revoke all
          const result = await AuthToken.updateMany(
            {
              userId,
              tokenType: 'refresh',
              isActive: true,
              isRevoked: false
            },
            {
              $set: {
                isRevoked: true,
                isActive: false,
                revokedAt: new Date(),
                revokedBy: userId,
                revokedReason: 'user_request'
              }
            }
          );
          
          revokedCount = result.modifiedCount;
        }
      } else {
        // Revoke ALL sessions including current
        const result = await AuthToken.updateMany(
          {
            userId,
            tokenType: 'refresh',
            isActive: true,
            isRevoked: false
          },
          {
            $set: {
              isRevoked: true,
              isActive: false,
              revokedAt: new Date(),
              revokedBy: userId,
              revokedReason: 'user_request'
            }
          }
        );
        
        revokedCount = result.modifiedCount;
      }
      
      // Log security event
      await SecurityEvent.createEvent({
        eventType: 'token_revoked',
        severity: 'medium',
        userId: userId,
        description: `User revoked ${revokedCount} sessions`,
        details: { 
          revokedCount,
          keepCurrent 
        },
        requestInfo: { 
          ip: req.ip, 
          userAgent: req.get('User-Agent') 
        },
        orgId: req.user.orgId
      });
      
      res.json({
        success: true,
        message: `${revokedCount} sessions revoked successfully`,
        data: {
          revokedCount,
          keepCurrent
        }
      });
      
    } catch (error) {
      logger.error('Revoke all sessions error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Failed to revoke sessions"
      });
    }
  })
);

/**
 * GET /api/sessions/security-summary
 * Get security summary for user sessions
 */
router.get("/security-summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    
    try {
      // Get session statistics
      const [activeSessions, recentSessions, suspiciousSessions] = await Promise.all([
        // Active sessions count
        AuthToken.countDocuments({
          userId,
          tokenType: 'refresh',
          isActive: true,
          isRevoked: false
        }),
        
        // Sessions created in last 7 days
        AuthToken.countDocuments({
          userId,
          tokenType: 'refresh',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        
        // Sessions with high risk factors (multiple IPs, unusual locations, etc.)
        AuthToken.find({
          userId,
          tokenType: 'refresh',
          isActive: true,
          $or: [
            { 'deviceInfo.ip': { $regex: /^(?!192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/ } }, // Non-private IPs
            { usageCount: { $gt: 100 } }, // High usage
            { createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Old sessions
          ]
        }).countDocuments()
      ]);
      
      // Get recent security events
      const recentSecurityEvents = await SecurityEvent.find({
        userId,
        eventType: { $in: ['login_success', 'login_failed', 'token_revoked', 'suspicious_login'] },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
      .select('eventType severity createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
      
      // Calculate risk score
      let riskScore = 0;
      
      if (activeSessions > 5) riskScore += 20;
      if (suspiciousSessions > 0) riskScore += 30;
      if (recentSecurityEvents.some(e => e.eventType === 'login_failed')) riskScore += 25;
      if (recentSecurityEvents.some(e => e.severity === 'high')) riskScore += 40;
      
      riskScore = Math.min(100, riskScore);
      
      // Generate recommendations
      const recommendations = [];
      
      if (activeSessions > 5) {
        recommendations.push({
          type: 'too_many_sessions',
          priority: 'medium',
          message: 'You have many active sessions. Consider revoking unused ones.'
        });
      }
      
      if (suspiciousSessions > 0) {
        recommendations.push({
          type: 'suspicious_sessions',
          priority: 'high',
          message: 'Some sessions show suspicious activity. Review and revoke if necessary.'
        });
      }
      
      if (recentSecurityEvents.some(e => e.eventType === 'login_failed')) {
        recommendations.push({
          type: 'failed_logins',
          priority: 'medium',
          message: 'Recent failed login attempts detected. Ensure your password is secure.'
        });
      }
      
      res.json({
        success: true,
        data: {
          summary: {
            activeSessions,
            recentSessions,
            suspiciousSessions,
            riskScore,
            riskLevel: riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high'
          },
          recentEvents: recentSecurityEvents,
          recommendations
        }
      });
      
    } catch (error) {
      logger.error('Get security summary error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Failed to get security summary"
      });
    }
  })
);

export default router;