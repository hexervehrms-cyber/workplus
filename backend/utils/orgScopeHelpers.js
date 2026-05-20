/**
 * Multi-tenant org scoping for Mongo queries.
 */

export function isSuperAdmin(req) {
  return req.user?.role === 'super_admin';
}

export function orgFilter(req, extra = {}) {
  if (isSuperAdmin(req)) return { ...extra };
  return { ...extra, orgId: String(req.user.orgId) };
}

export function employeeLookupQuery(req, employeeId) {
  if (isSuperAdmin(req)) return { _id: employeeId };
  return { _id: employeeId, orgId: String(req.user.orgId) };
}

export function structureLookupQuery(req, structureId) {
  if (isSuperAdmin(req)) return { _id: structureId };
  return { _id: structureId, orgId: String(req.user.orgId) };
}
