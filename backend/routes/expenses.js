/**
 * Expenses Routes
 * Handles expense management
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Expense from "../models/Expense.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Configure multer for receipt uploads
const receiptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/receipts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `receipt-${req.user.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const receiptUpload = multer({
  storage: receiptStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  }
});

/**
 * GET /api/expenses/receipt/:filename
 * Download expense receipt
 * IMPORTANT: This route must come BEFORE /user/:userId to avoid route conflicts
 */
router.get(
  "/receipt/:filename",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Validate filename to prevent directory traversal
      if (filename.includes('..') || filename.includes('/')) {
        return sendError(res, "Invalid filename", 400, "VALIDATION_ERROR");
      }

      const filePath = path.join(process.cwd(), 'uploads', 'receipts', filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return sendError(res, "Receipt not found", 404, "NOT_FOUND");
      }

      // Get file extension
      const ext = path.extname(filePath).toLowerCase();
      
      // Set appropriate content type
      let contentType = 'application/octet-stream';
      if (ext === '.pdf') {
        contentType = 'application/pdf';
      } else if (ext === '.png') {
        contentType = 'image/png';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      }

      // Set response headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      logger.info("Receipt downloaded", {
        userId: req.user.userId,
        filename
      });
    } catch (error) {
      logger.error("Download receipt error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to download receipt", 500, "DOWNLOAD_ERROR");
    }
  })
);

/**
 * GET /api/expenses/user/:userId
 * Get expenses for a user
 */
router.get(
  "/user/:userId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10, status } = req.query;
      const skip = (page - 1) * limit;

      // Check authorization - employees can only see their own expenses
      if (req.user.role === "employee" && req.user.userId.toString() !== userId) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      // Build query - handle both string and ObjectId
      const query = { userId: userId };
      if (status) {
        query.status = status;
      }

      logger.info("Fetching user expenses", {
        userId,
        reqUserId: req.user.userId,
        query
      });

      // Get total count
      const total = await Expense.countDocuments(query);

      // Get expenses with pagination
      const expenses = await Expense.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      logger.info("User expenses fetched", {
        userId,
        count: expenses.length,
        expenses: expenses.map(e => ({ _id: e._id, title: e.title, amount: e.amount, status: e.status }))
      });

      return sendPaginated(
        res,
        expenses || [],
        total,
        page,
        limit,
        "Expenses fetched successfully"
      );
    } catch (error) {
      logger.error("Get user expenses error", {
        error: error.message,
        userId: req.params.userId
      });
      return sendError(res, "Failed to fetch expenses", 500, "EXPENSES_ERROR");
    }
  })
);

/**
 * GET /api/expenses
 * Get all expenses (admin/super admin only)
 */
router.get(
  "/",
  authenticate,
  authorize("admin", "super_admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 10, status, orgId } = req.query;
      const skip = (page - 1) * limit;

      // Build query
      const query = {};
      if (status) {
        query.status = status;
      }
      if (orgId || req.user.role !== "super_admin") {
        query.orgId = orgId || req.user.orgId;
      }

      // Get total count
      const total = await Expense.countDocuments(query);

      // Get expenses with pagination
      const expenses = await Expense.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      logger.info("Expenses fetched", {
        userId: req.user.userId,
        count: expenses.length,
        expenseAmounts: expenses.map(e => ({ id: e._id, amount: e.amount, status: e.status, title: e.title }))
      });

      return sendPaginated(
        res,
        expenses || [],
        total,
        page,
        limit,
        "Expenses fetched successfully"
      );
    } catch (error) {
      logger.error("Get expenses error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to fetch expenses", 500, "EXPENSES_ERROR");
    }
  })
);

/**
 * POST /api/expenses
 * Create a new expense
 */
router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { title, amount, category, description, receipt, employeeName, date } = req.body;

      // Validate required fields
      if (!title || !amount || !category) {
        return sendError(res, "Missing required fields", 400, "VALIDATION_ERROR");
      }

      const expense = await Expense.create({
        userId: req.user.userId,
        employeeId: req.user.userId,
        employeeName: employeeName || req.user.name,
        orgId: req.user.orgId,
        title,
        amount: Number(amount),
        category,
        description,
        receipt,
        date: date ? new Date(date) : new Date(),
        status: "pending",
        createdAt: new Date()
      });

      logger.info("Expense created", {
        expenseId: expense._id,
        employeeId: req.user.userId
      });

      return sendSuccess(res, expense, "Expense created successfully", 201);
    } catch (error) {
      logger.error("Create expense error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to create expense", 500, "CREATE_ERROR");
    }
  })
);

/**
 * PUT /api/expenses/:expenseId
 * Update an expense
 */
