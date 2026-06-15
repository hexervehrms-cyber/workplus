/**
 * Org-scoped access helpers for leave routes.
 */
import { userOrgIdFromReq } from './orgScopeHelpers.js';

export const LEAVE_APPROVER_ROLES = ['admin', 'hr', 'manager', 'super_admin'];

/** Tenant org id from validated middleware / JWT (never bare undefined orgId). */
export function scopedOrgId(req) {
  if (req.user?.role === 'super_admin') {
    const q = req.query?.orgId && String(req.query.orgId).trim();
    const b = req.body?.orgId && String(req.body.orgId).trim();
    return (q && q !== 'system' ? q : null) || (b && b !== 'system' ? b : null) || userOrgIdFromReq(req);
  }
  return userOrgIdFromReq(req) || req.validatedOrgId || req.user?.orgId;
}

export function resolveQueryOrgId(req, queryOrgId) {
  if (req.user?.role === 'super_admin' && queryOrgId) {
    return queryOrgId;
  }
  return scopedOrgId(req);
}

export function assertSameOrg(req, recordOrgId) {
  if (!recordOrgId) return true;
  if (req.user?.role === 'super_admin') return true;
  const org = scopedOrgId(req);
  if (!org) return false;
  return String(recordOrgId) === String(org);
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
  const org = scopedOrgId(req);
  return org ? { orgId: String(org) } : {};
}
