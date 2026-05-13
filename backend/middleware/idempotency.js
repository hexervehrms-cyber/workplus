/**
 * Idempotency Middleware
 * Prevents duplicate submissions of critical operations
 * Uses Redis-like in-memory cache with TTL
 */

import crypto from 'crypto';

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
    action: req.body?.action || 'default',
    timestamp: Math.floor(Date.now() / 1000)
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
  const cached = idempotencyStore.get(idempotencyKey);

  if (cached) {
    const now = Date.now();

    if (cached.expiresAt < now) {
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

  idempotencyStore.set(idempotencyKey, {
    status: 'processing',
    expiresAt: Date.now() + PROCESSING_TTL
  });

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = res.statusCode || 200;

  res.status = (code) => {
    statusCode = code;
    return originalStatus(code);
  };

  res.json = function (data) {
    if (statusCode >= 200 && statusCode < 300) {
      idempotencyStore.set(idempotencyKey, {
        status: 'completed',
        statusCode,
        response: data,
        expiresAt: Date.now() + IDEMPOTENCY_TTL
      });
    } else {
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
