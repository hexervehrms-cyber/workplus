import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { DepartmentService, extractApiList, type DepartmentRecord } from '../utils/api';

async function fetchEmployeeDepartmentNames(orgId?: string): Promise<string[]> {
  const { apiGet } = await import('../utils/apiHelper');
  const params = new URLSearchParams({ limit: '500', simple: 'true' });
  if (orgId) params.set('orgId', orgId);
  const response = await apiGet<unknown>(`/employees?${params.toString()}`);
  const employees = extractApiList<{ department?: string }>(response);
  const names = new Set<string>();
  for (const emp of employees) {
    const name = String(emp.department || '').trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

async function seedDefaultDepartments(orgId?: string, role?: string): Promise<boolean> {
  const { apiPost, clearApiCache } = await import('../utils/apiHelper');
  let url = '/departments/seed-defaults';
  if (role === 'super_admin' && orgId) {
    url += `?orgId=${encodeURIComponent(orgId)}`;
  }
  const res = await apiPost<{ success?: boolean; data?: { created?: unknown[] } }>(url, {});
  clearApiCache('/departments');
  return !!res?.success && (res.data?.created?.length ?? 0) > 0;
}

export function useDepartments(options?: {
  status?: 'active' | 'inactive' | 'all';
  enabled?: boolean;
  seedIfEmpty?: boolean;
}) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enabled = options?.enabled !== false;
  const orgId = user?.orgId || user?.tenantId;
  const needsOrg =
    user?.role === 'super_admin' && (!orgId || String(orgId) === 'system');

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (needsOrg) {
      setDepartments([]);
      setError('Organization context is required. Log in with a tenant org or set orgId.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { clearApiCache } = await import('../utils/apiHelper');
      clearApiCache('/departments');

      const orgParam =
        user?.role === 'super_admin' && orgId ? String(orgId) : undefined;

      let list = await DepartmentService.getAll({
        status: options?.status ?? 'active',
        orgId: orgParam,
      });

      if (list.length === 0) {
        list = await DepartmentService.getAll({
          status: 'all',
          orgId: orgParam,
        });
      }

      if (list.length === 0) {
        const fromEmployees = await fetchEmployeeDepartmentNames(orgParam);
        if (fromEmployees.length > 0) {
          list = fromEmployees.map((name) => ({
            _id: null,
            name,
            source: 'employees' as const,
          }));
        }
      }

      if (list.length === 0 && options?.seedIfEmpty !== false) {
        try {
          const seeded = await seedDefaultDepartments(orgParam, user?.role);
          if (seeded) {
            list = await DepartmentService.getAll({
              status: options?.status ?? 'active',
              orgId: orgParam,
            });
          }
        } catch (seedErr) {
          console.warn('useDepartments: seed-defaults failed', seedErr);
        }
      }

      setDepartments(list);
    } catch (e) {
      console.error('useDepartments:', e);
      setError('Failed to load departments');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, needsOrg, orgId, user?.role, options?.status, options?.seedIfEmpty]);

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
