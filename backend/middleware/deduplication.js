/**
 * Request Deduplication Middleware
 * Prevents duplicate POST/PUT/DELETE within a short window.
 * Uses shared Redis when connected; in-memory fallback for single-instance dev.
 */

import crypto from 'crypto';
import redis from '../utils/redis.js';
import logger from '../utils/logger.js';

const requestCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_TTL_SEC = Math.ceil(CACHE_TTL_MS / 1000);

const redisKey = (fingerprint) => `dedupe:${fingerprint}`;

const generateFingerprint = (req) => {
  const data = {
    userId: req.user?.userId,
    method: req.method,
    path: req.path,
    body: JSON.stringify(req.body),
    timestamp: Math.floor(Date.now() / 1000)
  };

  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

const readCached = async (fingerprint) => {
  if (redis.isRedisConnected()) {
    try {
      return await redis.get(redisKey(fingerprint));
    } catch (err) {
      logger.warn('[dedupe] Redis read failed', { error: err.message });
    }
  }
  const entry = requestCache.get(fingerprint);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    requestCache.delete(fingerprint);
    return null;
  }
  return entry;
};

const writeCached = async (fingerprint, statusCode, response) => {
  const entry = { statusCode, response, timestamp: Date.now() };
  if (redis.isRedisConnected()) {
    try {
      await redis.setex(redisKey(fingerprint), CACHE_TTL_SEC, entry);
      return;
    } catch (err) {
      logger.warn('[dedupe] Redis write failed', { error: err.message });
    }
  }
  requestCache.set(fingerprint, entry);
};

export const deduplicationMiddleware = async (req, res, next) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  if (!req.user?.userId) {
    return next();
  }

  const fingerprint = generateFingerprint(req);
  const cached = await readCached(fingerprint);

  if (cached) {
    logger.warn('Duplicate request detected', {
      userId: req.user.userId,
      method: req.method,
      path: req.path
    });
    return res.status(cached.statusCode).json(cached.response);
  }

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void writeCached(fingerprint, res.statusCode, data);
    }
    return originalJson(data);
  };

  next();
};

export const startCacheCleanup = (interval = 60000) => {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of requestCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        requestCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired dedupe cache entries`);
    }
  }, interval);
};

export default {
  deduplicationMiddleware,
  startCacheCleanup
};
