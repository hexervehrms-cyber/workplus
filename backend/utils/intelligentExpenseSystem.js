/**
 * Intelligent Expense Processing System
 * Handles expense management with OCR, policy validation, and automated workflows
 */

import Expense from "../models/Expense.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";
import logger from "./logger.js";

class IntelligentExpenseSystem {
  constructor(notificationManager, workflowEngine, eventSystem, socketManager) {
    this.notificationManager = notificationManager;
    this.workflowEngine = workflowEngine;
    this.eventSystem = eventSystem;
    this.socketManager = socketManager;
    
    // Default expense policies
    this.defaultPolicies = {
      expenseCategories: {
        travel: {
          name: 'Travel & Transportation',
          code: 'TRAVEL',
          maxAmount: 50000,
          requiresReceipt: true,
          requiresApproval: true,
          autoApprovalLimit: 5000,
          allowedSubcategories: ['flight', 'train', 'bus', 'taxi', 'fuel', 'parking', 'toll'],
          reimbursementRate: 100, // percentage
          taxImplications: false
        },
        meals: {
          name: 'Meals & Entertainment',
          code: 'MEALS',
          maxAmount: 10000,
          requiresReceipt: true,
          requiresApproval: true,
          autoApprovalLimit: 2000,
          allowedSubcategories: ['breakfast', 'lunch', 'dinner', 'client_entertainment'],
          reimbursementRate: 80, // 80% reimbursement
          taxImplications: true,
          dailyLimit: 2000
        },
        accommodation: {
          name: 'Accommodation',
          code: 'ACCOM',
          maxAmount: 25000,
          requiresReceipt: true,
          requiresApproval: true,
          autoApprovalLimit: 8000,
          allowedSubcategories: ['hotel', 'guest_house', 'service_apartment'],
          reimbursementRate: 100,
          taxImplications: false
        },
        office: {
          name: 'Office Supplies',
          code: 'OFFICE',
          maxAmount: 15000,
          requiresReceipt: true,
          requiresApproval: false,
          autoApprovalLimit: 5000,
          allowedSubcategories: ['stationery', 'equipment', 'software', 'books'],
          reimbursementRate: 100,
          taxImplications: false
        },
        communication: {
          name: 'Communication',
          code: 'COMM',
          maxAmount: 5000,
          requiresReceipt: true,
          requiresApproval: false,
          autoApprovalLimit: 2000,
          allowedSubcategories: ['mobile', 'internet', 'postage'],
          reimbursementRate: 100,
          taxImplications: false,
          monthlyLimit: 3000
        },
        medical: {
          name: 'Medical Expenses',
          code: 'MEDICAL',
          maxAmount: 100000,
          requiresReceipt: true,
          requiresApproval: true,
          autoApprovalLimit: 10000,
          allowedSubcategories: ['consultation', 'medicine', 'tests', 'emergency'],
          reimbursementRate: 100,
          taxImplications: false,
          requiresPreApproval: true
        },
        training: {
          name: 'Training & Development',
          code: 'TRAINING',
          maxAmount: 75000,
          requiresReceipt: true,
          requiresApproval: true,
          autoApprovalLimit: 15000,
          allowedSubcategories: ['course_fee', 'certification', 'conference', 'workshop'],
          reimbursementRate: 100,
          taxImplications: false,
          requiresPreApproval: true
        }
      },
      approvalWorkflow: {
        levels: [
          {
            level: 1,
            approver: 'manager',
            maxAmount: 25000,
            timeout: 48 // hours
          },
          {
            level: 2,
            approver: 'finance',
            maxAmount: 100000,
            timeout: 72
          },
          {
            level: 3,
            approver: 'admin',
            maxAmount: Infinity,
            timeout: 96
          }
        ],
        escalationEnabled: true,
        parallelApproval: false,
        requiresAllApprovals: false
      },
      validation: {
        maxReceiptAge: 90, // days
        maxClaimAge: 30, // days from expense date
        duplicateDetection: true,
        amountValidation: true,
        receiptValidation: true,
        categoryValidation: true
      },
      reimbursement: {
        processingDays: 7,
        paymentMethods: ['bank_transfer', 'cash', 'cheque'],
        defaultMethod: 'bank_transfer',
        batchProcessing: true,
        minimumAmount: 100
      },
      notifications: {
        submissionConfirmation: true,
        approvalNotifications: true,
        rejectionNotifications: true,
        reimbursementNotifications: true,
        reminderDays: [3, 7, 14],
        escalationNotifications: true
      }
    };
    
    this.organizationPolicies = new Map();
    this.ocrProcessingQueue = [];
    this.duplicateDetectionCache = new Map();
  }

