import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import Task from "../models/Task.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * GET /api/tasks
 * Get tasks with filtering and pagination
 */
router.get("/", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  const {
    status,
    priority,
    assignedTo,
    createdBy,
    dueDate,
    category,
    page = 1,
    limit = 50,
    search
  } = req.query;
  
  const filter = { orgId };
  
  // Role-based filtering
  if (userRole === 'employee') {
    // Employees can only see tasks assigned to them or created by them
    filter.$or = [
      { assignedTo: userId },
      { createdBy: userId }
    ];
  } else if (userRole === 'manager') {
    // Managers can see tasks in their department or assigned to their reports
    // This would require department/team logic
    filter.$or = [
      { assignedTo: userId },
      { createdBy: userId },
      { visibility: 'public' }
    ];
  }
  // Admins and super_admins can see all tasks
  
  // Apply filters
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (createdBy) filter.createdBy = createdBy;
  if (category) filter.category = category;
  
  // Date filtering
  if (dueDate) {
    const date = new Date(dueDate);
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    filter.dueDate = { $gte: date, $lt: nextDay };
  }
  
  // Search functionality
  if (search) {
    filter.$text = { $search: search };
  }
  
  const tasks = await Task.find(filter)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .populate('assignedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();
  
  const total = await Task.countDocuments(filter);
  
  res.json({
    success: true,
    data: tasks,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/tasks/:id
 * Get task by ID
 */
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
  }
  
  const filter = { _id: id, orgId };
  
  // Role-based access control
  if (userRole === 'employee') {
    filter.$or = [
      { assignedTo: userId },
      { createdBy: userId },
      { visibility: 'public' }
    ];
  }
  
  const task = await Task.findOne(filter)
    .populate('assignedTo', 'name email avatar profile.title')
    .populate('createdBy', 'name email avatar profile.title')
    .populate('assignedBy', 'name email avatar')
    .populate('comments.author', 'name email avatar')
    .lean();
  
  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found or access denied"
    });
  }
  
  res.json({
    success: true,
    data: task
  });
}));

/**
 * POST /api/tasks
 * Create new task
 */
router.post("/", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  
  const {
    title,
    description,
    assignedTo,
    dueDate,
    priority = 'medium',
    category = 'general',
    tags = [],
    visibility = 'private',
    estimatedHours,
    attachments = []
  } = req.body;
  
  // Validate required fields
  if (!title || !assignedTo) {
    return res.status(400).json({
      success: false,
      message: "Title and assignedTo are required"
    });
  }
  
  // Validate assignedTo user exists and is in same organization
  const assignee = await User.findOne({ 
    _id: assignedTo, 
    orgId, 
    isActive: true 
  });
  
  if (!assignee) {
    return res.status(400).json({
      success: false,
      message: "Invalid assignee or user not found"
    });
  }
  
  const task = await Task.create({
    title: title.trim(),
    description: description?.trim(),
    assignedTo,
    assignedBy: userId,
    createdBy: userId,
    dueDate: dueDate ? new Date(dueDate) : null,
    priority,
    category,
    tags,
    visibility,
    estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
    attachments,
    orgId,
    status: 'todo'
  });
  
  // Populate the created task for response
  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .populate('assignedBy', 'name email')
    .lean();
  
  res.status(201).json({
    success: true,
    message: "Task created successfully",
    data: populatedTask
  });
}));

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
  }
  
  const task = await Task.findOne({ _id: id, orgId });
  
  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found"
    });
  }
  
  // Check permissions - only creator, assignee, or admin can update
  const canUpdate = userRole === 'admin' || 
                   userRole === 'super_admin' ||
                   task.createdBy.toString() === userId ||
                   task.assignedTo.toString() === userId;
  
  if (!canUpdate) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to update this task"
    });
  }
  
  const {
    title,
    description,
    assignedTo,
    dueDate,
    priority,
    category,
    tags,
    visibility,
    estimatedHours,
    actualHours,
    status,
    attachments
  } = req.body;
  
  // Update fields
  if (title) task.title = title.trim();
  if (description !== undefined) task.description = description?.trim();
  if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
  if (priority) task.priority = priority;
  if (category) task.category = category;
  if (tags) task.tags = tags;
  if (visibility) task.visibility = visibility;
  if (estimatedHours !== undefined) task.estimatedHours = estimatedHours ? parseFloat(estimatedHours) : null;
  if (actualHours !== undefined) task.actualHours = actualHours ? parseFloat(actualHours) : null;
  if (attachments) task.attachments = attachments;
  
  // Handle assignee change
  if (assignedTo && assignedTo !== task.assignedTo.toString()) {
    const assignee = await User.findOne({ 
      _id: assignedTo, 
      orgId, 
      isActive: true 
    });
    
    if (!assignee) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignee"
      });
    }
    
    task.assignedTo = assignedTo;
    task.assignedBy = userId;
  }
  
  // Handle status change
  if (status && status !== task.status) {
    task.status = status;
    
    // Update completion date
    if (status === 'completed') {
      task.completedAt = new Date();
      task.completedBy = userId;
    } else if (task.status === 'completed' && status !== 'completed') {
      task.completedAt = null;
      task.completedBy = null;
    }
  }
  
  task.updatedBy = userId;
  await task.save();
  
  // Populate for response
  const updatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email avatar')
    .populate('assignedBy', 'name email')
    .lean();
  
  res.json({
    success: true,
    message: "Task updated successfully",
    data: updatedTask
  });
}));

