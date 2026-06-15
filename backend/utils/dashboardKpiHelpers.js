/**
 * Shared KPI calculation helpers for admin dashboard (REST + real-time).
 */

import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import Payslip from '../models/Payroll.js';
import SalarySlip from '../models/SalarySlip.js';

/** Match orgId stored as string or ObjectId across collections. */
export function buildOrgIdFilter(orgId) {
  const s = String(orgId || '');
  if (!s || s === 'system') {
    return { orgId: '__invalid_tenant__' };
  }
  const clauses = [{ orgId: s }];
  if (mongoose.Types.ObjectId.isValid(s)) {
    clauses.push({ orgId: new mongoose.Types.ObjectId(s) });
  }
  return { $or: clauses };
}

/**
 * Count employees in org: active Employee records, with User fallback.
 */
export async function countOrgEmployees(orgId) {
  const orgFilter = buildOrgIdFilter(orgId);
  const employeeCount = await Employee.countDocuments({
    ...orgFilter,
    status: { $in: ['active', 'inactive'] },
  });

  if (employeeCount > 0) {
    return employeeCount;
  }

  return User.countDocuments({
    ...orgFilter,
    role: 'employee',
    isActive: true,
    deletedAt: null,
  });
}

/**
 * Sum approved/paid expenses and payroll net pay for a date range.
 * KPI Rules:
 * - Expenses: Only "approved" status (not pending/rejected)
 * - Payroll: Only "paid" or "pending" status (not draft)
 * - Date: Use actual payslip month/year for Payslip model
 */
export async function getFinancialTotals(orgId, rangeStart, rangeEnd) {
  const orgFilter = buildOrgIdFilter(orgId);

  // Extract month/year boundaries for payslip queries
  const startMonth = rangeStart.getMonth() + 1; // 1-12
  const startYear = rangeStart.getFullYear();
  const endMonth = rangeEnd.getMonth() + 1; // 1-12
  const endYear = rangeEnd.getFullYear();

  const [expenseAgg, payslipAgg, salarySlipAgg] = await Promise.all([
    // Expenses: Only approved (not pending, not rejected)
    Expense.aggregate([
      {
        $match: {
          ...orgFilter,
          date: { $gte: rangeStart, $lt: rangeEnd },
          status: 'approved', // Only approved expenses
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // Payslips: Only pending/paid (not draft), matching month/year range
    // month is a String (e.g., "June" or "06"), year is Number
    Payslip.aggregate([
      {
        $match: {
          ...orgFilter,
          year: { $gte: startYear, $lte: endYear },
          status: { $in: ['pending', 'paid'] }, // Not draft
        },
      },
      { $group: { _id: null, total: { $sum: '$netPay' } } },
    ]),
    // SalarySlips: Only approved/paid (not draft/pending_approval), using updatedAt date
    SalarySlip.aggregate([
      {
        $match: {
          ...orgFilter,
          updatedAt: { $gte: rangeStart, $lt: rangeEnd },
          status: { $in: ['approved', 'processed', 'paid'] }, // Only finalized slips
        },
      },
      { $group: { _id: null, total: { $sum: '$netSalary' } } },
    ]),
  ]);

  const thisMonthExpenses = expenseAgg[0]?.total || 0;
  const thisMonthPayroll =
    (payslipAgg[0]?.total || 0) + (salarySlipAgg[0]?.total || 0);

  return {
    thisMonthExpenses,
    thisMonthPayroll,
    totalCost: thisMonthExpenses + thisMonthPayroll,
  };
}
