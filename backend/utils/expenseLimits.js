/**
 * Organization expense limit settings — defaults, merge, and validation.
 */

import Expense from '../models/Expense.js';
import Organization from '../models/Organization.js';

export const DEFAULT_EXPENSE_LIMITS = {
  enabled: true,
  defaultDailyLimit: 5000,
  defaultMonthlyLimit: 50000,
  maxSingleClaim: 25000,
  maxClaimAgeDays: 90,
  requireReceiptAbove: 500,
  categoryLimits: {},
};

export function mergeExpenseLimits(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const categoryLimits =
    src.categoryLimits && typeof src.categoryLimits === 'object' ? src.categoryLimits : {};

  return {
    enabled: src.enabled !== false,
    defaultDailyLimit: Number(src.defaultDailyLimit) || DEFAULT_EXPENSE_LIMITS.defaultDailyLimit,
    defaultMonthlyLimit: Number(src.defaultMonthlyLimit) || DEFAULT_EXPENSE_LIMITS.defaultMonthlyLimit,
    maxSingleClaim: Number(src.maxSingleClaim) || DEFAULT_EXPENSE_LIMITS.maxSingleClaim,
    maxClaimAgeDays: Number(src.maxClaimAgeDays) || DEFAULT_EXPENSE_LIMITS.maxClaimAgeDays,
    requireReceiptAbove:
      src.requireReceiptAbove !== undefined && src.requireReceiptAbove !== null
        ? Number(src.requireReceiptAbove)
        : DEFAULT_EXPENSE_LIMITS.requireReceiptAbove,
    categoryLimits,
  };
}

export async function getOrgExpenseLimits(orgId) {
  if (!orgId) return mergeExpenseLimits(null);
  const org = await Organization.findById(orgId).select('settings.expenseLimits').lean();
  return mergeExpenseLimits(org?.settings?.expenseLimits);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

async function sumExpenses({ employeeId, orgId, from, to, category }) {
  const match = {
    employeeId,
    orgId: String(orgId),
    status: { $in: ['pending', 'approved'] },
    date: { $gte: from, $lte: to },
  };
  if (category) match.category = category;

  const rows = await Expense.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return rows[0]?.total || 0;
}

function limitsForCategory(limits, category) {
  const cat = limits.categoryLimits?.[category];
  if (!cat || typeof cat !== 'object') {
    return {
      dailyLimit: limits.defaultDailyLimit,
      monthlyLimit: limits.defaultMonthlyLimit,
    };
  }
  return {
    dailyLimit:
      cat.dailyLimit !== undefined && cat.dailyLimit !== null
        ? Number(cat.dailyLimit)
        : limits.defaultDailyLimit,
    monthlyLimit:
      cat.monthlyLimit !== undefined && cat.monthlyLimit !== null
        ? Number(cat.monthlyLimit)
        : limits.defaultMonthlyLimit,
  };
}

/**
 * Validate a new expense claim against org limits.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export async function validateExpenseAgainstLimits({
  orgId,
  employeeId,
  category,
  amount,
  date,
  receipt,
  excludeExpenseId,
}) {
  const limits = await getOrgExpenseLimits(orgId);
  if (!limits.enabled) {
    return { valid: true, errors: [] };
  }

  const errors = [];
  const amt = Number(amount);
  const expenseDate = date ? new Date(date) : new Date();

  if (!Number.isFinite(amt) || amt <= 0) {
    errors.push('Invalid expense amount');
    return { valid: false, errors };
  }

  if (amt > limits.maxSingleClaim) {
    errors.push(`Amount exceeds maximum single claim limit of ₹${limits.maxSingleClaim.toLocaleString('en-IN')}`);
  }

  const ageMs = Date.now() - expenseDate.getTime();
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (ageDays > limits.maxClaimAgeDays) {
    errors.push(`Expense is older than ${limits.maxClaimAgeDays} days and cannot be submitted`);
  }

  if (limits.requireReceiptAbove > 0 && amt >= limits.requireReceiptAbove && !receipt) {
    errors.push(`Receipt is required for claims of ₹${limits.requireReceiptAbove.toLocaleString('en-IN')} or more`);
  }

  const { dailyLimit, monthlyLimit } = limitsForCategory(limits, category);

  const dayFrom = startOfDay(expenseDate);
  const dayTo = endOfDay(expenseDate);
  let todayTotal = await sumExpenses({
    employeeId,
    orgId,
    from: dayFrom,
    to: dayTo,
    category,
  });

  if (excludeExpenseId) {
    const existing = await Expense.findById(excludeExpenseId).select('amount date category').lean();
    if (
      existing &&
      existing.category === category &&
      new Date(existing.date) >= dayFrom &&
      new Date(existing.date) <= dayTo
    ) {
      todayTotal = Math.max(0, todayTotal - (existing.amount || 0));
    }
  }

  if (dailyLimit > 0 && todayTotal + amt > dailyLimit) {
    errors.push(
      `Daily limit of ₹${dailyLimit.toLocaleString('en-IN')} exceeded for ${category || 'this category'}`
    );
  }

  const monthFrom = startOfMonth(expenseDate);
  const monthTo = endOfMonth(expenseDate);
  let monthTotal = await sumExpenses({
    employeeId,
    orgId,
    from: monthFrom,
    to: monthTo,
    category,
  });

  if (excludeExpenseId) {
    const existing = await Expense.findById(excludeExpenseId).select('amount date category').lean();
    if (
      existing &&
      existing.category === category &&
      new Date(existing.date) >= monthFrom &&
      new Date(existing.date) <= monthTo
    ) {
      monthTotal = Math.max(0, monthTotal - (existing.amount || 0));
    }
  }

  if (monthlyLimit > 0 && monthTotal + amt > monthlyLimit) {
    errors.push(
      `Monthly limit of ₹${monthlyLimit.toLocaleString('en-IN')} exceeded for ${category || 'this category'}`
    );
  }

  return { valid: errors.length === 0, errors };
}
