/**
 * Chat Routes - Integrated with Microsoft Teams
 * Handles messaging between users with Teams synchronization
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import ChatMessage from '../models/ChatMessage.js';
import ChatGroup from '../models/ChatGroup.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import storageService from '../utils/storageService.js';
import {
  assertScopedOrgId,
  userOrgIdFromReq,
  userOrgMatchFilter,
} from '../utils/orgScopeHelpers.js';
import {
  assertRecipientInOrg,
  assertConversationAccess,
  canAccessMessage,
} from '../utils/chatAccessHelpers.js';
import {
  sendTeamsMessage,
  getTeamsChatMessages,
  createTeamsChat,
  createTeamsOnlineMeeting,
  isTeamsConfigured,
} from '../config/teamsConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for chat file uploads (memory storage for storageService processing)
const chatFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Configure multer for avatar uploads (memory storage for storageService processing)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Configure multer for group avatar uploads (memory storage for storageService processing)
const groupAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Helper functions for group chat management
async function findGroupForMember(orgId, conversationId, userId) {
  return ChatGroup.findOne({
    conversationId: String(conversationId),
    orgId,
    members: userId,
  });
}

function canManageGroup(req, group) {
  const role = req.user?.role;
  if (['admin', 'super_admin', 'hr'].includes(role)) return true;
  return String(group.createdBy) === String(req.user.userId);
}

async function emitGroupUpdate(orgId, conversationId, payload) {
  if (!global.io) return;
  const group = await ChatGroup.findOne({ conversationId, orgId }).lean();
  if (!group?.members?.length) return;
  for (const mid of group.members) {
    global.io.to(`user_${String(mid)}`).emit('chat:group_updated', {
      conversationId,
      ...payload,
    });
  }
}

/**
 * Send a message
 * POST /api/chat/messages
 */
router.post('/messages', authenticate, asyncHandler(async (req, res) => {
  const { recipientId, content, messageType = 'text', channelInfo, metadata, teamsIntegration } = req.body;
  const senderId = req.user.userId;
  const orgId = userOrgIdFromReq(req) || req.validatedOrgId;
  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'ORG_REQUIRED',
    });
  }

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

  if (recipientId) {
    const recipientCheck = await assertRecipientInOrg(recipientId, orgId);
    if (!recipientCheck.ok) {
      return res.status(recipientCheck.status).json({
        success: false,
        message: recipientCheck.message,
        code: 'CHAT_RECIPIENT_FORBIDDEN'
      });
    }
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
 * GET /api/chat/groups
 * List group chats the current user belongs to (same org).
 */
router.get('/groups', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  const groups = await ChatGroup.find({ orgId, members: userId })
    .select('conversationId name members createdAt avatar createdBy')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({
    success: true,
    data: groups.map((g) => ({
      conversationId: g.conversationId,
      name: g.name,
      avatar: g.avatar || null,
      createdBy: g.createdBy ? String(g.createdBy) : null,
      members: (g.members || []).map((m) => String(m)),
    })),
  });
}));

/**
 * POST /api/chat/groups
 * Create a group and seed a system message so the thread appears for all members.
 * Body: { name: string, memberIds: string[] } — creator is added automatically; at least one other member required.
 */
