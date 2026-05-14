/**
 * Session Manager - Per-Employee Session Tracking
 * Manages individual sessions for each employee with Redis
 * Prevents role confusion and ensures proper dashboard routing
 */

import redis from './redis.js';
import logger from './logger.js';

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const SESSION_TTL = 24 * 60 * 60; // 24 hours

class SessionManager {
  /**
   * Create a new session for a user
   * @param {string} userId - User ID
   * @param {string} sessionId - Unique session ID
   * @param {object} sessionData - Session data including role, orgId, etc.
   * @returns {Promise<boolean>}
   */
  static async createSession(userId, sessionId, sessionData) {
    if (!redis.isRedisConnected()) {
      logger.debug('Redis not connected - skipping session creation');
      return false;
    }

    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

      // Validate required fields
      if (!sessionData.role) {
        logger.warn('Session data missing role field', { userId, sessionId });
        return false;
      }

      const sessionPayload = {
        userId,
        sessionId,
        role: sessionData.role,
        email: sessionData.email,
        name: sessionData.name,
        orgId: sessionData.orgId || 'system',
        departmentId: sessionData.departmentId || null,
        permissions: sessionData.permissions || [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        ipAddress: sessionData.ipAddress || null,
        userAgent: sessionData.userAgent || null
      };

      // Store session with TTL
      const sessionStored = await redis.set(sessionKey, sessionPayload, SESSION_TTL);

      if (sessionStored) {
        // Add session ID to user's session list
        await redis.sadd(userSessionsKey, sessionId);
        // Set TTL on user sessions set
        await redis.expire(userSessionsKey, SESSION_TTL);

        logger.info('Session created successfully', {
          userId,
          sessionId: sessionId.substring(0, 16),
          role: sessionData.role,
          orgId: sessionData.orgId
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to create session', {
        error: error.message,
        userId,
        sessionId: sessionId.substring(0, 16)
      });
      return false;
    }
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>}
   */
  static async getSession(sessionId) {
    if (!redis.isRedisConnected()) {
      return null;
    }

    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const sessionData = await redis.get(sessionKey);

      if (sessionData) {
        // Update last activity
        sessionData.lastActivity = new Date().toISOString();
        await redis.set(sessionKey, sessionData, SESSION_TTL);
      }

      return sessionData;
    } catch (error) {
      logger.warn('Failed to get session', {
        error: error.message,
        sessionId: sessionId.substring(0, 16)
      });
      return null;
    }
  }

  /**
   * Update session activity
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  static async updateActivity(sessionId) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const sessionData = await redis.get(sessionKey);

      if (sessionData) {
        sessionData.lastActivity = new Date().toISOString();
        await redis.set(sessionKey, sessionData, SESSION_TTL);
        return true;
      }

      return false;
    } catch (error) {
      logger.warn('Failed to update session activity', {
        error: error.message,
        sessionId: sessionId.substring(0, 16)
      });
      return false;
    }
  }

  /**
   * Invalidate a specific session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  static async invalidateSession(sessionId) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const sessionData = await redis.get(sessionKey);

      if (sessionData) {
        const userId = sessionData.userId;
        const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

        // Remove session
        await redis.del(sessionKey);
        // Remove from user's session list
        await redis.srem(userSessionsKey, sessionId);

        logger.info('Session invalidated', {
          userId,
          sessionId: sessionId.substring(0, 16)
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to invalidate session', {
        error: error.message,
        sessionId: sessionId.substring(0, 16)
      });
      return false;
    }
  }

  /**
   * Invalidate all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of sessions invalidated
   */
  static async invalidateAllUserSessions(userId) {
    if (!redis.isRedisConnected()) {
      return 0;
    }

    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      const sessionIds = await redis.smembers(userSessionsKey);

      let count = 0;
      for (const sessionId of sessionIds) {
        const sessionKey = `${SESSION_PREFIX}${sessionId}`;
        await redis.del(sessionKey);
        count++;
      }

      // Clear user sessions set
      await redis.del(userSessionsKey);

      logger.info('All user sessions invalidated', {
        userId,
        count
      });

      return count;
    } catch (error) {
      logger.error('Failed to invalidate all user sessions', {
        error: error.message,
        userId
      });
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<array>}
   */
  static async getUserSessions(userId) {
    if (!redis.isRedisConnected()) {
      return [];
    }

    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      const sessionIds = await redis.smembers(userSessionsKey);

      const sessions = [];
      for (const sessionId of sessionIds) {
        const sessionKey = `${SESSION_PREFIX}${sessionId}`;
        const sessionData = await redis.get(sessionKey);
        if (sessionData) {
          sessions.push(sessionData);
        }
      }

      return sessions;
    } catch (error) {
      logger.warn('Failed to get user sessions', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Verify session role matches expected role
   * @param {string} sessionId - Session ID
   * @param {string} expectedRole - Expected role
   * @returns {Promise<boolean>}
   */
  static async verifySessionRole(sessionId, expectedRole) {
    try {
      const sessionData = await this.getSession(sessionId);

      if (!sessionData) {
        logger.warn('Session not found for role verification', {
          sessionId: sessionId.substring(0, 16)
        });
        return false;
      }

      if (sessionData.role !== expectedRole) {
        logger.warn('Session role mismatch', {
          sessionId: sessionId.substring(0, 16),
          expectedRole,
          actualRole: sessionData.role
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to verify session role', {
        error: error.message,
        sessionId: sessionId.substring(0, 16)
      });
      return false;
    }
  }

  /**
   * Get session statistics for monitoring
   * @returns {Promise<object>}
   */
  static async getSessionStats() {
    if (!redis.isRedisConnected()) {
      return { active: 0, error: 'Redis not connected' };
    }

    try {
      // Get all session keys
      const keys = await redis.keys(`${SESSION_PREFIX}*`);
      const userSessionKeys = await redis.keys(`${USER_SESSIONS_PREFIX}*`);

      const stats = {
        activeSessions: keys.length,
        activeUsers: userSessionKeys.length,
        timestamp: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get session stats', {
        error: error.message
      });
      return { error: error.message };
    }
  }
}

export default SessionManager;
