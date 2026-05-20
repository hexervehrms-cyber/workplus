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
 */
export async function getFinancialTotals(orgId, rangeStart, rangeEnd) {
  const orgFilter = buildOrgIdFilter(orgId);

  const [expenseAgg, payslipAgg, salarySlipAgg] = await Promise.all([
    Expense.aggregate([
      {
        $match: {
          ...orgFilter,
          date: { $gte: rangeStart, $lt: rangeEnd },
          status: { $in: ['approved', 'paid'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payslip.aggregate([
      {
        $match: {
          ...orgFilter,
          createdAt: { $gte: rangeStart, $lt: rangeEnd },
          status: { $in: ['draft', 'pending', 'paid'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$netPay' } } },
    ]),
    SalarySlip.aggregate([
      {
        $match: {
          ...orgFilter,
          updatedAt: { $gte: rangeStart, $lt: rangeEnd },
          status: { $in: ['draft', 'pending_approval', 'approved', 'processed', 'paid'] },
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
