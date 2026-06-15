/**
 * Serve files under /uploads only after authorization (replaces public express.static).
 */

import path from "path";
import fs from "fs";
import Expense from "../models/Expense.js";
import Document from "../models/Document.js";
import User from "../models/User.js";
import ChatMessage from "../models/ChatMessage.js";

function resolveUploadRelativePath(req) {
  const raw = (req.originalUrl || req.url || "").split("?")[0];
  const withoutPrefix = raw.replace(/^\/uploads\/?/i, "").replace(/^\/+/, "");
  const decoded = decodeURIComponent(withoutPrefix).replace(/\\/g, "/");
  if (!decoded || decoded.includes("..")) {
    return null;
  }
  return decoded;
}

function virtualPathFromRelative(rel) {
  return `/uploads/${rel.replace(/\\/g, "/")}`;
}

function contentTypeForFile(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export function createAuthenticatedUploadsHandler(uploadsRootAbs) {
  const root = path.resolve(uploadsRootAbs);

  return async function authenticatedUploads(req, res) {
    const rel = resolveUploadRelativePath(req);
    if (!rel) {
      return res.status(400).json({ success: false, message: "Invalid path" });
    }

    const abs = path.resolve(path.join(root, rel));
    if (!abs.startsWith(root)) {
      return res.status(400).json({ success: false, message: "Invalid path" });
    }

    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const virtualPath = virtualPathFromRelative(rel);
    const uid = String(req.user.userId || "");
    const orgId = String(req.user.orgId || "");
    const privileged = ["admin", "hr", "super_admin", "manager"].includes(req.user.role);
    const isSuper = req.user.role === "super_admin";

    const segment = rel.split("/")[0];

    if (segment === "receipts") {
      const exp = await Expense.findOne({ receipt: virtualPath }).lean();
      if (!exp) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const isOwner = String(exp.userId) === uid;
      const sameOrg = String(exp.orgId) === orgId;
      if (!isOwner && !(privileged && sameOrg) && !isSuper) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    } else if (segment === "documents") {
      const doc = await Document.findOne({ filePath: virtualPath }).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const isOwner = String(doc.userId) === uid;
      const sameOrg = String(doc.orgId) === orgId;
      if (!isOwner && !(privileged && sameOrg) && !isSuper) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    } else if (segment === "avatars") {
      const avatarUser = await User.findOne({ avatar: virtualPath }).select("_id orgId").lean();
      if (!avatarUser) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const isSelf = String(avatarUser._id) === uid;
      const sameOrg = String(avatarUser.orgId) === orgId;
      if (!isSelf && !(privileged && sameOrg) && !isSuper) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    } else if (segment === "chat") {
      const msg = await ChatMessage.findOne({ "content.file.filePath": virtualPath }).lean();
      if (!msg) {
        return res.status(404).json({ success: false, message: "Not found" });
      }
      const participants = [
        String(msg.senderId),
        msg.recipientId ? String(msg.recipientId) : null,
        ...(msg.channelInfo?.participants || []).map((p) => String(p)),
      ].filter(Boolean);
      const inConv = participants.includes(uid);
      const sameOrg = String(msg.orgId) === orgId;
      if (!inConv && !(privileged && sameOrg) && !isSuper) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    } else {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.setHeader("Content-Type", contentTypeForFile(abs));
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.sendFile(abs);
  };
}
