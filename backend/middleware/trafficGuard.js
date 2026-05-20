/**
 * Production traffic shaping — protects API under heavy concurrent load.
 */
import rateLimit from 'express-rate-limit';
import { getClientIP } from './rateLimiter.js';

const isProd = process.env.NODE_ENV === 'production';

const skipPaths = (req) => {
  if (!isProd && process.env.ENABLE_TRAFFIC_GUARD !== 'true') return true;
  const p = req.path || req.originalUrl || '';
  if (p.startsWith('/health')) return true;
  if (p === '/api/auth/login' || p === '/api/auth/register') return true;
  return false;
};

/** Per-IP cap for anonymous/heavy SPA traffic (behind NAT: still per IP). */
export const apiTrafficLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '2000', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  skip: skipPaths,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Server is busy. Please wait a moment and try again.',
      code: 'RATE_LIMIT',
      retryAfter: Math.ceil((req.rateLimit?.resetTime || Date.now() + 60000) / 1000),
    });
  },
});

/** Tighter cap for upload-heavy routes */
export const uploadTrafficLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  skip: () => !isProd && process.env.ENABLE_TRAFFIC_GUARD !== 'true',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many uploads. Please try again shortly.',
      code: 'UPLOAD_RATE_LIMIT',
    });
  },
});
