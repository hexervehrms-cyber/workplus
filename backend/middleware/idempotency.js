/**
 * Idempotency Middleware
 * Prevents duplicate submissions of critical operations.
 * Uses shared Redis client when available; in-memory fallback for single-instance dev.
 */

import crypto from 'crypto';
import redis from '../utils/redis.js';
import logger from '../utils/logger.js';

const idempotencyStore = new Map();

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;
const PROCESSING_TTL = 60 * 1000;

const cleanupExpiredKeys = () => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (value.expiresAt < now) {
      idempotencyStore.delete(key);
    }
  }
};

setInterval(cleanupExpiredKeys, 60 * 60 * 1000);

let prodFallbackWarned = false;

const redisKey = (idempotencyKey) => `idempotency:${idempotencyKey}`;

const useRedis = () => redis.isRedisConnected();

const warnProdMemoryFallback = () => {
  if (prodFallbackWarned || process.env.NODE_ENV !== 'production') return;
  prodFallbackWarned = true;
  logger.warn(
    '[idempotency] REDIS_URL not connected — using in-memory store (not safe across multiple server instances)'
  );
};

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
const generateIdempotencyKey = (req) => {
  const headerKey = req.headers['idempotency-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const bodyKey = req.body?.idempotencyKey;
  if (bodyKey && typeof bodyKey === 'string' && bodyKey.trim()) {
    return bodyKey.trim();
  }

  const signature = JSON.stringify({
    method: req.method,
    path: req.path,
    userId: req.user?.userId || req.user?._id || req.user?.id,
    body: req.body || {},
    query: req.query || {},
    headers: {
      'content-type': req.headers['content-type'] || req.headers['Content-Type'] || ''
    }
  });

  return crypto.createHash('sha256').update(signature).digest('hex');
};

const readEntry = async (idempotencyKey) => {
  if (useRedis()) {
    try {
      return await redis.get(redisKey(idempotencyKey));
    } catch (err) {
      logger.warn('[idempotency] Redis read failed, using fallback', err.message || err);
    }
  } else {
    warnProdMemoryFallback();
  }
  return idempotencyStore.get(idempotencyKey) || null;
};

const writeEntry = async (idempotencyKey, entry, ttlMs) => {
  if (useRedis()) {
    try {
      const ok = await redis.setex(
        redisKey(idempotencyKey),
        Math.max(1, Math.ceil(ttlMs / 1000)),
        entry
      );
      if (ok) return;
    } catch (err) {
      logger.warn('[idempotency] Redis write failed, using fallback', err.message || err);
    }
  } else {
    warnProdMemoryFallback();
  }
  idempotencyStore.set(idempotencyKey, entry);
};

const deleteEntry = async (idempotencyKey) => {
  if (useRedis()) {
    try {
      await redis.del(redisKey(idempotencyKey));
    } catch {
      /* ignore */
    }
  }
  idempotencyStore.delete(idempotencyKey);
};

/**
 * Idempotency middleware for critical operations (payroll, expenses, leave, breaks, etc.)
 */
export const idempotencyMiddleware = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const idempotencyKey = generateIdempotencyKey(req);
  const cached = await readEntry(idempotencyKey);

  if (cached) {
    const now = Date.now();

    if (cached.expiresAt < now) {
      await deleteEntry(idempotencyKey);
      return next();
    }

    if (cached.status === 'processing') {
      return res.status(409).json({
        success: false,
        message: 'Request is still being processed. Please wait.',
        retryAfter: 2
      });
    }

    if (cached.status === 'completed') {
      return res.status(cached.statusCode).json(cached.response);
    }
  }

  await writeEntry(
    idempotencyKey,
    {
      status: 'processing',
      expiresAt: Date.now() + PROCESSING_TTL
    },
    PROCESSING_TTL
  );

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = res.statusCode || 200;

  res.status = (code) => {
    statusCode = code;
    return originalStatus(code);
  };

  const clearProcessing = async () => {
    await deleteEntry(idempotencyKey);
  };

  res.json = async function (data) {
    if (statusCode >= 200 && statusCode < 300) {
      await writeEntry(
        idempotencyKey,
        {
          status: 'completed',
          statusCode,
          response: data,
          expiresAt: Date.now() + IDEMPOTENCY_TTL
        },
        IDEMPOTENCY_TTL
      );
    } else {
      await clearProcessing();
    }
    return originalJson(data);
  };

  res.on('finish', () => {
    if (statusCode < 200 || statusCode >= 300) {
      void clearProcessing();
    }
  });

  next();
};

export const getIdempotencyStats = () => {
  const now = Date.now();
  let processing = 0;
  let completed = 0;
  let expired = 0;

  for (const [, value] of idempotencyStore.entries()) {
    if (value.expiresAt < now) {
      expired++;
    } else if (value.status === 'processing') {
      processing++;
    } else if (value.status === 'completed') {
      completed++;
    }
  }

  return {
    total: idempotencyStore.size,
    processing,
    completed,
    expired,
    redisConnected: useRedis()
  };
};

export const clearIdempotencyStore = () => {
  idempotencyStore.clear();
};

export default idempotencyMiddleware;
