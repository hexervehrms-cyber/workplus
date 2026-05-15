import express from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/errorHandler.js";
import Announcement from "../models/Announcement.js";
import logger from "../utils/logger.js";
import { notifyTeamsOnAnnouncement } from "../utils/workflowNotifications.js";

const router = express.Router();

const mapPriority = (p) => {
  if (["low", "medium", "high", "urgent"].includes(p)) return p;
  if (p === "normal") return "medium";
  return "medium";
};

/**
 * Map UI audience key -> { visibility, targetAudience } (matches Announcement.js schema)
 */
function resolveAudience(audienceKey) {
  const emptyTargets = { departments: [], roles: [], specificUsers: [] };
  switch (audienceKey) {
    case "management":
      return {
        visibility: "role",
        targetAudience: { ...emptyTargets, roles: ["admin", "hr", "manager"] },
      };
    case "super_admin":
      return {
        visibility: "role",
        targetAudience: { ...emptyTargets, roles: ["super_admin"] },
      };
    case "admin":
      return {
        visibility: "role",
        targetAudience: { ...emptyTargets, roles: ["admin"] },
      };
    case "employee":
      return {
        visibility: "role",
        targetAudience: { ...emptyTargets, roles: ["employee"] },
      };
    case "hr":
      return {
        visibility: "role",
        targetAudience: { ...emptyTargets, roles: ["hr"] },
      };
    case "all":
    default:
      return { visibility: "all", targetAudience: { ...emptyTargets } };
  }
}

/**
 * GET /api/announcements
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.user?.orgId || "system";
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { type, priority, page = 1, limit = 20, search } = req.query;

    const lim = Math.min(parseInt(String(limit), 10) || 20, 100);
    const p = Math.max(parseInt(String(page), 10) || 1, 1);
    const skip = (p - 1) * lim;

    if (userRole === "admin" || userRole === "super_admin") {
      const filter = { orgId };
      if (type) filter.type = type;
      if (priority) filter.priority = priority;
      if (search && String(search).trim()) {
        const q = String(search).trim();
        filter.$or = [
          { title: { $regex: q, $options: "i" } },
          { content: { $regex: q, $options: "i" } },
        ];
      }
      const [announcements, total] = await Promise.all([
        Announcement.find(filter)
          .populate("authorId", "name email avatar")
          .sort({ isPinned: -1, publishedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(lim)
          .lean(),
        Announcement.countDocuments(filter),
      ]);
      return res.json({
        success: true,
        data: announcements,
        pagination: {
          page: p,
          limit: lim,
          total,
          pages: Math.max(1, Math.ceil(total / lim)),
        },
      });
    }

    const userView = await Announcement.getUserAnnouncements(userId, orgId);
    let rows = userView || [];
    if (type) rows = rows.filter((r) => r.type === type);
    if (priority) rows = rows.filter((r) => r.priority === priority);
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.content && r.content.toLowerCase().includes(q))
      );
    }
    const total = rows.length;
    const announcements = rows.slice(skip, skip + lim);

    return res.json({
      success: true,
      data: announcements,
      pagination: {
        page: p,
        limit: lim,
        total,
        pages: Math.max(1, Math.ceil(total / lim)),
      },
    });
  })
);

/**
 * GET /api/announcements/pinned
 * Registered before /:id so "pinned" is not captured as an id.
 */
router.get(
  "/pinned",
  asyncHandler(async (req, res) => {
    const orgId = req.user?.orgId || "system";
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const filter = {
      orgId,
      isPinned: true,
      isPublished: true,
      isDraft: false,
    };

    if (userRole === "admin" || userRole === "super_admin") {
      const pinnedAnnouncements = await Announcement.find(filter)
        .populate("authorId", "name email avatar")
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(5)
        .lean();
      return res.json({ success: true, data: pinnedAnnouncements });
    }

    const scoped = await Announcement.getUserAnnouncements(userId, orgId);
    const pinnedAnnouncements = (scoped || [])
      .filter((a) => a.isPinned)
      .slice(0, 5);

    return res.json({ success: true, data: pinnedAnnouncements });
  })
);

/**
 * GET /api/announcements/dashboard-stats
 */
