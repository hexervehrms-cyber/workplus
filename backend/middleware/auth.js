import jwt from "jsonwebtoken";
import { asyncHandler } from "./errorHandler.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
import { getBearerOrCookieAccessToken } from "../utils/httpAuth.js";
import JWTCache from "../utils/jwtCache.js";
import { normalizeAuthOrgId } from "../utils/orgScopeHelpers.js";

/**
 * Authentication middleware
 * Verifies JWT token from Bearer header or HTTP-only cookie
 * Uses Redis caching for improved performance
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  // Validate JWT_SECRET is configured
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logger.error('CRITICAL: JWT_SECRET not properly configured');
    return res.status(500).json({
      success: false,
      message: "Server configuration error",
      code: "CONFIG_ERROR"
    });
  }

  // Try to get token from multiple sources (priority order):
  // 1. HTTP-only cookie (wp_at - set by httpAuth.js)
  // 2. Legacy cookies (accessToken, token)
  // 3. Authorization header (Bearer token) via getBearerOrCookieAccessToken
  let token = req.cookies?.wp_at || req.cookies?.accessToken || req.cookies?.token;
  
  if (!token) {
    token = getBearerOrCookieAccessToken(req);
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token or session cookie.",
      code: "NO_TOKEN"
    });
  }
  
  try {
    // Try to get from cache first (must still match verified JWT subject — legacy keys used token.substring(0,20) and collided)
    let cachedData = await JWTCache.getTokenCache(token);
    if (cachedData?.userData?.role) {
      try {
        const decodedForCache = jwt.verify(token, process.env.JWT_SECRET);
        if (String(decodedForCache.userId) !== String(cachedData.userData.userId)) {
          logger.warn('JWT cache userId mismatch with token; ignoring cache entry', {
            tokenUserId: decodedForCache.userId,
            cacheUserId: cachedData.userData.userId
          });
          cachedData = null;
        }
      } catch {
        cachedData = null;
      }
    }

    if (cachedData?.userData?.role) {
      const freshUser = await User.findById(cachedData.userData.userId)
        .select('orgId tenantId organizationId role isActive lockUntil name email departmentId permissions')
        .lean();

      if (!freshUser) {
        await JWTCache.clearTokenCache(token);
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!freshUser.isActive) {
        await JWTCache.clearTokenCache(token);
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated.',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      if (freshUser.lockUntil && freshUser.lockUntil > new Date()) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked.',
          code: 'ACCOUNT_LOCKED'
        });
      }

      const authOrg = normalizeAuthOrgId(freshUser);
      if (!authOrg && freshUser.role !== 'super_admin') {
        await JWTCache.clearTokenCache(token);
        return res.status(403).json({
          success: false,
          message: 'Organization context required. Please log in again.',
          code: 'MISSING_ORG_CONTEXT'
        });
      }

      const userData = {
        userId: freshUser._id,
        email: freshUser.email,
        name: freshUser.name,
        role: freshUser.role,
        orgId: authOrg,
        departmentId: freshUser.departmentId,
        permissions: freshUser.permissions || cachedData.userData.permissions || [],
        sessionId: cachedData.userData.sessionId
      };
      await JWTCache.cacheToken(token, freshUser._id, userData);

      req.user = {
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        orgId: authOrg,
        tenantId: authOrg,
        departmentId: userData.departmentId,
        permissions: userData.permissions,
        sessionId: userData.sessionId,
        fromCache: true
      };
      return next();
    }

    if (cachedData && !cachedData.userData?.role) {
      logger.warn('Cached token missing role field', {
        userId: cachedData.userData?.userId,
        tokenPrefix: token.substring(0, 20)
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token expiration explicitly (additional safety check)
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again.",
        code: "TOKEN_EXPIRED"
      });
    }
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.userId)
      .select('-password')
      .lean();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
        code: "USER_NOT_FOUND"
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated.",
        code: "ACCOUNT_DEACTIVATED"
      });
    }
    
    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message: "Account is temporarily locked.",
        code: "ACCOUNT_LOCKED"
      });
    }
    
    // Prepare user data for caching
    const authOrg = normalizeAuthOrgId(user);
    const userData = {
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: authOrg,
      departmentId: user.departmentId,
      permissions: user.permissions || [],
      sessionId: decoded.sessionId
    };

    // Cache the token and user session
    await Promise.all([
      JWTCache.cacheToken(token, user._id, userData),
      JWTCache.cacheUserSession(user._id, userData)
    ]);
    
    // Attach user info to request (use consistent orgId naming)
    req.user = {
      ...userData,
      tenantId: userData.orgId, // Alias for compatibility
      fromCache: false
    };
    
    next();
  } catch (error) {
    // Only log as debug for invalid token errors (expected for expired/invalid tokens)
    // Don't log as warning to avoid noise in production logs
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logger.debug('Auth failed', { 
        error: error.message,
        token: typeof token === 'string' ? token.substring(0, 20) + '...' : '',
        path: req.path
      });
    } else {
      logger.warn('Authentication failed', { 
        error: error.message,
        token: typeof token === 'string' ? token.substring(0, 20) + '...' : '',
        ip: req.ip
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again.",
        code: "TOKEN_EXPIRED"
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
        code: "INVALID_TOKEN"
      });
    }
    
    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
      code: "AUTH_FAILED"
    });
  }
});

/**
 * Authorization middleware factory
 * Creates middleware to check user roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED"
      });
    }
    
    // Normalize role to lowercase for case-insensitive comparison
    const userRole = String(req.user.role || '').toLowerCase();
    const allowedRoles = roles.map(r => String(r).toLowerCase());
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn('Authorization failed', {
        userId: req.user.userId,
        userRole: req.user.role,
        normalizedRole: userRole,
        requiredRoles: roles,
        normalizedRequiredRoles: allowedRoles,
        endpoint: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions.",
        code: "INSUFFICIENT_PERMISSIONS"
      });
    }
    
    next();
  };
};

/**
 * Permission-based authorization middleware
 * Checks if user has specific permission for a module
 */
