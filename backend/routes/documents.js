/**
 * Documents Routes
 * Handles document retrieval and management
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Document from "../models/Document.js";
import Employee from "../models/Employee.js";
import GeneratedDocument from "../models/GeneratedDocument.js";
import IssuedDocument from "../models/IssuedDocument.js";
import DocumentAcknowledgment from "../models/DocumentAcknowledgment.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const MANAGE_DOC_ROLES = ["super_admin", "admin", "hr"];

/** Resolve org id for reads — non–super-admins are limited to their tenant. */
const resolveReadableOrgId = (req, requestedOrgId) => {
  const userOrgId = String(req.user?.orgId || "system");
  if (req.user?.role === "super_admin" && requestedOrgId) {
    return String(requestedOrgId);
  }
  if (requestedOrgId && String(requestedOrgId) !== userOrgId) {
    return null;
  }
  return userOrgId;
};

const findGeneratedDocumentForUser = async (documentId, req, orgIds = []) => {
  const role = req.user?.role;
  const authOrgId = String(req.user?.orgId || "");

  const byCustomId = await GeneratedDocument.findOne({ id: documentId }).lean();
  const doc =
    byCustomId ||
    (mongoose.Types.ObjectId.isValid(String(documentId))
      ? await GeneratedDocument.findById(documentId).lean()
      : null);

  if (!doc) return { error: "NOT_FOUND" };

  if (role !== "super_admin") {
    const allowed = new Set([authOrgId, ...orgIds.map(String)].filter(Boolean));
    if (!allowed.has(String(doc.organizationId))) {
      return { error: "FORBIDDEN" };
    }
    if (role === "employee") {
      const uid = String(req.user.userId);
      const assignAll = !doc.assignTo || doc.assignTo === "all";
      const targeted =
        Array.isArray(doc.targetUsers) &&
        doc.targetUsers.some((t) => String(t) === uid);
      if (!assignAll && !targeted) {
        return { error: "FORBIDDEN" };
      }
    }
  }
  return { doc };
};

/** Collect org ids (JWT + employee row) for tenant-safe queries. */
async function collectOrgIds(req, requestedOrgId) {
  const ids = new Set();
  const authOrg = String(req.user?.orgId || req.user?.tenantId || "").trim();
  if (authOrg) ids.add(authOrg);
  if (requestedOrgId) ids.add(String(requestedOrgId).trim());

  const userId = req.user?.userId;
  if (userId) {
    const empQuery = mongoose.Types.ObjectId.isValid(String(userId))
      ? { userId: { $in: [String(userId), new mongoose.Types.ObjectId(String(userId))] } }
      : { userId: String(userId) };
    const emp = await Employee.findOne(empQuery).select("orgId").lean();
    if (emp?.orgId) ids.add(String(emp.orgId));
  }
  return [...ids].filter(Boolean);
}

function employeeVisibilityFilter(userId) {
  const uid = String(userId);
  const clauses = [{ assignTo: "all" }, { assignTo: { $exists: false } }];
  if (mongoose.Types.ObjectId.isValid(uid)) {
    const oid = new mongoose.Types.ObjectId(uid);
    clauses.push({ targetUsers: uid }, { targetUsers: oid });
  } else {
    clauses.push({ targetUsers: uid });
  }
  return { $or: clauses };
}

