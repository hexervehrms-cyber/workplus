import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { auditLog } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimiter.js";
import User from "../models/User.js";
import AuthToken from "../models/AuthToken.js";
import SecurityEvent from "../models/SecurityEvent.js";
import PasswordSecurity from "../utils/passwordSecurity.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * POST /api/password-reset/request
 * Request password reset
 */
router.post("/request",
  loginLimiter,
  auditLog('password_reset_request', 'auth'),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const clientIP = req.ip;
    const userAgent = req.get('User-Agent');
    
    // Input validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }
    
    try {
      // Find user
      const user = await User.findOne({ 
        email: email.toLowerCase().trim(),
        isActive: true,
        deletedAt: null
      });
      
      // Always return success to prevent email enumeration
      const successResponse = {
        success: true,
        message: "If an account with this email exists, a password reset link has been sent."
      };
      
      if (!user) {
        // Log attempt for non-existent user
        await SecurityEvent.createEvent({
          eventType: 'password_reset',
          severity: 'low',
          description: 'Password reset requested for non-existent email',
          details: { email: email.toLowerCase().trim() },
          requestInfo: { ip: clientIP, userAgent },
          orgId: null
        });
        
        // Return success to prevent email enumeration
        return res.json(successResponse);
      }
      
      // Check if account is locked
      if (user.security?.lockUntil && user.security.lockUntil > new Date()) {
        await SecurityEvent.createEvent({
          eventType: 'password_reset',
          severity: 'medium',
          userId: user._id,
          description: 'Password reset requested for locked account',
          requestInfo: { ip: clientIP, userAgent },
          orgId: user.orgId
        });
        
        return res.status(423).json({
          success: false,
          message: "Account is temporarily locked. Please try again later.",
          code: "ACCOUNT_LOCKED"
        });
      }
      
      // Check for recent reset requests (rate limiting)
      const recentResetTokens = await AuthToken.find({
        userId: user._id,
        tokenType: 'reset_password',
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }, // Last 15 minutes
        isActive: true
      });
      
      if (recentResetTokens.length >= 3) {
        await SecurityEvent.createEvent({
          eventType: 'password_reset',
          severity: 'medium',
          userId: user._id,
          description: 'Too many password reset requests',
          details: { recentRequests: recentResetTokens.length },
          requestInfo: { ip: clientIP, userAgent },
          orgId: user.orgId
        });
        
        return res.status(429).json({
          success: false,
          message: "Too many reset requests. Please wait before requesting again.",
          code: "TOO_MANY_REQUESTS"
        });
      }
      
      // Revoke any existing reset tokens
      await AuthToken.updateMany(
        {
          userId: user._id,
          tokenType: 'reset_password',
          isActive: true
        },
        {
          $set: {
            isRevoked: true,
            isActive: false,
            revokedAt: new Date(),
            revokedReason: 'new_request'
          }
        }
      );
      
      // Generate reset token
      const { token: resetToken } = await AuthToken.createToken({
        userId: user._id,
        tokenType: 'reset_password',
        purpose: 'Password reset',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        maxUsage: 1, // Single use
        deviceInfo: {
          userAgent,
          ip: clientIP
        },
        orgId: user.orgId
      });
      
      // In a real implementation, you would send an email here
      // For now, we'll log the token (REMOVE IN PRODUCTION)
      logger.info('Password reset token generated', {
        userId: user._id,
        email: user.email,
        token: resetToken, // REMOVE IN PRODUCTION
        ip: clientIP
      });
      
      // Log security event
      await SecurityEvent.createEvent({
        eventType: 'password_reset',
        severity: 'low',
        userId: user._id,
        description: 'Password reset token generated',
        requestInfo: { ip: clientIP, userAgent },
        orgId: user.orgId
      });
      
      // TODO: Send email with reset link
      // const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
      // await sendPasswordResetEmail(user.email, user.name, resetLink);
      
      res.json(successResponse);
      
    } catch (error) {
      logger.error('Password reset request error', { error: error.message, email });
      
      await SecurityEvent.createEvent({
        eventType: 'password_reset',
        severity: 'high',
        description: 'Password reset failed due to system error',
        details: { error: error.message },
        requestInfo: { ip: clientIP, userAgent },
          orgId: null
      });
      
      res.status(500).json({
        success: false,
        message: "An error occurred while processing your request"
      });
    }
  })
);

