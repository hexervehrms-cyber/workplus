/**
 * Centralized Error Handler Middleware - Production Grade
 * Handles all error types with proper logging and client responses
 */

import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom error classes for better error handling
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 503, 'DATABASE_ERROR');
  }
}

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
    /password[=:]\s*\S+/gi,
    /token[=:]\s*\S+/gi,
    /secret[=:]\s*\S+/gi,
    /api[_-]?key[=:]\s*\S+/gi,
    /authorization[=:]\s*\S+/gi,
    /bearer\s+\S+/gi,
    /mongodb(\+srv)?:\/\/[^\s]+/gi,
    /connectionstring[=:]\s*\S+/gi,
  ];

  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
};

/**
 * Handle MongoDB specific errors
 */
const handleMongoError = (err) => {
  // Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${messages.join(', ')}`
    };
  }

  // Cast Error (invalid ObjectId)
  if (err.name === 'CastError') {
    return {
      statusCode: 400,
      code: 'INVALID_ID',
      message: `Invalid ${err.path}: ${err.value}`
    };
  }

  // Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return {
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: `Duplicate value for ${field}. This ${field} already exists.`
    };
  }

  // Network Error
  if (err.name === 'MongoNetworkError' || err.name === 'MongoNetworkTimeoutError') {
    return {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database temporarily unavailable. Please try again later.'
    };
  }

  // Connection Error
  if (err.name === 'MongoNotConnectedError') {
    return {
      statusCode: 503,
      code: 'DATABASE_NOT_CONNECTED',
      message: 'Database connection not established. Please try again later.'
    };
  }

  // Server Selection Error
  if (err.name === 'MongooseServerSelectionError') {
    return {
      statusCode: 503,
      code: 'DATABASE_SERVER_SELECTION',
      message: 'Unable to connect to database server. Please try again later.'
    };
  }

  return null;
};

/**
 * Handle JWT specific errors
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid authentication token'
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired'
    };
  }

  if (err.name === 'NotBeforeError') {
    return {
      statusCode: 401,
      code: 'TOKEN_NOT_ACTIVE',
      message: 'Authentication token is not yet active'
    };
  }

  return null;
};

/**
 * Handle Multer file upload errors
 */
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return {
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
      message: 'File size exceeds the maximum allowed limit (5MB)'
    };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return {
      statusCode: 400,
      code: 'TOO_MANY_FILES',
      message: 'Too many files uploaded at once'
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return {
      statusCode: 400,
      code: 'UNEXPECTED_FILE',
      message: 'Unexpected file field in upload'
    };
  }

  if (err.code === 'LIMIT_PART_COUNT') {
    return {
      statusCode: 400,
      code: 'TOO_MANY_PARTS',
      message: 'Too many parts in the form'
    };
  }

  return null;
};

/**
 * Extract relevant error information for logging
 */
const extractErrorInfo = (error, req) => {
  return {
    message: error.message,
    code: error.code || 'UNKNOWN',
    stack: error.stack,
    statusCode: error.statusCode || error.status || 500,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
    body: req.body ? JSON.stringify(req.body).substring(0, 500) : undefined
  };
};

/**
 * Centralized error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  try {
    // Generate request ID for tracing
    const requestId = req.requestId || generateRequestId();
    req.requestId = requestId;

    // Extract error information
    const errorInfo = extractErrorInfo(err, req);
    errorInfo.requestId = requestId;

    // Determine status code and error details
    let statusCode = err.statusCode || err.status || 500;
    let errorCode = err.code || 'INTERNAL_ERROR';
    let errorMessage = err.message || 'An unexpected error occurred';

    // Handle specific error types
    const mongoError = handleMongoError(err);
    if (mongoError) {
      statusCode = mongoError.statusCode;
      errorCode = mongoError.code;
      errorMessage = mongoError.message;
    }

    const jwtError = handleJWTError(err);
    if (jwtError) {
      statusCode = jwtError.statusCode;
      errorCode = jwtError.code;
      errorMessage = jwtError.message;
    }

    const multerError = err.name === 'MulterError' ? handleMulterError(err) : null;
    if (multerError) {
      statusCode = multerError.statusCode;
      errorCode = multerError.code;
      errorMessage = multerError.message;
    }

    // Handle CORS errors
    if (err.message && err.message.includes('CORS')) {
      statusCode = 403;
      errorCode = 'CORS_ERROR';
      errorMessage = 'Request blocked by CORS policy';
    }

    // Log the error with appropriate level
    if (statusCode >= 500) {
      logger.error('Server Error', errorInfo);
    } else if (statusCode >= 400) {
      logger.warn('Client Error', errorInfo);
    } else {
      logger.info('Error', errorInfo);
    }

    // Prepare response message (sanitized for client)
    const clientMessage = statusCode >= 500 
      ? 'An unexpected error occurred. Please try again later.'
      : sanitizeErrorMessage(err);

    // Send standardized error response
    res.status(statusCode).json({
      success: false,
      message: clientMessage,
      code: errorCode,
      requestId: requestId,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: errorInfo 
      })
    });
  } catch (handlerError) {
    // Fallback error handler
    console.error('Error handler failed:', handlerError);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
      code: 'HANDLER_ERROR'
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

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

export {
  errorHandler,
  requestIdMiddleware,
  asyncHandler,
  notFoundHandler,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  DatabaseError
};
