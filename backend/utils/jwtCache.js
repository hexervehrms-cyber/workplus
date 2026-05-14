/**
 * JWT Token Cache Manager
 * Caches JWT tokens and user sessions in Redis for performance
 * Reduces database queries and improves authentication speed
 */

import redis from './redis.js';
import logger from './logger.js';

const TOKEN_CACHE_PREFIX = 'jwt:token:';
const USER_SESSION_PREFIX = 'session:user:';
const BLACKLIST_PREFIX = 'jwt:blacklist:';
const TOKEN_TTL = 24 * 60 * 60; // 24 hours
const SESSION_TTL = 24 * 60 * 60; // 24 hours
const BLACKLIST_TTL = 24 * 60 * 60; // 24 hours

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
      const key = `${TOKEN_CACHE_PREFIX}${token.substring(0, 20)}`;
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
      const key = `${TOKEN_CACHE_PREFIX}${token.substring(0, 20)}`;
      const cached = await redis.get(key);
      
      if (cached) {
        logger.debug('Token cache hit', {
          userId: cached.userId,
          tokenPrefix: token.substring(0, 20)
        });
      }
      
      return cached;
    } catch (error) {
      logger.warn('Failed to get token cache', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Cache user session
   */
  static async cacheUserSession(userId, sessionData, expiresIn = SESSION_TTL) {
    if (!redis.isRedisConnected()) {
      logger.debug('Redis not connected - skipping session cache');
      return false;
    }

    try {
      const key = `${USER_SESSION_PREFIX}${userId}`;
      const cacheData = {
        userId,
        ...sessionData,
        cachedAt: new Date().toISOString()
      };

      const success = await redis.set(key, cacheData, expiresIn);
      
      if (success) {
        logger.debug('User session cached', {
          userId,
          role: sessionData.role,
          orgId: sessionData.orgId
        });
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
      const cached = await redis.get(key);
      
      if (cached) {
        logger.debug('User session cache hit', {
          userId,
          role: cached.role
        });
      }
      
      return cached;
    } catch (error) {
      logger.warn('Failed to get user session', {
        error: error.message,
        userId
      });
      return null;
    }
  }

  /**
   * Invalidate token (add to blacklist)
   */
  static async invalidateToken(token, expiresIn = BLACKLIST_TTL) {
    if (!redis.isRedisConnected()) {
      logger.debug('Redis not connected - skipping token blacklist');
      return false;
    }

    try {
      const key = `${BLACKLIST_PREFIX}${token.substring(0, 20)}`;
      const success = await redis.set(key, { blacklistedAt: new Date().toISOString() }, expiresIn);
      
      if (success) {
        logger.debug('Token blacklisted', {
          tokenPrefix: token.substring(0, 20)
        });
      }
      
      return success;
    } catch (error) {
      logger.warn('Failed to blacklist token', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   */
  static async isTokenBlacklisted(token) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const key = `${BLACKLIST_PREFIX}${token.substring(0, 20)}`;
      const blacklisted = await redis.get(key);
      
      if (blacklisted) {
        logger.debug('Token is blacklisted', {
          tokenPrefix: token.substring(0, 20)
        });
      }
      
      return !!blacklisted;
    } catch (error) {
      logger.warn('Failed to check token blacklist', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Invalidate user session
   */
  static async invalidateUserSession(userId) {
    if (!redis.isRedisConnected()) {
      logger.debug('Redis not connected - skipping session invalidation');
      return false;
    }

    try {
      const key = `${USER_SESSION_PREFIX}${userId}`;
      const success = await redis.del(key);
      
      if (success) {
        logger.debug('User session invalidated', { userId });
      }
      
      return success;
    } catch (error) {
      logger.warn('Failed to invalidate user session', {
        error: error.message,
        userId
      });
      return false;
    }
  }

  /**
   * Clear all JWT caches (for maintenance)
   */
  static async clearAllCaches() {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const patterns = [
        `${TOKEN_CACHE_PREFIX}*`,
        `${USER_SESSION_PREFIX}*`,
        `${BLACKLIST_PREFIX}*`
      ];

      for (const pattern of patterns) {
        await redis.deletePattern(pattern);
      }
      
      logger.info('All JWT caches cleared');
      return true;
    } catch (error) {
      logger.warn('Failed to clear JWT caches', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats() {
    if (!redis.isRedisConnected()) {
      return null;
    }

    try {
      // This is a simplified version - in production you'd use Redis INFO command
      return {
        status: 'connected',
        timestamp: new Date().toISOString(),
        note: 'Use Redis CLI for detailed cache statistics'
      };
    } catch (error) {
      logger.warn('Failed to get cache stats', {
        error: error.message
      });
      return null;
    }
  }
}

export default JWTCache;
