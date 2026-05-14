/**
 * Organization ID Validation Middleware
 * CRITICAL: Enforces strict tenant isolation to prevent cross-tenant data access
 * 
 * This middleware ensures:
 * 1. All authenticated requests have a valid orgId
 * 2. Users can only access their own organization's data
 * 3. Super admins can access any organization but must explicitly specify orgId
 * 4. No fallback to 'system' orgId - must be explicit
 */

import logger from '../utils/logger.js';

/**
 * Validate that user has a valid orgId
 * Rejects requests without proper organization context
 */
export const validateOrgId = (req, res, next) => {
  try {
    const userOrgId = req.user?.orgId;
    
    // CRITICAL: Reject if no orgId
    if (!userOrgId || userOrgId === undefined || userOrgId === null) {
      logger.warn('Request rejected: missing orgId', {
        userId: req.user?.userId,
        role: req.user?.role,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Organization context required. Please log in again.',
        code: 'MISSING_ORG_CONTEXT'
      });
    }
    
    // CRITICAL: Reject 'system' orgId for non-super-admins
    if (userOrgId === 'system' && req.user?.role !== 'super_admin') {
      logger.warn('Request rejected: invalid orgId for non-super-admin', {
        userId: req.user?.userId,
        role: req.user?.role,
        orgId: userOrgId,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Invalid organization context',
        code: 'INVALID_ORG_CONTEXT'
      });
    }
    
    // Store validated orgId on request for use in route handlers
    req.validatedOrgId = userOrgId;
    next();
  } catch (error) {
    logger.error('OrgId validation middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during organization validation',
      code: 'ORG_VALIDATION_ERROR'
    });
  }
};

/**
 * Enforce orgId in query/body parameters
 * Ensures users can't access other organizations' data via query parameters
 */
export const enforceOrgIdInQuery = (req, res, next) => {
  try {
    const userOrgId = req.user?.orgId;
    const userRole = req.user?.role;
    const queryOrgId = req.query.orgId || req.body?.orgId;
    
    // Super admin can query any orgId
    if (userRole === 'super_admin') {
      if (queryOrgId) {
        req.validatedOrgId = queryOrgId;
      }
      return next();
    }
    
    // Non-super-admin: must use their own orgId
    if (queryOrgId && queryOrgId !== userOrgId) {
      logger.warn('Request rejected: orgId mismatch', {
        userId: req.user?.userId,
        role: userRole,
        userOrgId,
        queryOrgId,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Cannot access data from other organizations',
        code: 'ORG_MISMATCH'
      });
    }
    
    // Use user's orgId
    req.validatedOrgId = userOrgId;
    next();
  } catch (error) {
    logger.error('OrgId enforcement middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during organization enforcement',
      code: 'ORG_ENFORCEMENT_ERROR'
    });
  }
};

/**
 * Validate orgId in route parameters (e.g., /api/organizations/:orgId)
 */
export const validateOrgIdParam = (req, res, next) => {
  try {
    const userOrgId = req.user?.orgId;
    const userRole = req.user?.role;
    const paramOrgId = req.params.orgId;
    
    if (!paramOrgId) {
      return next();
    }
    
    // Super admin can access any orgId
    if (userRole === 'super_admin') {
      return next();
    }
    
    // Non-super-admin: must match their orgId
    if (paramOrgId !== userOrgId) {
      logger.warn('Request rejected: orgId param mismatch', {
        userId: req.user?.userId,
        role: userRole,
        userOrgId,
        paramOrgId,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Cannot access data from other organizations',
        code: 'ORG_PARAM_MISMATCH'
      });
    }
    
    next();
  } catch (error) {
    logger.error('OrgId param validation middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during organization parameter validation',
      code: 'ORG_PARAM_VALIDATION_ERROR'
    });
  }
};

/**
 * Sanitize query to enforce orgId
 * Automatically adds orgId filter to queries
 */
export const sanitizeOrgIdQuery = (req, res, next) => {
  try {
    const userOrgId = req.user?.orgId;
    const userRole = req.user?.role;
    
    // Store the sanitized orgId for use in route handlers
    if (userRole === 'super_admin' && req.query.orgId) {
      req.sanitizedOrgId = req.query.orgId;
    } else {
      req.sanitizedOrgId = userOrgId;
    }
    
    next();
  } catch (error) {
    logger.error('OrgId query sanitization error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during query sanitization',
      code: 'QUERY_SANITIZATION_ERROR'
    });
  }
};

export default {
  validateOrgId,
  enforceOrgIdInQuery,
  validateOrgIdParam,
  sanitizeOrgIdQuery
};