// Configure multer for document uploads
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `document-${req.user.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const DOCUMENT_TYPES = new Set([
  "general",
  "experience_letter",
  "offer_letter",
  "relieving_letter",
  "appraisal_letter",
  "salary_slips",
  "bank_statement",
  "education_10th_certificate",
  "education_10th_marksheet",
  "education_12th_certificate",
  "education_12th_marksheet",
  "education_graduation_certificate",
  "education_graduation_marksheet",
  "education_post_graduation_certificate",
  "education_post_graduation_marksheet",
  "education_diploma_certificate",
  "education_diploma_marksheet",
  "education_certificate_certificate",
  "education_certificate_marksheet",
  "education_drop_out_certificate",
  "education_drop_out_marksheet",
]);

/** Route param may be User id or Employee Mongo id — documents are stored by userId. */
const resolveDocumentUserId = async (idParam) => {
  const id = String(idParam);
  const asUser = await Document.findOne({ userId: id }).select("_id").lean();
  if (asUser) return id;
  const emp = await Employee.findById(id).select("userId").lean();
  if (emp?.userId) return String(emp.userId);
  return id;
};

/** Resolve stored filePath to an absolute path on disk (multiple layouts). */
const resolveDocumentAbsolutePath = (filePath) => {
  if (!filePath) return null;

  const rel = String(filePath).replace(/^\//, "");
  const basename = path.basename(rel);
  const candidates = [
    path.resolve(__dirname, "..", rel),
    path.join(__dirname, "..", "uploads", "documents", basename),
    path.resolve(process.cwd(), rel),
    path.join(process.cwd(), "uploads", "documents", basename),
    path.join(process.cwd(), "backend", "uploads", "documents", basename),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const resolveDocumentType = (rawType, name) => {
  if (rawType && DOCUMENT_TYPES.has(String(rawType))) {
    return String(rawType);
  }
  const label = String(name || "").toLowerCase();
  if (label.includes("offer")) return "offer_letter";
  if (label.includes("experience")) return "experience_letter";
  if (label.includes("relieving")) return "relieving_letter";
  if (label.includes("appraisal")) return "appraisal_letter";
  if (label.includes("salary")) return "salary_slips";
  return "general";
};

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, images, and text files are allowed.'));
    }
  }
});

/**
 * POST /api/documents/upload
 * Upload a document
 */
router.post(
  "/upload",
  authenticate,
  documentUpload.single('document'),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return sendError(res, "No document file provided", 400, "VALIDATION_ERROR");
      }

      const { name, type } = req.body;

      if (!name) {
        return sendError(res, "Document name is required", 400, "VALIDATION_ERROR");
      }

      const documentPath = `/uploads/documents/${req.file.filename}`;
      const resolvedType = resolveDocumentType(type, name);
      const orgId = String(req.user.orgId || req.user.tenantId || "system");

      // Create document record in database
      const document = await Document.create({
        userId: req.user.userId,
        orgId,
        name,
        type: resolvedType,
        fileName: req.file.originalname,
        filePath: documentPath,
        size: `${(req.file.size / 1024).toFixed(2)} KB`,
        status: 'uploaded',
        uploadedAt: new Date()
      });

      logger.info("Document uploaded", {
        userId: req.user.userId,
        documentId: document._id,
        filename: req.file.filename,
        size: req.file.size
      });

      return sendSuccess(res, {
        _id: document._id,
        name: document.name,
        type: document.type,
        fileName: document.fileName,
        filePath: document.filePath,
        size: document.size,
        status: document.status,
        uploadedAt: document.uploadedAt
      }, "Document uploaded successfully", 201);
    } catch (error) {
      logger.error("Upload document error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to upload document", 500, "UPLOAD_ERROR");
    }
  })
);

/**
 * POST /api/documents/company-upload
 * Upload a company document file (appears in organization document list)
 */
router.post(
  "/company-upload",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  documentUpload.single("file"),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return sendError(res, "No document file provided", 400, "VALIDATION_ERROR");
      }

      const { title, description, category, organizationId, isPublic } = req.body;

      if (!title || !category) {
        return sendError(res, "Title and category are required", 400, "VALIDATION_ERROR");
      }

      const orgId = organizationId || req.user.orgId;
      if (!orgId) {
        return sendError(res, "Organization ID is required", 400, "VALIDATION_ERROR");
      }

      const fileUrl = `/uploads/documents/${req.file.filename}`;
      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      const generatedDocument = await GeneratedDocument.create({
        id: docId,
        title,
        description: description || "",
        documentType: category,
        category,
        content: description || title,
        organizationId: String(orgId),
        status: "generated",
        fileUrl,
        fileName: req.file.originalname,
        createdBy: req.user.userId,
        assignTo: "all",
        requiresAcknowledgment: isPublic === "false" || isPublic === false ? false : true,
      });

      logger.info("Company document uploaded", {
        documentId: generatedDocument.id,
        organizationId: orgId,
        userId: req.user.userId,
      });

      return sendSuccess(
        res,
        {
          id: generatedDocument.id,
          _id: generatedDocument._id,
          title: generatedDocument.title,
          description: generatedDocument.description,
          category: generatedDocument.category,
          organizationId: generatedDocument.organizationId,
          createdBy: req.user.role,
          createdAt: generatedDocument.createdAt,
          updatedAt: generatedDocument.updatedAt,
          status: "Published",
          fileUrl: generatedDocument.fileUrl,
          fileName: generatedDocument.fileName,
          fileSize: `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`,
        },
        "Document uploaded successfully",
        201
      );
    } catch (error) {
      logger.error("Company document upload error", {
        error: error.message,
        userId: req.user?.userId,
      });
      return sendError(res, "Failed to upload document", 500, "UPLOAD_ERROR");
    }
  })
);

/**
 * POST /api/documents/submit-employment
 * Mark uploaded employment documents as submitted for HR review
 */
router.post(
  "/submit-employment",
  authenticate,
  authorize("employee", "admin", "hr", "manager", "super_admin"),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const orgId = String(req.user.orgId || req.user.tenantId || "system");

    const result = await Document.updateMany(
      { userId, orgId, status: { $in: ["uploaded", "Pending"] } },
      { $set: { status: "Pending" } }
    );

    if (global.socketManager?.broadcastToOrganization) {
      global.socketManager.broadcastToOrganization(orgId, "employee_documents_submitted", {
        userId: String(userId),
        count: result.modifiedCount,
        timestamp: new Date(),
      });
    }

    return sendSuccess(
      res,
      { updated: result.modifiedCount },
      "Employment documents submitted successfully"
    );
  })
);

/**
 * GET /api/documents/employee/:employeeId
 * Get documents for an employee
 */
router.get(
  "/employee/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;
      const userId = await resolveDocumentUserId(employeeId);

      // Check authorization - employees can only see their own documents
      if (
        req.user.role === "employee" &&
        String(req.user.userId) !== String(userId)
      ) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      // Get total count
      const total = await Document.countDocuments({ userId });

      // Get documents with pagination
      const documents = await Document.find({ userId })
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      logger.info("Employee documents fetched", {
        employeeId,
        count: documents.length
      });

      return sendPaginated(
        res,
        documents || [],
        total,
        page,
        limit,
        "Documents fetched successfully"
      );
    } catch (error) {
      logger.error("Get employee documents error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch documents", 500, "DOCUMENTS_ERROR");
    }
  })
);

/**
 * GET /api/documents/download/:id
 * Stream document file (authenticated) for inline view / download
 */
router.get(
  "/download/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const document = await Document.findById(id).lean();

      if (!document) {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }

      if (
        req.user.role === "employee" &&
        String(req.user.userId) !== String(document.userId)
      ) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      if (!document.filePath) {
        return sendError(res, "File path missing", 404, "NOT_FOUND");
      }

      const absolutePath = resolveDocumentAbsolutePath(document.filePath);

      if (!absolutePath) {
        return sendError(
          res,
          "File not found on server. It may have been removed after a server restart — please re-upload.",
          404,
          "NOT_FOUND"
        );
      }

      const ext = path.extname(document.fileName || document.filePath || "").toLowerCase();
      const mimeByExt = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
      };

      const contentType = mimeByExt[ext] || "application/octet-stream";
      const fileName = document.fileName || document.name || "document";
      const asDownload =
        req.query.download === "1" || req.query.download === "true";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `${asDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`
      );

      return res.sendFile(absolutePath);
    } catch (error) {
      logger.error("Download document error", {
        error: error.message,
        documentId: req.params.id,
      });
      return sendError(res, "Failed to download document", 500, "DOCUMENT_ERROR");
    }
  })
);

/**
 * GET /api/documents/:id
 * Get a specific document
 */
router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const document = await Document.findById(id).lean();

      if (!document) {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }

      // Check authorization
      if (
        req.user.role === "employee" &&
        String(req.user.userId) !== String(document.userId)
      ) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      logger.info("Document fetched", { documentId: id });

      return sendSuccess(res, document, "Document fetched successfully");
    } catch (error) {
      logger.error("Get document error", {
        error: error.message,
        documentId: req.params.id
      });
      return sendError(res, "Failed to fetch document", 500, "DOCUMENT_ERROR");
    }
  })
);

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const document = await Document.findById(id);

      if (!document) {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }

      // Check authorization
      if (
        req.user.role === "employee" &&
        String(req.user.userId) !== String(document.userId)
      ) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      const absolutePath = resolveDocumentAbsolutePath(document.filePath);
      if (absolutePath) {
        try {
          fs.unlinkSync(absolutePath);
        } catch (unlinkErr) {
          logger.warn("Could not delete document file from disk", {
            documentId: id,
            path: absolutePath,
            error: unlinkErr.message,
          });
        }
      }

      await Document.findByIdAndDelete(id);

      logger.info("Document deleted", { documentId: id });

      return sendSuccess(res, null, "Document deleted successfully");
    } catch (error) {
      logger.error("Delete document error", {
        error: error.message,
        documentId: req.params.id
      });
      return sendError(res, "Failed to delete document", 500, "DELETE_ERROR");
    }
  })
);

/**
 * POST /api/documents/digital-generate
 * Generate a digital document
 */
router.post(
  "/digital-generate",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const {
        title,
        description,
        content,
        category,
        organizationId,
        createdBy,
        assignTo,
        targetUsers,
        requiresAcknowledgment
      } = req.body;

      // Validate required fields
      if (!title || !content) {
        return sendError(res, "Title and content are required", 400, "VALIDATION_ERROR");
      }

      if (!organizationId && !req.user?.orgId) {
        return sendError(res, "Organization ID is required", 400, "VALIDATION_ERROR");
      }

      const orgId = String(
        req.user?.role === "super_admin" && organizationId
          ? organizationId
          : req.user?.orgId || organizationId
      );

      let resolvedTargetUsers = [];
      if (assignTo === "specific" && Array.isArray(targetUsers) && targetUsers.length) {
        const ids = targetUsers.map(String);
        const employees = await Employee.find({
          orgId,
          $or: [
            { userId: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)) } },
            { _id: { $in: ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)) } },
          ],
        })
          .select("userId")
          .lean();
        resolvedTargetUsers = [
          ...new Set(
            employees.map((e) => String(e.userId)).filter(Boolean)
          ),
        ];
        if (!resolvedTargetUsers.length) {
          return sendError(res, "No valid employees selected", 400, "VALIDATION_ERROR");
        }
      }

      // Create new generated document
      const documentData = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        documentType: category || "General",
        organizationId: orgId,
        content,
        status: "generated",
        title,
        description,
        category,
        assignTo: assignTo === "specific" ? "specific" : "all",
        targetUsers: assignTo === "specific" ? resolvedTargetUsers : [],
        requiresAcknowledgment: requiresAcknowledgment !== false,
        createdBy: req.user?.userId,
      };

      const generatedDocument = new GeneratedDocument(documentData);
      await generatedDocument.save();

      if (global.io && documentData.assignTo === "all") {
        global.io.to(`tenant_${orgId}`).emit("notification", {
          type: "document",
          title: "New company document",
          message: title,
          documentId: generatedDocument._id,
        });
      } else if (global.io && resolvedTargetUsers.length) {
        for (const uid of resolvedTargetUsers) {
          global.io.to(`user_${uid}`).emit("notification", {
            type: "document",
            title: "New document assigned",
            message: title,
            documentId: generatedDocument._id,
          });
        }
      }

      logger.info("Digital document generated", {
        documentId: generatedDocument._id,
        organizationId,
        createdBy: createdBy || req.user?._id,
        title
      });

      return sendSuccess(
        res,
        { document: generatedDocument },
        "Digital document generated successfully"
      );
    } catch (error) {
      logger.error("Generate digital document error", {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      return sendError(res, error.message || "Failed to generate document", 500, "GENERATION_ERROR");
    }
  })
);

/**
 * GET /api/documents/organization/:organizationId
 * Get all documents for an organization
 */
router.get(
  "/organization/:organizationId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const orgIds = await collectOrgIds(req, req.params.organizationId);
      if (!orgIds.length) {
        return sendError(res, "Organization not found", 400, "VALIDATION_ERROR");
      }

      if (req.user.role !== "super_admin") {
        const authOrg = String(req.user.orgId || "");
        if (authOrg && !orgIds.includes(authOrg)) {
          return sendError(res, "Unauthorized org access", 403, "FORBIDDEN");
        }
      }

      const query = { organizationId: { $in: orgIds } };
      if (req.user.role === "employee") {
        Object.assign(query, employeeVisibilityFilter(req.user.userId));
      }

      const documents = await GeneratedDocument.find(query)
        .sort({ createdAt: -1 })
        .lean();

      logger.info("Organization documents fetched", {
        organizationIds: orgIds,
        count: documents.length,
        role: req.user.role,
      });

      return sendSuccess(res, documents, "Documents fetched successfully");
    } catch (error) {
      logger.error("Get organization documents error", {
        error: error.message,
        organizationId: req.params.organizationId
      });
      return sendError(res, "Failed to fetch documents", 500, "DOCUMENTS_ERROR");
    }
  })
);

/**
 * GET /api/documents/generated/:documentId/file
 * Stream uploaded company document (authenticated)
 */
router.get(
  "/generated/:documentId/file",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { documentId } = req.params;
      const orgIds = await collectOrgIds(req, null);
      const lookup = await findGeneratedDocumentForUser(documentId, req, orgIds);
      if (lookup.error === "NOT_FOUND") {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }
      if (lookup.error === "FORBIDDEN") {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      const doc = lookup.doc;
      if (!doc.fileUrl) {
        return sendError(res, "This document has no file attachment", 404, "NOT_FOUND");
      }

      const absolutePath = resolveDocumentAbsolutePath(doc.fileUrl);
      if (!absolutePath) {
        return sendError(
          res,
          "File not found on server. Ask HR to re-upload the document.",
          404,
          "NOT_FOUND"
        );
      }

      const ext = path.extname(doc.fileName || doc.fileUrl || "").toLowerCase();
      const mimeByExt = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
      };
      const contentType = mimeByExt[ext] || "application/octet-stream";
      const fileName = doc.fileName || doc.title || "document";
      const asDownload =
        req.query.download === "1" || req.query.download === "true";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `${asDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`
      );
      return res.sendFile(absolutePath);
    } catch (error) {
      logger.error("Generated document file error", {
        error: error.message,
        documentId: req.params.documentId,
      });
      return sendError(res, "Failed to open document", 500, "DOCUMENT_ERROR");
    }
  })
);

/**
 * GET /api/documents/generated/:documentId
 * Get a specific generated document
 */
router.get(
  "/generated/:documentId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { documentId } = req.params;
      const orgIds = await collectOrgIds(req, null);

      const lookup = await findGeneratedDocumentForUser(documentId, req, orgIds);
      if (lookup.error === "NOT_FOUND") {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }
      if (lookup.error === "FORBIDDEN") {
        return sendError(res, "Unauthorized org access", 403, "FORBIDDEN");
      }
      const document = lookup.doc;

      logger.info("Generated document fetched", { documentId });

      return sendSuccess(res, document, "Document fetched successfully");
    } catch (error) {
      logger.error("Get generated document error", {
        error: error.message,
        documentId: req.params.documentId
      });
      return sendError(res, "Failed to fetch document", 500, "DOCUMENT_ERROR");
    }
  })
);

/**
 * PUT /api/documents/generated/:documentId
 * Update a generated document
 */
router.put(
  "/generated/:documentId",
  authenticate,
  authorize(...MANAGE_DOC_ROLES),
  asyncHandler(async (req, res) => {
    try {
      const { documentId } = req.params;
      const { title, description, content, category, status } = req.body;

      const orgIds = await collectOrgIds(req, null);
      const lookup = await findGeneratedDocumentForUser(documentId, req, orgIds);
      if (lookup.error === "NOT_FOUND") {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }
      if (lookup.error === "FORBIDDEN") {
        return sendError(res, "Unauthorized org access", 403, "FORBIDDEN");
      }

      const document = await GeneratedDocument.findOneAndUpdate(
        { id: documentId },
        {
          title,
          description,
          content,
          category,
          status,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!document) {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }

      logger.info("Generated document updated", { documentId });

      return sendSuccess(res, document, "Document updated successfully");
    } catch (error) {
      logger.error("Update generated document error", {
        error: error.message,
        documentId: req.params.documentId
      });
      return sendError(res, "Failed to update document", 500, "UPDATE_ERROR");
    }
  })
);

/**
 * DELETE /api/documents/generated/:documentId
 * Delete a generated document
 */
router.delete(
  "/generated/:documentId",
  authenticate,
  authorize(...MANAGE_DOC_ROLES),
  asyncHandler(async (req, res) => {
    try {
      const { documentId } = req.params;
      const orgIds = await collectOrgIds(req, null);

      const lookup = await findGeneratedDocumentForUser(documentId, req, orgIds);
      if (lookup.error === "NOT_FOUND") {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }
      if (lookup.error === "FORBIDDEN") {
        return sendError(res, "Unauthorized org access", 403, "FORBIDDEN");
      }

      const document = await GeneratedDocument.findOneAndDelete({ id: documentId });

      if (!document) {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }

      logger.info("Generated document deleted", { documentId });

      return sendSuccess(res, null, "Document deleted successfully");
    } catch (error) {
      logger.error("Delete generated document error", {
        error: error.message,
        documentId: req.params.documentId
      });
      return sendError(res, "Failed to delete document", 500, "DELETE_ERROR");
    }
  })
);

/**
 * GET /api/documents/issued/:employeeId
 * Get documents issued to a specific employee
 */
router.get(
  "/issued/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { employeeId } = req.params;

      const documents = await IssuedDocument.find({ targetEmployeeId: employeeId })
        .sort({ createdAt: -1 })
        .populate('issuedBy', 'name email')
        .lean();

      logger.info("Employee issued documents fetched", {
        employeeId,
        count: documents.length
      });

      return sendSuccess(res, documents, "Issued documents fetched successfully");
    } catch (error) {
      logger.error("Get employee issued documents error", {
        error: error.message,
        employeeId: req.params.employeeId
      });
      return sendError(res, "Failed to fetch issued documents", 500, "DOCUMENTS_ERROR");
    }
  })
);

/**
 * POST /api/documents/issue
 * Issue a document to an employee (optional file) — visible in employee Company Docs
 */
router.post(
  "/issue",
  authenticate,
  authorize(...MANAGE_DOC_ROLES),
  documentUpload.single("document"),
  asyncHandler(async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        targetEmployeeId,
        acknowledgmentRequired,
        notes,
      } = req.body;

      if (!title || !category || !targetEmployeeId) {
        return sendError(
          res,
          "Title, category, and target employee are required",
          400,
          "VALIDATION_ERROR"
        );
      }

      const employee = await Employee.findById(targetEmployeeId)
        .select("orgId userId firstName lastName")
        .lean();
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      const organizationId = String(
        employee.orgId || req.user.orgId || req.user.tenantId || "system"
      );

      let fileUrl;
      let fileName;
      let fileSize;
      if (req.file) {
        fileUrl = `/uploads/documents/${req.file.filename}`;
        fileName = req.file.originalname;
        fileSize = `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`;
      }

      const issuedId = `issued_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      const issuedDocument = await IssuedDocument.create({
        id: issuedId,
        title,
        description: description || "",
        category,
        targetEmployeeId: String(targetEmployeeId),
        issuedBy: req.user.userId,
        issuedByName: req.user.name || "HR",
        acknowledgmentRequired:
          acknowledgmentRequired === true ||
          acknowledgmentRequired === "true",
        notes: notes || "",
        organizationId,
        status: "pending",
        fileUrl,
        fileName,
        fileSize,
      });

      // Mirror into company library so it appears in employee Company Docs
      await GeneratedDocument.create({
        id: `gen_${issuedId}`,
        title,
        description: description || "",
        documentType: category,
        category,
        content: description || title,
        employeeId: String(targetEmployeeId),
        organizationId,
        status: "generated",
        fileUrl,
        fileName,
        createdBy: req.user.userId,
        assignTo: "specific",
        targetUsers: employee.userId ? [employee.userId] : [],
        requiresAcknowledgment:
          acknowledgmentRequired === true ||
          acknowledgmentRequired === "true",
      });

      logger.info("Document issued to employee", {
        documentId: issuedDocument.id,
        targetEmployeeId,
        issuedBy: req.user.userId,
        title,
      });

      return sendSuccess(res, { document: issuedDocument }, "Document issued successfully");
    } catch (error) {
      logger.error("Issue document error", {
        error: error.message,
        stack: error.stack,
        body: req.body,
      });
      return sendError(res, error.message || "Failed to issue document", 500, "ISSUE_ERROR");
    }
  })
);

