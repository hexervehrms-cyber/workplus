import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, auditLog } from "../middleware/auth.js";
import { loginLimiter, registerLimiter, passwordResetLimiter } from "../middleware/rateLimiter.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import AuthToken from "../models/AuthToken.js";
import SecurityEvent from "../models/SecurityEvent.js";
import TwoFactorAuth from "../utils/twoFactor.js";
import PasswordSecurity from "../utils/passwordSecurity.js";
import logger from "../utils/logger.js";
import SessionManager from "../utils/sessionManager.js";
import redis from "../utils/redis.js";
import JWTCache from "../utils/jwtCache.js";
import {
  getBearerOrCookieAccessToken,
  clearAccessTokenCookie,
  clearLegacyAuthCookies,
  setAccessTokenCookie,
} from "../utils/httpAuth.js";
import { normalizeAuthOrgId } from "../utils/orgScopeHelpers.js";

const router = express.Router();

/**
 * POST /api/auth/login
 * Simplified login for immediate functionality
 */
router.post("/login", 
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }

    try {
      const user = await User.findOne({ 
        email: email.toLowerCase().trim(),
        isActive: true
      }).select('+password');
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid credentials" 
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid credentials" 
        });
      }

      if (user.lockUntil && user.lockUntil > new Date()) {
        return res.status(423).json({
          success: false,
          message: "Account is temporarily locked.",
          code: "ACCOUNT_LOCKED"
        });
      }

      // Log user role for debugging
      console.log('🔍 LOGIN DEBUG:', {
        email: user.email,
        role: user.role,
        roleType: typeof user.role,
        userId: user._id
      });
      logger.info('User login attempt', {
        email: user.email,
        role: user.role,
        userId: user._id,
        roleType: typeof user.role
      });

      // Generate access token (short-lived)
      const sessionId = crypto.randomBytes(16).toString('hex');
      const orgId = normalizeAuthOrgId(user);
      if (!orgId) {
        return res.status(403).json({
          success: false,
          message: 'Account has no organization assigned. Contact your administrator.',
          code: 'MISSING_ORG_CONTEXT'
        });
      }
      const token = jwt.sign(
        { 
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          ...(orgId ? { orgId, tenantId: orgId } : {}),
          sessionId: sessionId
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' } // Short-lived access token
      );

      // Generate refresh token (long-lived)
      const refreshToken = jwt.sign(
        { 
          userId: user._id.toString(),
          type: 'refresh',
          sessionId: sessionId
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Create session in Redis for per-employee tracking
      await SessionManager.createSession(user._id, sessionId, {
        role: user.role,
        email: user.email,
        name: user.name,
        orgId,
        departmentId: user.departmentId,
        permissions: user.permissions || [],
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Store refresh token in database
      const authToken = await AuthToken.create({
        userId: user._id,
        orgId,
        tokenType: 'refresh',
        token: refreshToken,
        hashedToken: crypto.createHash('sha256').update(refreshToken).digest('hex'),
        purpose: 'session_refresh',
        maxUsage: -1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours (aligned with Redis session TTL)
        deviceInfo: {
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      });

      // Set HTTP-only cookies for enhanced security
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // HTTPS only in production
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes for access token
        path: '/'
      };

      const refreshCookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours for refresh token cookie
        path: '/'
      };

      // Set cookies (accessToken legacy name + wp_at for middleware / Socket cookie fallback)
      res.cookie('accessToken', token, cookieOptions);
      setAccessTokenCookie(res, token, 15 * 60);
      res.cookie('refreshToken', refreshToken, refreshCookieOptions);

      await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

      // Get employee record if exists
      let employee = await Employee.findOne(
        orgId ? { userId: user._id, orgId } : { userId: user._id }
      ).lean();

      logger.info('User logged in successfully', {
        userId: user._id,
        email: user.email,
        role: user.role
      });

      const userPayload = {
        id: user._id,
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        organization: user.organization,
        tenantId: orgId,
        orgId,
        employeeId: employee?._id?.toString?.() || '',
        employeeCode: employee?.employeeCode || ''
      };

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: userPayload,
        data: {
          user: userPayload,
          token,
          refreshToken,
          expiresIn: '15m'
        }
      });

      console.log('✅ LOGIN RESPONSE:', {
        email: user.email,
        role: user.role,
        token: token.substring(0, 20) + '...'
      });
    } catch (error) {
      logger.error('Login error', { 
        error: error.message, 
        stack: error.stack,
        email: req.body?.email 
      });
      res.status(500).json({ 
        success: false, 
        message: "An error occurred during login",
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  })
);

/**
 * GET /api/auth/me
 * Get current logged-in user profile with employee details
 */
router.get("/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const userOrgId = req.user.orgId;

    try {
      // Get user profile
      const user = await User.findById(userId)
        .select('-password -security.passwordHistory -security.twoFactorSecret')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Get employee profile if exists
      let employee = await Employee.findOne({ userId, orgId: userOrgId }).lean();

      // If no employee record exists, create one
      if (!employee) {
        employee = await Employee.create({
          userId,
          orgId: userOrgId,
          status: 'active'
        });
        employee = employee.toObject();
      }
      
      // Combine user and employee data
      const profileData = {
        _id: user._id,
        id: user._id,
        userId: user._id,
        firstName: employee?.firstName || user.profile?.firstName || user.name?.split(' ')[0] || '',
        lastName: employee?.lastName || user.profile?.lastName || user.name?.split(' ')[1] || '',
        email: user.email,
        phone: employee?.phone || user.contact?.phone || '',
        dateOfBirth: user.profile?.dateOfBirth || '',
        gender: user.profile?.gender || '',
        address: employee?.address || user.contact?.address?.street || '',
        employeeId: employee?._id?.toString?.() || '',
        employeeCode: employee?.employeeCode || '',
        department: employee?.department || '',
        designation: employee?.designation || '',
        joiningDate: employee?.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
        employmentType: employee?.employmentType || user.profile?.employmentType || '',
        workLocation: employee?.workLocation || '',
        aadharNumber: user.profile?.aadharNumber || '',
        panNumber: user.profile?.panNumber || '',
        bankAccount: employee?.bankDetails?.accountNumber || '',
        ifscCode: employee?.bankDetails?.ifscCode || '',
        role: user.role,
        avatar: user.avatar,
        organization: user.organization,
        tenantId: user.tenantId,
        orgId: user.orgId
      };

      res.json({
        success: true,
        data: profileData
      });

    } catch (error) {
      logger.error('Get profile error', { error: error.message, userId });
      res.status(500).json({
        success: false,
        message: "Failed to get profile"
      });
    }
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required"
      });
    }

    try {
      let decodedRefresh;
      try {
        decodedRefresh = jwt.verify(refreshToken, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token"
        });
      }

      if (decodedRefresh.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token"
        });
      }

      const authToken = await AuthToken.findByToken(refreshToken);

      if (!authToken || !authToken.isValid()) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token"
        });
      }

      const user = await User.findById(authToken.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User not found or inactive"
        });
      }

      const sessionId = decodedRefresh.sessionId;
      // Only enforce Redis session when Redis is up; otherwise rely on AuthToken DB record
      if (sessionId && redis.isRedisConnected()) {
        const liveSession = await SessionManager.getSession(sessionId);
        if (!liveSession) {
          return res.status(401).json({
            success: false,
            message: "Session expired or invalidated",
            code: "SESSION_EXPIRED"
          });
        }
      }

      const orgId = normalizeAuthOrgId(user);
      if (!orgId) {
        return res.status(403).json({
          success: false,
          message: 'Account has no organization assigned. Contact your administrator.',
          code: 'MISSING_ORG_CONTEXT'
        });
      }
      const accessToken = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          ...(orgId ? { orgId, tenantId: orgId } : {}),
          ...(sessionId ? { sessionId } : {}),
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const isProduction = process.env.NODE_ENV === 'production';
      const accessCookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/'
      };

      res.cookie('accessToken', accessToken, accessCookieOptions);
      setAccessTokenCookie(res, accessToken, 15 * 60);

      await authToken.use();

      res.json({
        success: true,
        data: {
          accessToken,
          token: accessToken,
          expiresIn: 900
        }
      });

    } catch (error) {
      logger.error('Token refresh error', { error: error.message });

      res.status(500).json({
        success: false,
        message: "Token refresh failed"
      });
    }
  })
);

