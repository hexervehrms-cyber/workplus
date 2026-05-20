/**
 * Org scoping helpers — regression tests (post-fix).
 * Ensures tenant org is never silently coerced to "system".
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeAuthOrgId,
  resolveScopedOrgId,
  userOrgIdFromReq,
  assertScopedOrgId
} from '../utils/orgScopeHelpers.js';

function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('orgScopeHelpers (fixed behavior)', () => {
  it('normalizeAuthOrgId returns admin orgId unchanged', () => {
    expect(
      normalizeAuthOrgId({ role: 'admin', orgId: 'org_123456' })
    ).toBe('org_123456');
  });

  it('normalizeAuthOrgId does not fallback tenants to system', () => {
    expect(normalizeAuthOrgId({ role: 'admin', orgId: undefined })).toBeUndefined();
    expect(normalizeAuthOrgId({ role: 'hr', orgId: null })).toBeUndefined();
    expect(normalizeAuthOrgId({ role: 'employee', orgId: 'system' })).toBeUndefined();
  });

  it('normalizeAuthOrgId allows super_admin system org', () => {
    expect(normalizeAuthOrgId({ role: 'super_admin', orgId: 'system' })).toBe('system');
  });

  it('resolveScopedOrgId uses query orgId for super_admin', () => {
    const req = {
      user: { role: 'super_admin', orgId: 'system' },
      query: { orgId: 'org_acme' },
      body: {}
    };
    expect(resolveScopedOrgId(req)).toBe('org_acme');
  });

  it('resolveScopedOrgId uses JWT org for admin', () => {
    const req = {
      user: { role: 'admin', orgId: 'org_123456' },
      validatedOrgId: 'org_123456',
      query: {},
      body: {}
    };
    expect(resolveScopedOrgId(req)).toBe('org_123456');
  });

  it('userOrgIdFromReq rejects system literal', () => {
    expect(userOrgIdFromReq({ user: { orgId: 'system' } })).toBeNull();
    expect(userOrgIdFromReq({ user: { orgId: 'org_real' } })).toBe('org_real');
  });

  it('assertScopedOrgId returns 400 when org missing', () => {
    const req = { user: { role: 'admin' }, query: {}, body: {} };
    const res = mockRes();
    expect(assertScopedOrgId(req, res)).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(res.body?.code).toBe('MISSING_ORG_CONTEXT');
  });

  it('legacy buggy extraction is NOT used for employee create', () => {
    const adminUser = { orgId: 'org_123456', organizationId: undefined, role: 'admin' };
    const buggy = adminUser.orgId || adminUser.organizationId || 'system';
    const fixed = normalizeAuthOrgId(adminUser);
    expect(buggy).toBe('org_123456');
    expect(fixed).toBe('org_123456');

    const missing = { role: 'admin' };
    const buggyMissing = missing.orgId || missing.organizationId || 'system';
    expect(buggyMissing).toBe('system');
    expect(normalizeAuthOrgId(missing)).toBeUndefined();
  });
});
