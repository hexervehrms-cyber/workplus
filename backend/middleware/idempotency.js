/**
 * Idempotency Middleware
 * Prevents duplicate submissions of critical operations
 * Uses Redis-like in-memory cache with TTL
 */

import crypto from 'crypto';

// In-memory store for idempotency keys (use Redis in production)
const idempotencyStore = new Map();

// TTL for idempotency keys (24 hours)
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

/**
 * Clean up expired idempotency keys
 */
const cleanupExpiredKeys = () => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (value.expiresAt < now) {
      idempotencyStore.delete(key);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredKeys, 60 * 60 * 1000);

/**
 * Generate idempotency key from request
 * @param {Object} req - Express request object
 * @returns {string} Idempotency key
 */
const generateIdempotencyKey = (req) => {
  // Use client-provided key if available
  if (req.headers['idempotency-key']) {
    return req.headers['idempotency-key'];
  }

  // Generate key from request signature
  const signature = JSON.stringify({
    method: req.method,
    path: req.path,
    body: req.body,
    userId: req.user?._id || req.user?.id
  });

  return crypto.createHash('sha256').update(signature).digest('hex');
};

/**
 * Idempotency middleware for critical operations
 * Prevents duplicate submissions (payroll, expenses, leave approvals)
 * 
 * Usage:
 * router.post('/payroll', idempotencyMiddleware, createPayroll);
 */
export const idempotencyMiddleware = async (req, res, next) => {
  // Only apply to POST, PUT, PATCH, DELETE
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const idempotencyKey = generateIdempotencyKey(req);
  const cached = idempotencyStore.get(idempotencyKey);

  // Check if request is duplicate
  if (cached) {
    const now = Date.now();

    // Key expired, remove it
    if (cached.expiresAt < now) {
      idempotencyStore.delete(idempotencyKey);
      return next();
    }

    // Request is still processing
    if (cached.status === 'processing') {
      return res.status(409).json({
        success: false,
        message: 'Request is already being processed. Please wait.',
        idempotencyKey
      });
    }

    // Request completed, return cached response
    if (cached.status === 'completed') {
      return res.status(cached.statusCode).json(cached.response);
    }
  }

  // Mark request as processing
  idempotencyStore.set(idempotencyKey, {
    status: 'processing',
    expiresAt: Date.now() + IDEMPOTENCY_TTL,
    startedAt: Date.now()
  });

  // Intercept response to cache it
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = 200;

  res.status = (code) => {
    statusCode = code;
    return originalStatus(code);
  };

  res.json = (data) => {
    // Cache successful responses
    if (statusCode >= 200 && statusCode < 300) {
      idempotencyStore.set(idempotencyKey, {
        status: 'completed',
        statusCode,
        response: data,
        expiresAt: Date.now() + IDEMPOTENCY_TTL,
        completedAt: Date.now()
      });
    } else {
      // Remove failed requests from cache
      idempotencyStore.delete(idempotencyKey);
    }

    return originalJson(data);
  };

  // Handle errors
  const originalNext = next;
  next = (err) => {
    if (err) {
      // Remove failed requests from cache
      idempotencyStore.delete(idempotencyKey);
    }
    originalNext(err);
  };

  next();
};

/**
 * Get idempotency store stats (for monitoring)
 */
export const getIdempotencyStats = () => {
  const now = Date.now();
  let processing = 0;
  let completed = 0;
  let expired = 0;

  for (const [key, value] of idempotencyStore.entries()) {
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

/**
 * Clear idempotency store (for testing)
 */
export const clearIdempotencyStore = () => {
  idempotencyStore.clear();
};

export default idempotencyMiddleware;
