/**
 * Idempotency Middleware
 * Prevents duplicate submissions of critical operations
 * Uses Redis-like in-memory cache with TTL
 */

import crypto from 'crypto';

const idempotencyStore = new Map();
let redisClient = null;
let redisEnabled = false;

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

const getRedisClient = async () => {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
      console.warn('[idempotency] Redis client error', err);
      redisEnabled = false;
      redisClient = null;
    });
    await redisClient.connect();
    redisEnabled = true;
    return redisClient;
  } catch (err) {
    console.warn('[idempotency] Redis unavailable, falling back to in-memory cache', err?.message || err);
    redisEnabled = false;
    redisClient = null;
    return null;
  }
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

/**
 * Idempotency middleware for critical operations (payroll, expenses, leave, breaks, etc.)
 */
export const idempotencyMiddleware = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const idempotencyKey = generateIdempotencyKey(req);
  const redis = await getRedisClient();

  let cached = null;
  if (redis) {
    try {
      const raw = await redis.get(`idempotency:${idempotencyKey}`);
      cached = raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[idempotency] Redis read failed, using fallback', err.message || err);
      cached = idempotencyStore.get(idempotencyKey);
    }
  } else {
    cached = idempotencyStore.get(idempotencyKey);
  }

  if (cached) {
    const now = Date.now();

    if (cached.expiresAt < now) {
      if (redis) await redis.del(`idempotency:${idempotencyKey}`);
      idempotencyStore.delete(idempotencyKey);
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

  const entry = {
    status: 'processing',
    expiresAt: Date.now() + PROCESSING_TTL
  };

  if (redis) {
    try {
      await redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(entry), {
        PX: PROCESSING_TTL,
        NX: true
      });
    } catch (err) {
      console.warn('[idempotency] Redis write failed, using fallback', err.message || err);
      idempotencyStore.set(idempotencyKey, entry);
    }
  } else {
    idempotencyStore.set(idempotencyKey, entry);
  }

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = res.statusCode || 200;

  res.status = (code) => {
    statusCode = code;
    return originalStatus(code);
  };

  res.json = async function (data) {
    if (statusCode >= 200 && statusCode < 300) {
      const entry = {
        status: 'completed',
        statusCode,
        response: data,
        expiresAt: Date.now() + IDEMPOTENCY_TTL
      };
      if (redis) {
        try {
          await redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(entry), {
            PX: IDEMPOTENCY_TTL,
            NX: false
          });
        } catch (err) {
          console.warn('[idempotency] Redis write failed, using fallback', err.message || err);
          idempotencyStore.set(idempotencyKey, entry);
        }
      } else {
        idempotencyStore.set(idempotencyKey, entry);
      }
    } else {
      if (redis) {
        try {
          await redis.del(`idempotency:${idempotencyKey}`);
        } catch {
          /* ignore */
        }
      }
      idempotencyStore.delete(idempotencyKey);
    }
    return originalJson(data);
  };

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
    expired
  };
};

export const clearIdempotencyStore = () => {
  idempotencyStore.clear();
};

export default idempotencyMiddleware;
