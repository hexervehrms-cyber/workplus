/**
 * Multi-tenant org scoping for Mongo queries.
 */

export function isSuperAdmin(req) {
  return req.user?.role === 'super_admin';
}

/** Raw org id from JWT / user record (no "system" fallback). */
export function userOrgIdFromReq(req) {
  const u = req.user;
  const id = u?.orgId || u?.tenantId || u?.organizationId;
  if (!id || String(id) === 'system') return null;
  return String(id);
}

/**
 * Tenant org for route handlers after validateOrgId.
 * Super admin: ?orgId= / body.orgId, else user org; null if still unknown.
 */
export function resolveScopedOrgId(req) {
  if (isSuperAdmin(req)) {
    const fromQuery = req.query?.orgId && String(req.query.orgId).trim();
    const fromBody = req.body?.orgId && String(req.body.orgId).trim();
    const picked =
      (fromQuery && fromQuery !== 'system' ? fromQuery : null) ||
      (fromBody && fromBody !== 'system' ? fromBody : null);
    if (picked) return picked;
    return userOrgIdFromReq(req);
  }
  return req.validatedOrgId || userOrgIdFromReq(req);
}

/** Read filter: current orgId field + legacy organizationId on Holiday docs. */
export function holidayOrgReadFilter(scopedOrgId) {
  const o = String(scopedOrgId);
  return { $or: [{ orgId: o }, { organizationId: o }] };
}

/**
 * Resolve tenant org or send 400. Use at start of route handlers (after validateOrgId).
 * @returns {string|null}
 */
export function assertScopedOrgId(req, res) {
  const orgId = resolveScopedOrgId(req);
  if (!orgId) {
    res.status(400).json({
      success: false,
      message: 'orgId is required (use ?orgId= for super admin)',
      code: 'MISSING_ORG_CONTEXT'
    });
    return null;
  }
  return orgId;
}

/** Employee record org (never "system"). */
export function resolveEmployeeOrgId(employee) {
  const o = employee?.orgId;
  if (!o || String(o) === 'system') return undefined;
  return String(o);
}

/** Socket.IO tenant room from verified JWT payload. */
export function socketTenantIdFromDecoded(decoded) {
  const raw = decoded?.orgId || decoded?.tenantId;
  if (raw && String(raw) !== 'system') return String(raw);
  if (decoded?.role === 'super_admin') return raw ? String(raw) : 'system';
  return raw ? String(raw) : null;
}

/** Org id for JWT/session attachment (no tenant fallback to "system"). */
export function normalizeAuthOrgId(user) {
  const raw = user?.orgId || user?.tenantId || user?.organizationId;
  if (!raw) {
    return user?.role === 'super_admin' ? 'system' : undefined;
  }
  const s = String(raw);
  if (s === 'system' || s === 'workplus_system') {
    return user?.role === 'super_admin' ? s : undefined;
  }
  return s;
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