router.get(
  "/dashboard-stats",
  asyncHandler(async (req, res) => {
    const orgId = req.user?.orgId || "system";

    const [
      totalAnnouncements,
      publishedAnnouncements,
      scheduledAnnouncements,
      pinnedAnnouncements,
    ] = await Promise.all([
      Announcement.countDocuments({ orgId }),
      Announcement.countDocuments({ orgId, isPublished: true, isDraft: false }),
      Announcement.countDocuments({ orgId, isDraft: true }),
      Announcement.countDocuments({
        orgId,
        isPinned: true,
        isPublished: true,
        isDraft: false,
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalAnnouncements,
        publishedAnnouncements,
        scheduledAnnouncements,
        pinnedAnnouncements,
      },
    });
  })
);

/**
 * GET /api/announcements/:id
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = req.user?.orgId || "system";
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await Announcement.findOne({ _id: id, orgId })
      .populate("authorId", "name email avatar")
      .lean();

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found or access denied",
      });
    }

    if (userRole !== "admin" && userRole !== "super_admin") {
      const allowed = await Announcement.getUserAnnouncements(userId, orgId);
      const ok = (allowed || []).some((a) => String(a._id) === String(announcement._id));
      if (!ok) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found or access denied",
        });
      }
      const doc = await Announcement.findById(id);
      if (doc) await doc.markAsRead(userId);
    }

    res.json({
      success: true,
      data: announcement,
    });
  })
);

/**
 * POST /api/announcements
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.user?.orgId || "system";
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!["admin", "super_admin", "hr"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to create announcements",
      });
    }

    const {
      title,
      content,
      type = "general",
      priority = "medium",
      audience = "all",
      scheduledFor,
      expiresAt,
      isPinned = false,
      attachments = [],
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    const { visibility, targetAudience } = resolveAudience(audience);
    const scheduled = scheduledFor ? new Date(scheduledFor) : null;
    const isScheduled = Boolean(scheduled && !Number.isNaN(scheduled.getTime()) && scheduled.getTime() > Date.now());

    const announcement = await Announcement.create({
      title: String(title).trim(),
      content: String(content).trim(),
      type,
      priority: mapPriority(priority),
      visibility,
      targetAudience,
      authorId: userId,
      orgId,
      isPublished: !isScheduled,
      isDraft: isScheduled,
      publishedAt: isScheduled ? null : new Date(),
      isPinned: Boolean(isPinned),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate("authorId", "name email avatar")
      .lean();

    if (!isScheduled) {
      setImmediate(async () => {
        try {
          const doc = await Announcement.findById(announcement._id);
          if (doc) {
            await doc.createNotifications();
            const audienceLabel =
              audience === "management"
                ? "Management (admin, HR, manager)"
                : audience === "all"
                  ? "All employees"
                  : String(audience);
            await notifyTeamsOnAnnouncement(
              orgId,
              doc.title,
              doc.content,
              audienceLabel
            );
          }
        } catch (err) {
          logger.error("Announcement notification dispatch failed", {
            error: err.message,
            announcementId: announcement._id,
          });
        }
      });
    }

    res.status(201).json({
      success: true,
      message: isScheduled
        ? "Announcement scheduled successfully"
        : "Announcement published successfully",
      data: populatedAnnouncement,
    });
  })
);

/**
 * PUT /api/announcements/:id
 */
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = req.user?.orgId || "system";
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await Announcement.findOne({ _id: id, orgId });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const canUpdate =
      userRole === "admin" ||
      userRole === "super_admin" ||
      userRole === "hr" ||
      announcement.authorId.toString() === String(userId);

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this announcement",
      });
    }

    const { title, content, type, priority, audience, expiresAt, isPinned, isPublished, isDraft } = req.body;

    if (title) announcement.title = String(title).trim();
    if (content) announcement.content = String(content).trim();
    if (type) announcement.type = type;
    if (priority) announcement.priority = mapPriority(priority);
    if (audience) {
      const { visibility, targetAudience } = resolveAudience(audience);
      announcement.visibility = visibility;
      announcement.targetAudience = targetAudience;
    }
    if (expiresAt !== undefined) {
      announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    if (isPinned !== undefined) announcement.isPinned = Boolean(isPinned);
    if (isPublished !== undefined) announcement.isPublished = Boolean(isPublished);
    if (isDraft !== undefined) announcement.isDraft = Boolean(isDraft);

    await announcement.save();

    const updatedAnnouncement = await Announcement.findById(announcement._id)
      .populate("authorId", "name email avatar")
      .lean();

    res.json({
      success: true,
      message: "Announcement updated successfully",
      data: updatedAnnouncement,
    });
  })
);

/**
 * DELETE /api/announcements/:id
 * Withdraw from publication (schema has no isDeleted field).
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = req.user?.orgId || "system";
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await Announcement.findOne({ _id: id, orgId });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const canDelete =
      userRole === "admin" ||
      userRole === "super_admin" ||
      userRole === "hr" ||
      announcement.authorId.toString() === String(userId);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this announcement",
      });
    }

    announcement.isPublished = false;
    announcement.isDraft = true;
    announcement.isPinned = false;
    await announcement.save();

    res.json({
      success: true,
      message: "Announcement deleted successfully",
    });
  })
);

/**
 * POST /api/announcements/:id/comments
 */
router.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = req.user?.orgId || "system";
    const userId = req.user?.userId;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await Announcement.findOne({
      _id: id,
      orgId,
      isPublished: true,
      isDraft: false,
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found or comments not allowed",
      });
    }

    announcement.comments.push({
      userId,
      comment: content.trim(),
      createdAt: new Date(),
    });
    await announcement.save();

    const updatedAnnouncement = await Announcement.findById(announcement._id)
      .populate("comments.userId", "name email avatar")
      .lean();

    const newComment =
      updatedAnnouncement.comments[updatedAnnouncement.comments.length - 1];

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: newComment,
    });
  })
);

/**
 * POST /api/announcements/:id/pin
 */
router.post(
  "/:id/pin",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgId = req.user?.orgId || "system";
    const userRole = req.user?.role;

    if (!["admin", "super_admin", "hr"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to pin announcements",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await Announcement.findOne({ _id: id, orgId });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    announcement.isPinned = !announcement.isPinned;
    await announcement.save();

    res.json({
      success: true,
      message: `Announcement ${announcement.isPinned ? "pinned" : "unpinned"} successfully`,
      data: { isPinned: announcement.isPinned },
    });
  })
);

export default router;
