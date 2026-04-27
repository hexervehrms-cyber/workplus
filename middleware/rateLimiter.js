/**
 * Rate Limiting Middleware - Production Ready
 * Fixed for Render proxy compatibility
 * Prevents brute force attacks on auth endpoints
 */

import rateLimit from 'express-rate-limit';

/**
 * Get client IP from request
 * Handles Render's proxy headers correctly
 */
const getClientIP = (req) => {
  // Check for forwarded headers (Render uses X-Forwarded-For)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list
    // The first IP is the original client IP
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  // Fallback to direct connection IP
  return req.ip || req.connection.remoteAddress || 'unknown';
};

/**
 * Key generator for rate limiting
 * Uses correct IP detection for Render
 */
const keyGenerator = (req) => {
  return getClientIP(req);
};

/**
 * Skip function for development/testing
 */
const shouldSkip = () => {
  return process.env.NODE_ENV === 'test';
};

/**
 * Login rate limiter
 * Limit: 10 requests per 15 minutes per IP (increased from 5 for better UX)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  
  // Use correct key generator for proxy
  keyGenerator,
  
  // Skip in test environment
  skip: shouldSkip,
  
  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    const ip = getClientIP(req);
    console.warn(`Rate limit exceeded for login from IP: ${ip}`);
    
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
  
  // Skip successful requests (don't count them)
  skipSuccessfulRequests: false,
  
  // Count failed requests
  skipFailedRequests: false
});

/**
 * Register rate limiter
 * Limit: 5 requests per hour per IP
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: shouldSkip,
  
  handler: (req, res) => {
    const ip = getClientIP(req);
    console.warn(`Rate limit exceeded for registration from IP: ${ip}`);
    
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please try again after 1 hour.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Refresh token rate limiter
 * Limit: 20 requests per minute per IP
 */
const refreshTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: shouldSkip,
  
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many token refresh attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Password reset rate limiter
 * Limit: 5 requests per hour per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: shouldSkip,
  
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts. Please try again after 1 hour.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * General API rate limiter
 * Limit: 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: shouldSkip,
  
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Strict rate limiter for sensitive operations
 * Limit: 3 requests per hour per IP
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: shouldSkip,
  
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

export {
  loginLimiter,
  registerLimiter,
  refreshTokenLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  getClientIP
};