router.post('/groups', authenticate, asyncHandler(async (req, res) => {
  const creatorId = req.user.userId;
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;
  const groupName = String(req.body?.name || '').trim();
  const rawMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

  if (!groupName) {
    return res.status(400).json({ success: false, message: 'Group name is required' });
  }

  const otherIds = [
    ...new Set(
      rawMembers
        .map((id) => String(id))
        .filter(Boolean)
        .filter((id) => id !== String(creatorId))
    ),
  ];

  if (otherIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Add at least one employee to the group',
    });
  }

  if (otherIds.length > 99) {
    return res.status(400).json({ success: false, message: 'Too many members (max 99 besides you)' });
  }

  const allIdStrings = [...new Set([String(creatorId), ...otherIds])];
  const memberObjectIdsForLookup = allIdStrings
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const usersFound = await User.find({
    _id: { $in: memberObjectIdsForLookup },
    ...userOrgMatchFilter(orgId),
    isActive: true,
    deletedAt: null,
  })
    .select('_id')
    .lean();

  const foundIdSet = new Set(usersFound.map((u) => String(u._id)));
  const missing = allIdStrings.filter((id) => !foundIdSet.has(String(id)));
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Some users are not in your organization or are inactive',
      data: { missingUserIds: missing },
    });
  }

  const conversationId = `grp_${new mongoose.Types.ObjectId().toString()}`;
  const memberObjectIds = allIdStrings.map((id) => new mongoose.Types.ObjectId(id));

  await ChatGroup.create({
    conversationId,
    name: groupName,
    orgId,
    createdBy: creatorId,
    members: memberObjectIds,
  });

  const seed = new ChatMessage({
    senderId: creatorId,
    recipientId: null,
    conversationId,
    messageType: 'system',
    content: {
      text: `Group "${groupName}" was created.`,
      system: { action: 'group_created', data: { name: groupName } },
    },
    channelInfo: {
      channelType: 'group',
      channelId: conversationId,
      participants: memberObjectIds,
    },
    orgId,
    status: 'delivered',
  });
  await seed.save();

  if (global.io) {
    for (const mid of allIdStrings) {
      global.io.to(`user_${mid}`).emit('chat:group_created', {
        conversationId,
        name: groupName,
        memberIds: allIdStrings,
      });
    }
  }

  res.status(201).json({
    success: true,
    data: {
      conversationId,
      name: groupName,
      memberIds: allIdStrings,
    },
    message: 'Group created',
  });
}));

/**
 * PATCH /api/chat/groups/:conversationId
 * Update group name (creator or admin/hr).
 */
router.patch(
  '/groups/:conversationId',
  authenticate,
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const groupName = String(req.body?.name || '').trim();

    if (!groupName) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    const group = await findGroupForMember(orgId, conversationId, userId);
    if (!group) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }
    if (!canManageGroup(req, group)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this group' });
    }

    group.name = groupName;
    await group.save();
    await emitGroupUpdate(orgId, conversationId, { name: groupName });

    res.json({
      success: true,
      data: {
        conversationId,
        name: groupName,
        avatar: group.avatar || null,
        memberIds: (group.members || []).map((m) => String(m)),
      },
      message: 'Group updated',
    });
  })
);

/**
 * POST /api/chat/groups/:conversationId/avatar
 * Upload group avatar (creator or admin/hr).
 */
router.post(
  '/groups/:conversationId/avatar',
  authenticate,
  groupAvatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user.userId;
    const { conversationId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No avatar file provided' });
    }

    const group = await findGroupForMember(orgId, conversationId, userId);
    if (!group) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }
    if (!canManageGroup(req, group)) {
      return res.status(403).json({ success: false, message: 'Not authorized to change group photo' });
    }

    try {
      // Upload via storageService (GridFS or local)
      const uploadResult = await storageService.uploadFile({
        buffer: req.file.buffer,
        folder: 'chat/group-avatars',
        fileName: `group-avatar-${conversationId}-${Date.now()}${path.extname(req.file.originalname)}`,
        mimeType: req.file.mimetype,
        size: req.file.size
      });

      // Store avatar path for backward compatibility
      const avatarPath = `/uploads/chat/group-avatars/${uploadResult.storageKey}`;
      
      // Clean up old avatar file if it exists and uses GridFS
      if (group.avatar && group.avatarStorageKey) {
        try {
          await storageService.deleteFile(group.avatarStorageKey);
        } catch (cleanupError) {
          logger.warn('Failed to clean up old group avatar', { error: cleanupError.message });
        }
      }

      group.avatar = avatarPath;
      group.avatarStorageKey = uploadResult.storageKey;
      group.avatarStorageDriver = uploadResult.driver;
      await group.save();
      await emitGroupUpdate(orgId, conversationId, { avatar: avatarPath });

      res.json({
        success: true,
        data: {
          conversationId,
          avatar: avatarPath,
          name: group.name,
        },
        message: 'Group photo updated',
      });
    } catch (error) {
      logger.error('Group avatar upload failed', { error: error.message, conversationId });
      res.status(500).json({
        success: false,
        message: 'Failed to upload group avatar',
        error: error.message
      });
    }
  })
);

/**
 * POST /api/chat/groups/:conversationId/members
 * Add members to an existing group.
 */
