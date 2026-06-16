/**
 * Chat Socket.IO Event Handlers - Phase 1 & 2
 * Handles real-time messaging, rooms, and unread count updates
 */

import ChatMessage from '../models/ChatMessage.js';
import ChatGroup from '../models/ChatGroup.js';
import User from '../models/User.js';
import logger from './logger.js';
import {
  assertRecipientInOrg,
  assertConversationAccess,
  canAccessMessage,
  resolveUserTenantOrg,
} from './chatAccessHelpers.js';
import { sendTeamsMessage } from '../config/teamsConfig.js';
import {
  registerUserSocket,
  unregisterUserSocket,
  authorizedChatRoomJoin,
  leaveChatRoom,
  isUserOnline
} from './chatRoomManager.js';

async function effectiveTenantId(socket) {
  if (socket.tenantId) return socket.tenantId;
  const resolved = await resolveUserTenantOrg(socket.userId);
  if (resolved) socket.tenantId = resolved;
  return resolved;
}

/**
 * Initialize chat socket handlers
 */
export const initializeChatHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const role = socket.role;
    let tenantId = socket.tenantId;

    logger.info(`Chat socket connected: ${socket.id} for user ${userId}`);

    // PHASE 1: Track active sockets per user
    if (userId) {
      registerUserSocket(userId, socket.id);
    }

    // PHASE 1: Join identity rooms
    socket.join(`user:${userId}`);
    if (tenantId) {
      socket.join(`org:${tenantId}`);
    }

    // PHASE 3: Mark user as online and emit presence:update
    (async () => {
      try {
        if (!userId || !tenantId) return;

        // Update user presence in database
        const user = await User.findByIdAndUpdate(
          userId,
          {
            presenceStatus: 'online',
            lastSeen: new Date()
          },
          { new: true }
        ).select('presenceStatus lastSeen').lean();

        if (user) {
          logger.info(`User ${userId} marked online`, {
            presenceStatus: user.presenceStatus,
            lastSeen: user.lastSeen
          });

          // PHASE 3: Emit presence:update to org room only (org isolation)
          io.to(`org:${tenantId}`).emit('presence:update', {
            userId: String(userId),
            presenceStatus: 'online',
            lastSeen: user.lastSeen,
            orgId: String(tenantId)
          });

          logger.info(`Presence update emitted to org ${tenantId}`, {
            userId: String(userId),
            presenceStatus: 'online'
          });
        }
      } catch (error) {
        logger.warn(`Failed to update presence on connect for ${userId}`, error.message);
      }
    })();

    /**
     * PHASE 1: Join conversation or group room
     * Event: chat:room:join
     * Payload: { conversationId?, groupId? }
     */
    socket.on('chat:room:join', async (data) => {
      try {
        const { conversationId, groupId } = data || {};
        tenantId = await effectiveTenantId(socket);

        if (conversationId) {
          // Verify user is participant in conversation
          const access = await assertConversationAccess(conversationId, userId, tenantId);
          if (!access.ok) {
            logger.warn(`User ${userId} denied access to conversation ${conversationId}`);
            socket.emit('chat:error', { message: 'Access denied to conversation' });
            return;
          }
          
          const joined = authorizedChatRoomJoin(socket, {
            conversationId,
            isParticipant: true
          });
          
          if (joined) {
            socket.emit('chat:room:joined', { conversationId });
          }
          return;
        }

        if (groupId) {
          // Verify user is member of group
          const group = await ChatGroup.findOne({
            conversationId: groupId,
            orgId: tenantId,
            members: userId
          }).lean();
          
          if (!group) {
            logger.warn(`User ${userId} denied access to group ${groupId}`);
            socket.emit('chat:error', { message: 'Access denied to group' });
            return;
          }

          const joined = authorizedChatRoomJoin(socket, {
            groupId,
            isMember: true
          });
          
          if (joined) {
            socket.emit('chat:room:joined', { groupId });
          }
        }
      } catch (error) {
        logger.error('Error joining chat room', error);
        socket.emit('chat:error', { message: 'Failed to join room' });
      }
    });

    /**
     * PHASE 1: Leave conversation or group room
     * Event: chat:room:leave
     * Payload: { conversationId?, groupId? }
     */
    socket.on('chat:room:leave', (data) => {
      try {
        const { conversationId, groupId } = data || {};
        leaveChatRoom(socket, { conversationId, groupId });
        socket.emit('chat:room:left', { conversationId, groupId });
      } catch (error) {
        logger.error('Error leaving chat room', error);
        socket.emit('chat:error', { message: 'Failed to leave room' });
      }
    });

    /**
     * PHASE 2: Send message event
     * Emitted by: Client
     * Data: { recipientId, content, messageType, teamsIntegration, conversationId }
     * Emits:
     *  - chat:message:new (canonical event)
     *  - chat:new_message (backward compat)
     *  - unread count updates
     */
    socket.on('chat:send_message', async (data) => {
      try {
        const {
          recipientId,
          content,
          messageType = 'text',
          teamsIntegration,
          conversationId: groupConversationId,
        } = data || {};

        // Group chat (conversation id prefix grp_)
        if (groupConversationId && String(groupConversationId).startsWith('grp_')) {
          if (!content) {
            socket.emit('chat:error', { message: 'Invalid message data' });
            return;
          }

          const conversationId = String(groupConversationId);
          tenantId = await effectiveTenantId(socket);
          
          const group = await ChatGroup.findOne({
            conversationId,
            orgId: tenantId,
          }).lean();

          if (!group || !group.members.some((m) => m.toString() === userId)) {
            socket.emit('chat:error', { message: 'Not a member of this group' });
            return;
          }

          // Create and save message
          const message = new ChatMessage({
            senderId: userId,
            recipientId: null,
            conversationId,
            messageType,
            content: { text: content },
            channelInfo: {
              channelType: 'group',
              channelId: conversationId,
              participants: group.members,
            },
            metadata: {
              teamsIntegration: teamsIntegration || {},
            },
            orgId: tenantId,
            status: 'sent',
          });

          await message.save();
          await message.populate('sender', 'name email avatar');

          // Build canonical message payload with all required fields (Phase 2)
          const messagePayload = {
            _id: String(message._id),
            messageId: message.messageId,
            conversationId: message.conversationId,
            groupId: conversationId,
            senderId: String(message.senderId),
            senderName: message.sender?.name || 'User',
            senderAvatar: message.sender?.avatar || null,
            content: message.content?.text || '',
            messageType: message.messageType,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            status: 'sent',
          };

          // Emit canonical event to group room
          io.to(`group:${conversationId}`).emit('chat:message:new', messagePayload);
          // Backward compat: emit old event
          for (const mid of group.members) {
            io.to(`user:${mid}`).emit('chat:new_message', {
              ...messagePayload,
              status: mid.toString() === userId ? 'sent' : 'delivered',
            });
          }

          logger.info(`Group message in ${conversationId} from ${userId}`);
          return;
        }

        if (!recipientId || !content) {
          socket.emit('chat:error', { message: 'Invalid message data' });
          return;
        }

        tenantId = await effectiveTenantId(socket);
        if (!tenantId) {
          socket.emit('chat:error', { message: 'Organization context required' });
          return;
        }

        // Validate recipient is in same org
        const recipientCheck = await assertRecipientInOrg(recipientId, tenantId);
        if (!recipientCheck.ok) {
          socket.emit('chat:error', { message: recipientCheck.message });
          return;
        }

        // Create conversation ID
        const conversationId = [userId, recipientId].sort().join('_');

        // Create and save message document
        const message = new ChatMessage({
          senderId: userId,
          recipientId,
          conversationId,
          messageType,
          content: {
            text: content
          },
          metadata: {
            teamsIntegration: teamsIntegration || {}
          },
          orgId: tenantId,
          status: 'sent'
        });

        await message.save();
        await message.populate('sender', 'name email avatar');

        // Get sender and recipient info
        const sender = await User.findById(userId).select('name email role').lean();
        const recipient = await User.findById(recipientId).select('name email role').lean();

        // Send to Teams if enabled
        if (teamsIntegration?.enabled && teamsIntegration?.chatId) {
          try {
            const teamsMsg = await sendTeamsMessage(
              teamsIntegration.chatId,
              `${sender.name}: ${content}`
            );
            
            message.metadata.teamsMessageId = teamsMsg.id;
            await message.save();
            
            logger.info(`Message synced to Teams: ${teamsMsg.id}`);
          } catch (teamsError) {
            logger.warn('Failed to sync to Teams', teamsError);
          }
        }

        // Teams ping for employee ↔ admin/hr/manager (both directions when chat is linked)
        const staffRoles = ['admin', 'hr', 'manager', 'super_admin'];
        const isEmployeeToStaff =
          sender.role === 'employee' && staffRoles.includes(recipient.role);
        const isStaffToEmployee =
          staffRoles.includes(sender.role) && recipient.role === 'employee';
        if (
          (isEmployeeToStaff || isStaffToEmployee) &&
          teamsIntegration?.enabled &&
          teamsIntegration?.chatId
        ) {
          try {
            const direction = isEmployeeToStaff ? 'New message from' : 'Message from';
            await sendTeamsMessage(
              teamsIntegration.chatId,
              `📧 ${direction} ${sender.name}:\n\n"${content}"\n\nReply in WorkPlus Pro Chat`
            );
            logger.info(`Teams chat notification for ${sender.name} → ${recipient.name}`);
          } catch (notificationError) {
            logger.warn('Failed to send Teams chat notification', notificationError);
          }
        }

        // Build canonical message payload (Phase 2)
        const messagePayload = {
          _id: String(message._id),
          messageId: message.messageId,
          conversationId: message.conversationId,
          senderId: String(message.senderId),
          senderName: message.sender?.name || 'User',
          senderAvatar: message.sender?.avatar || null,
          receiverId: String(recipientId),
          content: message.content?.text || '',
          messageType: message.messageType,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          status: 'sent',
        };

        // PHASE 2: Emit canonical event to conversation room
        io.to(`chat:${conversationId}`).emit('chat:message:new', messagePayload);

        // PHASE 2: Emit to recipient
        io.to(`user:${recipientId}`).emit('chat:message:new', {
          ...messagePayload,
          status: 'delivered'
        });

        // Backward compat: emit old event to both
        io.to(`user:${recipientId}`).emit('chat:new_message', {
          ...messagePayload,
          status: 'delivered'
        });
        socket.emit('chat:new_message', {
          ...messagePayload,
          status: 'sent'
        });

        logger.info(`Message sent from ${userId} to ${recipientId}`);
      } catch (error) {
        logger.error('Error sending message', error);
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    /**
     * Mark message as read
     * Emitted by: Client
     * Data: { messageId }
     */
    socket.on('chat:mark_read', async (data) => {
      try {
        const { messageId } = data;
        const message = await ChatMessage.findById(messageId);

        if (message && canAccessMessage(message, { userId, orgId: tenantId })) {
          await message.markAsRead(userId);

          // Notify sender that message was read
          io.to(`user_${message.senderId}`).emit('chat:message_read', {
            messageId,
            readBy: userId,
            readAt: new Date()
          });

          logger.info(`Message ${messageId} marked as read by ${userId}`);
        }
      } catch (error) {
        logger.error('Error marking message as read', error);
      }
    });

    /**
     * Typing indicator
     * Emitted by: Client
     * Data: { recipientId, isTyping }
     */
    socket.on('chat:typing', async (data) => {
      const { recipientId, conversationId: typingConvId, isTyping } = data || {};

      if (typingConvId && String(typingConvId).startsWith('grp_')) {
        try {
          const group = await ChatGroup.findOne({
            conversationId: String(typingConvId),
            orgId: tenantId,
          }).lean();
          if (!group || !group.members.some((m) => m.toString() === userId)) return;
          for (const mid of group.members) {
            if (mid.toString() === userId) continue;
            io.to(`user_${mid}`).emit('chat:user_typing', {
              userId,
              isTyping,
              conversationId: typingConvId,
              timestamp: new Date(),
            });
          }
        } catch (e) {
          logger.warn('chat:typing group relay failed', e);
        }
        return;
      }

      if (!recipientId) return;
      if (!tenantId) return;
      const typingCheck = await assertRecipientInOrg(recipientId, tenantId);
      if (!typingCheck.ok) return;
      io.to(`user_${recipientId}`).emit('chat:user_typing', {
        userId,
        isTyping,
        timestamp: new Date()
      });
    });

    /**
     * Get conversation history
     * Emitted by: Client
     * Data: { conversationId, page, limit }
     */
    socket.on('chat:get_history', async (data) => {
      try {
        const { conversationId, page = 1, limit = 50 } = data;

        const orgId = await effectiveTenantId(socket);
        if (!orgId) {
          socket.emit('chat:error', { message: 'Organization context required' });
          return;
        }

        const access = await assertConversationAccess(conversationId, userId, orgId);
        if (!access.ok) {
          socket.emit('chat:error', { message: access.message });
          return;
        }

        const messages = await ChatMessage.find({
          conversationId: String(conversationId),
          orgId: String(orgId),
          isDeleted: false
        })
          .populate('sender', 'name email avatar')
          .populate('recipient', 'name email avatar')
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip((page - 1) * limit)
          .lean();

        socket.emit('chat:history', {
          conversationId,
          messages,
          page,
          limit,
          total: messages.length
        });

        logger.info(`Conversation history fetched for ${conversationId}`);
      } catch (error) {
        logger.error('Error fetching conversation history', error);
        socket.emit('chat:error', { message: 'Failed to fetch history' });
      }
    });

    /**
     * Get unread messages
     * Emitted by: Client
     */
    socket.on('chat:get_unread', async () => {
      try {
        const orgId = await effectiveTenantId(socket);
        if (!orgId) {
          socket.emit('chat:unread_messages', { messages: [], count: 0 });
          return;
        }
        const unreadMessages = await ChatMessage.find({
          orgId: String(orgId),
          $or: [
            { recipientId: userId },
            { 'channelInfo.participants': userId }
          ],
          'readBy.userId': { $ne: userId },
          isDeleted: false
        })
          .populate('sender', 'name email avatar')
          .sort({ createdAt: -1 })
          .lean();

        socket.emit('chat:unread_messages', {
          messages: unreadMessages,
          count: unreadMessages.length
        });

        logger.info(`Unread messages fetched for ${userId}`);
      } catch (error) {
        logger.error('Error fetching unread messages', error);
        socket.emit('chat:error', { message: 'Failed to fetch unread messages' });
      }
    });

    /**
     * Get all conversations
     * Emitted by: Client
     */
    socket.on('chat:get_conversations', async () => {
      try {
        const conversations = await ChatMessage.aggregate([
          {
            $match: {
              orgId: tenantId ? String(tenantId) : null,
              $or: [
                { senderId: userId },
                { recipientId: userId },
                { 'channelInfo.participants': userId }
              ],
              isDeleted: false
            }
          },
          {
            $sort: { createdAt: -1 }
          },
          {
            $group: {
              _id: '$conversationId',
              lastMessage: { $first: '$$ROOT' },
              messageCount: { $sum: 1 },
              unreadCount: {
                $sum: {
                  $cond: [
                    { $not: [{ $in: [userId, '$readBy.userId'] }] },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'lastMessage.senderId',
              foreignField: '_id',
              as: 'sender'
            }
          },
          {
            $limit: 50
          }
        ]);

        socket.emit('chat:conversations', {
          conversations,
          count: conversations.length
        });

        logger.info(`Conversations fetched for ${userId}`);
      } catch (error) {
        logger.error('Error fetching conversations', error);
        socket.emit('chat:error', { message: 'Failed to fetch conversations' });
      }
    });

    /**
     * Edit message
     * Emitted by: Client
     * Data: { messageId, newContent }
     */
    socket.on('chat:edit_message', async (data) => {
      try {
        const { messageId, newContent } = data;
        const message = await ChatMessage.findById(messageId);

        if (!message) {
          socket.emit('chat:error', { message: 'Message not found' });
          return;
        }

        if (!canAccessMessage(message, { userId, orgId: tenantId })) {
          socket.emit('chat:error', { message: 'Access denied' });
          return;
        }

        if (message.senderId.toString() !== userId) {
          socket.emit('chat:error', { message: 'Not authorized to edit this message' });
          return;
        }

        await message.editMessage(newContent);

        const targets = new Set();
        targets.add(String(message.senderId));
        if (message.recipientId) targets.add(String(message.recipientId));
        for (const p of message.channelInfo?.participants || []) {
          targets.add(String(p));
        }
        for (const uid of targets) {
          io.to(`user_${uid}`).emit('chat:message_edited', {
            messageId,
            newContent,
            editedAt: message.metadata.edited.editedAt,
            conversationId: message.conversationId,
          });
        }

        logger.info(`Message ${messageId} edited by ${userId}`);
      } catch (error) {
        logger.error('Error editing message', error);
        socket.emit('chat:error', { message: 'Failed to edit message' });
      }
    });

    /**
     * Delete message
     * Emitted by: Client
     * Data: { messageId }
     */
    socket.on('chat:delete_message', async (data) => {
      try {
        const { messageId } = data;
        const message = await ChatMessage.findById(messageId);

        if (!message) {
          socket.emit('chat:error', { message: 'Message not found' });
          return;
        }

        if (String(message.orgId) !== String(tenantId)) {
          socket.emit('chat:error', { message: 'Access denied' });
          return;
        }

        if (message.senderId.toString() !== userId && role !== 'admin' && role !== 'super_admin') {
          socket.emit('chat:error', { message: 'Not authorized to delete this message' });
          return;
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        message.deletedBy = userId;
        await message.save();

        const targets = new Set();
        targets.add(String(message.senderId));
        if (message.recipientId) targets.add(String(message.recipientId));
        for (const p of message.channelInfo?.participants || []) {
          targets.add(String(p));
        }
        for (const uid of targets) {
          io.to(`user_${uid}`).emit('chat:message_deleted', {
            messageId,
            deletedAt: message.deletedAt,
            conversationId: message.conversationId,
          });
        }

        logger.info(`Message ${messageId} deleted by ${userId}`);
      } catch (error) {
        logger.error('Error deleting message', error);
        socket.emit('chat:error', { message: 'Failed to delete message' });
      }
    });

    /**
     * WebRTC call signaling (in-app audio/video when Teams is unavailable)
     */
    const relayToUser = (recipientId, event, payload) => {
      if (!recipientId) return;
      io.to(`user_${recipientId}`).emit(event, payload);
    };

    socket.on('call:offer', (data) => {
      const { recipientId, sdp, withVideo, callerName } = data || {};
      if (!recipientId || !sdp) {
        socket.emit('chat:error', { message: 'Invalid call offer' });
        return;
      }
      relayToUser(recipientId, 'call:incoming', {
        callerId: userId,
        callerName: callerName || 'User',
        sdp,
        withVideo: !!withVideo,
      });
    });

    socket.on('call:answer', (data) => {
      const { recipientId, sdp } = data || {};
      if (!recipientId || !sdp) {
        socket.emit('chat:error', { message: 'Invalid call answer' });
        return;
      }
      relayToUser(recipientId, 'call:answered', {
        answererId: userId,
        sdp,
      });
    });

    socket.on('call:ice-candidate', (data) => {
      const { recipientId, candidate } = data || {};
      if (!recipientId || !candidate) return;
      relayToUser(recipientId, 'call:ice-candidate', {
        fromUserId: userId,
        candidate,
      });
    });

    socket.on('call:end', (data) => {
      const { recipientId } = data || {};
      if (!recipientId) return;
      relayToUser(recipientId, 'call:ended', { fromUserId: userId });
    });

    socket.on('call:decline', (data) => {
      const { recipientId } = data || {};
      if (!recipientId) return;
      relayToUser(recipientId, 'call:declined', { fromUserId: userId });
    });

    /**
     * Disconnect handler - Phase 1 socket cleanup, Phase 3 offline presence
     */
    socket.on('disconnect', async () => {
      logger.info(`Chat socket disconnected: ${socket.id} for user ${userId}`);
      
      // PHASE 1: Unregister socket and check if user is now offline
      if (userId) {
        const isNowOffline = unregisterUserSocket(userId, socket.id);
        
        // PHASE 3: Mark offline only if no active sockets remain
        if (isNowOffline) {
          logger.info(`User ${userId} is now offline (no active sockets)`);
          
          try {
            if (!tenantId) {
              // Try to resolve tenantId if not available
              const user = await User.findById(userId)
                .select('orgId tenantId organizationId')
                .lean();
              if (user) {
                tenantId = user.orgId || user.tenantId || user.organizationId;
              }
            }

            if (tenantId) {
              // Update user presence in database
              const updated = await User.findByIdAndUpdate(
                userId,
                {
                  presenceStatus: 'offline',
                  lastSeen: new Date()
                },
                { new: true }
              ).select('presenceStatus lastSeen').lean();

              if (updated) {
                logger.info(`User ${userId} marked offline`, {
                  presenceStatus: updated.presenceStatus,
                  lastSeen: updated.lastSeen
                });

                // PHASE 3: Emit presence:update to org room only (org isolation)
                io.to(`org:${tenantId}`).emit('presence:update', {
                  userId: String(userId),
                  presenceStatus: 'offline',
                  lastSeen: updated.lastSeen,
                  orgId: String(tenantId)
                });

                logger.info(`Offline presence update emitted to org ${tenantId}`, {
                  userId: String(userId),
                  presenceStatus: 'offline'
                });
              }
            }
          } catch (error) {
            logger.warn(`Failed to update presence on disconnect for ${userId}`, error.message);
          }
        } else {
          logger.info(`User ${userId} still has active sockets, not marking offline`, {
            socketCount: socket.io.sockets.sockets.size
          });
        }
      }
    });
  });
};

export default initializeChatHandlers;
