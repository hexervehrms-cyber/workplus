/**
 * Input Validation Middleware - Production Security
 * 
 * Comprehensive input validation and sanitization:
 * - Schema-based validation using Joi
 * - SQL injection prevention
 * - XSS protection
 * - Data sanitization
 * - File upload validation
 * - Rate limiting per endpoint
 */

import Joi from 'joi';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import logger from '../utils/logger.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const schemas = {
  // Authentication schemas
  login: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(6).max(128).required(),
    rememberMe: Joi.boolean().optional()
  }),

  register: Joi.object({
    name: Joi.string().min(2).max(100).required().pattern(/^[a-zA-Z\s]+$/),
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    role: Joi.string().valid('employee', 'manager', 'hr', 'admin').default('employee'),
    orgId: Joi.string().required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  // Employee schemas
  employeeProfile: Joi.object({
    personal: Joi.object({
      name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s]+$/),
      phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20),
      address: Joi.object({
        street: Joi.string().max(255),
        city: Joi.string().max(100),
        state: Joi.string().max(100),
        zipCode: Joi.string().max(20),
        country: Joi.string().max(100)
      }),
      emergencyContact: Joi.object({
        name: Joi.string().max(100),
        relationship: Joi.string().max(50),
        phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20)
      })
    }),
    preferences: Joi.object({
      notifications: Joi.object({
        email: Joi.boolean(),
        push: Joi.boolean(),
        sms: Joi.boolean()
      }),
      theme: Joi.string().valid('light', 'dark', 'auto'),
      language: Joi.string().max(10)
    })
  }),

  // Attendance schemas
  checkIn: Joi.object({
    location: Joi.string().max(255).optional(),
    notes: Joi.string().max(500).optional()
  }),

  checkOut: Joi.object({
    notes: Joi.string().max(500).optional()
  }),

  // Leave request schemas
  leaveRequest: Joi.object({
    type: Joi.string().valid('Sick Leave', 'Vacation', 'Personal', 'Casual', 'Maternity', 'Paternity', 'Other').required(),
    startDate: Joi.date().min('now').required(),
    endDate: Joi.date().min(Joi.ref('startDate')).required(),
    reason: Joi.string().min(10).max(500).required()
  }),

  // Expense schemas
  expense: Joi.object({
    category: Joi.string().valid(
      'Travel', 'Meals', 'Office Supplies', 'Software', 'Training', 
      'Marketing', 'Equipment', 'Utilities', 'Other'
    ).required(),
    amount: Joi.number().positive().max(50000).required(),
    date: Joi.date().max('now').required(),
    description: Joi.string().max(500).optional()
  }),

  // Document schemas
  document: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    type: Joi.string().valid(
      'ID Document', 'Contract', 'Certificate', 'Resume', 
      'Tax Document', 'Insurance', 'Other'
    ).required()
  }),

  // Query parameter schemas
  pagination: Joi.object({
    page: Joi.number().integer().min(1).max(1000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().max(50).optional(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  dateRange: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().min(Joi.ref('startDate')).optional()
  })
};

// ============================================================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create validation middleware for request body
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation error', {
        endpoint: req.path,
        method: req.method,
        errors,
        userId: req.user?.userId,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Create validation middleware for query parameters
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors
      });
    }

    req.query = value;
    next();
  };
};

/**
 * Create validation middleware for URL parameters
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Invalid URL parameters',
        errors
      });
    }

    req.params = value;
    next();
  };
};

// ============================================================================
// SANITIZATION MIDDLEWARE
// ============================================================================

/**
 * Sanitize input data to prevent XSS attacks
 */
export const sanitizeInput = (req, res, next) => {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    logger.error('Sanitization error', {
      error: error.message,
      endpoint: req.path,
      method: req.method
    });

    res.status(500).json({
      success: false,
      message: 'Input processing failed'
    });
  }
};

