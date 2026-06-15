import { apiGet } from './apiHelper';

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
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    const employeeResponse = await apiGet<{
      success?: boolean;
      data?: { _id?: string; id?: string };
      _id?: string;
    }>(`/employees/user/${userId}`, false);
    
    // Safely narrow the union type
    let empId: string | undefined;
    if (employeeResponse && typeof employeeResponse === 'object') {
      // Check if response has data property (nested structure)
      if ('data' in employeeResponse && employeeResponse.data) {
        const data = employeeResponse.data as { _id?: string; id?: string };
        empId = data._id || data.id;
      } else {
        // Direct structure
        const direct = employeeResponse as { _id?: string; id?: string };
        empId = direct._id || direct.id;
      }
    }
    
    if (empId && isLikelyMongoObjectId(String(empId))) {
      return String(empId);
    }
  } catch {
    // caller handles null
  }
  return null;
}
