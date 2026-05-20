/** Shared leave balance helpers for leave request routes. */

export const LEAVE_TYPE_FIELD_MAP = {
  Vacation: 'vacation',
  'Sick Leave': 'sickLeave',
  'Casual Leave': 'casualLeave',
  'Earned Leave': 'earnedLeave',
  'Medical Leave': 'medicalLeave',
  'Maternity Leave': 'maternityLeave',
  'Paternity Leave': 'paternityLeave',
  'Compensatory Off': 'compensatoryOff',
  Personal: 'personal',
  Emergency: 'emergency',
  NCNS: 'ncns',
  'Sandwich Leave': 'sandwichLeave',
};

export const LEAVE_BALANCE_KEYS = Object.values(LEAVE_TYPE_FIELD_MAP);

export function getLeaveFieldName(leaveType) {
  return LEAVE_TYPE_FIELD_MAP[leaveType] || null;
}

export function allocationHasBalance(alloc) {
  if (!alloc) return false;
  const keys = LEAVE_BALANCE_KEYS;
  for (const field of keys) {
    const allocated = alloc.allocations?.[field] || 0;
    const carried = alloc.carriedForward?.[field] || 0;
    const used = alloc.used?.[field] || 0;
    const pending = alloc.pending?.[field] || 0;
    if (allocated + carried > 0 || used > 0 || pending > 0) {
      return true;
    }
  }
  return false;
}

export function computeLeaveRemaining(allocation, leaveType) {
  const field = getLeaveFieldName(leaveType);
  if (!field || !allocation) return 0;
  const allocated = allocation.allocations?.[field] || 0;
  const carried = allocation.carriedForward?.[field] || 0;
  const used = allocation.used?.[field] || 0;
  const pending = allocation.pending?.[field] || 0;
  const total = allocated + carried;
  return Math.max(0, total - used - pending);
}

export function getAllocatedTotal(allocation, leaveType) {
  const field = getLeaveFieldName(leaveType);
  if (!field || !allocation) return 0;
  const allocated = allocation.allocations?.[field] || 0;
  const carried = allocation.carriedForward?.[field] || 0;
  return allocated + carried;
}

/**
 * Resolve the LeaveAllocation document that holds the employee's active balance.
 * Tries exact year/month first, then the latest prior month in the same year with balance.
 */
export async function resolveLeaveAllocation(
  LeaveAllocation,
  employeeId,
  year,
  month
) {
  const y = parseInt(String(year), 10);
  const m = parseInt(String(month), 10);
  if (!employeeId || !Number.isFinite(y) || !Number.isFinite(m)) {
    return { allocation: null, resolvedYear: y, resolvedMonth: m };
  }

  const exact = await LeaveAllocation.findOne({ employeeId, year: y, month: m }).lean();
  if (exact && allocationHasBalance(exact)) {
    return { allocation: exact, resolvedYear: y, resolvedMonth: m };
  }

  const priorInYear = await LeaveAllocation.find({
    employeeId,
    year: y,
    month: { $lte: m },
  })
    .sort({ month: -1 })
    .lean();

  for (const doc of priorInYear) {
    if (allocationHasBalance(doc)) {
      return { allocation: doc, resolvedYear: y, resolvedMonth: doc.month };
    }
  }

  const anyInYear = await LeaveAllocation.find({ employeeId, year: y })
    .sort({ month: -1 })
    .lean();

  for (const doc of anyInYear) {
    if (allocationHasBalance(doc)) {
      return { allocation: doc, resolvedYear: y, resolvedMonth: doc.month };
    }
  }

  return {
    allocation: exact || null,
    resolvedYear: y,
    resolvedMonth: m,
  };
}

export async function findCurrentLeaveAllocation(
  LeaveAllocation,
  employeeId,
  orgId,
  when = new Date()
) {
  const year = when.getFullYear();
  const month = when.getMonth() + 1;
  const query = { employeeId, year, month };
  if (orgId) query.orgId = String(orgId);
  const { allocation } = await resolveLeaveAllocation(
    LeaveAllocation,
    employeeId,
    year,
    month
  );
  return allocation;
}
