/**
 * Chat Socket.IO Event Handlers
 * Handles real-time messaging with Teams integration and admin notifications
 */

import ChatMessage from '../models/ChatMessage.js';
import User from '../models/User.js';
import logger from './logger.js';
import { sendTeamsMessage } from '../config/teamsConfig.js';

/**
 * Initialize chat socket handlers
 */
export const initializeChatHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const role = socket.role;
    const tenantId = socket.tenantId;

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
        const { recipientId, content, messageType = 'text', teamsIntegration } = data;

        if (!recipientId || !content) {
          socket.emit('chat:error', { message: 'Invalid message data' });
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

        // Send admin notification via Teams if employee sends message to admin
        if (sender.role === 'employee' && (recipient.role === 'admin' || recipient.role === 'super_admin')) {
          try {
            // Send Teams notification to admin
            if (teamsIntegration?.enabled && teamsIntegration?.adminChatId) {
              await sendTeamsMessage(
                teamsIntegration.adminChatId,
                `📧 New message from ${sender.name}:\n\n"${content}"\n\nReply in WorkPlus Pro Chat`
              );
              logger.info(`Admin notification sent to Teams for message from ${sender.name}`);
            }
          } catch (notificationError) {
            logger.warn('Failed to send admin Teams notification', notificationError);
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

        if (message) {
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
    socket.on('chat:typing', (data) => {
      const { recipientId, isTyping } = data;

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

        const messages = await ChatMessage.findConversation(conversationId, page, limit);

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
        const unreadMessages = await ChatMessage.findUnreadForUser(userId);

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

        if (message.senderId.toString() !== userId) {
          socket.emit('chat:error', { message: 'Not authorized to edit this message' });
          return;
        }

        await message.editMessage(newContent);

        // Notify all participants
        io.to(`user_${message.recipientId}`).emit('chat:message_edited', {
          messageId,
          newContent,
          editedAt: message.metadata.edited.editedAt
        });

        socket.emit('chat:message_edited', {
          messageId,
          newContent,
          editedAt: message.metadata.edited.editedAt
        });

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

        if (message.senderId.toString() !== userId && role !== 'admin' && role !== 'super_admin') {
          socket.emit('chat:error', { message: 'Not authorized to delete this message' });
          return;
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        message.deletedBy = userId;
        await message.save();

        // Notify all participants
        io.to(`user_${message.recipientId}`).emit('chat:message_deleted', {
          messageId,
          deletedAt: message.deletedAt
        });

        socket.emit('chat:message_deleted', {
          messageId,
          deletedAt: message.deletedAt
        });

        logger.info(`Message ${messageId} deleted by ${userId}`);
      } catch (error) {
        logger.error('Error deleting message', error);
        socket.emit('chat:error', { message: 'Failed to delete message' });
      }
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
