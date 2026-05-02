/**
 * Intelligent Expense Management Engine
 * Handles expense validation, policy enforcement, and automation
 */

import Expense from "../models/Expense.js";
import Employee from "../models/Employee.js";
import logger from "./logger.js";

class ExpensePolicyEngine {
  constructor(notificationManager, eventSystem) {
    this.notificationManager = notificationManager;
    this.eventSystem = eventSystem;
    
    this.expenseCategories = {
      TRAVEL: 'travel',
      MEALS: 'meals',
      ACCOMMODATION: 'accommodation',
      ENTERTAINMENT: 'entertainment',
      OFFICE_SUPPLIES: 'office_supplies',
      TELEPHONE: 'telephone',
      INTERNET: 'internet',
      MAINTENANCE: 'maintenance',
      TRAINING: 'training',
      MISC: 'miscellaneous'
    };

    this.defaultPolicies = {
      travel: {
        dailyLimit: 2000,
        requiresReceipt: true,
        approvalThreshold: 5000,
        documentation: ['boarding_pass', 'ticket', 'itinerary']
      },
      meals: {
        dailyLimit: 500,
        perPersonLimit: 250,
        requiresReceipt: true,
        approvalThreshold: 2000,
        documentation: ['receipt']
      },
      accommodation: {
        dailyLimit: 3000,
        requiresReceipt: true,
        approvalThreshold: 10000,
        documentation: ['invoice', 'booking_confirmation']
      },
      entertainment: {
        dailyLimit: 3000,
        perPersonLimit: 1000,
        requiresReceipt: true,
        approvalThreshold: 5000,
        documentation: ['receipt', 'guest_list']
      },
      office_supplies: {
        monthlyLimit: 5000,
        requiresReceipt: true,
        approvalThreshold: 10000,
        documentation: ['receipt', 'invoice']
      },
      telephone: {
        monthlyLimit: 1500,
        requiresReceipt: true,
        approvalThreshold: 3000,
        documentation: ['bill']
      },
      internet: {
        monthlyLimit: 2000,
        requiresReceipt: true,
        approvalThreshold: 5000,
        documentation: ['bill']
      },
      maintenance: {
        singleTransactionLimit: 10000,
        requiresReceipt: true,
        approvalThreshold: 25000,
        documentation: ['receipt', 'work_order']
      },
      training: {
        singleTransactionLimit: 25000,
        requiresReceipt: true,
        approvalThreshold: 50000,
        documentation: ['receipt', 'certificate']
      },
      miscellaneous: {
        monthlyLimit: 3000,
        requiresReceipt: true,
        approvalThreshold: 5000,
        documentation: ['receipt']
      }
    };

    this.approvalWorkflow = {
      threshold: {
        low: 1000,
        medium: 5000,
        high: 25000
      },
      approvers: {
        low: 'manager',
        medium: 'manager',
        high: 'admin'
      }
    };
  }

