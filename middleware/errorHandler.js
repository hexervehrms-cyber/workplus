/**
 * Centralized Error Handler Middleware
 * Handles all errors and logs them securely
 */

import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique request ID for tracing
 */
const generateRequestId = () => {
  return uuidv4();
};

/**
 * Sanitize error message to prevent sensitive data leakage
 */
const sanitizeErrorMessage = (error) => {
  const message = error.message || 'An unexpected error occurred';
  
  // Remove sensitive patterns
  const sensitivePatterns = [
    /password/gi,
    /token/gi,
    /secret/gi,
    /api[_-]?key/gi,
    /authorization/gi,
    /bearer/gi,
    /mongodb/gi,
    /connection/gi
  ];

  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
};

/**
 * Extract relevant error information for logging
 */
const extractErrorInfo = (error, req) => {
  return {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  };
};

/**
 * Centralized error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  try {
    // Generate request ID for tracing
    const requestId = req.requestId || generateRequestId();
    req.requestId = requestId;

    // Extract error information
    const errorInfo = extractErrorInfo(err, req);
    errorInfo.requestId = requestId;

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Log the error with full details (internal logging)
    if (statusCode >= 500) {
      logger.error('Server Error', {
        ...errorInfo,
        requestId
      });
    } else if (statusCode >= 400) {
      logger.warn('Client Error', {
        ...errorInfo,
        requestId
      });
    } else {
      logger.info('Error', {
        ...errorInfo,
        requestId
      });
    }

    // Prepare response message (sanitized for client)
    const clientMessage = sanitizeErrorMessage(err);

    // Send standardized error response
    res.status(statusCode).json({
      success: false,
      message: clientMessage,
      requestId: requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  } catch (handlerError) {
    // Fallback error handler
    console.error('Error handler failed:', handlerError);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
};

/**
 * Request ID middleware - adds unique ID to each request for tracing
 */
const requestIdMiddleware = (req, res, next) => {
  req.requestId = generateRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Async error wrapper - wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export { errorHandler, requestIdMiddleware, asyncHandler };
