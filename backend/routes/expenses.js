/**
 * Expenses Routes
 * Handles expense management
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { asyncHandler } from "../middleware/errorHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import Expense from "../models/Expense.js";
import Employee from "../models/Employee.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";
import EmailNotificationService from "../utils/emailNotificationService.js";
import User from "../models/User.js";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for receipt uploads
const receiptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'receipts');
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
 * POST /api/expenses/upload-receipt
 * Upload expense receipt
 * IMPORTANT: This route must come BEFORE /:expenseId routes to avoid route conflicts
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

      const filePath = path.join(__dirname, '..', 'uploads', 'receipts', filename);
      
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

      console.log("=== GET USER EXPENSES DEBUG ===");
      console.log("Params userId:", userId, "Type:", typeof userId);
      console.log("Req user userId:", req.user.userId, "Type:", typeof req.user.userId);
      console.log("Comparison:", req.user.userId.toString(), "===", userId, "?", req.user.userId.toString() === userId);

      // Check authorization - employees can only see their own expenses
      if (req.user.role === "employee" && req.user.userId.toString() !== userId) {
        console.log("❌ GET AUTHORIZATION DENIED - Employee trying to access other user's expenses");
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      // Build query - convert userId string to ObjectId for proper MongoDB query
      const mongoose = await import('mongoose');
      let queryUserId = userId;
      
      // Try to convert to ObjectId if it looks like one
      if (mongoose.Types.ObjectId.isValid(userId)) {
        queryUserId = new mongoose.Types.ObjectId(userId);
      }

      const query = { userId: queryUserId };
      if (status) {
        query.status = status;
      }

      console.log("Query:", query);

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

      console.log("✅ Expenses found:", expenses.length);

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
      console.log("❌ GET ERROR:", error.message);
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
        .populate('approvedBy', 'name email')
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

      // Emit real-time updates to dashboards
      if (req.emitDashboardUpdate) {
        try {
          req.emitDashboardUpdate('create', 'expense', expense, req.user.orgId);
        } catch (e) {
          logger.warn('Failed to emit dashboard update', { error: e.message });
        }
      }

      // Send email notification to employee (confirmation)
      try {
        const user = await User.findById(req.user.userId).select('name email').lean();
        const employee = await Employee.findOne({ userId: req.user.userId }).select('_id orgId').lean();
        
        if (user && user.email && employee) {
          await EmailNotificationService.sendExpenseSubmitted(
            { 
              _id: employee._id,
              name: user.name, 
              email: user.email,
              orgId: employee.orgId || req.user.orgId
            },
            expense
          );
          logger.info('Expense submitted email sent', { expenseId: expense._id, email: user.email });
        } else {
          logger.warn('Missing user or employee data for expense submission notification', { 
            expenseId: expense._id, 
            hasUser: !!user, 
            hasEmployee: !!employee 
          });
        }
      } catch (emailError) {
        logger.error('Failed to send expense submitted email', { error: emailError.message });
      }

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

      console.log("=== UPDATE EXPENSE DEBUG ===");
      console.log("Params:", { expenseId });
      console.log("User:", { 
        userId: req.user.userId, 
        userIdType: typeof req.user.userId,
        role: req.user.role 
      });
      console.log("Body:", { title, amount, category, description, receipt, date });

      // Find expense
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        console.log("Expense not found:", expenseId);
        return sendError(res, "Expense not found", 404, "NOT_FOUND");
      }

      console.log("Expense found:", {
        _id: expense._id,
        userId: expense.userId,
        userIdType: typeof expense.userId,
        status: expense.status
      });

      // Check authorization - only owner or admin can edit
      const expenseUserIdStr = expense.userId.toString();
      const reqUserIdStr = req.user.userId.toString();
      const isOwner = expenseUserIdStr === reqUserIdStr;
      const isAdmin = ["admin", "super_admin", "hr"].includes(req.user.role);
      
      console.log("Authorization check:", {
        expenseUserIdStr,
        reqUserIdStr,
        isOwner,
        userRole: req.user.role,
        isAdmin,
        allowed: isOwner || isAdmin
      });
      
      if (!isOwner && !isAdmin) {
        console.log("❌ UPDATE AUTHORIZATION DENIED");
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      console.log("✅ Authorization passed");

      // Update fields
      if (title !== undefined && title !== null && title !== '') expense.title = title;
      if (amount !== undefined && amount !== null && amount !== '') {
        const numAmount = Number(amount);
        expense.amount = numAmount;
      }
      if (category !== undefined && category !== null && category !== '') expense.category = category;
      if (description !== undefined && description !== null && description !== '') expense.description = description;
      if (receipt !== undefined && receipt !== null && receipt !== '') expense.receipt = receipt;
      if (date !== undefined && date !== null && date !== '') expense.date = new Date(date);

      // Ensure amount is a number before saving
      if (expense.amount) {
        expense.amount = Number(expense.amount);
      }

      console.log("Updated expense object:", {
        title: expense.title,
        amount: expense.amount,
        category: expense.category,
        date: expense.date
      });

      await expense.save();

      console.log("✅ Expense saved successfully");

      logger.info("Expense updated", {
        expenseId,
        userId: req.user.userId,
        updatedTitle: expense.title,
        updatedAmount: expense.amount
      });

      // Emit real-time updates to dashboards
      if (req.emitDashboardUpdate) {
        try {
          req.emitDashboardUpdate('update', 'expense', expense, req.user.orgId);
        } catch (e) {
          logger.warn('Failed to emit dashboard update', { error: e.message });
        }
      }

      return sendSuccess(res, expense, "Expense updated successfully");
    } catch (error) {
      console.log("❌ UPDATE ERROR:", error.message);
      console.log("Stack:", error.stack);
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

      // Send email notification to employee
      try {
        const user = await User.findById(expense.userId).select('name email').lean();
        const employee = await Employee.findOne({ userId: expense.userId }).select('_id orgId').lean();
        const approver = await User.findById(req.user.userId).select('name').lean();
        
        if (user && user.email && employee) {
          await EmailNotificationService.sendExpenseApproved(
            { 
              _id: employee._id,
              name: user.name, 
              email: user.email,
              orgId: employee.orgId || req.user.orgId
            },
            expense,
            { 
              _id: req.user.userId,
              name: approver?.name || 'Admin' 
            }
          );
          logger.info('Expense approved email sent', { expenseId, email: user.email });
        } else {
          logger.warn('Missing user or employee data for expense notification', { 
            expenseId, 
            hasUser: !!user, 
            hasEmployee: !!employee 
          });
        }
      } catch (emailError) {
        logger.error('Failed to send expense approved email', { error: emailError.message, expenseId });
      }

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

      console.log("=== DELETE EXPENSE DEBUG ===");
      console.log("Params:", { expenseId });
      console.log("User:", { 
        userId: req.user.userId, 
        userIdType: typeof req.user.userId,
        role: req.user.role 
      });

      console.log("Expense found:", {
        _id: expense._id,
        userId: expense.userId,
        userIdType: typeof expense.userId,
        status: expense.status
      });

      // Check authorization - only owner or admin can delete
      const expenseUserIdStr = expense.userId.toString();
      const reqUserIdStr = req.user.userId.toString();
      const isOwner = expenseUserIdStr === reqUserIdStr;
      const isAdmin = ["admin", "super_admin", "hr"].includes(req.user.role);
      
      console.log("Authorization check:", {
        expenseUserIdStr,
        reqUserIdStr,
        isOwner,
        userRole: req.user.role,
        isAdmin,
        allowed: isOwner || isAdmin
      });
      
      if (!isOwner && !isAdmin) {
        console.log("❌ DELETE AUTHORIZATION DENIED");
        return sendError(res, "Unauthorized access", 403, "FORBIDDEN");
      }

      console.log("✅ Authorization passed");

      // Delete expense
      await Expense.findByIdAndDelete(expenseId);

      console.log("✅ Expense deleted successfully");

      logger.info("Expense deleted", {
        expenseId,
        userId: req.user.userId
      });

      // Emit real-time updates to dashboards
      if (req.emitDashboardUpdate) {
        try {
          req.emitDashboardUpdate('delete', 'expense', { _id: expenseId }, req.user.orgId);
        } catch (e) {
          logger.warn('Failed to emit dashboard update', { error: e.message });
        }
      }

      return sendSuccess(res, { id: expenseId }, "Expense deleted successfully");
    } catch (error) {
      console.log("❌ DELETE ERROR:", error.message);
      console.log("Stack:", error.stack);
      logger.error("Delete expense error", {
        error: error.message,
        expenseId: req.params.expenseId,
        userId: req.user.userId
      });
      return sendError(res, "Failed to delete expense", 500, "DELETE_ERROR");
    }
  })
);

export default router;
