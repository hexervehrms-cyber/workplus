/**
 * POST /api/auth/refresh — shared handler (mounted on auth router and main app).
 */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuthToken from '../models/AuthToken.js';
import logger from '../utils/logger.js';
import SessionManager from '../utils/sessionManager.js';
import redis from '../utils/redis.js';
import { setAccessTokenCookie } from '../utils/httpAuth.js';
import { normalizeAuthOrgId } from '../utils/orgScopeHelpers.js';

export async function handleAuthRefresh(req, res) {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required',
    });
  }

  try {
    let decodedRefresh;
    try {
      decodedRefresh = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    if (decodedRefresh.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    const authToken = await AuthToken.findByToken(refreshToken);

    if (!authToken || !authToken.isValid()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    const user = await User.findById(authToken.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const sessionId = decodedRefresh.sessionId;
    if (sessionId && redis.isRedisConnected()) {
      const liveSession = await SessionManager.getSession(sessionId);
      if (!liveSession) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalidated',
          code: 'SESSION_EXPIRED',
        });
      }
    }

    const orgId = normalizeAuthOrgId(user);
    if (!orgId) {
      return res.status(403).json({
        success: false,
        message: 'Account has no organization assigned. Contact your administrator.',
        code: 'MISSING_ORG_CONTEXT',
      });
    }

    const accessToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        orgId,
        tenantId: orgId,
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
      path: '/',
    };

    res.cookie('accessToken', accessToken, accessCookieOptions);
    setAccessTokenCookie(res, accessToken, 15 * 60);

    await authToken.use();

    return res.json({
      success: true,
      data: {
        accessToken,
        token: accessToken,
        expiresIn: 900,
      },
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Token refresh failed',
    });
  }
}
