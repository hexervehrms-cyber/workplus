/**
 * Shared employee access checks for self-service vs HR/admin routes.
 */
import Employee from '../models/Employee.js';
import { userOrgIdFromReq, isSuperAdmin } from './orgScopeHelpers.js';
import { findEmployeeForSelfService } from './employeeSelfService.js';

const PRIVILEGED_ROLES = ['super_admin', 'admin', 'hr', 'manager'];

export function isPrivilegedEmployeeAccess(role) {
  return PRIVILEGED_ROLES.includes(role);
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export async function assertEmployeeSelfOrPrivileged(req, employeeId) {
  const targetId = String(employeeId || '').trim();
  if (!targetId) {
    return { ok: false, status: 400, message: 'Employee id is required' };
  }

  const role = req.user?.role;
  if (isPrivilegedEmployeeAccess(role)) {
    if (isSuperAdmin(req)) {
      return { ok: true };
    }
    const emp = await Employee.findById(targetId).select('orgId').lean();
    if (!emp) {
      return { ok: false, status: 404, message: 'Employee not found' };
    }
    const callerOrg = userOrgIdFromReq(req) || req.user.orgId;
    if (callerOrg && emp.orgId && String(emp.orgId) !== String(callerOrg)) {
      return { ok: false, status: 403, message: 'Forbidden' };
    }
    return { ok: true };
  }

  const callerOrg = userOrgIdFromReq(req) || req.user.orgId;
  const self = await findEmployeeForSelfService(req.user.userId, callerOrg, {
    allowCrossOrgFallback: true,
  });
  if (!self || String(self._id) !== targetId) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }
  return { ok: true };
}