/**
 * POST /api/auth/logout
 * Logout and revoke tokens
 */
router.post("/logout",
  authenticate,
  auditLog('logout', 'auth'),
  asyncHandler(async (req, res) => {
    const { refreshToken: bodyRefresh, logoutAll = false } = req.body;
    const userId = req.user.userId;
    const sessionId = req.user.sessionId;
    const cookieRefresh = req.cookies?.refreshToken;
    const refreshToken = bodyRefresh || cookieRefresh || null;

    const accessToken =
      req.cookies?.wp_at ||
      req.cookies?.accessToken ||
      req.cookies?.token ||
      getBearerOrCookieAccessToken(req) ||
      null;

    try {
      if (logoutAll) {
        await AuthToken.revokeAllUserTokens(userId, null, userId, 'user_logout_all');
        await SessionManager.invalidateAllUserSessions(userId);
      } else {
        if (sessionId) {
          await SessionManager.invalidateSession(sessionId);
        }
        if (refreshToken) {
          const authToken = await AuthToken.findByToken(refreshToken);
          if (authToken) {
            await authToken.revoke(userId, 'user_logout');
          }
        }
      }

      if (accessToken) {
        try {
          await JWTCache.clearTokenCache(accessToken);
        } catch (e) {
          logger.warn('Logout: could not clear JWT decode cache', { error: e.message });
        }
      }

      await SecurityEvent.createEvent({
        eventType: 'logout',
        severity: 'low',
        userId: userId,
        description: logoutAll ? 'Logout from all devices' : 'Logout',
        requestInfo: {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        },
        orgId: req.user.orgId,
      });

      clearAccessTokenCookie(res);
      clearLegacyAuthCookies(res);

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      logger.error('Logout error', { error: error.message, userId });

      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  })
);

/**
 * POST /api/auth/setup-2fa
 * Setup two-factor authentication
 */
router.post("/setup-2fa",
  authenticate,
  auditLog('setup_2fa', 'auth'),
  asyncHandler(async (req, res) => {
    const { method, phoneNumber, verificationCode } = req.body;
    const userId = req.user.userId;
    
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Validate setup requirements
      const validation = TwoFactorAuth.validateSetupRequirements(method, {
        phoneNumber,
        email: user.email,
        token: verificationCode
      });
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid setup data",
          errors: validation.errors
        });
      }
      
      let setupData = {};
      
      if (method === 'totp') {
        // Generate TOTP secret
        const totpSetup = TwoFactorAuth.generateTOTPSecret(user.email);
        
        if (verificationCode) {
          // Verify the setup code
          const isValid = TwoFactorAuth.verifyTOTP(verificationCode, totpSetup.secret);
          
          if (!isValid) {
            return res.status(400).json({
              success: false,
              message: "Invalid verification code"
            });
          }
          
          // Save TOTP secret
          user.security = user.security || {};
          user.security.twoFactorEnabled = true;
          user.security.twoFactorMethod = 'totp';
          user.security.twoFactorSecret = totpSetup.secret;
          
          // Generate backup codes
          const backupCodes = TwoFactorAuth.generateBackupCodes();
          user.security.backupCodes = TwoFactorAuth.hashBackupCodes(backupCodes);
          
          await user.save();
          
          setupData = { backupCodes };
        } else {
          // Return setup information
          const qrCode = await TwoFactorAuth.generateQRCode(totpSetup.otpauthUrl);
          
          setupData = {
            secret: totpSetup.secret,
            qrCode,
            manualEntryKey: totpSetup.secret
          };
        }
      }
      
      // Log 2FA setup event
      await SecurityEvent.createEvent({
        eventType: verificationCode ? 'two_factor_enabled' : 'two_factor_setup_started',
        severity: 'medium',
        userId: userId,
        description: `2FA ${method} ${verificationCode ? 'enabled' : 'setup initiated'}`,
        requestInfo: { 
          ip: req.ip, 
          userAgent: req.get('User-Agent') 
        },
        orgId: user.orgId
      });
      
      res.json({
        success: true,
        message: verificationCode ? "Two-factor authentication enabled successfully" : "2FA setup initiated",
        data: setupData
      });
      
    } catch (error) {
      logger.error('2FA setup error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "2FA setup failed"
      });
    }
  })
);