/**
 * GET /api/documents/acknowledgments/organization/:organizationId
 * List all document acknowledgments for an organization (admin/hr)
 */
router.get(
  "/acknowledgments/organization/:organizationId",
  authenticate,
  authorize(...MANAGE_DOC_ROLES),
  asyncHandler(async (req, res) => {
    try {
      const orgId = resolveReadableOrgId(req, req.params.organizationId);
      if (!orgId) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      const orgIds = await collectOrgIds(req, orgId);
      const acknowledgments = await DocumentAcknowledgment.find({
        organizationId: { $in: orgIds.length ? orgIds : [orgId] },
      })
        .sort({ acknowledgedAt: -1 })
        .lean();

      return sendSuccess(res, acknowledgments, "Acknowledgments fetched successfully");
    } catch (error) {
      logger.error("Get organization acknowledgments error", {
        error: error.message,
        organizationId: req.params.organizationId,
      });
      return sendError(res, "Failed to fetch acknowledgments", 500, "ACKNOWLEDGMENTS_ERROR");
    }
  })
);

/**
 * GET /api/documents/acknowledgments/employee/:employeeId
 * employeeId may be User id or Employee Mongo id
 */
router.get(
  "/acknowledgments/employee/:employeeId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const userId = await resolveDocumentUserId(req.params.employeeId);

      if (
        req.user.role === "employee" &&
        String(req.user.userId) !== String(userId)
      ) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      const acknowledgments = await DocumentAcknowledgment.find({
        employeeId: userId,
      })
        .sort({ acknowledgedAt: -1 })
        .lean();

      return sendSuccess(res, acknowledgments, "Acknowledgments fetched successfully");
    } catch (error) {
      logger.error("Get employee acknowledgments error", {
        error: error.message,
        employeeId: req.params.employeeId,
      });
      return sendError(res, "Failed to fetch acknowledgments", 500, "ACKNOWLEDGMENTS_ERROR");
    }
  })
);

