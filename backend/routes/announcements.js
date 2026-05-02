import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import Announcement from "../models/Announcement.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * GET /api/announcements
 * Get announcements with filtering and pagination
 */
router.get("/", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  const {
    type,
    priority,
    status = 'published',
    targetAudience,
    page = 1,
    limit = 20,
    search
  } = req.query;
  
  const filter = { orgId };
  
  // Role-based filtering
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    // Non-admins can only see published announcements targeted to them
    filter.status = 'published';
    filter.$or = [
      { targetAudience: 'all' },
      { targetAudience: 'employees', 'targetRoles': { $in: [userRole] } },
      { 'targetUsers': userId },
      { 'targetDepartments': req.user?.departmentId }
    ];
  } else {
    // Admins can see all announcements
    if (status) filter.status = status;
  }
  
  // Apply other filters
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (targetAudience) filter.targetAudience = targetAudience;
  
  // Search functionality
  if (search) {
    filter.$text = { $search: search };
  }
  
  const announcements = await Announcement.find(filter)
    .populate('createdBy', 'name email avatar profile.title')
    .populate('targetUsers', 'name email')
    .populate('targetDepartments', 'name')
    .sort({ isPinned: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();
  
  const total = await Announcement.countDocuments(filter);
  
  res.json({
    success: true,
    data: announcements,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/announcements/:id
 * Get announcement by ID
 */
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid announcement ID"
    });
  }
  
  const filter = { _id: id, orgId };
  
  // Role-based access control
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    filter.status = 'published';
    filter.$or = [
      { targetAudience: 'all' },
      { targetAudience: 'employees', 'targetRoles': { $in: [userRole] } },
      { 'targetUsers': userId },
      { 'targetDepartments': req.user?.departmentId }
    ];
  }
  
  const announcement = await Announcement.findOne(filter)
    .populate('createdBy', 'name email avatar profile.title')
    .populate('targetUsers', 'name email avatar')
    .populate('targetDepartments', 'name')
    .lean();
  
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: "Announcement not found or access denied"
    });
  }
  
  // Mark as read for the current user
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    await Announcement.findByIdAndUpdate(id, {
      $addToSet: { 'analytics.readBy': userId }
    });
  }
  
  res.json({
    success: true,
    data: announcement
  });
}));

/**
 * POST /api/announcements
 * Create new announcement
 */
router.post("/", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  // Check permissions - only admins and HR can create announcements
  if (!['admin', 'super_admin', 'hr'].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to create announcements"
    });
  }
  
  const {
    title,
    content,
    type = 'general',
    priority = 'normal',
    targetAudience = 'all',
    targetRoles = [],
    targetUsers = [],
    targetDepartments = [],
    scheduledFor,
    expiresAt,
    isPinned = false,
    allowComments = true,
    attachments = []
  } = req.body;
  
  // Validate required fields
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: "Title and content are required"
    });
  }
  
  // Validate target audience
  if (targetAudience === 'specific') {
    if (targetRoles.length === 0 && targetUsers.length === 0 && targetDepartments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one target (roles, users, or departments) must be specified for specific audience"
      });
    }
  }
  
  const announcement = await Announcement.create({
    title: title.trim(),
    content: content.trim(),
    type,
    priority,
    targetAudience,
    targetRoles: targetAudience === 'specific' ? targetRoles : [],
    targetUsers: targetAudience === 'specific' ? targetUsers : [],
    targetDepartments: targetAudience === 'specific' ? targetDepartments : [],
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isPinned,
    allowComments,
    attachments,
    createdBy: userId,
    orgId,
    status: scheduledFor ? 'scheduled' : 'published'
  });
  
  // Populate the created announcement for response
  const populatedAnnouncement = await Announcement.findById(announcement._id)
    .populate('createdBy', 'name email avatar')
    .populate('targetUsers', 'name email')
    .populate('targetDepartments', 'name')
    .lean();
  
  res.status(201).json({
    success: true,
    message: "Announcement created successfully",
    data: populatedAnnouncement
  });
}));

/**
 * PUT /api/announcements/:id
 * Update announcement
 */
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid announcement ID"
    });
  }
  
  const announcement = await Announcement.findOne({ _id: id, orgId });
  
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: "Announcement not found"
    });
  }
  
  // Check permissions - only creator or admin can update
  const canUpdate = userRole === 'admin' || 
                   userRole === 'super_admin' ||
                   announcement.createdBy.toString() === userId;
  
  if (!canUpdate) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to update this announcement"
    });
  }
  
  const {
    title,
    content,
    type,
    priority,
    targetAudience,
    targetRoles,
    targetUsers,
    targetDepartments,
    scheduledFor,
    expiresAt,
    isPinned,
    allowComments,
    attachments,
    status
  } = req.body;
  
  // Update fields
  if (title) announcement.title = title.trim();
  if (content) announcement.content = content.trim();
  if (type) announcement.type = type;
  if (priority) announcement.priority = priority;
  if (targetAudience) announcement.targetAudience = targetAudience;
  if (targetRoles) announcement.targetRoles = targetRoles;
  if (targetUsers) announcement.targetUsers = targetUsers;
  if (targetDepartments) announcement.targetDepartments = targetDepartments;
  if (scheduledFor !== undefined) announcement.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
  if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (isPinned !== undefined) announcement.isPinned = isPinned;
  if (allowComments !== undefined) announcement.allowComments = allowComments;
  if (attachments) announcement.attachments = attachments;
  if (status) announcement.status = status;
  
  announcement.updatedBy = userId;
  await announcement.save();
  
  // Populate for response
  const updatedAnnouncement = await Announcement.findById(announcement._id)
    .populate('createdBy', 'name email avatar')
    .populate('targetUsers', 'name email')
    .populate('targetDepartments', 'name')
    .lean();
  
  res.json({
    success: true,
    message: "Announcement updated successfully",
    data: updatedAnnouncement
  });
}));