router.post(
  '/groups/:conversationId/members',
  authenticate,
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const rawMembers = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

    const group = await findGroupForMember(orgId, conversationId, userId);
    if (!group) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }

    const existing = new Set((group.members || []).map((m) => String(m)));
    const toAdd = [
      ...new Set(
        rawMembers
          .map((id) => String(id))
          .filter(Boolean)
          .filter((id) => !existing.has(id))
      ),
    ];

    if (toAdd.length === 0) {
      return res.status(400).json({ success: false, message: 'No new members to add' });
    }

    const memberObjectIdsForLookup = toAdd
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const usersFound = await User.find({
      _id: { $in: memberObjectIdsForLookup },
      ...userOrgMatchFilter(orgId),
      isActive: true,
      deletedAt: null,
    })
      .select('_id name')
      .lean();

    const foundIdSet = new Set(usersFound.map((u) => String(u._id)));
    const missing = toAdd.filter((id) => !foundIdSet.has(String(id)));
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some users are not in your organization or are inactive',
        data: { missingUserIds: missing },
      });
    }

    for (const id of toAdd) {
      group.members.push(new mongoose.Types.ObjectId(id));
    }
    await group.save();

    const memberIds = (group.members || []).map((m) => String(m));
    const addedNames = usersFound.map((u) => u.name).filter(Boolean).join(', ');

    const seed = new ChatMessage({
      senderId: userId,
      recipientId: null,
      conversationId,
      messageType: 'system',
      content: {
        text: addedNames
          ? `${addedNames} joined the group.`
          : `${toAdd.length} member(s) joined the group.`,
        system: { action: 'members_added', data: { memberIds: toAdd } },
      },
      channelInfo: {
        channelType: 'group',
        channelId: conversationId,
        participants: group.members,
      },
      orgId,
      status: 'delivered',
    });
    await seed.save();

    await emitGroupUpdate(orgId, conversationId, {
      name: group.name,
      memberIds,
      avatar: group.avatar || null,
    });

    if (global.io) {
      for (const mid of toAdd) {
        global.io.to(`user_${mid}`).emit('chat:group_created', {
          conversationId,
          name: group.name,
          memberIds,
        });
      }
    }

    res.json({
      success: true,
      data: {
        conversationId,
        name: group.name,
        memberIds,
        added: toAdd,
      },
      message: 'Members added',
    });
  })
);

/**
 * DELETE /api/chat/groups/:conversationId
 * Delete group (creator or admin/super_admin/hr only).
 */
router.delete(
  '/groups/:conversationId',
  authenticate,
  asyncHandler(async (req, res) => {
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const userId = req.user.userId;
    const { conversationId } = req.params;

    const group = await findGroupForMember(orgId, conversationId, userId);
    if (!group) {
      return res.status(403).json({ success: false, message: 'Not a member of this group' });
    }
    if (!canManageGroup(req, group)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this group' });
    }

    const memberIds = (group.members || []).map((m) => String(m));
    await ChatMessage.deleteMany({ conversationId, orgId });
    await ChatGroup.deleteOne({ _id: group._id });

    if (global.io) {
      for (const mid of memberIds) {
        global.io.to(`user_${mid}`).emit('chat:group_deleted', { conversationId });
      }
    }

    res.json({
      success: true,
      message: 'Group deleted',
      data: { conversationId },
    });
  })
);

/**
 * POST /api/chat/upload
 * Upload a file attachment for direct/group messages via storageService
 * Stores in GridFS or local depending on FILE_STORAGE_DRIVER
 * Maintains backward compatibility with old file paths
 */
