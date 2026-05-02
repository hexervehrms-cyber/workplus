import SecurityEvent from "../models/SecurityEvent.js";
import logger from "../utils/logger.js";

/**
 * Security Event Logging Middleware
 * Automatically logs security-relevant events
 */

/**
 * Log authentication events
 */
export const logAuthEvent = (eventType, severity = 'medium') => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Call original send first
      originalSend.call(this, data);
      
      // Log security event asynchronously
      setImmediate(async () => {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          const isSuccess = responseData.success === true;
          const statusCode = res.statusCode;
          
          // Determine actual event type and severity based on response
          let actualEventType = eventType;
          let actualSeverity = severity;
          
          if (eventType === 'login_attempt') {
            actualEventType = isSuccess ? 'login_success' : 'login_failed';
            actualSeverity = isSuccess ? 'low' : 'medium';
            
            // Increase severity for repeated failures
            if (!isSuccess && statusCode === 423) {
              actualSeverity = 'high'; // Account locked
            }
          }
          
          // Extract user info if available
          const userId = req.user?.userId || req.body?.userId || null;
          const orgId = req.user?.orgId || 'system';
          
          // Create security event
          await SecurityEvent.createEvent({
            eventType: actualEventType,
            severity: actualSeverity,
            userId: userId,
            description: generateEventDescription(actualEventType, isSuccess, req, res),
            details: {
              success: isSuccess,
              statusCode: statusCode,
              responseMessage: responseData.message,
              requestBody: sanitizeRequestBody(req.body),
              userAgent: req.get('User-Agent'),
              method: req.method,
              path: req.path
            },
            requestInfo: {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              method: req.method,
              url: req.originalUrl,
              headers: sanitizeHeaders(req.headers)
            },
            orgId: orgId
          });
          
        } catch (error) {
          logger.error('Security event logging failed', {
            error: error.message,
            eventType,
            path: req.path
          });
        }
      });
    };
    
    next();
  };
};

/**
 * Log data access events
 */
export const logDataAccess = (resourceType, action = 'read') => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      originalSend.call(this, data);
      
      setImmediate(async () => {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          const isSuccess = responseData.success === true && res.statusCode < 400;
          
          if (isSuccess && req.user) {
            await SecurityEvent.createEvent({
              eventType: 'data_access',
              severity: 'low',
              userId: req.user.userId,
              description: `User accessed ${resourceType} data`,
              details: {
                resourceType,
                action,
                method: req.method,
                path: req.path,
                recordCount: Array.isArray(responseData.data) ? responseData.data.length : 1,
                filters: req.query
              },
              requestInfo: {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                method: req.method,
                url: req.originalUrl
              },
              orgId: req.user.orgId
            });
          }
        } catch (error) {
          logger.error('Data access logging failed', {
            error: error.message,
            resourceType,
            action
          });
        }
      });
    };
    
    next();
  };
};

/**
 * Log administrative actions
 */
export const logAdminAction = (actionType, targetResource) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      originalSend.call(this, data);
      
      setImmediate(async () => {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          const isSuccess = responseData.success === true && res.statusCode < 400;
          
          if (req.user) {
            await SecurityEvent.createEvent({
              eventType: 'admin_action',
              severity: isSuccess ? 'medium' : 'high',
              userId: req.user.userId,
              targetUserId: req.params.userId || req.body.userId || null,
              description: `Admin ${actionType} on ${targetResource}`,
              details: {
                actionType,
                targetResource,
                success: isSuccess,
                method: req.method,
                path: req.path,
                requestData: sanitizeRequestBody(req.body),
                responseMessage: responseData.message
              },
              requestInfo: {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                method: req.method,
                url: req.originalUrl
              },
              orgId: req.user.orgId
            });
          }
        } catch (error) {
          logger.error('Admin action logging failed', {
            error: error.message,
            actionType,
            targetResource
          });
        }
      });
    };
    
    next();
  };
};

/**
 * Log permission denied events
 */
export const logPermissionDenied = () => {
  return async (req, res, next) => {
    const originalStatus = res.status;
    
    res.status = function(statusCode) {
      if (statusCode === 403 && req.user) {
        setImmediate(async () => {
          try {
            await SecurityEvent.createEvent({
              eventType: 'permission_denied',
              severity: 'medium',
              userId: req.user.userId,
              description: 'Access denied due to insufficient permissions',
              details: {
                requiredPermission: req.requiredPermission || 'unknown',
                userRole: req.user.role,
                userPermissions: req.user.permissions || [],
                method: req.method,
                path: req.path
              },
              requestInfo: {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                method: req.method,
                url: req.originalUrl
              },
              orgId: req.user.orgId
            });
          } catch (error) {
            logger.error('Permission denied logging failed', {
              error: error.message,
              userId: req.user.userId
            });
          }
        });
      }
      
      return originalStatus.call(this, statusCode);
    };
    
    next();
  };
};