/**
 * DELETE /api/tasks/:id
 * Delete task (soft delete)
 */
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
  }
  
  const task = await Task.findOne({ _id: id, orgId });
  
  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found"
    });
  }
  
  // Check permissions - only creator or admin can delete
  const canDelete = userRole === 'admin' || 
                   userRole === 'super_admin' ||
                   task.createdBy.toString() === userId;
  
  if (!canDelete) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to delete this task"
    });
  }
  
  // Soft delete
  task.isDeleted = true;
  task.deletedAt = new Date();
  task.deletedBy = userId;
  await task.save();
  
  res.json({
    success: true,
    message: "Task deleted successfully"
  });
}));

/**
 * POST /api/tasks/:id/comments
 * Add comment to task
 */
router.post("/:id/comments", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const { content } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      message: "Comment content is required"
    });
  }
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID"
    });
  }
  
  const task = await Task.findOne({ _id: id, orgId });
  
  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found"
    });
  }
  
  // Check if user has access to this task
  const hasAccess = task.assignedTo.toString() === userId ||
                   task.createdBy.toString() === userId ||
                   task.visibility === 'public' ||
                   ['admin', 'super_admin'].includes(req.user?.role);
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You don't have access to this task"
    });
  }
  
  const comment = {
    content: content.trim(),
    author: userId,
    createdAt: new Date()
  };
  
  task.comments.push(comment);
  await task.save();
  
  // Populate the new comment for response
  const updatedTask = await Task.findById(task._id)
    .populate('comments.author', 'name email avatar')
    .lean();
  
  const newComment = updatedTask.comments[updatedTask.comments.length - 1];
  
  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: newComment
  });
}));

/**
 * GET /api/tasks/my-tasks
 * Get tasks assigned to current user
 */
router.get("/my-tasks", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const { status, priority, overdue } = req.query;
  
  const filter = { 
    orgId,
    assignedTo: userId,
    isDeleted: false
  };
  
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  
  // Filter overdue tasks
  if (overdue === 'true') {
    filter.dueDate = { $lt: new Date() };
    filter.status = { $ne: 'completed' };
  }
  
  const tasks = await Task.find(filter)
    .populate('createdBy', 'name email avatar')
    .populate('assignedBy', 'name email')
    .sort({ dueDate: 1, priority: -1 })
    .lean();
  
  res.json({
    success: true,
    data: tasks
  });
}));

/**
 * GET /api/tasks/dashboard-stats
 * Get task statistics for dashboard
 */
router.get("/dashboard-stats", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  let filter = { orgId, isDeleted: false };
  
  // Role-based filtering
  if (userRole === 'employee') {
    filter.assignedTo = userId;
  }
  
  const [
    totalTasks,
    todoTasks,
    inProgressTasks,
    completedTasks,
    overdueTasks
  ] = await Promise.all([
    Task.countDocuments(filter),
    Task.countDocuments({ ...filter, status: 'todo' }),
    Task.countDocuments({ ...filter, status: 'in_progress' }),
    Task.countDocuments({ ...filter, status: 'completed' }),
    Task.countDocuments({
      ...filter,
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' }
    })
  ]);
  
  res.json({
    success: true,
    data: {
      totalTasks,
      todoTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    }
  });
}));

export default router;