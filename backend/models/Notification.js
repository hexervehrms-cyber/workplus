import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: { 
      type: String, 
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    type: {
      type: String,
      enum: [
        "info", "success", "warning", "error",
        "leave_request", "leave_approved", "leave_rejected",
        "expense_submitted", "expense_approved", "expense_rejected",
        "payroll_generated", "attendance_reminder",
        "document_uploaded", "task_assigned", "announcement"
      ],
      required: true,
      index: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true
    },
    recipientId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    senderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      index: true
    },
    orgId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Organization",
      required: true,
      index: true
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ["leave_request", "expense", "payroll", "attendance", "document", "task", "announcement"]
      },
      entityId: { type: mongoose.Schema.Types.ObjectId }
    },
    isRead: { 
      type: Boolean, 
      default: false,
      index: true
    },
    readAt: { 
      type: Date 
    },
    isEmailSent: { 
      type: Boolean, 
      default: false 
    },
    emailSentAt: { 
      type: Date 
    },
    isPushSent: { 
      type: Boolean, 
      default: false 
    },
    pushSentAt: { 
      type: Date 
    },
    actionUrl: { 
      type: String,
      trim: true
    },
    actionText: { 
      type: String,
      trim: true,
      maxlength: [50, 'Action text cannot exceed 50 characters']
    },
    expiresAt: { 
      type: Date,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { 
    timestamps: true
  }
);

// Compound indexes for performance
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ orgId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for sender details
notificationSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true
});

// Virtual for recipient details
notificationSchema.virtual('recipient', {
  ref: 'User',
  localField: 'recipientId',
  foreignField: '_id',
  justOne: true
});

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = await this.create({
    title: data.title,
    message: data.message,
    type: data.type,
    priority: data.priority || 'medium',
    recipientId: data.recipientId,
    senderId: data.senderId,
    orgId: data.orgId,
    relatedEntity: data.relatedEntity,
    actionUrl: data.actionUrl,
    actionText: data.actionText,
    expiresAt: data.expiresAt,
    metadata: data.metadata || {}
  });

  // Emit real-time notification via Socket.IO
  const io = global.io;
  if (io) {
    io.to(`user_${data.recipientId}`).emit('notification', {
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      createdAt: notification.createdAt,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText
    });
  }

  return notification;
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function(notificationId, userId) {
  return await this.findOneAndUpdate(
    { _id: notificationId, recipientId: userId },
    { 
      isRead: true, 
      readAt: new Date() 
    },
    { new: true }
  );
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    { recipientId: userId, isRead: false },
    { 
      isRead: true, 
      readAt: new Date() 
    }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ 
    recipientId: userId, 
    isRead: false 
  });
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;