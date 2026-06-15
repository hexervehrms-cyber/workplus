import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  Loader2,
  Users,
  ChevronRight,
} from 'lucide-react';
import { ApiError, type DepartmentRecord } from '../../utils/api';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiHelper';
import { ensureAccessToken } from '../../utils/sessionAuth';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';
import { authUserKey } from '../../utils/safeUi';

type Department = DepartmentRecord;

interface Organization {
  _id: string;
  name: string;
  code: string;
}

interface DeptEmployee {
  _id: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
  status?: string;
  userId?: { name?: string; email?: string } | string;
}

const emptyForm = {
  name: '',
  description: '',
  headName: '',
  code: '',
  isActive: true,
};

const PREDEFINED_DEPARTMENTS = [
  'Human Resources',
  'Engineering',
  'Finance',
  'Sales',
  'Marketing',
  'Operations',
  'Customer Support',
  'Information Technology',
] as const;

function deptKey(dept: Department) {
  return dept._id || `name:${dept.name}`;
}

function employeeDisplayName(emp: DeptEmployee) {
  const u = emp.userId;
  if (u && typeof u === 'object' && u.name) return u.name;
  return emp.employeeCode || 'Employee';
}

export default function SuperAdminDepartments() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [orgsLoading, setOrgsLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [detailEmployees, setDetailEmployees] = useState<DeptEmployee[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setOrgsLoading(true);
        await ensureAccessToken();
        const res = await apiGet<{ success?: boolean; data?: Organization[] }>(
          '/organizations?limit=100',
          false
        );
        const orgs = res?.data || [];
        setOrganizations(orgs);
        
        // Restore selected org from localStorage if it still exists
        const saved = localStorage.getItem('superAdmin_departments_selectedOrgId');
        if (saved && orgs.some(o => o._id === saved)) {
          setSelectedOrgId(saved);
        }
      } catch (err) {
        console.error('Error loading organizations:', err);
        toast.error('Failed to load organizations');
      } finally {
        setOrgsLoading(false);
      }
    };
    loadOrganizations();
  }, []);

  // Persist selected org to localStorage
  useEffect(() => {
    if (selectedOrgId) {
      localStorage.setItem('superAdmin_departments_selectedOrgId', selectedOrgId);
    }
  }, [selectedOrgId]);

  const loadDepartments = useCallback(async () => {
    if (!selectedOrgId) {
      setDepartments([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      await ensureAccessToken();
      const url = `/departments?orgId=${encodeURIComponent(selectedOrgId)}&search=${encodeURIComponent(
        searchTerm.trim()
      )}&status=${filterStatus}`;
      const res = await apiGet<{ success?: boolean; data?: Department[] }>(url, false);
      const list = res?.data || [];
      setDepartments(list);
    } catch (err) {
      console.error('Error loading departments:', err);
      toast.error('Failed to load departments');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, searchTerm, filterStatus]);

  const loadDepartmentDetail = useCallback(
    async (dept: Department) => {
      setDetailLoading(true);
      try {
        await ensureAccessToken();
        if (dept._id && selectedOrgId) {
          const url = `/departments/${dept._id}?orgId=${encodeURIComponent(selectedOrgId)}`;
          const res = await apiGet<{
            success?: boolean;
            data?: { employees?: DeptEmployee[] } & Department;
          }>(url, false);
          if (res?.success && res.data) {
            setDetailEmployees(Array.isArray(res.data.employees) ? res.data.employees : []);
            return;
          }
        }
        setDetailEmployees([]);
      } catch (err) {
        console.error('Error loading department employees:', err);
        setDetailEmployees([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [selectedOrgId]
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void loadDepartments();
      if (selectedDept) void loadDepartmentDetail(selectedDept);
    }, 400);
  }, [loadDepartments, loadDepartmentDetail, selectedDept]);

  const openDepartmentDetail = (dept: Department) => {
    setSelectedDept(dept);
    void loadDepartmentDetail(dept);
  };

  const closeDepartmentDetail = () => {
    setSelectedDept(null);
    setDetailEmployees([]);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDepartments();
    }, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadDepartments, searchTerm, filterStatus]);

  useEffect(() => {
    const uid = authUserKey(user);
    if (!uid || !selectedOrgId) return;
    realTimeSocket.connectFromAuth({
      id: uid,
      role: user?.role || 'super_admin',
      orgId: selectedOrgId,
      tenantId: selectedOrgId,
    });
    const unsub = realTimeSocket.onEmployeeUpdate(() => {
      scheduleRefresh();
    });
    const onFocus = () => void loadDepartments();
    window.addEventListener('focus', onFocus);
    return () => {
      unsub();
      window.removeEventListener('focus', onFocus);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [user, selectedOrgId, scheduleRefresh, loadDepartments]);

  const openAddForm = (prefillName?: string) => {
    setEditingDepartment(null);
    setFormData(prefillName ? { ...emptyForm, name: prefillName } : emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (department: Department, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!department._id) {
      openAddForm(department.name);
      return;
    }
    setEditingDepartment(department);
    setFormData({
      name: department.name || '',
      description: department.description || '',
      headName: department.headName || '',
      code: department.code || '',
      isActive: department.isActive !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDepartment(null);
    setFormData(emptyForm);
    setFormError(null);
  };

  const handleSeedPredefined = async () => {
    if (!selectedOrgId) {
      toast.error('Please select an organization first');
      return;
    }
    setSeeding(true);
    try {
      await ensureAccessToken();
      const url = `/departments/seed-defaults?orgId=${encodeURIComponent(selectedOrgId)}`;
      const res = await apiPost<{
        success?: boolean;
        message?: string;
        data?: { created?: Department[]; skipped?: { name: string; reason: string }[] };
      }>(url, {});
      if (res?.success) {
        const createdCount = res.data?.created?.length ?? 0;
        toast.success(res.message || `Added ${createdCount} predefined department(s)`);
        await loadDepartments();
      } else {
        throw new Error(res?.message || 'Failed to add predefined departments');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.getUserMessage()
          : err instanceof Error
            ? err.message
            : 'Failed to add predefined departments';
      toast.error(msg);
    } finally {
      setSeeding(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      const msg = 'Department name is required';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    if (!selectedOrgId) {
      const msg = 'Please select an organization first';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      await ensureAccessToken();
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        headName: formData.headName.trim(),
        code: formData.code.trim() || undefined,
        isActive: formData.isActive,
        orgId: selectedOrgId,
      };

      if (editingDepartment?._id) {
        const res = await apiPut<{ success?: boolean; message?: string; data?: Department }>(
          `/departments/${editingDepartment._id}?orgId=${encodeURIComponent(selectedOrgId)}`,
          payload
        );
        if (res?.success) {
          toast.success('Department updated');
          closeForm();
          await loadDepartments();
          if (selectedDept?._id === editingDepartment._id) {
            const updated = { ...selectedDept, ...payload, name: formData.name.trim() } as Department;
            setSelectedDept(updated);
            void loadDepartmentDetail(updated);
          }
        } else {
          throw new Error(res?.message || 'Update failed');
        }
      } else {
        const res = await apiPost<{ success?: boolean; message?: string; data?: Department }>(
          '/departments',
          payload
        );
        if (res?.success) {
          toast.success('Department created');
          closeForm();
          await loadDepartments();
        } else {
          throw new Error(res?.message || 'Create failed');
        }
      }
    } catch (err: unknown) {
      let msg =
        err instanceof ApiError
          ? err.getUserMessage()
          : err instanceof Error
            ? err.message
            : 'Failed to save department';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDepartmentId || !selectedOrgId) return;
    setSaving(true);
    try {
      await ensureAccessToken();
      const url = `/departments/${deletingDepartmentId}?orgId=${encodeURIComponent(selectedOrgId)}`;
      const res = await apiDelete<{ success?: boolean }>(url);
      if (res?.success) {
        toast.success('Department deleted');
        setShowDeleteConfirm(false);
        setDeletingDepartmentId(null);
        if (selectedDept?._id === deletingDepartmentId) closeDepartmentDetail();
        await loadDepartments();
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.getUserMessage() : 'Failed to delete department');
    } finally {
      setSaving(false);
    }
  };

  const filteredDepartments = departments.filter((dept) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      dept.name.toLowerCase().includes(q) ||
      (dept.description || '').toLowerCase().includes(q) ||
      (dept.headName || '').toLowerCase().includes(q) ||
      (dept.code || '').toLowerCase().includes(q)
    );
  });

  const totalEmployees = useMemo(
    () => departments.reduce((sum, d) => sum + (d.employeeCount ?? 0), 0),
    [departments]
  );

  if (orgsLoading) {
    return (
      <div className="p-6 flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center rounded-xl">
          <p className="text-muted-foreground mb-4">No organizations available.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingDepartment ? 'Edit Department' : 'Create Department'}
              </h2>
              <Button type="button" variant="ghost" size="icon" onClick={closeForm} disabled={saving}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              {formError && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}
              <div>
                <label className="text-sm font-medium">Department Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Engineering"
                  className="mt-1 rounded-xl"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Auto-generated if empty"
                  className="mt-1 rounded-xl"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What this department does"
                  className="mt-1 rounded-xl"
                  rows={3}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department Head</label>
                <Input
                  value={formData.headName}
                  onChange={(e) => setFormData({ ...formData, headName: e.target.value })}
                  placeholder="Head of department name"
                  className="mt-1 rounded-xl"
                  disabled={saving}
                />
              </div>
              {editingDepartment && (
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={formData.isActive ? 'active' : 'inactive'}
                    onValueChange={(v) => setFormData({ ...formData, isActive: v === 'active' })}
                  >
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <Button type="button" variant="outline" onClick={closeForm} disabled={saving} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingDepartment ? (
                  'Update Department'
                ) : (
                  'Create Department'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Delete Department</h2>
              <p className="text-muted-foreground mb-6">
                This will deactivate the department. Employees already assigned by name are not changed.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingDepartmentId(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {selectedDept && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-end"
          onClick={closeDepartmentDetail}
          role="presentation"
        >
          <Card
            className="w-full max-w-md h-full rounded-none rounded-l-2xl p-6 overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedDept.name}</h2>
                {selectedDept.code && (
                  <p className="text-sm text-muted-foreground mt-1">Code: {selectedDept.code}</p>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeDepartmentDetail}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4 text-sm mb-6">
              <p className="text-muted-foreground">{selectedDept.description || 'No description'}</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Head</span>
                <span className="font-medium">{selectedDept.headName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employees</span>
                <span className="font-medium">{selectedDept.employeeCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">
                  {selectedDept.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              {selectedDept._id ? (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1" 
                    onClick={(e) => openEditForm(selectedDept, e)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setDeletingDepartmentId(selectedDept._id || null);
                      setShowDeleteConfirm(true);
                      closeDepartmentDetail();
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </>
              ) : null}
            </div>

            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team members
            </h3>
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">No employees in this department yet.</p>
            ) : (
              <ul className="space-y-2">
                {detailEmployees.map((emp) => (
                  <li
                    key={emp._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{employeeDisplayName(emp)}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.designation || '—'}
                        {emp.employeeCode ? ` · ${emp.employeeCode}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Manage departments for your selected organization</p>
        </div>
      </div>

      {/* Organization Selector */}
      <Card className="p-4 rounded-xl border-primary/20 bg-primary/5">
        <label className="text-sm font-medium block mb-2">Select Organization</label>
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Choose an organization..." />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org._id} value={org._id}>
                {org.name} {org.code ? `(${org.code})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {!selectedOrgId ? (
        <Card className="p-12 text-center rounded-xl">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Select an organization to manage its departments.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void handleSeedPredefined()}
              disabled={loading || seeding}
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4 mr-2" />
              )}
              Add predefined departments
            </Button>
            <Button type="button" className="rounded-xl" onClick={() => openAddForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Create Department
            </Button>
          </div>

          {!loading && departments.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 rounded-xl">
                <p className="text-xs text-muted-foreground">Departments</p>
                <p className="text-2xl font-bold">{departments.length}</p>
              </Card>
              <Card className="p-4 rounded-xl">
                <p className="text-xs text-muted-foreground">Employees assigned</p>
                <p className="text-2xl font-bold">{totalEmployees}</p>
              </Card>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
                <SelectItem value="all">All departments</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              type="button" 
              variant="outline" 
              className="rounded-xl" 
              onClick={() => void loadDepartments()} 
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDepartments.length === 0 ? (
            <Card className="p-12 text-center rounded-xl">
              <p className="text-muted-foreground mb-4">
                No departments yet. Add predefined departments or create a custom one.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => void handleSeedPredefined()} 
                  disabled={seeding}
                >
                  {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}
                  Add predefined departments
                </Button>
                <Button type="button" onClick={() => openAddForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Department
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepartments.map((department) => (
                <Card
                  key={deptKey(department)}
                  role="button"
                  tabIndex={0}
                  className="p-6 rounded-xl cursor-pointer transition-all hover:shadow-md hover:border-primary/40"
                  onClick={() => openDepartmentDetail(department)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{department.name}</h3>
                      {department.code && (
                        <p className="text-xs text-muted-foreground mt-1">Code: {department.code}</p>
                      )}
                    </div>
                    {department._id && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(department, e);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingDepartmentId(department._id || null);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {department.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{department.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{department.employeeCount ?? 0} employees</span>
                    <span className={`px-2 py-1 rounded-full ${
                      department.isActive !== false 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {department.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
