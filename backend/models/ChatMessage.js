import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      default: () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true // null for group messages
    },
    conversationId: {
      type: String,
      required: true,
      index: true
    },
    messageType: {
      type: String,
      enum: ['text', 'file', 'image', 'system', 'announcement'],
      default: 'text',
      index: true
    },
    content: {
      text: { type: String },
      file: {
        fileName: { type: String },
        filePath: { type: String },
        fileSize: { type: Number },
        mimeType: { type: String }
      },
      system: {
        action: { type: String },
        data: { type: mongoose.Schema.Types.Mixed }
      }
    },
    // Message status
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent',
      index: true
    },
    readBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Group/Channel info
    channelInfo: {
      channelId: { type: String },
      channelType: {
        type: String,
        enum: ['direct', 'group', 'department', 'announcement', 'support']
      },
      participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }]
    },
    // Message metadata
    metadata: {
      priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
      },
      tags: [{ type: String }],
      mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }],
      replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChatMessage"
      },
      edited: {
        isEdited: { type: Boolean, default: false },
        editedAt: { type: Date },
        originalContent: { type: String }
      }
    },
    // Organization context
    orgId: {
      type: String,
      required: true,
      index: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      index: true
    },
    // Compliance & Security
    compliance: {
      isArchived: { type: Boolean, default: false },
      retentionDate: { type: Date },
      isEncrypted: { type: Boolean, default: false },
      classification: {
        type: String,
        enum: ['public', 'internal', 'confidential', 'restricted'],
        default: 'internal'
      }
    },
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1, createdAt: -1 });
chatMessageSchema.index({ orgId: 1, createdAt: -1 });
chatMessageSchema.index({ 'channelInfo.channelId': 1, createdAt: -1 });
chatMessageSchema.index({ status: 1, createdAt: -1 });
chatMessageSchema.index({ messageType: 1, orgId: 1 });
chatMessageSchema.index({ isDeleted: 1, createdAt: -1 });

// Text search index
chatMessageSchema.index({ 
  'content.text': 'text',
  'content.file.fileName': 'text'
});

// Virtual for sender details
chatMessageSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true
});

// Virtual for recipient details
chatMessageSchema.virtual('recipient', {
  ref: 'User',
  localField: 'recipientId',
  foreignField: '_id',
  justOne: true
});

// Virtual for reply message
chatMessageSchema.virtual('replyMessage', {
  ref: 'ChatMessage',
  localField: 'metadata.replyTo',
  foreignField: '_id',
  justOne: true
});

// Method to mark as read
chatMessageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(r => r.userId.toString() === userId.toString());
  if (!existingRead) {
    this.readBy.push({ userId, readAt: new Date() });
    if (this.status === 'delivered') {
      this.status = 'read';
    }
  }
  return this.save();
};

// Method to edit message
chatMessageSchema.methods.editMessage = function(newContent) {
  this.metadata.edited = {
    isEdited: true,
    editedAt: new Date(),
    originalContent: this.content.text
  };
  this.content.text = newContent;
  return this.save();
};

// Static method to find conversation messages
chatMessageSchema.statics.findConversation = function(conversationId, page = 1, limit = 50) {
  return this.find({
    conversationId,
    isDeleted: false
  })
  .populate('sender', 'name email avatar')
  .populate('recipient', 'name email avatar')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip((page - 1) * limit)
  .lean();
};

// Static method to find unread messages
chatMessageSchema.statics.findUnreadForUser = function(userId) {
  return this.find({
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
};

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

export default ChatMessage;