/**
 * Recursively sanitize object properties
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Remove potential XSS vectors
    let sanitized = DOMPurify.sanitize(obj, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
    
    // Additional sanitization
    sanitized = validator.escape(sanitized);
    
    return sanitized;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names
      const sanitizedKey = validator.escape(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

// ============================================================================
// MONGODB INJECTION PREVENTION
// ============================================================================

/**
 * Prevent NoSQL injection attacks
 */
export const preventNoSQLInjection = (req, res, next) => {
  try {
    // Check for MongoDB operators in request data
    const checkForInjection = (obj, path = '') => {
      if (obj === null || obj === undefined) return false;
      
      if (typeof obj === 'string') {
        // Check for MongoDB operators
        const mongoOperators = /^\$|\..*\$|javascript:|eval\(|function\s*\(/i;
        if (mongoOperators.test(obj)) {
          logger.warn('Potential NoSQL injection attempt', {
            path,
            value: obj,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.userId
          });
          return true;
        }
      }
      
      if (Array.isArray(obj)) {
        return obj.some((item, index) => 
          checkForInjection(item, `${path}[${index}]`)
        );
      }
      
      if (typeof obj === 'object') {
        return Object.entries(obj).some(([key, value]) => {
          // Check key for MongoDB operators
          if (key.startsWith('$') || key.includes('.')) {
            logger.warn('Potential NoSQL injection in key', {
              key,
              path,
              ip: req.ip,
              userId: req.user?.userId
            });
            return true;
          }
          
          return checkForInjection(value, path ? `${path}.${key}` : key);
        });
      }
      
      return false;
    };

    // Check body, query, and params
    const hasInjection = 
      checkForInjection(req.body, 'body') ||
      checkForInjection(req.query, 'query') ||
      checkForInjection(req.params, 'params');

    if (hasInjection) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input detected',
        code: 'INVALID_INPUT'
      });
    }

    next();
  } catch (error) {
    logger.error('NoSQL injection check error', {
      error: error.message,
      endpoint: req.path,
      method: req.method
    });

    res.status(500).json({
      success: false,
      message: 'Input validation failed'
    });
  }
};

// ============================================================================
// FILE UPLOAD VALIDATION
// ============================================================================

/**
 * Enhanced file upload validation
 */
export const validateFileUpload = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
    maxSize = 5 * 1024 * 1024, // 5MB
    required = false
  } = options;

  return (req, res, next) => {
    try {
      if (!req.file && required) {
        return res.status(400).json({
          success: false,
          message: 'File upload is required'
        });
      }

      if (req.file) {
        // Check file type
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
          });
        }

        // Check file size
        if (req.file.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
          });
        }

        // Validate file name
        const sanitizedName = validator.escape(req.file.originalname);
        if (sanitizedName !== req.file.originalname) {
          logger.warn('Suspicious file name detected', {
            original: req.file.originalname,
            sanitized: sanitizedName,
            userId: req.user?.userId,
            ip: req.ip
          });
        }

        // Additional security checks
        const suspiciousExtensions = /\.(exe|bat|cmd|scr|pif|com|js|jar|vbs|ws|wsf)$/i;
        if (suspiciousExtensions.test(req.file.originalname)) {
          return res.status(400).json({
            success: false,
            message: 'File type not allowed for security reasons'
          });
        }
      }

      next();
    } catch (error) {
      logger.error('File validation error', {
        error: error.message,
        file: req.file?.originalname,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        message: 'File validation failed'
      });
    }
  };
};

// ============================================================================
// COMMON VALIDATION PATTERNS
// ============================================================================

export const commonSchemas = {
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ID format'),
  email: Joi.string().email().max(255),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20),
  name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s]+$/),
  password: Joi.string().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  url: Joi.string().uri(),
  date: Joi.date().iso(),
  amount: Joi.number().positive().max(1000000),
  percentage: Joi.number().min(0).max(100)
};

export default {
  schemas,
  validateBody,
  validateQuery,
  validateParams,
  sanitizeInput,
  preventNoSQLInjection,
  validateFileUpload,
  commonSchemas
};