  /**
   * Set expense policy for organization
   */
  setOrganizationPolicy(orgId, policy) {
    const mergedPolicy = {
      ...this.defaultPolicies,
      ...policy,
      orgId,
      updatedAt: new Date()
    };
    
    this.organizationPolicies.set(orgId, mergedPolicy);
    
    logger.info('Expense policy updated', { orgId });
    
    return mergedPolicy;
  }

  /**
   * Get expense policy for organization
   */
  getOrganizationPolicy(orgId) {
    return this.organizationPolicies.get(orgId) || this.defaultPolicies;
  }

  /**
   * Process expense submission with intelligent validation
   */
  async processExpenseSubmission(expenseData) {
    try {
      const {
        employeeId,
        category,
        subcategory,
        amount,
        description,
        expenseDate,
        receipts = [],
        location,
        businessPurpose,
        clientName,
        orgId,
        submittedBy
      } = expenseData;

      const employee = await Employee.findById(employeeId).populate('userId');
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.getOrganizationPolicy(orgId);

      // Validate expense against policy
      const validation = await this.validateExpense(expenseData, policy);
      
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Process receipts with OCR if available
      const processedReceipts = await this.processReceipts(receipts, category);

      // Check for duplicates
      const duplicateCheck = await this.checkForDuplicates(expenseData, orgId);
      if (duplicateCheck.isDuplicate) {
        validation.warnings.push(`Potential duplicate expense detected: ${duplicateCheck.message}`);
      }

      // Calculate reimbursement amount
      const categoryPolicy = policy.expenseCategories[category];
      const reimbursementAmount = (amount * categoryPolicy.reimbursementRate) / 100;

      // Create expense record
      const expense = await Expense.create({
        employeeId,
        userId: employee.userId._id,
        category,
        subcategory,
        amount,
        reimbursementAmount,
        description,
        expenseDate: new Date(expenseDate),
        receipts: processedReceipts,
        location,
        businessPurpose,
        clientName,
        status: validation.autoApprove ? 'approved' : 'pending',
        submittedBy: submittedBy || employee.userId._id,
        orgId,
        policyValidation: validation,
        ocrProcessed: processedReceipts.some(r => r.ocrData),
        autoApproved: validation.autoApprove
      });

      // Start approval workflow if not auto-approved
      let workflowResult = null;
      if (!validation.autoApprove && this.workflowEngine) {
        workflowResult = await this.workflowEngine.startWorkflow('expense_approval', {
          expenseId: expense._id,
          employeeId,
          employeeName: employee.userId.name,
          category,
          amount,
          description,
          createdBy: submittedBy || employee.userId._id,
          orgId
        });
      }

      // Send notifications
      if (this.notificationManager) {
        await this.sendExpenseSubmissionNotifications(expense, employee, validation.autoApprove, orgId);
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('expense.submitted', {
          expense,
          employee,
          autoApproved: validation.autoApprove,
          workflowId: workflowResult?.instanceId,
          orgId
        });
      }

      // Real-time updates
      if (this.socketManager) {
        this.socketManager.broadcastToOrganization(orgId, 'expense_submitted', {
          expenseId: expense._id,
          employeeName: employee.userId.name,
          category,
          amount,
          autoApproved: validation.autoApprove
        });
      }

      logger.info('Expense processed', {
        expenseId: expense._id,
        employeeId,
        category,
        amount,
        autoApproved: validation.autoApprove
      });

      return {
        success: true,
        expense,
        autoApproved: validation.autoApprove,
        reimbursementAmount,
        workflowId: workflowResult?.instanceId,
        warnings: validation.warnings,
        ocrResults: processedReceipts.filter(r => r.ocrData)
      };

    } catch (error) {
      logger.error('Failed to process expense submission', {
        error: error.message,
        expenseData
      });
      throw error;
    }
  }

  /**
   * Validate expense against policy
   */
  async validateExpense(expenseData, policy) {
    const {
      employeeId,
      category,
      subcategory,
      amount,
      expenseDate,
      receipts = []
    } = expenseData;

    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      autoApprove: false
    };