/**
 * Log suspicious activity
 */
export const logSuspiciousActivity = (activityType, riskScore = 50) => {
  return async (req, res, next) => {
    try {
      await SecurityEvent.createEvent({
        eventType: 'suspicious_activity',
        severity: riskScore >= 70 ? 'high' : 'medium',
        userId: req.user?.userId || null,
        description: `Suspicious activity detected: ${activityType}`,
        details: {
          activityType,
          riskScore,
          method: req.method,
          path: req.path,
          suspiciousIndicators: req.suspiciousIndicators || []
        },
        requestInfo: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.originalUrl,
          headers: sanitizeHeaders(req.headers)
        },
        riskScore: riskScore,
        orgId: req.user?.orgId || 'system'
      });
    } catch (error) {
      logger.error('Suspicious activity logging failed', {
        error: error.message,
        activityType
      });
    }
    
    next();
  };
};

/**
 * Detect and log unusual activity patterns
 */
export const detectUnusualActivity = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    try {
      const userId = req.user.userId;
      const currentIP = req.ip;
      const currentTime = new Date();
      const hour = currentTime.getHours();
      
      // Check for unusual access patterns
      const recentEvents = await SecurityEvent.find({
        userId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).limit(50).lean();
      
      const suspiciousIndicators = [];
      let riskScore = 0;
      
      // Check for new IP address
      const recentIPs = recentEvents
        .map(e => e.requestInfo?.ip)
        .filter(ip => ip && ip !== currentIP);
      
      if (recentIPs.length > 0 && !recentIPs.includes(currentIP)) {
        suspiciousIndicators.push('new_ip_address');
        riskScore += 25;
      }
      
      // Check for unusual time access
      if (hour < 6 || hour > 22) {
        suspiciousIndicators.push('unusual_time');
        riskScore += 15;
      }
      
      // Check for rapid requests (potential automation)
      const recentRequests = recentEvents.filter(e => 
        e.createdAt > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      );
      
      if (recentRequests.length > 20) {
        suspiciousIndicators.push('rapid_requests');
        riskScore += 30;
      }
      
      // Check for multiple failed attempts
      const recentFailures = recentEvents.filter(e => 
        e.eventType === 'login_failed' &&
        e.createdAt > new Date(Date.now() - 60 * 60 * 1000) // Last hour
      );
      
      if (recentFailures.length > 3) {
        suspiciousIndicators.push('multiple_failures');
        riskScore += 20;
      }
      
      // Log if suspicious
      if (suspiciousIndicators.length > 0) {
        req.suspiciousIndicators = suspiciousIndicators;
        
        await SecurityEvent.createEvent({
          eventType: 'unusual_activity',
          severity: riskScore >= 50 ? 'high' : 'medium',
          userId: userId,
          description: 'Unusual activity pattern detected',
          details: {
            indicators: suspiciousIndicators,
            riskScore,
            recentEventCount: recentEvents.length,
            recentFailureCount: recentFailures.length
          },
          requestInfo: {
            ip: currentIP,
            userAgent: req.get('User-Agent'),
            method: req.method,
            url: req.originalUrl
          },
          riskScore: riskScore,
          orgId: req.user.orgId
        });
      }
      
    } catch (error) {
      logger.error('Unusual activity detection failed', {
        error: error.message,
        userId: req.user?.userId
      });
    }
    
    next();
  };
};

/**
 * Helper functions
 */

function generateEventDescription(eventType, isSuccess, req, res) {
  const descriptions = {
    login_success: 'User logged in successfully',
    login_failed: 'User login failed',
    logout: 'User logged out',
    password_change: 'User changed password',
    password_reset: 'Password reset requested',
    two_factor_enabled: 'Two-factor authentication enabled',
    two_factor_disabled: 'Two-factor authentication disabled',
    account_locked: 'Account locked due to failed attempts',
    permission_denied: 'Access denied due to insufficient permissions',
    admin_action: 'Administrative action performed',
    data_access: 'Data access performed',
    suspicious_activity: 'Suspicious activity detected',
    unusual_activity: 'Unusual activity pattern detected'
  };
  
  return descriptions[eventType] || `Security event: ${eventType}`;
}

function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password', 'newPassword', 'currentPassword', 'confirmPassword',
    'token', 'refreshToken', 'accessToken', 'secret', 'key',
    'creditCard', 'ssn', 'socialSecurityNumber', 'bankAccount'
  ];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return headers;
  }
  
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  const sensitiveHeaders = [
    'authorization', 'cookie', 'x-api-key', 'x-auth-token'
  ];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

export default {
  logAuthEvent,
  logDataAccess,
  logAdminAction,
  logPermissionDenied,
  logSuspiciousActivity,
  detectUnusualActivity
};