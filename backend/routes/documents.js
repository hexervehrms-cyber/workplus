/**
 * Documents Routes
 * Handles document retrieval and management
 */

import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Document from "../models/Document.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

const router = express.Router();

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
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      // Check authorization - employees can only see their own documents
      if (req.user.role === "employee" && req.user.userId !== employeeId) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      // Get total count
      const total = await Document.countDocuments({ userId: employeeId });

      // Get documents with pagination
      const documents = await Document.find({ userId: employeeId })
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
      if (req.user.role === "employee" && req.user.userId !== document.userId) {
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
      if (req.user.role === "employee" && req.user.userId !== document.userId) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
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

export default router;