/**
 * POST /api/documents/acknowledgments
 */
router.post(
  "/acknowledgments",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const {
        documentId,
        employeeId,
        employeeName,
        organizationId,
        acknowledgedAt,
        ipAddress,
        accepted,
      } = req.body;

      const resolvedEmployeeId = employeeId
        ? await resolveDocumentUserId(employeeId)
        : req.user.userId;

      if (!documentId || !resolvedEmployeeId) {
        return sendError(
          res,
          "Document ID and employee are required",
          400,
          "VALIDATION_ERROR"
        );
      }

      if (
        req.user.role === "employee" &&
        String(req.user.userId) !== String(resolvedEmployeeId)
      ) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      const existingAcknowledgment = await DocumentAcknowledgment.findOne({
        documentId,
        employeeId: resolvedEmployeeId,
      });

      if (existingAcknowledgment) {
        return sendSuccess(
          res,
          existingAcknowledgment,
          "Document already acknowledged"
        );
      }

      const acknowledgment = await DocumentAcknowledgment.create({
        documentId,
        employeeId: resolvedEmployeeId,
        employeeName,
        organizationId,
        acknowledgedAt: acknowledgedAt || new Date(),
        ipAddress,
        accepted,
        status: accepted ? "Completed" : "Rejected",
      });

      return sendSuccess(res, acknowledgment, "Document acknowledged successfully");
    } catch (error) {
      logger.error("Create acknowledgment error", {
        error: error.message,
        documentId: req.body.documentId,
      });
      return sendError(res, "Failed to create acknowledgment", 500, "ACKNOWLEDGMENT_ERROR");
    }
  })
);

export default router;
