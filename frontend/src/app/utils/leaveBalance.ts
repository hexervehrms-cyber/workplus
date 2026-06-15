/** Per leave-type balance from GET /api/leave-allocation/balance/:employeeId */
export interface LeaveTypeBalance {
  allocated: number;
  carried: number;
  used: number;
  pending: number;
  total: number;
  remaining: number;
}

export type LeaveBalanceMap = Record<string, LeaveTypeBalance>;

export function buildLeaveBalanceMap(raw: unknown): LeaveBalanceMap {
  if (!raw || typeof raw !== 'object') return {};

  const out: LeaveBalanceMap = {};
  const obj = raw as Record<string, unknown>;

  for (const [key, val] of Object.entries(obj)) {
    if (key === 'hasAllocation' || key === 'balances') continue;

    if (typeof val === 'number') {
      out[key] = {
        allocated: 0,
        carried: 0,
        used: 0,
        pending: 0,
        total: val,
        remaining: val,
      };
      continue;
    }

    if (val && typeof val === 'object') {
      const v = val as Record<string, number>;
      const allocated = Number(v.allocated) || 0;
      const carried = Number(v.carried) || 0;
      const used = Number(v.used) || 0;
      const pending = Number(v.pending) || 0;
      const total =
        typeof v.total === 'number' ? v.total : allocated + carried;
      const remaining =
        typeof v.remaining === 'number'
          ? v.remaining
          : Math.max(0, total - used - pending);
      out[key] = { allocated, carried, used, pending, total, remaining };
    }
  }

  return out;
}

export function parseBalanceApiResponse(response: {
  success?: boolean;
  data?: unknown;
  hasAllocation?: boolean;
}): { balances: LeaveBalanceMap; hasAllocation: boolean } {
  const payload = response?.data;
  let hasAllocation = response?.hasAllocation === true;

  if (payload && typeof payload === 'object' && 'balances' in (payload as object)) {
    const nested = payload as { balances?: unknown; hasAllocation?: boolean };
    hasAllocation = nested.hasAllocation === true;
    return {
      balances: buildLeaveBalanceMap(nested.balances),
      hasAllocation,
    };
  }

  const balances = buildLeaveBalanceMap(payload);
  if (!hasAllocation) {
    hasAllocation = Object.values(balances).some((b) => b.total > 0);
  }

  return { balances, hasAllocation };
}

export function sumRemainingDays(balances: LeaveBalanceMap): number {
  return Object.values(balances).reduce((sum, b) => sum + (b.remaining || 0), 0);
}

/** Sum allocated days across all leave types (matches admin allocation form total). */
export function sumAllocatedDays(balances: LeaveBalanceMap): number {
  return Object.values(balances).reduce((sum, b) => sum + (b.allocated || 0), 0);
}

export function getTypeBalance(
  balances: LeaveBalanceMap,
  key: string
): LeaveTypeBalance {
  return (
    balances[key] || {
      allocated: 0,
      carried: 0,
      used: 0,
      pending: 0,
      total: 0,
      remaining: 0,
    }
  );
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface LeaveBalanceKpiSummary {
  totalRemaining: number;
  totalAllocated: number;
  hasAllocation: boolean;
  balanceSourceMonth?: number;
}

/** Load leave balance KPI totals from admin allocation API. */
export async function fetchLeaveBalanceKpiSummary(
  employeeId: string,
  year?: number,
  month?: number
): Promise<LeaveBalanceKpiSummary> {
  const { LeaveAllocationService } = await import('./api');
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  const balanceRes = await LeaveAllocationService.getEmployeeBalance(employeeId, y, m);
  if (!balanceRes?.success) {
    return { totalRemaining: 0, totalAllocated: 0, hasAllocation: false };
  }

  const parsed = parseBalanceApiResponse(balanceRes);
  const body = balanceRes as {
    balanceSourceMonth?: number;
    resolvedMonth?: number;
  };
  const sourceMonth = body.balanceSourceMonth ?? body.resolvedMonth;

  return {
    totalRemaining: sumRemainingDays(parsed.balances),
    totalAllocated: sumAllocatedDays(parsed.balances),
    hasAllocation: parsed.hasAllocation,
    balanceSourceMonth:
      sourceMonth && sourceMonth !== m ? sourceMonth : undefined,
  };
}

export function formatLeaveBalanceKpi(summary: LeaveBalanceKpiSummary): {
  value: string;
  subtitle: string;
} {
  const { totalRemaining, totalAllocated, hasAllocation, balanceSourceMonth } =
    summary;

  if (!hasAllocation || (totalRemaining === 0 && totalAllocated === 0)) {
    return {
      value: '0 days',
      subtitle: 'No leave allocated yet — contact HR',
    };
  }

  const value = `${totalRemaining} day${totalRemaining === 1 ? '' : 's'}`;
  let subtitle = `${totalAllocated} day${totalAllocated === 1 ? '' : 's'} allocated`;
  if (balanceSourceMonth && balanceSourceMonth >= 1 && balanceSourceMonth <= 12) {
    subtitle += ` (${MONTH_NAMES[balanceSourceMonth - 1]} pool)`;
  }

  return { value, subtitle };
}
