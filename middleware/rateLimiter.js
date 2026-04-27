/**
 * Rate Limiting Middleware
 * Prevents brute force attacks on auth endpoints
 */

import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter
 * Limit: 5 requests per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req, res) => {
    // Skip rate limiting for test requests
    return process.env.NODE_ENV === 'test';
  },
  keyGenerator: (req, res) => {
    // Use IP address as key
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Register rate limiter
 * Limit: 3 requests per hour per IP
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per windowMs
  message: 'Too many registration attempts. Please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for test requests
    return process.env.NODE_ENV === 'test';
  },
  keyGenerator: (req, res) => {
    // Use IP address as key
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please try again after 1 hour.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Refresh token rate limiter
 * Limit: 10 requests per minute per IP
 */
const refreshTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per windowMs
  message: 'Too many token refresh attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    return process.env.NODE_ENV === 'test';
  },
  keyGenerator: (req, res) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many token refresh attempts. Please try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Password reset rate limiter
 * Limit: 3 requests per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per windowMs
  message: 'Too many password reset attempts. Please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    return process.env.NODE_ENV === 'test';
  },
  keyGenerator: (req, res) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts. Please try again after 1 hour.',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

export {
  loginLimiter,
  registerLimiter,
  refreshTokenLimiter,
  passwordResetLimiter
};
