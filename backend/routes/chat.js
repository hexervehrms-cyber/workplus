/**
 * Chat Routes - Integrated with Microsoft Teams
 * Handles messaging between users with Teams synchronization
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import ChatMessage from '../models/ChatMessage.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import {
  sendTeamsMessage,
  getTeamsChatMessages,
  createTeamsChat,
  createTeamsOnlineMeeting,
} from '../config/teamsConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const chatUploadDir = path.join(__dirname, '..', 'uploads', 'chat');
const chatFileStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    if (!fs.existsSync(chatUploadDir)) {
      fs.mkdirSync(chatUploadDir, { recursive: true });
    }
    cb(null, chatUploadDir);
  },
  filename(_req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `chat-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const avatarUploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
const avatarStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    if (!fs.existsSync(avatarUploadDir)) {
      fs.mkdirSync(avatarUploadDir, { recursive: true });
    }
    cb(null, avatarUploadDir);
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const targetId = req.params.userId || req.user?.userId || 'user';
    cb(null, `avatar-${targetId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const chatFileUpload = multer({
  storage: chatFileStorage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

/**
 * Send a message
 * POST /api/chat/messages
 */
router.post('/messages', authenticate, asyncHandler(async (req, res) => {
  const { recipientId, content, messageType = 'text', channelInfo, metadata, teamsIntegration } = req.body;
  const senderId = req.user.userId;
  const orgId = req.user.orgId;

  // Validate input
  if (!recipientId && !channelInfo?.channelId) {
    return res.status(400).json({
      success: false,
      message: 'Either recipientId or channelInfo is required'
    });
  }

  if (!content || !content.text) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required'
    });
  }

  try {
    // Create conversation ID
    const conversationId = recipientId 
      ? [senderId, recipientId].sort().join('_')
      : channelInfo?.channelId;

    // Create message document
    const message = new ChatMessage({
      senderId,
      recipientId: recipientId || null,
      conversationId,
      messageType,
      content,
      channelInfo: channelInfo || {
        channelType: 'direct',
        participants: [senderId, recipientId]
      },
      metadata: {
        ...metadata,
        teamsIntegration: teamsIntegration || {}
      },
      orgId,
      status: 'sent'
    });

    await message.save();

    // Populate sender details
    await message.populate('sender', 'name email avatar');

    // Send to Teams if integration is enabled
    if (teamsIntegration?.enabled && teamsIntegration?.chatId) {
      try {
        const teamsMessage = await sendTeamsMessage(
          teamsIntegration.chatId,
          `${message.sender.name}: ${content.text}`
        );
        
        // Store Teams message ID for sync
        message.metadata.teamsMessageId = teamsMessage.id;
        await message.save();
        
        logger.info(`Message synced to Teams: ${teamsMessage.id}`);
      } catch (teamsError) {
        logger.warn('Failed to sync message to Teams', teamsError);
        // Don't fail the request if Teams sync fails
      }
    }

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    });
  } catch (error) {
    logger.error('Error sending message', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
}));

/**
 * POST /api/chat/upload
 * Upload a file attachment for a direct message (persists message + file on disk)
 */
router.post(
  '/upload',
  authenticate,
  chatFileUpload.single('file'),
  asyncHandler(async (req, res) => {
    const senderId = req.user.userId;
    const orgId = req.user.orgId;
    const { recipientId } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'recipientId is required' });
    }

    const recipient = await User.findOne({
      _id: recipientId,
      orgId,
      isActive: true,
      deletedAt: null
    }).select('_id').lean();

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const relPath = `/uploads/chat/${req.file.filename}`;
    const conversationId = [String(senderId), String(recipientId)].sort().join('_');

    const message = await ChatMessage.create({
      senderId,
      recipientId,
      conversationId,
      messageType: 'file',
      content: {
        text: relPath,
        file: {
          fileName: req.file.originalname,
          filePath: relPath,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        }
      },
      channelInfo: {
        channelType: 'direct',
        participants: [senderId, recipientId]
      },
      orgId,
      status: 'delivered'
    });

    res.status(201).json({
      success: true,
      data: {
        fileUrl: relPath,
        messageId: message.messageId || message._id.toString(),
        fileName: req.file.originalname
      },
      message: 'File uploaded'
    });
  })
);

/**
 * Get conversation messages
 * GET /api/chat/conversations/:conversationId
 */