  /**
   * Validate expense against policy
   */
  async validateExpense(expenseData) {
    try {
      const {
        employeeId,
        category,
        amount,
        date,
        description,
        orgId
      } = expenseData;

      const employee = await Employee.findById(employeeId).lean();
      if (!employee) {
        throw new Error('Employee not found');
      }

      const policy = this.defaultPolicies[category];
      if (!policy) {
        return {
          valid: false,
          errors: ['Invalid expense category']
        };
      }

      const errors = [];
      const warnings = [];

      // Check amount against limits
      if (amount > policy.approvalThreshold) {
        errors.push(`Amount exceeds approval threshold of ₹${policy.approvalThreshold}`);
      }

      // Check daily limits
      if (policy.dailyLimit) {
        const todayExpenses = await this.getTodayExpenses(employeeId, category, date);
        if (todayExpenses + amount > policy.dailyLimit) {
          errors.push(`Daily limit of ₹${policy.dailyLimit} exceeded for ${category}`);
        }
      }

      // Check monthly limits
      if (policy.monthlyLimit) {
        const monthlyExpenses = await this.getMonthlyExpenses(employeeId, category, date);
        if (monthlyExpenses + amount > policy.monthlyLimit) {
          errors.push(`Monthly limit of ₹${policy.monthlyLimit} exceeded for ${category}`);
        }
      }

      // Check per person limits (for entertainment, meals)
      if (policy.perPersonLimit) {
        const personCount = Math.ceil(amount / policy.perPersonLimit);
        if (personCount > 1) {
          warnings.push(`Expense may require justification for multiple persons`);
        }
      }

      // Check documentation requirements
      if (policy.requiresReceipt && !expenseData.receiptUrl) {
        warnings.push('Receipt is required for this expense category');
      }

      // Check for duplicate expenses
      const duplicate = await Expense.findOne({
        employeeId,
        category,
        amount,
        date,
        status: 'pending'
      });

      if (duplicate) {
        errors.push('Duplicate expense already exists');
      }

      // Calculate approval workflow
      const approvalWorkflow = this.determineApprovalWorkflow(amount, category);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        amount,
        category,
        policy,
        approvalWorkflow
      };

    } catch (error) {
      logger.error('Failed to validate expense', {
        error: error.message,
        expenseData
      });
      throw error;
    }
  }

  /**
   * Determine approval workflow based on amount and category
   */
  determineApprovalWorkflow(amount, category) {
    const thresholds = this.approvalWorkflow.threshold;
    
    if (amount >= thresholds.high) {
      return {
        level: 'high',
        approverRole: this.approvalWorkflow.approvers.high,
        estimatedTime: '2-3 business days',
        requiresDocumentation: true
      };
    } else if (amount >= thresholds.medium) {
      return {
        level: 'medium',
        approverRole: this.approvalWorkflow.approvers.medium,
        estimatedTime: '1-2 business days',
        requiresDocumentation: true
      };
    } else {
      return {
        level: 'low',
        approverRole: this.approvalWorkflow.approvers.low,
        estimatedTime: 'same day',
        requiresDocumentation: false
      };
    }
  }

  /**
   * Get today's expenses for employee
   */
  async getTodayExpenses(employeeId, category, date) {
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    const result = await Expense.aggregate([
      {
        $match: {
          employeeId,
          category,
          date: { $gte: today },
          status: { $in: ['pending', 'approved'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Get monthly expenses for employee
   */
  async getMonthlyExpenses(employeeId, category, date) {
    const monthStart = new Date(date);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const result = await Expense.aggregate([
      {
        $match: {
          employeeId,
          category,
          date: { $gte: monthStart, $lt: monthEnd },
          status: { $in: ['pending', 'approved'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Calculate expense analytics
   */
  async getExpenseAnalytics(employeeId, period = 'month') {
    try {
      const now = new Date();
      const startDate = new Date();
      
      if (period === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === 'quarter') {
        startDate.setMonth(now.getMonth() - 3);
      } else if (period === 'year') {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      const analytics = await Expense.aggregate([
        {
          $match: {
            employeeId,
            date: { $gte: startDate },
            status: 'approved'
          }
        },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            avg: { $avg: "$amount" }
          }
        },
        { $sort: { total: -1 } }
      ]);

      // Calculate total
      const total = analytics.reduce((sum, item) => sum + item.total, 0);

      // Calculate category percentages
      const categoryBreakdown = analytics.map(item => ({
        category: item._id,
        total: item.total,
        count: item.count,
        avg: item.avg,
        percentage: total > 0 ? Math.round((item.total / total) * 100) : 0
      }));

      return {
        employeeId,
        period,
        total,
        categoryBreakdown,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get expense analytics', {
        error: error.message,
        employeeId
      });
      throw error;
    }
  }

  /**
   * Get expense summary for employee
   */
  async getExpenseSummary(employeeId, month, year) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const summary = await Expense.aggregate([
        {
          $match: {
            employeeId,
            date: { $gte: startDate, $lte: endDate },
            status: 'approved'
          }
        },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        }
      ]);

      const total = summary.reduce((sum, item) => sum + item.total, 0);

      return {
        employeeId,
        month,
        year,
        total,
        byCategory: summary,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get expense summary', {
        error: error.message,
        employeeId,
        month,
        year
      });
      throw error;
    }
  }

  /**
   * Get expense categories
   */
  getExpenseCategories() {
    return this.expenseCategories;
  }

  /**
   * Get policies
   */
  getPolicies() {
    return this.defaultPolicies;
  }

  /**
   * Get approval workflow
   */
  getApprovalWorkflow() {
    return this.approvalWorkflow;
  }
}

export default ExpensePolicyEngine;