import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { DepartmentService, type DepartmentRecord } from '../utils/api';

export function useDepartments(options?: { status?: 'active' | 'inactive' | 'all' }) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = user?.orgId || user?.tenantId;
  const needsOrg =
    user?.role === 'super_admin' && (!orgId || String(orgId) === 'system');

  const reload = useCallback(async () => {
    if (needsOrg) {
      setDepartments([]);
      setError('Organization context is required. Log in with a tenant org or set orgId.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await DepartmentService.getAll({
        status: options?.status ?? 'active',
        orgId:
          user?.role === 'super_admin' && orgId ? String(orgId) : undefined,
      });
      setDepartments(list);
    } catch (e) {
      console.error('useDepartments:', e);
      setError('Failed to load departments');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [needsOrg, orgId, user?.role, options?.status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const departmentNames = departments.map((d) => d.name).filter(Boolean);

  return {
    departments,
    departmentNames,
    loading,
    error,
    needsOrg,
    reload,
    orgId: orgId ? String(orgId) : undefined,
  };
}
