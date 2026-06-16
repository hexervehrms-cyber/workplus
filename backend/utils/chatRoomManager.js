/**
 * Chat Room Manager - Phase 1 Socket Rooms & Identity
 * Handles socket room management for chat: user/{userId}, org/{orgId}, chat/{conversationId}, group/{groupId}
 */

import logger from './logger.js';

// In-memory tracking of active sockets per user: Map<userId, Set<socketId>>
const userSocketMap = new Map();

/**
 * Register a socket for a user
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
export const registerUserSocket = (userId, socketId) => {
  if (!userId || !socketId) {
    logger.warn('registerUserSocket: missing userId or socketId');
    return;
  }
  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId).add(socketId);
  logger.debug(`Socket registered for user ${userId}: ${socketId}`, {
    socketCount: userSocketMap.get(userId).size
  });
};

/**
 * Unregister a socket for a user
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 * @returns {boolean} - true if user is now offline (no sockets left)
 */
export const unregisterUserSocket = (userId, socketId) => {
  if (!userId || !socketId) {
    return false;
  }
  const sockets = userSocketMap.get(userId);
  if (!sockets) {
    return true; // Already offline
  }
  sockets.delete(socketId);
  const isOffline = sockets.size === 0;
  if (isOffline) {
    userSocketMap.delete(userId);
  }
  logger.debug(`Socket unregistered for user ${userId}: ${socketId}`, {
    socketCount: sockets.size,
    isOffline
  });
  return isOffline;
};

/**
 * Check if a user is online (has active sockets)
 * @param {string} userId - User ID
 * @returns {boolean}
 */
export const isUserOnline = (userId) => {
  return userSocketMap.has(userId) && userSocketMap.get(userId).size > 0;
};

/**
 * Get active socket count for a user
 * @param {string} userId - User ID
 * @returns {number}
 */
export const getUserSocketCount = (userId) => {
  const sockets = userSocketMap.get(userId);
  return sockets ? sockets.size : 0;
};

/**
 * Validate and join a chat room with authorization
 * @param {Object} socket - Socket.IO socket instance
 * @param {string} conversationId - Conversation ID (optional)
 * @param {string} groupId - Group ID (optional)
 * @param {Object} options - { isParticipant: boolean, isMember: boolean }
 * @returns {boolean} - true if join was successful
 */
export const authorizedChatRoomJoin = (socket, { conversationId, groupId, isParticipant, isMember }) => {
  const userId = socket.userId;
  const orgId = socket.tenantId;
  
  if (!userId || !orgId) {
    logger.warn('authorizedChatRoomJoin: missing userId or orgId');
    return false;
  }

  if (conversationId) {
    if (!isParticipant) {
      logger.warn(`User ${userId} attempted to join unauthorized conversation: ${conversationId}`);
      return false;
    }
    const room = `chat:${conversationId}`;
    socket.join(room);
    logger.info(`User ${userId} joined conversation room: ${room}`);
    return true;
  }

  if (groupId) {
    if (!isMember) {
      logger.warn(`User ${userId} attempted to join unauthorized group: ${groupId}`);
      return false;
    }
    const room = `group:${groupId}`;
    socket.join(room);
    logger.info(`User ${userId} joined group room: ${room}`);
    return true;
  }

  return false;
};

/**
 * Leave a chat room safely
 * @param {Object} socket - Socket.IO socket instance
 * @param {string} conversationId - Conversation ID (optional)
 * @param {string} groupId - Group ID (optional)
 */
export const leaveChatRoom = (socket, { conversationId, groupId }) => {
  if (conversationId) {
    const room = `chat:${conversationId}`;
    socket.leave(room);
    logger.info(`User ${socket.userId} left conversation room: ${room}`);
    return;
  }

  if (groupId) {
    const room = `group:${groupId}`;
    socket.leave(room);
    logger.info(`User ${socket.userId} left group room: ${room}`);
  }
};

/**
 * Clean up all socket tracking on server shutdown
 */
export const cleanupRoomManager = () => {
  userSocketMap.clear();
  logger.info('Chat room manager cleaned up');
};

export default {
  registerUserSocket,
  unregisterUserSocket,
  isUserOnline,
  getUserSocketCount,
  authorizedChatRoomJoin,
  leaveChatRoom,
  cleanupRoomManager
};
