/**
 * CSRF Protection Middleware
 * Implements CSRF token validation for state-changing operations
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';

// Store for CSRF tokens (in production, use Redis)
const csrfTokens = new Map();

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (req, res, next) => {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store token with session/user ID
  const sessionId = req.sessionID || req.user?.userId || req.ip;
  csrfTokens.set(sessionId, {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  
  // Attach token to request
  req.csrfToken = token;
  
  // Set token in response header for client to use
  res.setHeader('X-CSRF-Token', token);
  
  next();
};

/**
 * Verify CSRF token
 * Checks token from request headers or body
 */
export const verifyCSRFToken = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get token from header or body
  const token = req.headers['x-csrf-token'] || req.body?.csrfToken;
  
  if (!token) {
    logger.warn('CSRF token missing', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    return res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }
  
  // Get session ID
  const sessionId = req.sessionID || req.user?.userId || req.ip;
  
  // Verify token
  const storedToken = csrfTokens.get(sessionId);
  
  if (!storedToken) {
    logger.warn('CSRF token not found in store', {
      method: req.method,
      path: req.path,
      sessionId,
      ip: req.ip
    });
    
    return res.status(403).json({
      success: false,
      message: 'CSRF token invalid or expired',
      code: 'CSRF_TOKEN_INVALID'
    });
  }
  
  // Check if token has expired
  if (storedToken.expiresAt < Date.now()) {
    csrfTokens.delete(sessionId);
    
    logger.warn('CSRF token expired', {
      method: req.method,
      path: req.path,
      sessionId,
      ip: req.ip
    });
    
    return res.status(403).json({
      success: false,
      message: 'CSRF token expired',
      code: 'CSRF_TOKEN_EXPIRED'
    });
  }
  
  // Verify token matches
  if (token !== storedToken.token) {
    logger.warn('CSRF token mismatch', {
      method: req.method,
      path: req.path,
      sessionId,
      ip: req.ip,
      providedToken: token.substring(0, 10) + '...',
      storedToken: storedToken.token.substring(0, 10) + '...'
    });
    
    return res.status(403).json({
      success: false,
      message: 'CSRF token invalid',
      code: 'CSRF_TOKEN_INVALID'
    });
  }
  
  // Token is valid, regenerate for next request
  const newToken = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, {
    token: newToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });
  
  res.setHeader('X-CSRF-Token', newToken);
  
  logger.debug('CSRF token verified successfully', {
    method: req.method,
    path: req.path,
    sessionId
  });
  
  next();
};

/**
 * Cleanup expired CSRF tokens
 * Run periodically to prevent memory leaks
 */
export const cleanupExpiredTokens = () => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [sessionId, tokenData] of csrfTokens.entries()) {
    if (tokenData.expiresAt < now) {
      csrfTokens.delete(sessionId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Cleaned up ${cleaned} expired CSRF tokens`);
  }
};

/**
 * Start periodic cleanup of expired tokens
 */
export const startCSRFCleanup = (interval = 60 * 60 * 1000) => {
  setInterval(cleanupExpiredTokens, interval);
  logger.info('CSRF token cleanup started', { interval });
};

export default {
  generateCSRFToken,
  verifyCSRFToken,
  cleanupExpiredTokens,
  startCSRFCleanup
};