/**
 * DELETE /api/announcements/:id
 * Delete announcement (soft delete)
 */
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid announcement ID"
    });
  }
  
  const announcement = await Announcement.findOne({ _id: id, orgId });
  
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: "Announcement not found"
    });
  }
  
  // Check permissions - only creator or admin can delete
  const canDelete = userRole === 'admin' || 
                   userRole === 'super_admin' ||
                   announcement.createdBy.toString() === userId;
  
  if (!canDelete) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to delete this announcement"
    });
  }
  
  // Soft delete
  announcement.isDeleted = true;
  announcement.deletedAt = new Date();
  announcement.deletedBy = userId;
  await announcement.save();
  
  res.json({
    success: true,
    message: "Announcement deleted successfully"
  });
}));

/**
 * POST /api/announcements/:id/comments
 * Add comment to announcement
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
      message: "Invalid announcement ID"
    });
  }
  
  const announcement = await Announcement.findOne({ 
    _id: id, 
    orgId,
    status: 'published',
    allowComments: true
  });
  
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: "Announcement not found or comments not allowed"
    });
  }
  
  const comment = {
    content: content.trim(),
    author: userId,
    createdAt: new Date()
  };
  
  announcement.comments.push(comment);
  await announcement.save();
  
  // Populate the new comment for response
  const updatedAnnouncement = await Announcement.findById(announcement._id)
    .populate('comments.author', 'name email avatar')
    .lean();
  
  const newComment = updatedAnnouncement.comments[updatedAnnouncement.comments.length - 1];
  
  res.status(201).json({
    success: true,
    message: "Comment added successfully",
    data: newComment
  });
}));

/**
 * GET /api/announcements/pinned
 * Get pinned announcements
 */
router.get("/pinned", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  const filter = { 
    orgId,
    isPinned: true,
    status: 'published'
  };
  
  // Role-based filtering for non-admins
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    filter.$or = [
      { targetAudience: 'all' },
      { targetAudience: 'employees', 'targetRoles': { $in: [userRole] } },
      { 'targetUsers': userId },
      { 'targetDepartments': req.user?.departmentId }
    ];
  }
  
  const pinnedAnnouncements = await Announcement.find(filter)
    .populate('createdBy', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  
  res.json({
    success: true,
    data: pinnedAnnouncements
  });
}));

/**
 * GET /api/announcements/dashboard-stats
 * Get announcement statistics for dashboard
 */
router.get("/dashboard-stats", asyncHandler(async (req, res) => {
  const orgId = req.user?.orgId || 'system';
  
  const [
    totalAnnouncements,
    publishedAnnouncements,
    scheduledAnnouncements,
    pinnedAnnouncements
  ] = await Promise.all([
    Announcement.countDocuments({ orgId, isDeleted: false }),
    Announcement.countDocuments({ orgId, status: 'published', isDeleted: false }),
    Announcement.countDocuments({ orgId, status: 'scheduled', isDeleted: false }),
    Announcement.countDocuments({ orgId, isPinned: true, status: 'published', isDeleted: false })
  ]);
  
  res.json({
    success: true,
    data: {
      totalAnnouncements,
      publishedAnnouncements,
      scheduledAnnouncements,
      pinnedAnnouncements
    }
  });
}));

/**
 * POST /api/announcements/:id/pin
 * Pin/unpin announcement
 */
router.post("/:id/pin", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orgId = req.user?.orgId || 'system';
  const userId = req.user?.userId;
  const userRole = req.user?.role;
  
  // Check permissions
  if (!['admin', 'super_admin', 'hr'].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to pin announcements"
    });
  }
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid announcement ID"
    });
  }
  
  const announcement = await Announcement.findOne({ _id: id, orgId });
  
  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: "Announcement not found"
    });
  }
  
  announcement.isPinned = !announcement.isPinned;
  announcement.updatedBy = userId;
  await announcement.save();
  
  res.json({
    success: true,
    message: `Announcement ${announcement.isPinned ? 'pinned' : 'unpinned'} successfully`,
    data: { isPinned: announcement.isPinned }
  });
}));

export default router;