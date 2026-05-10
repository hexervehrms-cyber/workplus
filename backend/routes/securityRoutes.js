/**
 * Security Routes
 * Includes token refresh, file upload validation, and rate limiting
 * CRITICAL: All routes require authentication
 */

import express from 'express';
import fileValidator from '../middleware/fileValidator.js';
import { loginLimiter, registerLimiter, refreshTokenLimiter } from '../middleware/rateLimiter.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens
} from '../services/authService.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcrypt';

const router = express.Router();

/**
 * POST /api/auth/refresh-token
 * Refresh access token using refresh token
 * PROTECTED: Requires authentication
 */
router.post('/auth/refresh-token', authenticate, refreshTokenLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    if (!refreshToken || !authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token and user ID are required'
      });
    }

    // Extract user ID from authenticated request
    const userId = req.user.userId;

    // Get client IP and user agent for token tracking
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Refresh the access token
    const result = await refreshAccessToken(refreshToken, userId, ipAddress, userAgent);

    logger.info('Access token refreshed successfully', { userId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn
      }
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    res.status(401).json({
      success: false,
      message: error.message || 'Failed to refresh token'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke refresh token
 * PROTECTED: Requires authentication
 */
router.post('/auth/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.userId;

    // Revoke refresh token if provided
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    logger.info('User logged out', { userId });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/logout-all-devices
 * Logout from all devices by revoking all refresh tokens
 * PROTECTED: Requires authentication
 */
router.post('/auth/logout-all-devices', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Revoke all user tokens
    await revokeAllUserTokens(userId);

    logger.info('User logged out from all devices', { userId });

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    logger.error('Logout all devices error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/login
 * Login with rate limiting and session creation
 */
router.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      logger.warn('Login attempt with non-existent email', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token pair
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const tokens = await generateTokenPair(user, ipAddress, userAgent);

    // Create session record for tracking logged-in users
    const orgId = user.orgId || 'system';
    try {
      const session = await Session.create({
        userId: user._id,
        orgId,
        socketId: null, // Will be updated when Socket.IO connects
        role: user.role,
        isActive: true,
        ipAddress,
        userAgent,
        loginTime: new Date()
      });
      
      logger.info('Session created on login', { 
        userId: user._id, 
        sessionId: session._id,
        orgId
      });

      // Emit real-time dashboard update to all admins in the organization
      try {
        if (global.io) {
          const activeCount = await Session.countDocuments({
            orgId,
            isActive: true,
            role: 'employee'
          });
          
          global.io.to(`tenant_${orgId}`).emit('dashboard_update', {
            type: 'active_users_updated',
            data: {
              activeUsers: activeCount,
              userId: user._id,
              userName: user.name,
              role: user.role,
              action: 'login'
            }
          });
          
          logger.info('Dashboard update emitted on login', { 
            orgId, 
            activeUsers: activeCount,
            userId: user._id
          });
        }
      } catch (emitError) {
        logger.warn('Failed to emit dashboard update on login', { 
          error: emitError.message 
        });
      }
    } catch (sessionError) {
      logger.warn('Failed to create session on login', { 
        error: sessionError.message,
        userId: user._id 
      });
      // Don't fail login if session creation fails
    }

    // Update user's lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    logger.info('User logged in successfully', { userId: user._id, email });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
          organization: user.organization || 'WorkPlus Inc.',
          orgId: user.orgId
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and mark session as inactive
 */
router.post('/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    
    // Decode token to get userId
    let userId;
    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Mark all active sessions for this user as inactive
    const result = await Session.updateMany(
      { userId, isActive: true },
      { 
        isActive: false,
        logoutTime: new Date()
      }
    );

    logger.info('User logged out', { 
      userId, 
      sessionsUpdated: result.modifiedCount 
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/register
 * Register with rate limiting
 */
router.post('/auth/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, role, organization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('Registration attempt with existing email', { email });
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'employee',
      organization: organization || 'WorkPlus Inc.'
    });

    // Generate token pair
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const tokens = await generateTokenPair(user, ipAddress, userAgent);

    logger.info('User registered successfully', { userId: user._id, email });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
          organization: user.organization || 'WorkPlus Inc.'
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
