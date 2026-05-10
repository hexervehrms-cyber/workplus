import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: { 
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "completed", "cancelled"],
      default: "todo",
      index: true
    },
    assignedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    assignedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
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
    dueDate: { 
      type: Date,
      index: true
    },
    startDate: { 
      type: Date,
      default: Date.now
    },
    completedAt: { 
      type: Date 
    },
    estimatedHours: { 
      type: Number,
      min: [0, 'Estimated hours cannot be negative']
    },
    actualHours: { 
      type: Number,
      min: [0, 'Actual hours cannot be negative']
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: [50, 'Tag cannot exceed 50 characters']
    }],
    attachments: [{
      fileName: String,
      filePath: String,
      fileSize: String,
      uploadedAt: { type: Date, default: Date.now }
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
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"]
      },
      interval: { type: Number, min: 1 },
      endDate: Date
    },
    parentTaskId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Task"
    },
    subtasks: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Task"
    }]
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for performance
taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ orgId: 1, status: 1, createdAt: -1 });
taskSchema.index({ assignedBy: 1, createdAt: -1 });
taskSchema.index({ departmentId: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ tags: 1 });

// Virtual for assigned user details
taskSchema.virtual('assignedUser', {
  ref: 'User',
  localField: 'assignedTo',
  foreignField: '_id',
  justOne: true
});

// Virtual for assigner details
taskSchema.virtual('assigner', {
  ref: 'User',
  localField: 'assignedBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.dueDate < new Date() && this.status !== 'completed';
});

// Virtual for days remaining
taskSchema.virtual('daysRemaining').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const diffTime = this.dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Static method to get user tasks
taskSchema.statics.getUserTasks = function(userId, status = null) {
  const query = { assignedTo: userId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('assignedBy', 'name email')
    .populate('departmentId', 'name')
    .sort({ dueDate: 1, priority: -1, createdAt: -1 })
    .lean();
};

// Static method to get department tasks
taskSchema.statics.getDepartmentTasks = function(departmentId, status = null) {
  const query = { departmentId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('assignedTo', 'name email')
    .populate('assignedBy', 'name email')
    .sort({ dueDate: 1, priority: -1, createdAt: -1 })
    .lean();
};

// Static method to get overdue tasks
taskSchema.statics.getOverdueTasks = function(orgId) {
  return this.find({
    orgId,
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] }
  })
  .populate('assignedTo', 'name email')
  .populate('assignedBy', 'name email')
  .sort({ dueDate: 1 })
  .lean();
};

// Method to add comment
taskSchema.methods.addComment = async function(userId, comment) {
  this.comments.push({
    userId,
    comment,
    createdAt: new Date()
  });
  
  await this.save();
  
  // Create notification for assigned user (if not self)
  if (userId.toString() !== this.assignedTo.toString()) {
    const Notification = mongoose.model('Notification');
    await Notification.createNotification({
      title: 'New Task Comment',
      message: `New comment on task: ${this.title}`,
      type: 'task_assigned',
      recipientId: this.assignedTo,
      senderId: userId,
      orgId: this.orgId,
      relatedEntity: {
        entityType: 'task',
        entityId: this._id
      },
      actionUrl: `/tasks/${this._id}`
    });
  }
  
  return this;
};

// Method to update progress
taskSchema.methods.updateProgress = async function(progress) {
  this.progress = Math.max(0, Math.min(100, progress));
  
  if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  await this.save();
  return this;
};

const Task = mongoose.model("Task", taskSchema);

export default Task;