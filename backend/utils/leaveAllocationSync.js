/**
 * Keep LeaveAllocation.used / .pending in sync with leave requests.
 */
import {
  findCurrentLeaveAllocation,
  getLeaveFieldName,
} from './leaveBalanceHelpers.js';

export function computeLeaveDaysFromRequest(leaveRequest) {
  if (!leaveRequest) return 0;
  if (leaveRequest.isHourlyLeave && leaveRequest.startTime && leaveRequest.endTime) {
    const [sh, sm] = String(leaveRequest.startTime).split(':').map(Number);
    const [eh, em] = String(leaveRequest.endTime).split(':').map(Number);
    const totalMinutes = eh * 60 + em - (sh * 60 + sm);
    if (Number.isFinite(totalMinutes) && totalMinutes > 0) {
      return totalMinutes / 60 / 8;
    }
  }
  if (leaveRequest.isHalfDay) return 0.5;
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

async function loadAllocationForUpdate(LeaveAllocation, employeeId, orgId, when = new Date()) {
  const lean = await findCurrentLeaveAllocation(LeaveAllocation, employeeId, orgId, when);
  if (!lean?._id) return null;
  return LeaveAllocation.findById(lean._id);
}

/**
 * Add or remove pending days on the employee's active allocation month.
 * @param {'add'|'remove'} action
 */
export async function syncLeaveAllocationPending(
  LeaveAllocation,
  { employeeId, orgId, leaveType, days, when = new Date(), action = 'add' }
) {
  const field = getLeaveFieldName(leaveType);
  const amount = Number(days);
  if (!field || !amount || amount <= 0) {
    return { ok: false, reason: 'invalid' };
  }

  const doc = await loadAllocationForUpdate(LeaveAllocation, employeeId, orgId, when);
  if (!doc) return { ok: false, reason: 'no_allocation' };

  const current = doc.pending?.[field] || 0;
  const delta = action === 'remove' ? -amount : amount;
  doc.pending[field] = Math.max(0, current + delta);
  await doc.save();
  return { ok: true, allocation: doc };
}

/** On approve: pending → used */
export async function syncLeaveAllocationOnApprove(LeaveAllocation, leaveRequest) {
  const field = getLeaveFieldName(leaveRequest?.type);
  const days = computeLeaveDaysFromRequest(leaveRequest);
  if (!field || !days || days <= 0) return { ok: false, reason: 'invalid' };

  const when = leaveRequest.startDate ? new Date(leaveRequest.startDate) : new Date();
  const doc = await loadAllocationForUpdate(
    LeaveAllocation,
    leaveRequest.employeeId,
    leaveRequest.orgId,
    when
  );
  if (!doc) return { ok: false, reason: 'no_allocation' };

  const pending = doc.pending?.[field] || 0;
  const used = doc.used?.[field] || 0;
  const fromPending = Math.min(pending, days);
  doc.pending[field] = Math.max(0, pending - fromPending);
  const remainder = days - fromPending;
  doc.used[field] = used + fromPending + remainder;
  await doc.save();
  return { ok: true, allocation: doc };
}

/** On reject/delete: release pending only */
export async function syncLeaveAllocationReleasePending(LeaveAllocation, leaveRequest) {
  return syncLeaveAllocationPending(LeaveAllocation, {
    employeeId: leaveRequest.employeeId,
    orgId: leaveRequest.orgId,
    leaveType: leaveRequest.type,
    days: computeLeaveDaysFromRequest(leaveRequest),
    when: leaveRequest.startDate ? new Date(leaveRequest.startDate) : new Date(),
    action: 'remove',
  });
}
