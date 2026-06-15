/**
 * Chat Socket.IO Event Handlers
 * Handles real-time messaging with Teams integration and admin notifications
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

    // Join user-specific room for direct messages
    socket.join(`user_${userId}`);

    /**
     * Send message event
     * Emitted by: Client
     * Data: { recipientId, content, messageType, teamsIntegration }
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
          const group = await ChatGroup.findOne({
            conversationId,
            orgId: tenantId,
          }).lean();

          if (!group || !group.members.some((m) => m.toString() === userId)) {
            socket.emit('chat:error', { message: 'Not a member of this group' });
            return;
          }

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

          const basePayload = {
            messageId: message._id,
            senderId: message.senderId,
            senderName: message.sender.name,
            senderAvatar: message.sender.avatar,
            content: message.content.text,
            timestamp: message.createdAt,
            conversationId: message.conversationId,
          };

          for (const mid of group.members) {
            io.to(`user_${mid}`).emit('chat:new_message', {
              ...basePayload,
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

        const recipientCheck = await assertRecipientInOrg(recipientId, tenantId);
        if (!recipientCheck.ok) {
          socket.emit('chat:error', { message: recipientCheck.message });
          return;
        }

        // Create message document
        const message = new ChatMessage({
          senderId: userId,
          recipientId,
          conversationId: [userId, recipientId].sort().join('_'),
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

        // Emit to recipient
        io.to(`user_${recipientId}`).emit('chat:new_message', {
          messageId: message._id,
          senderId: message.senderId,
          senderName: message.sender.name,
          senderAvatar: message.sender.avatar,
          content: message.content.text,
          timestamp: message.createdAt,
          conversationId: message.conversationId,
          status: 'delivered'
        });

        // Also emit to sender so they see their own message
        socket.emit('chat:new_message', {
          messageId: message._id,
          senderId: message.senderId,
          senderName: message.sender.name,
          senderAvatar: message.sender.avatar,
          content: message.content.text,
          timestamp: message.createdAt,
          conversationId: message.conversationId,
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
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      logger.info(`Chat socket disconnected: ${socket.id} for user ${userId}`);
    });
  });
};

export default initializeChatHandlers;
