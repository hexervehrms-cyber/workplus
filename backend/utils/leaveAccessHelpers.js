/**
 * Org-scoped access helpers for leave routes.
 */

export const LEAVE_APPROVER_ROLES = ['admin', 'hr', 'manager', 'super_admin'];

export function resolveQueryOrgId(req, queryOrgId) {
  if (req.user?.role === 'super_admin' && queryOrgId) {
    return queryOrgId;
  }
  return req.user?.orgId;
}

export function assertSameOrg(req, recordOrgId) {
  if (!recordOrgId) return true;
  if (req.user?.role === 'super_admin') return true;
  return String(recordOrgId) === String(req.user.orgId);
}

export function denyIfCrossOrg(req, res, recordOrgId) {
  if (!assertSameOrg(req, recordOrgId)) {
    res.status(403).json({ success: false, message: 'Unauthorized access' });
    return true;
  }
  return false;
}

export function bulkOrgFilter(req) {
  if (req.user?.role === 'super_admin') return {};
  return { orgId: String(req.user.orgId) };
}