    const categoryPolicy = policy.expenseCategories[category];
    
    if (!categoryPolicy) {
      validation.isValid = false;
      validation.errors.push(`Invalid expense category: ${category}`);
      return validation;
    }

    // Amount validation
    if (amount > categoryPolicy.maxAmount) {
      validation.isValid = false;
      validation.errors.push(`Amount exceeds category limit of ${categoryPolicy.maxAmount}`);
    }

    // Subcategory validation
    if (subcategory && !categoryPolicy.allowedSubcategories.includes(subcategory)) {
      validation.isValid = false;
      validation.errors.push(`Invalid subcategory: ${subcategory}`);
    }

    // Receipt validation
    if (categoryPolicy.requiresReceipt && receipts.length === 0) {
      validation.isValid = false;
      validation.errors.push('Receipt is required for this category');
    }

    // Date validation
    const expenseDateObj = new Date(expenseDate);
    const daysSinceExpense = Math.floor((new Date() - expenseDateObj) / (1000 * 60 * 60 * 24));
    
    if (daysSinceExpense > policy.validation.maxClaimAge) {
      validation.isValid = false;
      validation.errors.push(`Expense is too old. Maximum age: ${policy.validation.maxClaimAge} days`);
    }

    // Daily/Monthly limits
    if (categoryPolicy.dailyLimit) {
      const dailyTotal = await this.getDailyExpenseTotal(employeeId, category, expenseDate);
      if (dailyTotal + amount > categoryPolicy.dailyLimit) {
        validation.isValid = false;
        validation.errors.push(`Daily limit exceeded for ${category}. Limit: ${categoryPolicy.dailyLimit}`);
      }
    }

    if (categoryPolicy.monthlyLimit) {
      const monthlyTotal = await this.getMonthlyExpenseTotal(employeeId, category, expenseDate);
      if (monthlyTotal + amount > categoryPolicy.monthlyLimit) {
        validation.isValid = false;
        validation.errors.push(`Monthly limit exceeded for ${category}. Limit: ${categoryPolicy.monthlyLimit}`);
      }
    }

    // Auto-approval check
    if (validation.isValid && 
        !categoryPolicy.requiresApproval && 
        amount <= categoryPolicy.autoApprovalLimit) {
      validation.autoApprove = true;
    }

