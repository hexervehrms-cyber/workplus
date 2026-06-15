/**
 * Input Validation Middleware
 * Validates request bodies against schemas
 */

import { body, param, query, validationResult } from 'express-validator';

/**
 * Validation error handler
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Employee validation rules
 */
export const validateEmployeeCreation = [
  body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('designation').trim().notEmpty().withMessage('Designation is required'),
  body('baseSalary').isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
  handleValidationErrors
];

export const validateEmployeeUpdate = [
  body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('baseSalary').optional().isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
  handleValidationErrors
];

/**
 * Expense validation rules
 */
export const validateExpenseCreation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
  handleValidationErrors
];

export const validateExpenseUpdate = [
  body('title').optional().trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('category').optional().trim().notEmpty().withMessage('Category is required'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
  handleValidationErrors
];

/**
 * Leave request validation rules
 */
export const validateLeaveRequest = [
  body('leaveType').trim().notEmpty().withMessage('Leave type is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required').isLength({ min: 5 }).withMessage('Reason must be at least 5 characters'),
  body('endDate').custom((value, { req }) => {
    if (new Date(value) <= new Date(req.body.startDate)) {
      throw new Error('End date must be after start date');
    }
    return true;
  }),
  handleValidationErrors
];

/**
 * Attendance validation rules
 */
export const validateAttendanceCheckIn = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('location').optional().trim().isLength({ min: 3 }).withMessage('Location must be at least 3 characters'),
  handleValidationErrors
];

/**
 * User profile validation rules
 */
export const validateProfileUpdate = [
  body('profile.firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('profile.lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('contact.phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('contact.address.street').optional().trim().isLength({ min: 5 }).withMessage('Street must be at least 5 characters'),
  handleValidationErrors
];

/**
 * Password validation rules
 */
export const validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  handleValidationErrors
];

/**
 * Pagination validation
 */
export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

/**
 * ID validation
 */
export const validateObjectId = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors
];

/** Reject MongoDB operator keys in body/query (NoSQL injection guard). */
export const preventNoSQLInjection = (req, res, next) => {
  const hasOperatorKeys = (value) => {
    if (value == null || typeof value !== 'object') return false;
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) return true;
      if (hasOperatorKeys(value[key])) return true;
    }
    return false;
  };
  if (hasOperatorKeys(req.body) || hasOperatorKeys(req.query)) {
    return res.status(400).json({ success: false, message: 'Invalid request payload' });
  }
  next();
};

/** Shallow trim for string fields in JSON body. */
export const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const [key, val] of Object.entries(req.body)) {
      if (typeof val === 'string') req.body[key] = val.trim();
    }
  }
  next();
};

/** Apply express-validator rule arrays from schemas, or no-op. */
export const validateBody = (rules) => (Array.isArray(rules) ? rules : [(req, res, next) => next()]);

export const validateQuery = (rules) => (Array.isArray(rules) ? rules : [(req, res, next) => next()]);

export const validateFileUpload = (_options = {}) => (req, res, next) => next();

/** Named rule sets used by employee-dashboard routes. */
export const schemas = {
  employeeProfile: validateProfileUpdate,
  checkIn: validateAttendanceCheckIn,
  leaveRequest: validateLeaveRequest,
  expense: validateExpenseCreation,
};
