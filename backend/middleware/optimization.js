/**
 * Performance Optimization Middleware
 * Includes compression, caching, and response optimization
 */

import compression from 'compression';
import helmet from 'helmet';
import crypto from 'crypto';

/**
 * Response compression middleware
 * Compresses responses larger than 1KB
 */
export const compressionMiddleware = compression({
  level: 6, // Balance between compression ratio and CPU usage
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  }
});

/**
 * Security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://workplus-backend-sg3a.onrender.com', 'https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app', 'https://hexerve.online', 'https://www.hexerve.online'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
});

/**
 * Cache control middleware
 * Sets appropriate cache headers based on response type
 */
export const cacheControl = (req, res, next) => {
  // Don't cache API responses by default
  if (req.path.startsWith('/api')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  } else {
    // Cache static assets for 1 year
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
};

/**
 * ETag middleware for conditional requests
 * Reduces bandwidth by allowing 304 Not Modified responses
 */
export const etagMiddleware = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Generate ETag from response data
    const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    
    res.set('ETag', `"${etag}"`);
    
    // Check if client has matching ETag
    if (req.headers['if-none-match'] === `"${etag}"`) {
      return res.status(304).end();
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Response size optimization middleware
 * Removes unnecessary fields from responses
 */
export const optimizeResponse = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Remove sensitive fields from responses
    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }
      
      const sanitized = { ...obj };
      
      // Remove sensitive fields
      delete sanitized.password;
      delete sanitized.__v;
      delete sanitized.security;
      delete sanitized.loginHistory;
      
      return sanitized;
    };
    
    const sanitizedData = sanitize(data);
    return originalJson.call(this, sanitizedData);
  };
  
  next();
};

/**
 * Request timeout middleware
 * Prevents long-running requests from consuming resources
 */
export const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout',
          code: 'REQUEST_TIMEOUT'
        });
      }
    }, timeout);
    
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    
    next();
  };
};

/**
 * Query optimization middleware
 * Limits pagination and enforces best practices
 */
export const queryOptimization = (req, res, next) => {
  // Set default pagination
  req.query.page = Math.max(1, parseInt(req.query.page) || 1);
  req.query.limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  
  // Set default sort
  if (!req.query.sort) {
    req.query.sort = '-createdAt';
  }
  
  next();
};

export default {
  compressionMiddleware,
  securityHeaders,
  cacheControl,
  etagMiddleware,
  optimizeResponse,
  requestTimeout,
  queryOptimization
};