router.post(
  '/upload',
  authenticate,
  chatFileUpload.single('file'),
  asyncHandler(async (req, res) => {
    const senderId = req.user.userId;
    const orgId = assertScopedOrgId(req, res);
    if (!orgId) return;
    const { recipientId, conversationId: groupConversationId } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
      // Upload via storageService (GridFS or local)
      const uploadResult = await storageService.uploadFile({
        buffer: req.file.buffer,
        folder: 'chat',
        fileName: `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`,
        mimeType: req.file.mimetype,
        size: req.file.size
      });

      // Backward compatibility: create local path format
      const relPath = `/uploads/chat/${uploadResult.storageKey}`;

      if (groupConversationId && String(groupConversationId).startsWith('grp_')) {
        const group = await ChatGroup.findOne({
          conversationId: String(groupConversationId),
          orgId,
          members: senderId,
        })
          .select('members conversationId')
          .lean();

        if (!group) {
          return res.status(403).json({ success: false, message: 'Not a member of this group' });
        }

        const message = await ChatMessage.create({
          senderId,
          recipientId: null,
          conversationId: group.conversationId,
          messageType: 'file',
          content: {
            text: relPath,
            file: {
              fileName: req.file.originalname,
              filePath: relPath,
              fileSize: req.file.size,
              mimeType: req.file.mimetype,
              // NEW: Store GridFS metadata
              storageKey: uploadResult.storageKey,
              storageDriver: uploadResult.driver
            },
          },
          channelInfo: {
            channelType: 'group',
            channelId: group.conversationId,
            participants: group.members,
          },
          orgId,
          status: 'delivered',
        });

        if (global.io) {
          const senderDoc = await User.findById(senderId).select('name avatar').lean();
          const payload = {
            messageId: message._id,
            senderId: message.senderId,
            conversationId: message.conversationId,
            content: relPath,
            messageType: 'file',
            timestamp: message.createdAt,
            attachment: {
              fileName: req.file.originalname,
              fileSize: req.file.size,
              mimeType: req.file.mimetype,
              storageKey: uploadResult.storageKey,
              storageDriver: uploadResult.driver
            },
          };
          for (const mid of group.members) {
            global.io.to(`user_${mid}`).emit('chat:new_message', {
              ...payload,
              senderName: senderDoc?.name || 'User',
              senderAvatar: senderDoc?.avatar,
              status: String(mid) === String(senderId) ? 'sent' : 'delivered',
            });
          }
        }

        logger.info('Chat file uploaded to group via storageService', {
          conversationId: group.conversationId,
          messageId: message._id,
          storageKey: uploadResult.storageKey,
          driver: uploadResult.driver,
          size: req.file.size
        });

        return res.status(201).json({
          success: true,
          data: {
            messageId: message._id.toString(),
            attachment: {
              fileName: req.file.originalname,
              fileSize: req.file.size,
              mimeType: req.file.mimetype,
              storageKey: uploadResult.storageKey,
              storageDriver: uploadResult.driver
            },
          },
          message: 'File uploaded',
        });
      }

      if (!recipientId) {
        return res.status(400).json({
          success: false,
          message: 'recipientId or group conversationId is required',
        });
      }

      const recipient = await User.findOne({
        _id: recipientId,
        orgId,
        isActive: true,
        deletedAt: null,
      })
        .select('_id')
        .lean();

      if (!recipient) {
        return res.status(404).json({ success: false, message: 'Recipient not found' });
      }

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
            mimeType: req.file.mimetype,
            // NEW: Store GridFS metadata
            storageKey: uploadResult.storageKey,
            storageDriver: uploadResult.driver
          },
        },
        channelInfo: {
          channelType: 'direct',
          participants: [senderId, recipientId],
        },
        orgId,
        status: 'delivered',
      });

      logger.info('Chat file uploaded via storageService', {
        messageId: message._id,
        conversationId,
        storageKey: uploadResult.storageKey,
        driver: uploadResult.driver,
        size: req.file.size
      });

      res.status(201).json({
        success: true,
        data: {
          messageId: message._id.toString(),
          attachment: {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            storageKey: uploadResult.storageKey,
            storageDriver: uploadResult.driver
          },
        },
        message: 'File uploaded',
      });
    } catch (error) {
      logger.error('Chat file upload failed', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to upload file',
        error: error.message
      });
    }
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
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  try {
    const access = await assertConversationAccess(conversationId, userId, orgId);
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message
      });
    }

    const messages = await ChatMessage.find({
      conversationId: String(conversationId),
      orgId: String(orgId),
      isDeleted: false
    })
      .populate('sender', 'name email avatar')
      .populate('recipient', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
      .lean();

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
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  try {
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
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  try {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (!canAccessMessage(message, { userId, orgId })) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
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
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  try {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (!canAccessMessage(message, { userId, orgId })) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
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
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  try {
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (String(message.orgId) !== String(orgId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
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
      const targets = new Set();
      targets.add(String(message.senderId));
      if (message.recipientId) targets.add(String(message.recipientId));
      for (const p of message.channelInfo?.participants || []) {
        targets.add(String(p));
      }
      for (const uid of targets) {
        global.io.to(`user_${uid}`).emit('chat:message_deleted', payload);
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
  const orgId = userOrgIdFromReq(req) || req.validatedOrgId;
  if (!orgId) {
    return res.status(400).json({
      success: false,
      message: 'Organization context required',
      code: 'ORG_REQUIRED',
    });
  }

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
 * Teams integration availability
 * GET /api/chat/teams/status
 */
router.get('/teams/status', authenticate, asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: { configured: isTeamsConfigured() },
  });
}));

/**
 * Create Microsoft Teams online meeting for in-platform voice/video
 * POST /api/chat/teams/meeting
 */
router.post('/teams/meeting', authenticate, asyncHandler(async (req, res) => {
  const { recipientId, withVideo = true } = req.body;
  const userId = req.user.userId;
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  if (!recipientId) {
    return res.status(400).json({
      success: false,
      message: 'recipientId is required',
    });
  }

  const recipientCheck = await assertRecipientInOrg(recipientId, orgId);
  if (!recipientCheck.ok) {
    return res.status(recipientCheck.status).json({
      success: false,
      message: recipientCheck.message
    });
  }

  if (!isTeamsConfigured()) {
    return res.status(503).json({
      success: false,
      code: 'TEAMS_NOT_CONFIGURED',
      message:
        'Microsoft Teams is not configured on this server. In-app calling is available instead.',
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
        error.message ||
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
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  const recipientCheck = await assertRecipientInOrg(recipientId, orgId);
  if (!recipientCheck.ok) {
    return res.status(recipientCheck.status).json({
      success: false,
      message: recipientCheck.message
    });
  }

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
    const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

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
    }).select('avatar name email avatarStorageKey avatarStorageDriver');

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    try {
      // Upload via storageService (GridFS or local)
      const uploadResult = await storageService.uploadFile({
        buffer: req.file.buffer,
        folder: 'chat/user-avatars',
        fileName: `user-avatar-${targetUserId}-${Date.now()}${path.extname(req.file.originalname)}`,
        mimeType: req.file.mimetype,
        size: req.file.size
      });

      // Store avatar path for backward compatibility
      const avatarPath = `/uploads/chat/user-avatars/${uploadResult.storageKey}`;
      
      // Clean up old avatar file if it exists and uses GridFS
      if (targetUser.avatar && targetUser.avatarStorageKey) {
        try {
          await storageService.deleteFile(targetUser.avatarStorageKey);
        } catch (cleanupError) {
          logger.warn('Failed to clean up old user avatar', { error: cleanupError.message });
        }
      }

      targetUser.avatar = avatarPath;
      targetUser.avatarStorageKey = uploadResult.storageKey;
      targetUser.avatarStorageDriver = uploadResult.driver;
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
    } catch (error) {
      logger.error('User avatar upload failed', { error: error.message, userId: targetUserId });
      res.status(500).json({
        success: false,
        message: 'Failed to upload avatar',
        error: error.message
      });
    }
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
    const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

    let filter = {
      _id: { $ne: currentUserId },
      ...userOrgMatchFilter(orgId),
      isActive: true,
      deletedAt: null,
    };

    // Role-based filtering — employee/admin chat excludes super_admin
    if (currentUserRole === 'employee') {
      filter.role = { $in: ['admin', 'hr', 'manager', 'employee'] };
    } else if (currentUserRole === 'admin' || currentUserRole === 'hr' || currentUserRole === 'manager') {
      filter.role = { $in: ['employee', 'admin', 'hr', 'manager'] };
    } else if (currentUserRole === 'super_admin') {
      // Super admins can see everyone in org
    } else {
      filter.role = { $in: ['admin', 'hr', 'manager', 'employee'] };
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

/**
 * GET /api/chat/messages/:messageId/attachment/view
 * View attachment file with GridFS support and fallback to local storage
 */
router.get('/messages/:messageId/attachment/view', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  try {
    // Look up message by ID
    const message = await ChatMessage.findById(messageId).lean();
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Verify org match
    if (String(message.orgId) !== String(orgId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
      });
    }

    // Authorization: sender or valid participant
    const isSender = String(message.senderId) === String(userId);
    const isRecipient = message.recipientId && String(message.recipientId) === String(userId);
    const isParticipant = (message.channelInfo?.participants || []).some(
      p => String(p) === String(userId)
    );

    if (!isSender && !isRecipient && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this attachment'
      });
    }

    // Get file info from message content
    const fileInfo = message.content?.file;
    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        message: 'No attachment found in this message'
      });
    }

    let fileStream;
    const fileName = fileInfo.fileName || 'attachment';
    const mimeType = fileInfo.mimeType || 'application/octet-stream';

    // Try GridFS first if storage key exists
    if (fileInfo.storageKey && fileInfo.storageDriver) {
      try {
        fileStream = await storageService.getFileStream(fileInfo.storageKey, fileInfo.storageDriver);
        logger.info('Chat attachment retrieved from GridFS', { 
          messageId, 
          storageKey: fileInfo.storageKey, 
          driver: fileInfo.storageDriver 
        });
      } catch (gridfsError) {
        logger.warn('Failed to retrieve chat attachment from GridFS, falling back to local', { 
          error: gridfsError.message, 
          messageId 
        });
        fileStream = null;
      }
    }

    // Fall back to local file if GridFS fails or no storage key
    if (!fileStream && fileInfo.filePath) {
      // Path traversal prevention: ensure path is within uploads directory
      const resolvedPath = path.resolve(__dirname, '..', fileInfo.filePath);
      const uploadsDir = path.resolve(__dirname, '..', 'uploads');
      
      if (!resolvedPath.startsWith(uploadsDir)) {
        return res.status(403).json({
          success: false,
          message: 'Invalid file path'
        });
      }

      // Verify file exists
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }

      fileStream = fs.createReadStream(resolvedPath);
      logger.info('Chat attachment retrieved from local storage (fallback)', { messageId });
    }

    if (!fileStream) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Set headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Send file
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Error viewing attachment', error);
    res.status(500).json({
      success: false,
      message: 'Failed to view attachment',
      error: error.message
    });
  }
}));

