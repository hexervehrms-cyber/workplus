/**
 * Authentication Service
 * Handles token generation, refresh, and validation
 */

import jwt from 'jsonwebtoken';
import RefreshToken from '../models/RefreshToken.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const ACCESS_TOKEN_EXPIRY = '24h'; // 24 hours
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Generate access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      tenantId: user.orgId || 'system'
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY}s` }
  );
};

/**
 * Save refresh token to database
 */
const saveRefreshToken = async (userId, token, ipAddress, userAgent) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const expiresAt = new Date(decoded.exp * 1000);

    const refreshToken = new RefreshToken({
      userId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
      isRevoked: false
    });

    await refreshToken.save();
    logger.info('Refresh token saved', { userId, expiresAt });
    return refreshToken;
  } catch (error) {
    logger.error('Error saving refresh token', { userId, error: error.message });
    throw error;
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = async (token, userId) => {
  try {
    // Verify JWT signature
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token is in database and not revoked
    const refreshToken = await RefreshToken.findOne({
      token,
      userId,
      isRevoked: false
    });

    if (!refreshToken) {
      logger.warn('Invalid or revoked refresh token', { userId });
      return null;
    }

    // Check if token is expired
    if (new Date() > refreshToken.expiresAt) {
      logger.warn('Refresh token expired', { userId });
      return null;
    }

    return refreshToken;
  } catch (error) {
    logger.error('Error verifying refresh token', { userId, error: error.message });
    return null;
  }
};

/**
 * Revoke refresh token
 */
const revokeRefreshToken = async (token) => {
  try {
    const refreshToken = await RefreshToken.findOneAndUpdate(
      { token },
      { isRevoked: true, revokedAt: new Date() },
      { new: true }
    );

    if (refreshToken) {
      logger.info('Refresh token revoked', { userId: refreshToken.userId });
    }

    return refreshToken;
  } catch (error) {
    logger.error('Error revoking refresh token', { error: error.message });
    throw error;
  }
};

/**
 * Revoke all user tokens (logout from all devices)
 */
const revokeAllUserTokens = async (userId) => {
  try {
    const result = await RefreshToken.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );

    logger.info('All user tokens revoked', { userId, count: result.modifiedCount });
    return result;
  } catch (error) {
    logger.error('Error revoking all user tokens', { userId, error: error.message });
    throw error;
  }
};

/**
 * Generate token pair (access + refresh)
 */
const generateTokenPair = async (user, ipAddress, userAgent) => {
  try {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to database
    await saveRefreshToken(user._id, refreshToken, ipAddress, userAgent);

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60 // 24 hours in seconds
    };
  } catch (error) {
    logger.error('Error generating token pair', { userId: user._id, error: error.message });
    throw error;
  }
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (refreshToken, userId, ipAddress, userAgent) => {
  try {
    // Verify refresh token
    const validToken = await verifyRefreshToken(refreshToken, userId);

    if (!validToken) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get user
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    logger.info('Access token refreshed', { userId });

    return {
      accessToken: newAccessToken,
      expiresIn: 24 * 60 * 60 // 24 hours in seconds
    };
  } catch (error) {
    logger.error('Error refreshing access token', { userId, error: error.message });
    throw error;
  }
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    logger.warn('Invalid access token', { error: error.message });
    return null;
  }
};

export {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  generateTokenPair,
  refreshAccessToken,
  verifyAccessToken
};