/**
 * POST /api/auth/disable-2fa
 * Disable two-factor authentication
 */
router.post("/disable-2fa",
  authenticate,
  auditLog('disable_2fa', 'auth'),
  asyncHandler(async (req, res) => {
    const { password, verificationCode } = req.body;
    const userId = req.user.userId;
    
    try {
      const user = await User.findById(userId).select('+password +security.twoFactorSecret');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Verify password
      const isPasswordValid = await PasswordSecurity.verifyPassword(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid password"
        });
      }
      
      // Verify 2FA code
      if (user.security?.twoFactorEnabled && user.security?.twoFactorSecret) {
        const isCodeValid = TwoFactorAuth.verifyTOTP(verificationCode, user.security.twoFactorSecret);
        
        if (!isCodeValid) {
          return res.status(401).json({
            success: false,
            message: "Invalid verification code"
          });
        }
      }
      
      // Disable 2FA
      user.security = user.security || {};
      user.security.twoFactorEnabled = false;
      user.security.twoFactorMethod = null;
      user.security.twoFactorSecret = null;
      user.security.backupCodes = [];
      
      await user.save();
      
      // Log 2FA disable event
      await SecurityEvent.createEvent({
        eventType: 'two_factor_disabled',
        severity: 'medium',
        userId: userId,
        description: 'Two-factor authentication disabled',
        requestInfo: { 
          ip: req.ip, 
          userAgent: req.get('User-Agent') 
        },
        orgId: user.orgId
      });
      
      res.json({
        success: true,
        message: "Two-factor authentication disabled successfully"
      });
      
    } catch (error) {
      logger.error('2FA disable error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Failed to disable 2FA"
      });
    }
  })
);