/**
 * GET /api/chat/messages/:messageId/attachment/download
 * Download attachment file with GridFS support and fallback to local storage
 */
router.get('/messages/:messageId/attachment/download', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;
  const orgId = assertScopedOrgId(req, res);
  if (!orgId) return;

  try {
    // Look up message by ID
    const message = await ChatMessage.findById(messageId).lean();
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Verify org match
    if (String(message.orgId) !== String(orgId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
      });
    }

    // Authorization: sender or valid participant
    const isSender = String(message.senderId) === String(userId);
    const isRecipient = message.recipientId && String(message.recipientId) === String(userId);
    const isParticipant = (message.channelInfo?.participants || []).some(
      p => String(p) === String(userId)
    );

    if (!isSender && !isRecipient && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to download this attachment'
      });
    }

    // Get file info from message content
    const fileInfo = message.content?.file;
    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        message: 'No attachment found in this message'
      });
    }

    let fileStream;
    const fileName = fileInfo.fileName || 'attachment';
    const mimeType = fileInfo.mimeType || 'application/octet-stream';

    // Try GridFS first if storage key exists
    if (fileInfo.storageKey && fileInfo.storageDriver) {
      try {
        fileStream = await storageService.getFileStream(fileInfo.storageKey, fileInfo.storageDriver);
        logger.info('Chat attachment downloaded from GridFS', { 
          messageId, 
          storageKey: fileInfo.storageKey, 
          driver: fileInfo.storageDriver 
        });
      } catch (gridfsError) {
        logger.warn('Failed to retrieve chat attachment from GridFS, falling back to local', { 
          error: gridfsError.message, 
          messageId 
        });
        fileStream = null;
      }
    }

    // Fall back to local file if GridFS fails or no storage key
    if (!fileStream && fileInfo.filePath) {
      // Path traversal prevention: ensure path is within uploads directory
      const resolvedPath = path.resolve(__dirname, '..', fileInfo.filePath);
      const uploadsDir = path.resolve(__dirname, '..', 'uploads');
      
      if (!resolvedPath.startsWith(uploadsDir)) {
        return res.status(403).json({
          success: false,
          message: 'Invalid file path'
        });
      }

      // Verify file exists
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }

      fileStream = fs.createReadStream(resolvedPath);
      logger.info('Chat attachment downloaded from local storage (fallback)', { messageId });
    }

    if (!fileStream) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Set headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Send file stream
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Error downloading attachment', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download attachment',
      error: error.message
    });
  }
}));

export default router;
