import { LeaveRequestService } from './api';
import { clearApiCache, resolveOrgIdForApi } from './apiHelper';
import { resolveEmployeeMongoId } from './resolveEmployeeId';

export type LeaveSubmitForm = {
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  leaveDuration?: 'full' | 'first_half' | 'second_half' | 'hourly';
  isHourlyLeave?: boolean;
  startTime?: string;
  endTime?: string;
};

export function formatLocalDateString(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

export function isLeaveApiSuccess(response: unknown): boolean {
  if (response == null || typeof response !== 'object') return false;
  return (response as { success?: boolean }).success !== false;
}

/** Shared employee leave submission for dashboard calendar and Leave page. */
export async function buildAndSubmitLeaveRequest(
  user: {
    orgId?: string;
    tenantId?: string;
    userId?: string;
    id?: string;
    employeeId?: string;
    role?: string;
  } | null | undefined,
  form: LeaveSubmitForm
): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  const authUserId = String(user?.userId || user?.id || '');
  if (!authUserId || !form.type || !form.startDate || !form.endDate || !form.reason) {
    return { ok: false, error: 'Please fill in all required fields' };
  }

  const leaveDuration = form.leaveDuration ?? (form.isHourlyLeave ? 'hourly' : 'full');
  const isHourly = leaveDuration === 'hourly' || !!form.isHourlyLeave;
  const isHalf = leaveDuration === 'first_half' || leaveDuration === 'second_half';

  if (isHourly && (!form.startTime || !form.endTime)) {
    return { ok: false, error: 'Please select start and end time for hourly leave' };
  }

  const employeeId = await resolveEmployeeMongoId(user);
  if (!employeeId) {
    return { ok: false, error: 'Employee profile not found. Please contact HR.' };
  }

  const orgId = await resolveOrgIdForApi(user);
  if (!orgId) {
    return {
      ok: false,
      error:
        'Organization not set on your account. Please sign out and sign in again, or contact HR.',
    };
  }

  const startDate = new Date(form.startDate);
  const endDate =
    isHalf || isHourly ? new Date(form.startDate) : new Date(form.endDate || form.startDate);

  const leaveData: Record<string, unknown> = {
    userId: authUserId,
    employeeId,
    leaveType: form.type,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    reason: form.reason,
    orgId,
    leaveDuration,
    isHalfDay: isHalf,
    halfDaySession:
      leaveDuration === 'first_half'
        ? 'first_half'
        : leaveDuration === 'second_half'
          ? 'second_half'
          : 'none',
    isHourlyLeave: isHourly,
    isShortLeave: isHourly,
  };

  if (isHourly) {
    leaveData.startTime = form.startTime;
    leaveData.endTime = form.endTime;
  }

  try {
    const response = await LeaveRequestService.createLeaveRequest(leaveData);
    if (!isLeaveApiSuccess(response)) {
      const msg =
        (response as { message?: string })?.message || 'Failed to submit leave request';
      return { ok: false, error: msg, response };
    }
    clearApiCache();
    return { ok: true, response };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to submit leave request';
    return { ok: false, error: msg };
  }
}
