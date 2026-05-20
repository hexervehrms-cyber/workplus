import { describe, it, expect } from 'vitest';
import { buildOrgIdFilter } from '../utils/dashboardKpiHelpers.js';

describe('buildOrgIdFilter', () => {
  it('matches string orgId', () => {
    const filter = buildOrgIdFilter('org_abc123');
    expect(filter.$or).toContainEqual({ orgId: 'org_abc123' });
  });

  it('includes ObjectId clause for valid 24-char hex ids', () => {
    const hex = '507f1f77bcf86cd799439011';
    const filter = buildOrgIdFilter(hex);
    expect(filter.$or.length).toBe(2);
    expect(filter.$or[0]).toEqual({ orgId: hex });
    expect(filter.$or[1].orgId.toString()).toBe(hex);
  });

  it('does not match any tenant when orgId is empty or system', () => {
    expect(buildOrgIdFilter('')).toEqual({ orgId: '__invalid_tenant__' });
    expect(buildOrgIdFilter('system')).toEqual({ orgId: '__invalid_tenant__' });
  });
});