export const requirePermission = (module, action, scope = 'own') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
        code: "AUTH_REQUIRED"
      });
    }
    
    // Super admin has all permissions
    if (req.user.role === 'super_admin') {
      return next();
    }
    
    // Check if user has the required permission
    const hasPermission = req.user.permissions.some(permission => 
      permission.module === module &&
      permission.actions.includes(action) &&
      (permission.scope === scope || permission.scope === 'all')
    );
    
    if (!hasPermission) {
      logger.warn('Permission denied', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredPermission: { module, action, scope },
        userPermissions: req.user.permissions,
        endpoint: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required: ${module}:${action}:${scope}`,
        code: "PERMISSION_DENIED"
      });
    }
    
    next();
  };
};

/**
 * Organization-based access control
 * Ensures user can only access data from their organization
 */
export const requireSameOrg = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      code: "AUTH_REQUIRED"
    });
  }
  
  // Super admin can access all organizations
  if (req.user.role === 'super_admin') {
    return next();
  }
  
  // Add orgId filter to query parameters for route handlers to use
  req.orgFilter = { orgId: req.user.orgId };
  
  next();
};

/**
 * Optional authentication middleware
 * Attaches user if token is provided, but doesn't require it
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without user
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select('-password')
      .lean();
    
    if (user && user.isActive) {
      req.user = {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        departmentId: user.departmentId,
        permissions: user.permissions || []
      };
    }
  } catch (error) {
    // Ignore token errors for optional auth
    logger.debug('Optional auth failed', { error: error.message });
  }
  
  next();
});

/**
 * Rate limiting by user
 * Applies different rate limits based on user role
 */
export const userRateLimit = (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  // Different rate limits by role
  const rateLimits = {
    'super_admin': 1000, // requests per hour
    'admin': 500,
    'hr': 300,
    'manager': 200,
    'employee': 100
  };
  
  const userLimit = rateLimits[req.user.role] || 100;
  
  // This would integrate with a rate limiting service like Redis
  // For now, just pass through
  req.userRateLimit = userLimit;
  next();
};

/**
 * Audit logging middleware
 * Logs user actions for compliance
 */
export const auditLog = (action, resource) => {
  return (req, res, next) => {
    if (req.user) {
      logger.info('User action', {
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action,
        resource,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

export default {
  authenticate,
  authorize,
  requirePermission,
  requireSameOrg,
  optionalAuth,
  userRateLimit,
  auditLog
};