/**
 * Redis Session Manager
 * Manages user sessions with Redis for scalability and performance
 * Integrates with JWT tokens for stateless authentication
 */

import logger from './logger.js';

let redisClient = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client
 */
export async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    logger.warn('REDIS_URL not configured - sessions will use in-memory storage (not recommended for production)');
    return null;
  }

  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ 
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection limit exceeded');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      isRedisAvailable = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
    });

    await redisClient.connect();
    logger.info('Redis session manager initialized successfully');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error.message);
    redisClient = null;
    isRedisAvailable = false;
    return null;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisReady() {
  return isRedisAvailable && redisClient && redisClient.isReady;
}

/**
 * Session key prefix
 */
const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const ATTENDANCE_STATE_PREFIX = 'attendance:';

/**
 * Generate session key
 */
function sessionKey(sessionId) {
  return `${SESSION_PREFIX}${sessionId}`;
}

/**
 * Generate user sessions key
 */
function userSessionsKey(userId) {
  return `${USER_SESSIONS_PREFIX}${userId}`;
}

/**
 * Generate attendance state key
 */
function attendanceStateKey(userId) {
  return `${ATTENDANCE_STATE_PREFIX}${userId}`;
}

/**
 * Create a new session
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID (from JWT)
 * @param {object} sessionData - Session data
 * @param {number} ttl - Time to live in seconds (default: 15 minutes)
 */
export async function createSession(userId, sessionId, sessionData, ttl = 900) {
  if (!isRedisReady()) {
    logger.warn('Redis not available - session not stored');
    return false;
  }

  try {
    const key = sessionKey(sessionId);
    const data = {
      userId,
      sessionId,
      ...sessionData,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    // Store session data
    await redisClient.setEx(key, ttl, JSON.stringify(data));

    // Add session to user's session set
    await redisClient.sAdd(userSessionsKey(userId), sessionId);

    logger.debug('Session created:', { userId, sessionId, ttl });
    return true;
  } catch (error) {
    logger.error('Failed to create session:', error.message);
    return false;
  }
}

/**
 * Get session data
 * @param {string} sessionId - Session ID
 */
export async function getSession(sessionId) {
  if (!isRedisReady()) {
    return null;
  }

  try {
    const key = sessionKey(sessionId);
    const data = await redisClient.get(key);
    
    if (!data) {
      return null;
    }

    const session = JSON.parse(data);
    
    // Update last activity
    session.lastActivity = Date.now();
    await redisClient.setEx(key, 900, JSON.stringify(session)); // Refresh TTL

    return session;
  } catch (error) {
    logger.error('Failed to get session:', error.message);
    return null;
  }
}

/**
 * Update session data
 * @param {string} sessionId - Session ID
 * @param {object} updates - Data to update
 * @param {number} ttl - Time to live in seconds
 */
export async function updateSession(sessionId, updates, ttl = 900) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return false;
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: Date.now()
    };

    const key = sessionKey(sessionId);
    await redisClient.setEx(key, ttl, JSON.stringify(updatedSession));

    logger.debug('Session updated:', { sessionId });
    return true;
  } catch (error) {
    logger.error('Failed to update session:', error.message);
    return false;
  }
}

/**
 * Delete a session
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 */
export async function deleteSession(userId, sessionId) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    // Remove session data
    await redisClient.del(sessionKey(sessionId));

    // Remove from user's session set
    await redisClient.sRem(userSessionsKey(userId), sessionId);

    logger.debug('Session deleted:', { userId, sessionId });
    return true;
  } catch (error) {
    logger.error('Failed to delete session:', error.message);
    return false;
  }
}

/**
 * Delete all sessions for a user
 * @param {string} userId - User ID
 */
export async function deleteAllUserSessions(userId) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    // Get all session IDs for user
    const sessionIds = await redisClient.sMembers(userSessionsKey(userId));

    // Delete each session
    const deletePromises = sessionIds.map(sessionId => 
      redisClient.del(sessionKey(sessionId))
    );
    await Promise.all(deletePromises);

    // Clear user's session set
    await redisClient.del(userSessionsKey(userId));

    logger.debug('All user sessions deleted:', { userId, count: sessionIds.length });
    return true;
  } catch (error) {
    logger.error('Failed to delete all user sessions:', error.message);
    return false;
  }
}

/**
 * Get all active sessions for a user
 * @param {string} userId - User ID
 */
export async function getUserSessions(userId) {
  if (!isRedisReady()) {
    return [];
  }

  try {
    const sessionIds = await redisClient.sMembers(userSessionsKey(userId));
    
    const sessions = await Promise.all(
      sessionIds.map(async (sessionId) => {
        const data = await redisClient.get(sessionKey(sessionId));
        return data ? JSON.parse(data) : null;
      })
    );

    return sessions.filter(s => s !== null);
  } catch (error) {
    logger.error('Failed to get user sessions:', error.message);
    return [];
  }
}

/**
 * Store attendance state in Redis for real-time sync
 * @param {string} userId - User ID
 * @param {object} attendanceState - Attendance state
 * @param {number} ttl - Time to live in seconds (default: 24 hours)
 */
export async function setAttendanceState(userId, attendanceState, ttl = 86400) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    const key = attendanceStateKey(userId);
    const data = {
      ...attendanceState,
      updatedAt: Date.now()
    };

    await redisClient.setEx(key, ttl, JSON.stringify(data));
    logger.debug('Attendance state stored:', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to store attendance state:', error.message);
    return false;
  }
}

/**
 * Get attendance state from Redis
 * @param {string} userId - User ID
 */
export async function getAttendanceState(userId) {
  if (!isRedisReady()) {
    return null;
  }

  try {
    const key = attendanceStateKey(userId);
    const data = await redisClient.get(key);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to get attendance state:', error.message);
    return null;
  }
}

/**
 * Delete attendance state from Redis
 * @param {string} userId - User ID
 */
export async function deleteAttendanceState(userId) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    const key = attendanceStateKey(userId);
    await redisClient.del(key);
    logger.debug('Attendance state deleted:', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to delete attendance state:', error.message);
    return false;
  }
}

/**
 * Cleanup expired sessions (run periodically)
 */
export async function cleanupExpiredSessions() {
  if (!isRedisReady()) {
    return;
  }

  try {
    // Redis automatically handles TTL expiration
    // This function can be used for additional cleanup if needed
    logger.debug('Session cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup sessions:', error.message);
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error.message);
    }
  }
}

export default {
  initializeRedis,
  getRedisClient,
  isRedisReady,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  deleteAllUserSessions,
  getUserSessions,
  setAttendanceState,
  getAttendanceState,
  deleteAttendanceState,
  cleanupExpiredSessions,
  closeRedis
};