    return validation;
  }

  /**
   * Process receipts with OCR simulation
   */
  async processReceipts(receipts, category) {
    const processedReceipts = [];

    for (const receipt of receipts) {
      const processedReceipt = {
        ...receipt,
        processedAt: new Date(),
        ocrData: null
      };

      // Simulate OCR processing
      if (receipt.fileType && receipt.fileType.startsWith('image/')) {
        try {
          const ocrData = await this.simulateOCRProcessing(receipt, category);
          processedReceipt.ocrData = ocrData;
          processedReceipt.ocrProcessed = true;
        } catch (ocrError) {
          logger.warn('OCR processing failed', {
            receiptId: receipt.id,
            error: ocrError.message
          });
          processedReceipt.ocrError = ocrError.message;
        }
      }

      processedReceipts.push(processedReceipt);
    }

    return processedReceipts;
  }

  /**
   * Simulate OCR processing (placeholder for real OCR integration)
   */
  async simulateOCRProcessing(receipt, category) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate OCR results based on category
    const ocrTemplates = {
      travel: {
        vendor: 'Sample Airlines',
        amount: Math.floor(Math.random() * 10000) + 1000,
        date: new Date().toISOString().split('T')[0],
        items: ['Flight Ticket', 'Taxes', 'Fuel Surcharge'],
        confidence: 0.95
      },
      meals: {
        vendor: 'Sample Restaurant',
        amount: Math.floor(Math.random() * 2000) + 200,
        date: new Date().toISOString().split('T')[0],
        items: ['Food Items', 'Beverages', 'Service Charge'],
        confidence: 0.88
      },
      accommodation: {
        vendor: 'Sample Hotel',
        amount: Math.floor(Math.random() * 8000) + 2000,
        date: new Date().toISOString().split('T')[0],
        items: ['Room Charges', 'Taxes', 'Service Charge'],
        confidence: 0.92
      }
    };

    return ocrTemplates[category] || {
      vendor: 'Unknown Vendor',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      items: [],
      confidence: 0.5
    };
  }

  /**
   * Check for duplicate expenses
   */
  async checkForDuplicates(expenseData, orgId) {
    const { employeeId, amount, expenseDate, category } = expenseData;
    
    // Create a signature for duplicate detection
    const signature = `${employeeId}_${amount}_${expenseDate}_${category}`;
    
    // Check cache first
    if (this.duplicateDetectionCache.has(signature)) {
      return {
        isDuplicate: true,
        message: 'Identical expense found in recent submissions'
      };
    }

    // Check database for similar expenses
    const similarExpenses = await Expense.find({
      employeeId,
      amount,
      category,
      expenseDate: {
        $gte: new Date(new Date(expenseDate).getTime() - 24 * 60 * 60 * 1000), // 1 day before
        $lte: new Date(new Date(expenseDate).getTime() + 24 * 60 * 60 * 1000)  // 1 day after
      },
      status: { $ne: 'rejected' }
    }).lean();

    if (similarExpenses.length > 0) {
      // Add to cache for future checks
      this.duplicateDetectionCache.set(signature, true);
      
      // Clean cache periodically
      if (this.duplicateDetectionCache.size > 1000) {
        this.duplicateDetectionCache.clear();
      }

      return {
        isDuplicate: true,
        message: `Similar expense found: ${similarExpenses[0]._id}`,
        similarExpenses
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Approve expense
   */
  async approveExpense(expenseId, approverId, comments = '') {
    try {
      const expense = await Expense.findById(expenseId)
        .populate('employeeId')
        .populate('userId');

      if (!expense) {
        throw new Error('Expense not found');
      }

      if (expense.status !== 'pending') {
        throw new Error(`Expense is already ${expense.status}`);
      }

      // Update expense
      expense.status = 'approved';
      expense.approvedBy = approverId;
      expense.approvedAt = new Date();
      expense.approverComments = comments;
      await expense.save();

      // Send notifications
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'expense_approved',
          title: 'Expense Approved',
          message: `Your ${expense.category} expense of ${expense.amount} has been approved`,
          recipients: [expense.userId._id],
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: { expense, comments },
          orgId: expense.orgId,
          createdBy: approverId
        });
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('expense.approved', {
          expense,
          employee: expense.employeeId,
          approvedBy: approverId,
          comments,
          orgId: expense.orgId
        });
      }

      logger.info('Expense approved', {
        expenseId,
        approverId,
        amount: expense.amount
      });

      return { success: true, expense };

    } catch (error) {
      logger.error('Failed to approve expense', {
        error: error.message,
        expenseId,
        approverId
      });
      throw error;
    }
  }

  /**
   * Reject expense
   */
  async rejectExpense(expenseId, rejectedBy, reason) {
    try {
      const expense = await Expense.findById(expenseId)
        .populate('employeeId')
        .populate('userId');

      if (!expense) {
        throw new Error('Expense not found');
      }

      if (expense.status !== 'pending') {
        throw new Error(`Expense is already ${expense.status}`);
      }

      // Update expense
      expense.status = 'rejected';
      expense.rejectedBy = rejectedBy;
      expense.rejectedAt = new Date();
      expense.rejectionReason = reason;
      await expense.save();

      // Send notifications
      if (this.notificationManager) {
        await this.notificationManager.sendNotification({
          type: 'expense_rejected',
          title: 'Expense Rejected',
          message: `Your ${expense.category} expense has been rejected`,
          recipients: [expense.userId._id],
          priority: 'normal',
          channels: ['in_app', 'email'],
          data: { expense, reason },
          orgId: expense.orgId,
          createdBy: rejectedBy
        });
      }

      // Emit business event
      if (this.eventSystem) {
        await this.eventSystem.emit('expense.rejected', {
          expense,
          employee: expense.employeeId,
          rejectedBy,
          reason,
          orgId: expense.orgId
        });
      }

      logger.info('Expense rejected', {
        expenseId,
        rejectedBy,
        reason
      });

      return { success: true, expense };

    } catch (error) {
      logger.error('Failed to reject expense', {
        error: error.message,
        expenseId,
        rejectedBy
      });
      throw error;
    }
  }

  /**
   * Process reimbursement
   */
  async processReimbursement(expenseIds, processedBy, paymentMethod = 'bank_transfer') {
    try {
      const expenses = await Expense.find({
        _id: { $in: expenseIds },
        status: 'approved'
      }).populate('employeeId').populate('userId');

      if (expenses.length === 0) {
        throw new Error('No approved expenses found');
      }

      const totalAmount = expenses.reduce((sum, expense) => sum + expense.reimbursementAmount, 0);
      const reimbursementBatch = {
        id: `REIMB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        expenses: expenseIds,
        totalAmount,
        paymentMethod,
        processedBy,
        processedAt: new Date(),
        status: 'processed'
      };

      // Update expenses
      await Expense.updateMany(
        { _id: { $in: expenseIds } },
        {
          status: 'reimbursed',
          reimbursedAt: new Date(),
          reimbursementBatch: reimbursementBatch.id
        }
      );

      // Send notifications to employees
      for (const expense of expenses) {
        if (this.notificationManager) {
          await this.notificationManager.sendNotification({
            type: 'expense_reimbursed',
            title: 'Expense Reimbursed',
            message: `Your expense reimbursement of ${expense.reimbursementAmount} has been processed`,
            recipients: [expense.userId._id],
            priority: 'normal',
            channels: ['in_app', 'email'],
            data: { expense, reimbursementBatch },
            orgId: expense.orgId,
            createdBy: processedBy
          });
        }
      }

      logger.info('Reimbursement processed', {
        batchId: reimbursementBatch.id,
        expenseCount: expenses.length,
        totalAmount
      });

      return {
        success: true,
        reimbursementBatch,
        processedExpenses: expenses.length,
        totalAmount
      };

    } catch (error) {
      logger.error('Failed to process reimbursement', {
        error: error.message,
        expenseIds
      });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async getDailyExpenseTotal(employeeId, category, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await Expense.aggregate([
      {
        $match: {
          employeeId,
          category,
          expenseDate: { $gte: startOfDay, $lte: endOfDay },
          status: { $ne: 'rejected' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  async getMonthlyExpenseTotal(employeeId, category, date) {
    const startOfMonth = new Date(date);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const result = await Expense.aggregate([
      {
        $match: {
          employeeId,
          category,
          expenseDate: { $gte: startOfMonth, $lte: endOfMonth },
          status: { $ne: 'rejected' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  async sendExpenseSubmissionNotifications(expense, employee, autoApproved, orgId) {
    if (autoApproved) {
      // Notify employee of auto-approval
      await this.notificationManager.sendNotification({
        type: 'expense_auto_approved',
        title: 'Expense Auto-Approved',
        message: `Your ${expense.category} expense has been automatically approved`,
        recipients: [employee.userId._id],
        priority: 'normal',
        channels: ['in_app', 'email'],
        data: { expense },
        orgId
      });
    } else {
      // Notify managers for approval
      await this.notificationManager.sendNotification({
        type: 'expense_approval_required',
        title: 'Expense Approval Required',
        message: `${employee.userId.name} has submitted an expense for approval`,
        recipients: 'managers',
        priority: 'normal',
        channels: ['in_app'],
        data: { expense, employee },
        actionUrl: `/expenses/approve/${expense._id}`,
        orgId
      });
    }
  }

  /**
   * Get expense analytics
   */
  async getExpenseAnalytics(orgId, timeframe = 30) {
    try {
      const since = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const analytics = await Expense.aggregate([
        {
          $match: {
            orgId,
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalReimbursement: { $sum: '$reimbursementAmount' },
            approvedExpenses: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            rejectedExpenses: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
            pendingExpenses: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
            avgAmount: { $avg: '$amount' }
          }
        }
      ]);

      const categoryStats = await Expense.aggregate([
        {
          $match: {
            orgId,
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' }
          }
        },
        {
          $sort: { totalAmount: -1 }
        }
      ]);

      return {
        timeframe: `${timeframe} days`,
        summary: analytics[0] || {},
        categoryStats,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get expense analytics', {
        error: error.message,
        orgId
      });
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    return {
      organizationPolicies: this.organizationPolicies.size,
      ocrQueueSize: this.ocrProcessingQueue.length,
      duplicateCacheSize: this.duplicateDetectionCache.size,
      defaultCategories: Object.keys(this.defaultPolicies.expenseCategories).length,
      timestamp: new Date()
    };
  }
}

export default IntelligentExpenseSystem;