/**
 * Request Deduplication Middleware
 * Prevents duplicate requests from being processed multiple times
 * Useful for preventing double-submissions and race conditions
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';

// In-memory cache for request deduplication
// In production, use Redis for distributed systems
const requestCache = new Map();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Generate request fingerprint
 */
const generateFingerprint = (req) => {
  const data = {
    userId: req.user?.userId,
    method: req.method,
    path: req.path,
    body: JSON.stringify(req.body),
    timestamp: Math.floor(Date.now() / 1000) // Group by second
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
};

/**
 * Deduplication middleware
 * Prevents duplicate requests within a short time window
 */
export const deduplicationMiddleware = (req, res, next) => {
  // Only apply to POST, PUT, DELETE requests
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Skip if no user (public endpoints)
  if (!req.user?.userId) {
    return next();
  }

  const fingerprint = generateFingerprint(req);

  // Check if request was recently processed
  if (requestCache.has(fingerprint)) {
    const cached = requestCache.get(fingerprint);

    logger.warn('Duplicate request detected', {
      userId: req.user.userId,
      method: req.method,
      path: req.path,
      fingerprint
    });

    // Return cached response
    return res.status(cached.statusCode).json(cached.response);
  }

  // Store original res.json to intercept response
  const originalJson = res.json;

  res.json = function(data) {
    // Cache successful responses (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      requestCache.set(fingerprint, {
        statusCode: res.statusCode,
        response: data,
        timestamp: Date.now()
      });

      // Clean up cache after TTL
      setTimeout(() => {
        requestCache.delete(fingerprint);
      }, CACHE_TTL);

      logger.debug('Request cached for deduplication', {
        fingerprint,
        ttl: CACHE_TTL
      });
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Clean up old cache entries periodically
 */
export const startCacheCleanup = (interval = 60000) => {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of requestCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        requestCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }, interval);
};

export default {
  deduplicationMiddleware,
  startCacheCleanup
};
