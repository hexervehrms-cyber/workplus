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
import {
  isSuperAdmin,
  employeeLookupQuery,
  resolveScopedOrgId,
  userOrgIdFromReq
} from "../utils/orgScopeHelpers.js";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const MANAGE_DOC_ROLES = ["super_admin", "admin", "hr"];

function resolveWriteOrgId(req, bodyOrgId) {
  const pick = (v) => {
    if (v == null || v === "") return null;
    const s = String(v).trim();
    if (!s || s === "system") return null;
    return s;
  };
  if (isSuperAdmin(req)) {
    return (
      pick(bodyOrgId) ||
      pick(resolveScopedOrgId(req)) ||
      pick(userOrgIdFromReq(req)) ||
      null
    );
  }
  return pick(userOrgIdFromReq(req)) || pick(req.validatedOrgId) || pick(bodyOrgId) || null;
}

const EMPLOYMENT_DOCUMENT_TYPES = [
  "general",
  "experience_letter",
  "offer_letter",
  "relieving_letter",
  "appraisal_letter",
  "salary_slips",
  "bank_statement",
];

function buildDocumentOrgFilter(req, employeeOrgId) {
  const ids = new Set();
  const scoped = userOrgIdFromReq(req) || req.validatedOrgId || req.user?.orgId;
  if (scoped) ids.add(String(scoped));
  if (employeeOrgId) ids.add(String(employeeOrgId));
  if (!ids.size) return null;
  if (ids.size === 1) return { orgId: [...ids][0] };
  return { orgId: { $in: [...ids] } };
}

async function assertPersonalDocumentAccess(req, document) {
  if (!document) {
    return { ok: false, status: 404, message: "Document not found" };
  }
  const isOwner = String(document.userId) === String(req.user.userId);
  if (req.user.role === "employee") {
    return isOwner
      ? { ok: true }
      : { ok: false, status: 403, message: "Unauthorized access" };
  }
  if (
    !isSuperAdmin(req) &&
    document.orgId &&
    String(document.orgId) !== String(req.user.orgId)
  ) {
    return { ok: false, status: 403, message: "Unauthorized access" };
  }
  return { ok: true };
}

async function assertCanAccessEmployeeDocuments(req, employeeIdParam) {
  const privileged = [...MANAGE_DOC_ROLES, "manager"];
  const idParam = String(employeeIdParam);
  
  // Try to resolve the parameter as either Employee._id or User._id
  // First try Employee._id lookup (scoped to org for non-super_admin)
  let emp = await Employee.findOne(employeeLookupQuery(req, employeeIdParam))
    .select("userId orgId")
    .lean();
  
  // If not found, try User._id lookup (documents are stored by userId)
  if (!emp) {
    const orgId = isSuperAdmin(req) ? {} : { orgId: String(req.user.orgId) };
    emp = await Employee.findOne({ userId: idParam, ...orgId })
      .select("userId orgId")
      .lean();
  }

  if (!emp) {
    return { ok: false, status: 404, message: "Employee not found" };
  }

  if (privileged.includes(req.user.role)) {
    if (!isSuperAdmin(req) && String(emp.orgId) !== String(req.user.orgId)) {
      return { ok: false, status: 403, message: "Unauthorized access" };
    }
    return {
      ok: true,
      userId: String(emp.userId),
      employeeOrgId: emp.orgId,
    };
  }

  const self = await Employee.findOne({ userId: req.user.userId })
    .select("_id userId orgId")
    .lean();

  const param = String(employeeIdParam);
  if (
    !self ||
    (String(self._id) !== param && String(self.userId) !== param)
  ) {
    return { ok: false, status: 403, message: "Unauthorized access" };
  }

  const scopedOrg = userOrgIdFromReq(req) || req.validatedOrgId;
  if (
    scopedOrg &&
    self.orgId &&
    String(self.orgId) !== String(scopedOrg) &&
    !isSuperAdmin(req)
  ) {
    logger.warn("Employee org mismatch on document access", {
      userId: req.user.userId,
      employeeOrgId: self.orgId,
      tokenOrgId: scopedOrg,
    });
  }

  return { ok: true, userId: String(self.userId), employeeOrgId: self.orgId };
}