router.put(
  "/:expenseId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { expenseId } = req.params;
      const { title, amount, category, description, receipt, date } = req.body;

      // Find expense
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        return sendError(res, "Expense not found", 404, "NOT_FOUND");
      }

      // Check authorization - admin/super_admin/hr can edit any expense, others can only edit their own
      if (req.user.role !== "admin" && req.user.role !== "super_admin" && req.user.role !== "hr") {
        if (expense.userId.toString() !== req.user.userId) {
          return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
        }
      }

      // Update fields
      if (title) expense.title = title;
      if (amount !== undefined && amount !== null && amount !== '') {
        const numAmount = Number(amount);
        console.log(`Updating amount from ${expense.amount} to ${numAmount} (received: ${amount}, type: ${typeof amount})`);
        expense.amount = numAmount;
      }
      if (category) expense.category = category;
      if (description) expense.description = description;
      if (receipt) expense.receipt = receipt;
      if (date) expense.date = new Date(date);

      // Ensure amount is a number before saving
      if (expense.amount) {
        expense.amount = Number(expense.amount);
      }

      await expense.save();

      logger.info("Expense updated", {
        expenseId,
        userId: req.user.userId,
        updatedAmount: expense.amount,
        updatedAmountType: typeof expense.amount,
        updatedTitle: expense.title,
        requestAmount: amount,
        allFields: { title, amount, category, description, receipt, date }
      });

      return sendSuccess(res, expense, "Expense updated successfully");
    } catch (error) {
      logger.error("Update expense error", {
        error: error.message,
        expenseId: req.params.expenseId,
        userId: req.user.userId
      });
      return sendError(res, "Failed to update expense", 500, "UPDATE_ERROR");
    }
  })
);

/**
 * PUT /api/expenses/:expenseId/approve
 * Approve an expense
 */
router.put(
  "/:expenseId/approve",
  authenticate,
  authorize("admin", "super_admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { expenseId } = req.params;

      // Find expense
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        return sendError(res, "Expense not found", 404, "NOT_FOUND");
      }

      // Update status
      expense.status = "approved";
      expense.approvedBy = req.user.userId;
      expense.approvedDate = new Date();

      await expense.save();

      logger.info("Expense approved", {
        expenseId,
        approvedBy: req.user.userId
      });

      return sendSuccess(res, expense, "Expense approved successfully");
    } catch (error) {
      logger.error("Approve expense error", {
        error: error.message,
        expenseId: req.params.expenseId,
        userId: req.user.userId
      });
      return sendError(res, "Failed to approve expense", 500, "APPROVE_ERROR");
    }
  })
);

/**
 * PUT /api/expenses/:expenseId/reject
 * Reject an expense
 */
router.put(
  "/:expenseId/reject",
  authenticate,
  authorize("admin", "super_admin", "hr"),
  asyncHandler(async (req, res) => {
    try {
      const { expenseId } = req.params;
      const { rejectionReason } = req.body;

      // Find expense
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        return sendError(res, "Expense not found", 404, "NOT_FOUND");
      }

      // Update status
      expense.status = "rejected";
      expense.rejectedBy = req.user.userId;
      expense.rejectedDate = new Date();
      expense.rejectionReason = rejectionReason || "";

      await expense.save();

      logger.info("Expense rejected", {
        expenseId,
        rejectedBy: req.user.userId
      });

      return sendSuccess(res, expense, "Expense rejected successfully");
    } catch (error) {
      logger.error("Reject expense error", {
        error: error.message,
        expenseId: req.params.expenseId,
        userId: req.user.userId
      });
      return sendError(res, "Failed to reject expense", 500, "REJECT_ERROR");
    }
  })
);

/**
 * DELETE /api/expenses/:expenseId
 * Delete an expense
 */
router.delete(
  "/:expenseId",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { expenseId } = req.params;

      // Find expense
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        return sendError(res, "Expense not found", 404, "NOT_FOUND");
      }

      // Check authorization - only creator or admin can delete
      if (req.user.role !== "admin" && req.user.role !== "super_admin" && req.user.role !== "hr" && expense.userId.toString() !== req.user.userId) {
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      // Delete expense
      await Expense.findByIdAndDelete(expenseId);

      logger.info("Expense deleted", {
        expenseId,
        userId: req.user.userId
      });

      return sendSuccess(res, { id: expenseId }, "Expense deleted successfully");
    } catch (error) {
      logger.error("Delete expense error", {
        error: error.message,
        expenseId: req.params.expenseId,
        userId: req.user.userId
      });
      return sendError(res, "Failed to delete expense", 500, "DELETE_ERROR");
    }
  })
);

/**
 * POST /api/expenses/upload-receipt
 * Upload expense receipt
 */
router.post(
  "/upload-receipt",
  authenticate,
  receiptUpload.single('receipt'),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return sendError(res, "No receipt file provided", 400, "VALIDATION_ERROR");
      }

      const receiptPath = `/uploads/receipts/${req.file.filename}`;

      logger.info("Receipt uploaded", {
        userId: req.user.userId,
        filename: req.file.filename,
        size: req.file.size
      });

      return sendSuccess(res, {
        filePath: receiptPath,
        filename: req.file.filename,
        size: req.file.size
      }, "Receipt uploaded successfully", 201);
    } catch (error) {
      logger.error("Upload receipt error", {
        error: error.message,
        userId: req.user.userId
      });
      return sendError(res, "Failed to upload receipt", 500, "UPLOAD_ERROR");
    }
  })
);

export default router;