/**
 * POST /api/password-reset/verify
 * Verify reset token
 */
router.post("/verify",
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required"
      });
    }
    
    try {
      // Find and validate reset token
      const authToken = await AuthToken.findByToken(token);
      
      if (!authToken || authToken.tokenType !== 'reset_password' || !authToken.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
          code: "INVALID_TOKEN"
        });
      }
      
      // Get user
      const user = await User.findById(authToken.userId);
      
      if (!user || !user.isActive) {
        return res.status(400).json({
          success: false,
          message: "Invalid reset token",
          code: "INVALID_TOKEN"
        });
      }
      
      res.json({
        success: true,
        message: "Reset token is valid",
        data: {
          email: user.email,
          expiresAt: authToken.expiresAt
        }
      });
      
    } catch (error) {
      logger.error('Password reset verify error', { error: error.message });
      
      res.status(500).json({
        success: false,
        message: "Token verification failed"
      });
    }
  })
);

/**
 * POST /api/password-reset/reset
 * Reset password with token
 */
router.post("/reset",
  auditLog('password_reset_complete', 'auth'),
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    const clientIP = req.ip;
    const userAgent = req.get('User-Agent');
    
    // Input validation
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required"
      });
    }
    
    try {
      // Find and validate reset token
      const authToken = await AuthToken.findByToken(token);
      
      if (!authToken || authToken.tokenType !== 'reset_password' || !authToken.isValid()) {
        await SecurityEvent.createEvent({
          eventType: 'password_reset',
          severity: 'medium',
          description: 'Password reset attempted with invalid token',
          details: { tokenProvided: !!token },
          requestInfo: { ip: clientIP, userAgent },
          orgId: null
        });
        
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
          code: "INVALID_TOKEN"
        });
      }
      
      // Get user
      const user = await User.findById(authToken.userId).select('+password +security.passwordHistory');
      
      if (!user || !user.isActive) {
        return res.status(400).json({
          success: false,
          message: "Invalid reset token",
          code: "INVALID_TOKEN"
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
      user.security.loginAttempts = 0;
      user.security.lockUntil = null;
      
      await user.save();
      
      // Mark token as used
      await authToken.use();
      
      // Revoke all existing sessions (force re-login)
      await AuthToken.revokeAllUserTokens(user._id, 'refresh', user._id, 'password_reset');
      
      // Log security event
      await SecurityEvent.createEvent({
        eventType: 'password_change',
        severity: 'medium',
        userId: user._id,
        description: 'Password reset completed successfully',
        requestInfo: { ip: clientIP, userAgent },
        orgId: user.orgId
      });
      
      logger.info('Password reset completed', {
        userId: user._id,
        email: user.email,
        ip: clientIP
      });
      
      res.json({
        success: true,
        message: "Password reset successfully. Please log in with your new password."
      });
      
    } catch (error) {
      logger.error('Password reset error', { error: error.message });
      
      await SecurityEvent.createEvent({
        eventType: 'password_reset',
        severity: 'high',
        description: 'Password reset failed due to system error',
        details: { error: error.message },
        requestInfo: { ip: clientIP, userAgent },
          orgId: null
      });
      
      res.status(500).json({
        success: false,
        message: "Password reset failed"
      });
    }
  })
);

/**
 * POST /api/password-reset/change
 * Change password (authenticated user)
 */
router.post("/change",
  // Note: This would typically be in the main auth routes, but included here for completeness
  asyncHandler(async (req, res) => {
    // This endpoint is already implemented in routes/auth.js as /api/auth/change-password
    res.status(404).json({
      success: false,
      message: "Use /api/auth/change-password endpoint instead"
    });
  })
);

export default router;