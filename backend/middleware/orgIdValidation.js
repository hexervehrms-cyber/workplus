/**
 * Organization ID validation — strict tenant context (no "system" fallback for tenants).
 */
import logger from '../utils/logger.js';
import { isSuperAdmin, userOrgIdFromReq } from '../utils/orgScopeHelpers.js';

export const validateOrgId = (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const role = req.user.role;
    const raw =
      req.user.orgId || req.user.tenantId || req.user.organizationId;

    if (isSuperAdmin(req)) {
      req.validatedOrgId = raw ? String(raw) : 'system';
      if (raw && !req.user.orgId) {
        req.user.orgId = String(raw);
      }
      return next();
    }

    const orgId = userOrgIdFromReq(req);
    if (!orgId) {
      logger.warn('Request rejected: missing orgId', {
        userId: req.user.userId,
        role,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        message: 'Organization context required. Please log in again.',
        code: 'MISSING_ORG_CONTEXT'
      });
    }

    req.validatedOrgId = orgId;
    req.user.orgId = orgId;
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

export const enforceOrgIdInQuery = (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const userOrgId = req.validatedOrgId || userOrgIdFromReq(req);
    const userRole = req.user?.role;
    const explicitOrgId = req.query?.orgId || req.body?.orgId || req.body?.organizationId;
    const explicitTrimmed =
      explicitOrgId != null && String(explicitOrgId).trim() !== '' && String(explicitOrgId) !== 'system'
        ? String(explicitOrgId).trim()
        : null;

    if (userRole === 'super_admin') {
      if (explicitTrimmed) {
        req.validatedOrgId = explicitTrimmed;
      }
      return next();
    }

    const tenantOrg = userOrgId || explicitTrimmed;
    if (!tenantOrg) {
      return res.status(403).json({
        success: false,
        message: 'Organization context required. Please log in again.',
        code: 'MISSING_ORG_CONTEXT',
      });
    }

    if (explicitTrimmed && userOrgId && String(explicitTrimmed) !== String(userOrgId)) {
      logger.warn('Request rejected: orgId mismatch', {
        userId: req.user?.userId,
        role: userRole,
        userOrgId,
        queryOrgId: explicitTrimmed,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        message: 'Cannot access data from other organizations',
        code: 'ORG_MISMATCH',
      });
    }

    req.validatedOrgId = tenantOrg;
    req.user.orgId = tenantOrg;
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

export const validateOrgIdParam = (req, res, next) => {
  try {
    const userOrgId = req.validatedOrgId || userOrgIdFromReq(req);
    const userRole = req.user?.role;
    const paramOrgId = req.params.orgId;

    if (!paramOrgId) {
      return next();
    }

    if (userRole === 'super_admin') {
      return next();
    }

    if (String(paramOrgId) !== String(userOrgId)) {
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

export const sanitizeOrgIdQuery = (req, res, next) => {
  try {
    if (req.user?.role === 'super_admin' && req.query.orgId) {
      req.sanitizedOrgId = String(req.query.orgId);
    } else {
      req.sanitizedOrgId = req.validatedOrgId || userOrgIdFromReq(req);
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