/**
 * POST /api/auth/change-password
 * Change user password
 * PROTECTED: Rate limited to prevent brute force attacks
 */
router.post("/change-password",
  passwordResetLimiter,
  authenticate,
  auditLog('change_password', 'auth'),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    try {
      const user = await User.findById(userId).select('+password +security.passwordHistory');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Verify current password
      const isCurrentPasswordValid = await PasswordSecurity.verifyPassword(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect"
        });
      }
      
      // Validate new password
      const passwordValidation = PasswordSecurity.validatePassword(newPassword, PasswordSecurity.defaultPolicy, {
        name: user.name,
        email: user.email
      });
      
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: "New password does not meet requirements",
          errors: passwordValidation.errors
        });
      }
      
      // Check password reuse
      const isReused = PasswordSecurity.isPasswordReused(newPassword, user.security?.passwordHistory || [], 5);
      
      if (isReused) {
        return res.status(400).json({
          success: false,
          message: "Cannot reuse recent passwords"
        });
      }
      
      // Hash new password
      const hashedPassword = await PasswordSecurity.hashPassword(newPassword);
      
      // Update password and history
      user.security = user.security || {};
      user.security.passwordHistory = user.security.passwordHistory || [];
      
      // Add current password to history
      if (user.password) {
        user.security.passwordHistory.push({
          hash: user.password,
          createdAt: user.security.passwordLastChanged || new Date()
        });
        
        // Keep only last 5 passwords
        if (user.security.passwordHistory.length > 5) {
          user.security.passwordHistory = user.security.passwordHistory.slice(-5);
        }
      }
      
      user.password = hashedPassword;
      user.security.passwordLastChanged = new Date();
      user.security.mustChangePassword = false;
      
      await user.save();
      
      // Revoke all existing tokens (force re-login)
      await AuthToken.revokeAllUserTokens(userId, 'refresh', userId, 'password_change');
      
      // Log password change event
      await SecurityEvent.createEvent({
        eventType: 'password_change',
        severity: 'medium',
        userId: userId,
        description: 'Password changed successfully',
        requestInfo: { 
          ip: req.ip, 
          userAgent: req.get('User-Agent') 
        },
        orgId: user.orgId
      });
      
      logger.info('User password changed', {
        userId,
        orgId: user.orgId
      });
      
      res.json({
        success: true,
        message: "Password changed successfully. Please log in again."
      });
      
    } catch (error) {
      logger.error('Password change error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Password change failed"
      });
    }
  })
);

/**
 * GET /api/auth/security-status
 * Get user security status and recommendations
 */