router.get('/conversations/:conversationId', authenticate, asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const userId = req.user.userId;
  const orgId = req.user.orgId;

  try {
    // Verify user has access to this conversation
    const messages = await ChatMessage.findConversation(conversationId, page, limit);
    
    // Check if user is part of this conversation
    const isParticipant = messages.some(msg => 
      msg.senderId.toString() === userId || 
      msg.recipientId?.toString() === userId ||
      msg.channelInfo?.participants?.some(p => p.toString() === userId)
    );

    if (!isParticipant && messages.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: messages.length
      }
    });
  } catch (error) {
    logger.error('Error fetching conversation', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: error.message
    });
  }
}));

/**
 * Get unread messages for user
 * GET /api/chat/unread
 */
router.get('/unread', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  try {
    const unreadMessages = await ChatMessage.findUnreadForUser(userId);

    res.json({
      success: true,
      data: unreadMessages,
      count: unreadMessages.length
    });
  } catch (error) {
    logger.error('Error fetching unread messages', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread messages',
      error: error.message
    });
  }
}));

/**
 * Mark message as read
 * PUT /api/chat/messages/:messageId/read
 */
router.put('/messages/:messageId/read', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  try {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.markAsRead(userId);

    res.json({
      success: true,
      data: message,
      message: 'Message marked as read'
    });
  } catch (error) {
    logger.error('Error marking message as read', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
}));

/**
 * Edit message
 * PUT /api/chat/messages/:messageId
 */
router.put('/messages/:messageId', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  try {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can edit
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only sender can edit this message'
      });
    }

    await message.editMessage(content.text);

    res.json({
      success: true,
      data: message,
      message: 'Message updated successfully'
    });
  } catch (error) {
    logger.error('Error editing message', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit message',
      error: error.message
    });
  }
}));

/**
 * Delete message
 * DELETE /api/chat/messages/:messageId
 */
router.delete('/messages/:messageId', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  try {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender or admin can delete
    if (message.senderId.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    if (global.io) {
      const payload = {
        messageId: message._id.toString(),
        conversationId: message.conversationId,
      };
      global.io.to(`user_${message.senderId}`).emit('chat:message_deleted', payload);
      if (message.recipientId) {
        global.io.to(`user_${message.recipientId}`).emit('chat:message_deleted', payload);
      }
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting message', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
}));

/**
 * Get all conversations for user
 * GET /api/chat/conversations
 */
router.get('/conversations', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const orgId = req.user.orgId;

  try {
    // Get unique conversations
    const conversations = await ChatMessage.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { recipientId: userId },
            { 'channelInfo.participants': userId }
          ],
          isDeleted: false,
          orgId: orgId
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 }
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
        $lookup: {
          from: 'users',
          localField: 'lastMessage.recipientId',
          foreignField: '_id',
          as: 'recipient'
        }
      },
      {
        $limit: 50
      }
    ]);

    res.json({
      success: true,
      data: conversations,
      count: conversations.length
    });
  } catch (error) {
    logger.error('Error fetching conversations', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
}));

/**
 * Create Microsoft Teams online meeting for in-platform voice/video
 * POST /api/chat/teams/meeting
 */
router.post('/teams/meeting', authenticate, asyncHandler(async (req, res) => {
  const { recipientId, withVideo = true } = req.body;
  const userId = req.user.userId;

  if (!recipientId) {
    return res.status(400).json({
      success: false,
      message: 'recipientId is required',
    });
  }

  try {
    const currentUser = await User.findById(userId).select('name email').lean();
    const recipient = await User.findById(recipientId).select('name email').lean();

    if (!recipient?.email) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found',
      });
    }

    if (!currentUser?.email) {
      return res.status(400).json({
        success: false,
        message: 'Your account must have an email linked to Microsoft 365 for Teams calls',
      });
    }

    const subject = withVideo
      ? `Video call: ${currentUser.name} & ${recipient.name}`
      : `Voice call: ${currentUser.name} & ${recipient.name}`;

    const meeting = await createTeamsOnlineMeeting(currentUser.email, subject, !!withVideo);

    res.json({
      success: true,
      data: {
        joinWebUrl: meeting.joinWebUrl,
        meetingId: meeting.meetingId,
        subject: meeting.subject,
        withVideo: !!withVideo,
      },
    });
  } catch (error) {
    logger.error('Error creating Teams meeting', {
      error: error.message,
      response: error.response?.data,
    });
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.error?.message ||
        'Failed to create Teams meeting. Ensure Teams app permissions (OnlineMeetings.ReadWrite.All) are granted.',
    });
  }
}));

/**
 * Create Teams chat and link to conversation
 * POST /api/chat/teams/create
 */
