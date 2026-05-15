/**
 * JWT Cache Manager - Redis-based token caching
 * Improves performance by caching JWT verification results.
 * Logout relies on refresh/session revocation and short access TTL (no blacklist).
 */

import crypto from "crypto";
import redis from './redis.js';
import logger from './logger.js';

const TOKEN_CACHE_PREFIX = 'jwt_token:';
const USER_SESSION_PREFIX = 'user_session:';
const TOKEN_TTL = 24 * 60 * 60; // 24 hours

/** Full-token hash — NEVER use token.substring(0,20): HS256 JWTs share an identical prefix, causing cross-user cache collisions. */
function tokenFingerprint(token) {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

class JWTCache {
  /**
   * Cache a JWT token with user data
   */
  static async cacheToken(token, userId, userData, expiresIn = TOKEN_TTL) {
    if (!redis.isRedisConnected()) {
      logger.debug('Redis not connected - skipping token cache');
      return false;
    }

    try {
      const key = `${TOKEN_CACHE_PREFIX}${tokenFingerprint(token)}`;
      const cacheData = {
        userId,
        userData,
        cachedAt: new Date().toISOString(),
        expiresIn
      };

      const success = await redis.set(key, cacheData, expiresIn);
      
      if (success) {
        logger.debug('Token cached successfully', {
          userId,
          tokenPrefix: token.substring(0, 20)
        });
      }
      
      return success;
    } catch (error) {
      logger.warn('Failed to cache token', {
        error: error.message,
        userId
      });
      return false;
    }
  }

  /**
   * Get cached token data
   */
  static async getTokenCache(token) {
    if (!redis.isRedisConnected()) {
      return null;
    }

    try {
      const key = `${TOKEN_CACHE_PREFIX}${tokenFingerprint(token)}`;
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        logger.debug('Token retrieved from cache', {
          userId: cachedData.userData?.userId,
          tokenPrefix: token.substring(0, 20)
        });
      }
      
      return cachedData;
    } catch (error) {
      logger.warn('Failed to get token cache', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Cache user session data
   */
  static async cacheUserSession(userId, userData, expiresIn = TOKEN_TTL) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const key = `${USER_SESSION_PREFIX}${userId}`;
      const sessionData = {
        ...userData,
        cachedAt: new Date().toISOString()
      };

      const success = await redis.set(key, sessionData, expiresIn);
      
      if (success) {
        logger.debug('User session cached', { userId });
      }
      
      return success;
    } catch (error) {
      logger.warn('Failed to cache user session', {
        error: error.message,
        userId
      });
      return false;
    }
  }

  /**
   * Get cached user session
   */
  static async getUserSession(userId) {
    if (!redis.isRedisConnected()) {
      return null;
    }

    try {
      const key = `${USER_SESSION_PREFIX}${userId}`;
      const sessionData = await redis.get(key);
      
      if (sessionData) {
        logger.debug('User session retrieved from cache', { userId });
      }
      
      return sessionData;
    } catch (error) {
      logger.warn('Failed to get user session', {
        error: error.message,
        userId
      });
      return null;
    }
  }

  /**
   * Clear token cache
   */
  static async clearTokenCache(token) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const key = `${TOKEN_CACHE_PREFIX}${tokenFingerprint(token)}`;
      await redis.del(key);
      
      logger.debug('Token cache cleared', {
        tokenPrefix: token.substring(0, 20)
      });
      
      return true;
    } catch (error) {
      logger.warn('Failed to clear token cache', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Clear user session cache
   */
  static async clearUserSession(userId) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const key = `${USER_SESSION_PREFIX}${userId}`;
      await redis.del(key);
      
      logger.debug('User session cache cleared', { userId });
      
      return true;
    } catch (error) {
      logger.warn('Failed to clear user session', {
        error: error.message,
        userId
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats() {
    if (!redis.isRedisConnected()) {
      return { error: 'Redis not connected' };
    }

    try {
      const tokenKeys = await redis.keys(`${TOKEN_CACHE_PREFIX}*`);
      const sessionKeys = await redis.keys(`${USER_SESSION_PREFIX}*`);

      return {
        cachedTokens: tokenKeys.length,
        cachedSessions: sessionKeys.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get cache stats', {
        error: error.message
      });
      return { error: error.message };
    }
  }
}

export default JWTCache;