/** Resolve org id for reads — non–super-admins are limited to their tenant. */
const resolveReadableOrgId = (req, requestedOrgId) => {
  const userOrgId = userOrgIdFromReq(req);
  if (isSuperAdmin(req)) {
    if (requestedOrgId) return String(requestedOrgId);
    return resolveScopedOrgId(req);
  }
  if (requestedOrgId && userOrgId && String(requestedOrgId) !== String(userOrgId)) {
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
  const authOrg = String(req.user?.orgId || "").trim();
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
const resolveDocumentUserId = async (idParam, req) => {
  const id = String(idParam);
  const orgFilter = isSuperAdmin(req) ? {} : { orgId: String(req.user.orgId) };
  const asUser = await Document.findOne({ userId: id, ...orgFilter }).select("_id").lean();
  if (asUser) return id;
  const emp = await Employee.findOne(employeeLookupQuery(req, id)).select("userId").lean();
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
      const orgId = resolveWriteOrgId(req, req.body?.orgId);
      if (!orgId) {
        return sendError(
          res,
          "Organization context is required. Sign out and sign in again, or contact HR.",
          400,
          "MISSING_ORG_CONTEXT"
        );
      }

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

      const orgId = resolveWriteOrgId(req, organizationId);
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
    const orgId = userOrgIdFromReq(req) || resolveScopedOrgId(req);
    if (!orgId) {
      return sendError(res, "Organization context is required", 400, "MISSING_ORG_CONTEXT");
    }

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
      const { page = 1, limit = 50, scope } = req.query;
      const skip = (page - 1) * limit;

      const access = await assertCanAccessEmployeeDocuments(req, employeeId);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }
      const userId = access.userId;

      const docFilter = { userId };
      if (!isSuperAdmin(req)) {
        const orgClause = buildDocumentOrgFilter(req, access.employeeOrgId);
        if (orgClause) Object.assign(docFilter, orgClause);
      }

      if (scope === "employment") {
        docFilter.type = { $in: EMPLOYMENT_DOCUMENT_TYPES };
      } else if (scope === "education") {
        docFilter.type = { $regex: /^education_/ };
      }

      // Get total count
      const total = await Document.countDocuments(docFilter);

      // Get documents with pagination
      const documents = await Document.find(docFilter)
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

      const access = await assertPersonalDocumentAccess(req, document);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
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

      const access = await assertPersonalDocumentAccess(req, document);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
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

      const access = await assertPersonalDocumentAccess(req, document);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
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
  authorize(...MANAGE_DOC_ROLES),
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

      const orgId = resolveWriteOrgId(req, organizationId);
      if (!orgId) {
        return sendError(res, "Organization ID is required", 400, "VALIDATION_ERROR");
      }

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

      const deleted = await GeneratedDocument.findByIdAndDelete(lookup.doc._id);

      if (!deleted) {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }

      logger.info("Generated document deleted", {
        documentId: deleted.id || String(deleted._id),
      });

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

      const access = await assertCanAccessEmployeeDocuments(req, employeeId);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }

      const issuedFilter = { targetEmployeeId: employeeId };
      if (!isSuperAdmin(req)) {
        issuedFilter.organizationId = String(req.user.orgId);
      }

      const documents = await IssuedDocument.find(issuedFilter)
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

      const employee = await Employee.findOne(employeeLookupQuery(req, targetEmployeeId))
        .select("orgId userId firstName lastName")
        .lean();
      if (!employee) {
        return sendError(res, "Employee not found", 404, "NOT_FOUND");
      }

      if (!isSuperAdmin(req) && String(employee.orgId) !== String(req.user.orgId)) {
        return sendError(res, "Unauthorized org access", 403, "FORBIDDEN");
      }

      const organizationId = String(employee.orgId || resolveWriteOrgId(req, null));
      if (!organizationId) {
        return sendError(res, "Organization context is required", 400, "MISSING_ORG_CONTEXT");
      }

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
 * PATCH /api/documents/issued/:docId
 * Update an issued document (admin/hr)
 */
router.patch(
  "/issued/:docId",
  authenticate,
  authorize(...MANAGE_DOC_ROLES),
  asyncHandler(async (req, res) => {
    const { docId } = req.params;
    const doc = await IssuedDocument.findOne({ id: docId });
    if (!doc) {
      return sendError(res, "Issued document not found", 404, "NOT_FOUND");
    }
    if (!isSuperAdmin(req) && String(doc.organizationId) !== String(req.user.orgId)) {
      return sendError(res, "Unauthorized org access", 403, "FORBIDDEN");
    }
    const { title, description, category, notes, status } = req.body || {};
    if (title != null) doc.title = String(title);
    if (description != null) doc.description = String(description);
    if (category != null) doc.category = String(category);
    if (notes != null) doc.notes = String(notes);
    if (status != null) doc.status = String(status);
    await doc.save();
    return sendSuccess(res, { document: doc.toObject() }, "Issued document updated");
  })
);

/**
 * DELETE /api/documents/issued/:docId
 */
router.delete(
  "/issued/:docId",
  authenticate,
  authorize(...MANAGE_DOC_ROLES),
  asyncHandler(async (req, res) => {
    const { docId } = req.params;
    const doc = await IssuedDocument.findOne({ id: docId });
    if (!doc) {
      return sendError(res, "Issued document not found", 404, "NOT_FOUND");
    }
    if (!isSuperAdmin(req) && String(doc.organizationId) !== String(req.user.orgId)) {
      return sendError(res, "Unauthorized org access", 403, "FORBIDDEN");
    }
    if (doc.fileUrl) {
      const absolutePath = resolveDocumentAbsolutePath(doc.fileUrl);
      if (absolutePath) {
        try {
          fs.unlinkSync(absolutePath);
        } catch {
          /* ignore missing file */
        }
      }
    }
    await IssuedDocument.deleteOne({ id: docId });
    await GeneratedDocument.deleteMany({ id: `gen_${docId}` });
    return sendSuccess(res, null, "Issued document deleted");
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
      const access = await assertCanAccessEmployeeDocuments(req, req.params.employeeId);
      if (!access.ok) {
        return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
      }
      const userId = access.userId;

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
      // TASK 1: Normalize incoming payload - accept multiple field names
      const rawDocumentId = req.body.documentId || req.body.docId || req.body.id;
      const rawReadConfirmed = 
        req.body.readConfirmed === true ||
        req.body.readConfirmed === 'true' ||
        req.body.hasRead === true ||
        req.body.hasRead === 'true' ||
        req.body.read === true ||
        req.body.read === 'true';
      
      const rawTermsAccepted = 
        req.body.termsAccepted === true ||
        req.body.termsAccepted === 'true' ||
        req.body.acceptedTerms === true ||
        req.body.acceptedTerms === 'true' ||
        req.body.accepted === true ||
        req.body.accepted === 'true';

      const isAccepted = rawReadConfirmed && rawTermsAccepted;

      // Validation: documentId required, both confirmations must be true
      if (!rawDocumentId) {
        return sendError(
          res,
          "Document ID is required",
          400,
          "VALIDATION_ERROR"
        );
      }

      if (!isAccepted) {
        return sendError(
          res,
          "Please confirm that you have read and accepted the document terms",
          400,
          "VALIDATION_ERROR"
        );
      }

      const documentId = String(rawDocumentId);
      const {
        employeeId,
        acknowledgedAt,
        ipAddress,
      } = req.body;

      let resolvedEmployeeId = req.user.userId;
      let resolvedOrgId = userOrgIdFromReq(req) || resolveScopedOrgId(req);

      if (employeeId) {
        const access = await assertCanAccessEmployeeDocuments(req, employeeId);
        if (!access.ok) {
          return sendError(res, access.message, access.status, access.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
        }
        resolvedEmployeeId = access.userId;
        // Update org from employee's org for validation
        if (access.employeeOrgId) {
          resolvedOrgId = access.employeeOrgId;
        }
      }

      if (!resolvedEmployeeId) {
        return sendError(
          res,
          "Employee ID could not be determined",
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

      // Fetch and validate the generated document
      const orgIds = await collectOrgIds(req, null);
      const docLookup = await findGeneratedDocumentForUser(documentId, req, orgIds);
      
      if (docLookup.error === "NOT_FOUND") {
        return sendError(res, "Document not found", 404, "NOT_FOUND");
      }
      if (docLookup.error === "FORBIDDEN") {
        return sendError(res, "Unauthorized document access", 403, "FORBIDDEN");
      }

      const doc = docLookup.doc;
      
      // For employees: verify document is visible to them
      if (req.user.role === "employee") {
        const uid = String(req.user.userId);
        const assignAll = !doc.assignTo || doc.assignTo === "all";
        const targeted =
          Array.isArray(doc.targetUsers) &&
          doc.targetUsers.some((t) => String(t) === uid);
        
        if (!assignAll && !targeted) {
          return sendError(res, "Document not assigned to you", 403, "FORBIDDEN");
        }
      }

      // TASK 2: Tenant-safe upsert filter - include organizationId
      const finalOrgId = String(resolvedOrgId || doc.organizationId);
      const upsertFilter = {
        documentId: String(documentId),
        employeeId: String(resolvedEmployeeId),
        organizationId: finalOrgId,
      };

      try {
        // Use idempotent upsert to handle duplicate submissions safely
        const acknowledgment = await DocumentAcknowledgment.findOneAndUpdate(
          upsertFilter,
          {
            $set: {
              employeeName: String(req.user.name || "Employee"),
              organizationId: finalOrgId,
              acknowledgedAt: acknowledgedAt || new Date(),
              ipAddress: ipAddress || undefined,
              accepted: true,
              status: "Completed",
            },
            $setOnInsert: {
              createdAt: new Date(),
            }
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
          }
        );

        return sendSuccess(res, acknowledgment, "Document acknowledged successfully");
      } catch (mongoError) {
        // TASK 3: Handle duplicate key error gracefully
        if (mongoError.code === 11000) {
          logger.info("Duplicate acknowledgment (idempotent)", {
            documentId,
            employeeId: String(resolvedEmployeeId),
            organizationId: finalOrgId,
          });
          
          const existing = await DocumentAcknowledgment.findOne(upsertFilter);
          if (existing) {
            return sendSuccess(res, existing, "Document already acknowledged");
          }
        }
        throw mongoError;
      }
    } catch (error) {
      logger.error("Create acknowledgment error", {
        message: error.message,
        name: error.name,
        code: error.code,
        errors: error.errors,
        documentId: req.body.documentId || req.body.docId || req.body.id,
        employeeId: req.body.employeeId,
        userId: req.user?.userId,
        orgId: req.user?.orgId,
      });
      return sendError(res, error.message || "Failed to create acknowledgment", 500, "ACKNOWLEDGMENT_ERROR");
    }
  })
);

export default router;