router.get("/security-status",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      // Get recent security events
      const recentEvents = await SecurityEvent.findRecentForUser(userId, 24);
      
      // Check password age
      const passwordAge = user.security?.passwordLastChanged ? 
        Math.floor((Date.now() - user.security.passwordLastChanged.getTime()) / (1000 * 60 * 60 * 24)) : 
        null;
      
      // Get active sessions
      const activeSessions = await AuthToken.find({
        userId,
        tokenType: 'refresh',
        isActive: true,
        isRevoked: false
      }).select('deviceInfo createdAt expiresAt');
      
      const securityStatus = {
        twoFactorEnabled: user.security?.twoFactorEnabled || false,
        twoFactorMethod: user.security?.twoFactorMethod || null,
        passwordAge: passwordAge,
        needsPasswordChange: PasswordSecurity.needsPasswordChange(user.security?.passwordLastChanged),
        activeSessions: activeSessions.length,
        recentSecurityEvents: recentEvents.length,
        accountLocked: user.security?.lockUntil && user.security.lockUntil > new Date(),
        lastLogin: user.lastLogin,
        loginHistory: user.loginHistory?.slice(-5) || []
      };
      
      // Generate recommendations
      const recommendations = [];
      
      if (!securityStatus.twoFactorEnabled) {
        recommendations.push({
          type: 'enable_2fa',
          priority: 'high',
          message: 'Enable two-factor authentication for better security'
        });
      }
      
      if (securityStatus.needsPasswordChange) {
        recommendations.push({
          type: 'change_password',
          priority: 'medium',
          message: 'Your password is old. Consider changing it.'
        });
      }
      
      if (securityStatus.activeSessions > 5) {
        recommendations.push({
          type: 'review_sessions',
          priority: 'medium',
          message: 'You have many active sessions. Review and revoke unused ones.'
        });
      }
      
      res.json({
        success: true,
        data: {
          securityStatus,
          recommendations
        }
      });
      
    } catch (error) {
      logger.error('Security status error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Failed to get security status"
      });
    }
  })
);

/**
 * GET /api/auth/verify-role
 * Verify user's role and session validity
 * Used by frontend to ensure correct dashboard routing
 */
router.get("/verify-role",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const sessionId = req.user.sessionId;
    const userRole = req.user.role;

    try {
      // Verify session is still valid
      if (sessionId) {
        const sessionValid = await SessionManager.getSession(sessionId);
        if (!sessionValid) {
          return res.status(401).json({
            success: false,
            message: "Session invalid or expired",
            code: "SESSION_INVALID"
          });
        }

        // Verify role matches
        if (sessionValid.role !== userRole) {
          logger.warn('Role mismatch in session verification', {
            userId,
            sessionId: sessionId.substring(0, 16),
            tokenRole: userRole,
            sessionRole: sessionValid.role
          });
          return res.status(401).json({
            success: false,
            message: "Role mismatch detected",
            code: "ROLE_MISMATCH"
          });
        }
      }

      // Get user from database to ensure latest role
      const user = await User.findById(userId)
        .select('role orgId departmentId')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }

      // Verify role hasn't changed
      if (user.role !== userRole) {
        logger.warn('User role changed', {
          userId,
          previousRole: userRole,
          currentRole: user.role
        });
        return res.status(401).json({
          success: false,
          message: "User role has changed. Please log in again.",
          code: "ROLE_CHANGED"
        });
      }

      res.json({
        success: true,
        data: {
          userId,
          role: user.role,
          orgId: user.orgId,
          departmentId: user.departmentId,
          sessionId: sessionId,
          verified: true
        }
      });

    } catch (error) {
      logger.error('Role verification error', { error: error.message, userId });
      
      res.status(500).json({
        success: false,
        message: "Failed to verify role"
      });
    }
  })
);

/**
 * GET /api/auth/session-stats
 * Get session statistics (admin only)
 */
router.get("/session-stats",
  authenticate,
  asyncHandler(async (req, res) => {
    // Only super_admin can view session stats
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions"
      });
    }

    try {
      const stats = await SessionManager.getSessionStats();
      
      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Session stats error', { error: error.message });
      
      res.status(500).json({
        success: false,
        message: "Failed to get session stats"
      });
    }
  })
);

export default router;