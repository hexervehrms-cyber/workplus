import { EmployeeService } from './api';

export function isLikelyMongoObjectId(id: string | null | undefined): boolean {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

/** Resolve Employee document _id for API calls (not employeeCode or user id). */
export async function resolveEmployeeMongoId(user: {
  id?: string;
  userId?: string;
  employeeId?: string;
} | null | undefined): Promise<string | null> {
  if (!user) return null;

  const fromUser = user.employeeId ? String(user.employeeId) : '';
  if (isLikelyMongoObjectId(fromUser)) return fromUser;

  const userId = user.id || user.userId;
  if (!userId) return null;

  try {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    const employeeResponse = await apiGet<{
      success?: boolean;
      data?: { _id?: string; id?: string };
    }>(`/employees/user/${userId}`, false);
    const payload = employeeResponse as { _id?: string; data?: { _id?: string; id?: string } };
    const empId =
      payload?._id ||
      payload?.data?._id ||
      payload?.data?.id;
    if (empId && isLikelyMongoObjectId(String(empId))) {
      return String(empId);
    }
  } catch {
    // caller handles null
  }
  return null;
}
