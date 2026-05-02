import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: { 
      type: String, 
      required: [true, 'Announcement content is required'],
      trim: true,
      maxlength: [5000, 'Content cannot exceed 5000 characters']
    },
    type: {
      type: String,
      enum: ["general", "urgent", "policy", "event", "holiday", "system", "celebration"],
      default: "general",
      index: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true
    },
    visibility: {
      type: String,
      enum: ["all", "department", "role", "specific_users"],
      default: "all",
      index: true
    },
    targetAudience: {
      departments: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Department" 
      }],
      roles: [{
        type: String,
        enum: ["super_admin", "admin", "hr", "manager", "employee"]
      }],
      specificUsers: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      }]
    },
    authorId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    orgId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Organization",
      required: true,
      index: true
    },
    publishedAt: { 
      type: Date,
      index: true
    },
    expiresAt: { 
      type: Date,
      index: true
    },
    isPublished: { 
      type: Boolean, 
      default: false,
      index: true
    },
    isDraft: { 
      type: Boolean, 
      default: true 
    },
    isPinned: { 
      type: Boolean, 
      default: false,
      index: true
    },
    attachments: [{
      fileName: String,
      filePath: String,
      fileSize: String,
      fileType: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
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
    likes: [{
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
      },
      likedAt: { 
        type: Date, 
        default: Date.now 
      }
    }],
    comments: [{
      userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true
      },
      comment: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: [1000, 'Comment cannot exceed 1000 characters']
      },
      createdAt: { 
        type: Date, 
        default: Date.now 
      }
    }],
    viewCount: {
      type: Number,
      default: 0
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
announcementSchema.index({ orgId: 1, isPublished: 1, publishedAt: -1 });
announcementSchema.index({ orgId: 1, isPinned: 1, publishedAt: -1 });
announcementSchema.index({ authorId: 1, createdAt: -1 });
announcementSchema.index({ type: 1, priority: 1, publishedAt: -1 });
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for author details
announcementSchema.virtual('author', {
  ref: 'User',
  localField: 'authorId',
  foreignField: '_id',
  justOne: true
});

// Virtual for read count
announcementSchema.virtual('readCount').get(function() {
  return this.readBy ? this.readBy.length : 0;
});

// Virtual for like count
announcementSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for comment count
announcementSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for expired status
announcementSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Static method to get published announcements
announcementSchema.statics.getPublished = function(orgId, userId = null) {
  const query = {
    orgId,
    isPublished: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  return this.find(query)
    .populate('author', 'name email avatar')
    .sort({ isPinned: -1, publishedAt: -1 })
    .lean();
};

// Static method to get user-specific announcements
announcementSchema.statics.getUserAnnouncements = async function(userId, orgId) {
  const User = mongoose.model('User');
  const Employee = mongoose.model('Employee');
  
  // Get user details
  const user = await User.findById(userId).lean();
  const employee = await Employee.findOne({ userId }).populate('departmentId').lean();
  
  const query = {
    orgId,
    isPublished: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ],
    $and: [
      {
        $or: [
          { visibility: 'all' },
          { 
            visibility: 'department',
            'targetAudience.departments': employee?.departmentId?._id
          },
          {
            visibility: 'role',
            'targetAudience.roles': user?.role
          },
          {
            visibility: 'specific_users',
            'targetAudience.specificUsers': userId
          }
        ]
      }
    ]
  };

  return this.find(query)
    .populate('author', 'name email avatar')
    .sort({ isPinned: -1, publishedAt: -1 })
    .lean();
};

// Method to publish announcement
announcementSchema.methods.publish = async function() {
  this.isPublished = true;
  this.isDraft = false;
  this.publishedAt = new Date();
  
  await this.save();
  
  // Create notifications for target audience
  await this.createNotifications();
  
  return this;
};

// Method to create notifications for target audience
announcementSchema.methods.createNotifications = async function() {
  const Notification = mongoose.model('Notification');
  const User = mongoose.model('User');
  const Employee = mongoose.model('Employee');
  
  let targetUsers = [];
  
  if (this.visibility === 'all') {
    // Get all users in organization
    const employees = await Employee.find({ orgId: this.orgId, status: 'active' })
      .populate('userId')
      .lean();
    targetUsers = employees.map(emp => emp.userId._id);
  } else if (this.visibility === 'department') {
    // Get users in specific departments
    const employees = await Employee.find({ 
      orgId: this.orgId, 
      status: 'active',
      departmentId: { $in: this.targetAudience.departments }
    }).populate('userId').lean();
    targetUsers = employees.map(emp => emp.userId._id);
  } else if (this.visibility === 'role') {
    // Get users with specific roles
    const users = await User.find({ 
      orgId: this.orgId,
      isActive: true,
      role: { $in: this.targetAudience.roles }
    }).lean();
    targetUsers = users.map(user => user._id);
  } else if (this.visibility === 'specific_users') {
    targetUsers = this.targetAudience.specificUsers;
  }
  
  // Create notifications for all target users
  const notifications = targetUsers.map(userId => ({
    title: 'New Announcement',
    message: this.title,
    type: 'announcement',
    priority: this.priority,
    recipientId: userId,
    senderId: this.authorId,
    orgId: this.orgId,
    relatedEntity: {
      entityType: 'announcement',
      entityId: this._id
    },
    actionUrl: `/announcements/${this._id}`
  }));
  
  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
};

// Method to mark as read by user
announcementSchema.methods.markAsRead = async function(userId) {
  const existingRead = this.readBy.find(r => r.userId.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({ userId, readAt: new Date() });
    this.viewCount += 1;
    await this.save();
  }
  
  return this;
};

// Method to toggle like
announcementSchema.methods.toggleLike = async function(userId) {
  const existingLike = this.likes.find(l => l.userId.toString() === userId.toString());
  
  if (existingLike) {
    this.likes = this.likes.filter(l => l.userId.toString() !== userId.toString());
  } else {
    this.likes.push({ userId, likedAt: new Date() });
  }
  
  await this.save();
  return this;
};

// Method to add comment
announcementSchema.methods.addComment = async function(userId, comment) {
  this.comments.push({
    userId,
    comment,
    createdAt: new Date()
  });
  
  await this.save();
  
  // Create notification for author (if not self)
  if (userId.toString() !== this.authorId.toString()) {
    const Notification = mongoose.model('Notification');
    await Notification.createNotification({
      title: 'New Comment on Announcement',
      message: `Someone commented on your announcement: ${this.title}`,
      type: 'announcement',
      recipientId: this.authorId,
      senderId: userId,
      orgId: this.orgId,
      relatedEntity: {
        entityType: 'announcement',
        entityId: this._id
      },
      actionUrl: `/announcements/${this._id}`
    });
  }
  
  return this;
};

const Announcement = mongoose.model("Announcement", announcementSchema);

export default Announcement;