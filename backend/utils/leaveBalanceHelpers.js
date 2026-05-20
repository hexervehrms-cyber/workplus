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

export function getLeaveFieldName(leaveType) {
  return LEAVE_TYPE_FIELD_MAP[leaveType] || null;
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

export async function findCurrentLeaveAllocation(LeaveAllocation, employeeId, orgId, when = new Date()) {
  const year = when.getFullYear();
  const month = when.getMonth() + 1;
  return LeaveAllocation.findOne({ employeeId, orgId, year, month }).lean();
}