router.post('/teams/create', authenticate, asyncHandler(async (req, res) => {
  const { recipientId, topic } = req.body;
  const userId = req.user.userId;

  try {
    // Get user details
    const currentUser = await User.findById(userId);
    const recipient = await User.findById(recipientId);

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Create Teams chat
    const teamsChat = await createTeamsChat(
      [currentUser.email, recipient.email],
      topic || `Chat between ${currentUser.name} and ${recipient.name}`
    );

    res.json({
      success: true,
      data: {
        teamsChatId: teamsChat.id,
        topic: teamsChat.topic,
        createdAt: teamsChat.createdDateTime
      },
      message: 'Teams chat created successfully'
    });
  } catch (error) {
    logger.error('Error creating Teams chat', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Teams chat',
      error: error.message
    });
  }
}));

/**
 * Sync Teams messages to local database
 * POST /api/chat/teams/sync
 */
router.post('/teams/sync', authenticate, asyncHandler(async (req, res) => {
  const { teamsChatId, conversationId } = req.body;

  try {
    // Get messages from Teams
    const teamsMessages = await getTeamsChatMessages(teamsChatId);

    // Sync to local database
    for (const teamsMsg of teamsMessages) {
      const existingMsg = await ChatMessage.findOne({
        'metadata.teamsMessageId': teamsMsg.id
      });

      if (!existingMsg) {
        // Parse sender info from Teams message
        const senderEmail = teamsMsg.from?.user?.userPrincipalName;
        const sender = await User.findOne({ email: senderEmail });

        if (sender) {
          const message = new ChatMessage({
            senderId: sender._id,
            conversationId,
            messageType: 'text',
            content: {
              text: teamsMsg.body?.content || ''
            },
            metadata: {
              teamsMessageId: teamsMsg.id,
              teamsIntegration: {
                enabled: true,
                chatId: teamsChatId
              }
            },
            orgId: sender.orgId,
            status: 'delivered'
          });

          await message.save();
        }
      }
    }

    res.json({
      success: true,
      message: 'Teams messages synced successfully',
      syncedCount: teamsMessages.length
    });
  } catch (error) {
    logger.error('Error syncing Teams messages', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync Teams messages',
      error: error.message
    });
  }
}));

/**
 * POST /api/chat/users/:userId/avatar
 * Upload avatar for self or (admin) another user in the same org
 */
router.post(
  '/users/:userId/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    const { userId: targetUserId } = req.params;
    const requesterId = req.user.userId;
    const requesterRole = req.user.role;
    const orgId = req.user.orgId || 'system';

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No avatar file provided' });
    }

    const isSelf = String(targetUserId) === String(requesterId);
    if (!isSelf && requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this avatar' });
    }

    const targetUser = await User.findOne({
      _id: targetUserId,
      orgId,
      isActive: true,
      deletedAt: null,
    }).select('avatar name email');

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const avatarPath = `uploads/avatars/${req.file.filename}`;
    targetUser.avatar = avatarPath;
    await targetUser.save();

    if (global.io) {
      global.io.to(`user_${targetUserId}`).emit('chat:avatar_updated', {
        userId: targetUserId,
        avatar: avatarPath,
      });
      global.io.to(`tenant_${orgId}`).emit('chat:avatar_updated', {
        userId: targetUserId,
        avatar: avatarPath,
      });
    }

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatarPath, user: targetUser },
    });
  })
);

/**
 * GET /api/chat/users
 * Get all users for chat (accessible to all authenticated users)
 * Employees see: admins, super_admins, and other employees
 * Admins see: employees, other admins, and super_admins
 * Super admins see: everyone
 */
router.get('/users', authenticate, asyncHandler(async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const currentUserRole = req.user.role;
    const orgId = req.user.orgId || 'system';

    let filter = { 
      _id: { $ne: currentUserId },
      orgId: orgId,
      isActive: true,
      deletedAt: null
    };

    // Role-based filtering
    if (currentUserRole === 'employee') {
      // Employees can see: admins, super_admins, and other employees
      filter.role = { $in: ['admin', 'super_admin', 'employee'] };
    } else if (currentUserRole === 'admin') {
      // Admins can see: employees, other admins, and super_admins
      filter.role = { $in: ['employee', 'admin', 'super_admin'] };
    } else if (currentUserRole === 'super_admin') {
      // Super admins can see: everyone
      // No role filtering needed
    } else {
      // Other roles can see admins and super_admins
      filter.role = { $in: ['admin', 'super_admin'] };
    }

    const users = await User.find(filter)
      .select('_id name email role avatar isActive')
      .sort({ role: 1, name: 1 })
      .lean();

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error('Error fetching chat users', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
}));

export default router;
