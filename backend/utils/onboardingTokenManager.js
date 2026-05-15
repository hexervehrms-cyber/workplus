/**
 * Onboarding Token Manager - JWT + Redis
 * Manages secure onboarding tokens with JWT and Redis caching
 * Each token is unique per employee and stored in Redis with TTL
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import redis from './redis.js';
import logger from './logger.js';

const ONBOARDING_TOKEN_PREFIX = 'onboarding_token:';
const ONBOARDING_SESSION_PREFIX = 'onboarding_session:';
const TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

class OnboardingTokenManager {
  /**
   * Generate a new onboarding JWT token
   * @param {object} payload - Token payload (employeeEmail, employeeName, etc.)
   * @returns {string} JWT token
   */
  static generateToken(payload) {
    try {
      const token = jwt.sign(
        {
          ...payload,
          type: 'onboarding',
          iat: Math.floor(Date.now() / 1000),
          jti: crypto.randomBytes(16).toString('hex') // Unique token ID
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      logger.info('Onboarding token generated', {
        employeeEmail: payload.employeeEmail,
        tokenPrefix: token.substring(0, 20)
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate onboarding token', {
        error: error.message,
        payload
      });
      throw error;
    }
  }

  /**
   * Verify and decode onboarding token
   * @param {string} token - JWT token to verify
   * @returns {object} Decoded token payload
   */
  static verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type !== 'onboarding') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      logger.warn('Token verification failed', {
        error: error.message,
        tokenPrefix: token.substring(0, 20)
      });
      throw error;
    }
  }

  /**
   * Store onboarding token in Redis
   * @param {string} token - JWT token
   * @param {object} data - Token data to store
   * @returns {Promise<boolean>}
   */
  static async storeToken(token, data) {
    if (!redis.isRedisConnected()) {
      logger.debug('Redis not connected - skipping token storage');
      return false;
    }

    try {
      const decoded = jwt.decode(token);
      const tokenKey = `${ONBOARDING_TOKEN_PREFIX}${decoded.jti}`;
      const sessionKey = `${ONBOARDING_SESSION_PREFIX}${data.employeeEmail}`;

      const tokenData = {
        token,
        employeeEmail: data.employeeEmail,
        employeeName: data.employeeName,
        department: data.department,
        organizationId: data.organizationId,
        organizationName: data.organizationName,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + TOKEN_TTL * 1000).toISOString(),
        isUsed: false,
        usedAt: null
      };

      // Store token with TTL
      const stored = await redis.set(tokenKey, tokenData, TOKEN_TTL);

      if (stored) {
        // Also store in session index for quick lookup by email
        await redis.set(sessionKey, { jti: decoded.jti, token }, TOKEN_TTL);

        logger.info('Onboarding token stored in Redis', {
          employeeEmail: data.employeeEmail,
          jti: decoded.jti,
          ttl: TOKEN_TTL
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to store onboarding token', {
        error: error.message,
        employeeEmail: data.employeeEmail
      });
      return false;
    }
  }

  /**
   * Get token data from Redis
   * @param {string} token - JWT token
   * @returns {Promise<object|null>}
   */
  static async getToken(token) {
    if (!redis.isRedisConnected()) {
      return null;
    }

    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.jti) {
        return null;
      }

      const tokenKey = `${ONBOARDING_TOKEN_PREFIX}${decoded.jti}`;
      const tokenData = await redis.get(tokenKey);

      if (tokenData) {
        logger.debug('Onboarding token retrieved from Redis', {
          employeeEmail: tokenData.employeeEmail,
          jti: decoded.jti
        });
      }

      return tokenData;
    } catch (error) {
      logger.warn('Failed to get onboarding token', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Mark token as used
   * @param {string} token - JWT token
   * @returns {Promise<boolean>}
   */
  static async markTokenAsUsed(token) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.jti) {
        return false;
      }

      const tokenKey = `${ONBOARDING_TOKEN_PREFIX}${decoded.jti}`;
      const tokenData = await redis.get(tokenKey);

      if (tokenData) {
        tokenData.isUsed = true;
        tokenData.usedAt = new Date().toISOString();

        await redis.set(tokenKey, tokenData, TOKEN_TTL);

        logger.info('Onboarding token marked as used', {
          employeeEmail: tokenData.employeeEmail,
          jti: decoded.jti
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to mark token as used', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Invalidate token
   * @param {string} token - JWT token
   * @returns {Promise<boolean>}
   */
  static async invalidateToken(token) {
    if (!redis.isRedisConnected()) {
      return false;
    }

    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.jti) {
        return false;
      }

      const tokenKey = `${ONBOARDING_TOKEN_PREFIX}${decoded.jti}`;
      const tokenData = await redis.get(tokenKey);

      if (tokenData) {
        const sessionKey = `${ONBOARDING_SESSION_PREFIX}${tokenData.employeeEmail}`;
        
        await redis.del(tokenKey);
        await redis.del(sessionKey);

        logger.info('Onboarding token invalidated', {
          employeeEmail: tokenData.employeeEmail,
          jti: decoded.jti
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to invalidate token', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get token by employee email
   * @param {string} employeeEmail - Employee email
   * @returns {Promise<object|null>}
   */
  static async getTokenByEmail(employeeEmail) {
    if (!redis.isRedisConnected()) {
      return null;
    }

    try {
      const sessionKey = `${ONBOARDING_SESSION_PREFIX}${employeeEmail}`;
      const sessionData = await redis.get(sessionKey);

      if (sessionData && sessionData.jti) {
        const tokenKey = `${ONBOARDING_TOKEN_PREFIX}${sessionData.jti}`;
        const tokenData = await redis.get(tokenKey);

        if (tokenData) {
          logger.debug('Onboarding token retrieved by email', {
            employeeEmail
          });
          return tokenData;
        }
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get token by email', {
        error: error.message,
        employeeEmail
      });
      return null;
    }
  }

  /**
   * Validate token is still active
   * @param {string} token - JWT token
   * @returns {Promise<boolean>}
   */
  static async isTokenValid(token) {
    try {
      // Verify JWT signature and expiration (always required)
      this.verifyToken(token);

      if (!redis.isRedisConnected()) {
        return true;
      }

      const tokenData = await this.getToken(token);

      // JWT valid but not in Redis (e.g. store failed) — still allow send-email
      if (!tokenData) {
        logger.warn('Token not found in Redis; accepting valid JWT', {
          tokenPrefix: token.substring(0, 20),
        });
        return true;
      }

      if (tokenData.isUsed) {
        logger.warn('Token already used', {
          employeeEmail: tokenData.employeeEmail,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.warn('Token validation failed', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get token statistics
   * @returns {Promise<object>}
   */
  static async getTokenStats() {
    if (!redis.isRedisConnected()) {
      return { error: 'Redis not connected' };
    }

    try {
      const tokenKeys = await redis.keys(`${ONBOARDING_TOKEN_PREFIX}*`);
      const sessionKeys = await redis.keys(`${ONBOARDING_SESSION_PREFIX}*`);

      let activeTokens = 0;
      let usedTokens = 0;

      for (const key of tokenKeys) {
        const data = await redis.get(key);
        if (data) {
          if (data.isUsed) {
            usedTokens++;
          } else {
            activeTokens++;
          }
        }
      }

      return {
        totalTokens: tokenKeys.length,
        activeTokens,
        usedTokens,
        activeSessions: sessionKeys.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get token stats', {
        error: error.message
      });
      return { error: error.message };
    }
  }
}

export default OnboardingTokenManager;
