import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
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
import { apiClient, ApiError, DepartmentService, extractApiList, type DepartmentRecord } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import realTimeSocket from '../../utils/realTimeSocket';

type Department = DepartmentRecord;

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

function deptKey(dept: Department) {
  return dept._id || `name:${dept.name}`;
}

function employeeDisplayName(emp: DeptEmployee) {
  const u = emp.userId;
  if (u && typeof u === 'object' && u.name) return u.name;
  return emp.employeeCode || 'Employee';
}

export default function AdminDepartments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantOrgId = user?.orgId || user?.tenantId;
  const needsOrgContext =
    user?.role === 'super_admin' && (!tenantOrgId || String(tenantOrgId) === 'system');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const loadDepartments = useCallback(async () => {
    if (needsOrgContext) {
      setDepartments([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await DepartmentService.getAll({
        search: searchTerm.trim() || undefined,
        status: filterStatus,
        orgId:
          user?.role === 'super_admin' && tenantOrgId
            ? String(tenantOrgId)
            : undefined,
      });
      setDepartments(list);
    } catch (err) {
      console.error('Error loading departments:', err);
      toast.error('Failed to load departments');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterStatus, needsOrgContext, tenantOrgId, user?.role]);

  const loadDepartmentDetail = useCallback(
    async (dept: Department) => {
      setDetailLoading(true);
      try {
        if (dept._id) {
          let url = `/departments/${dept._id}`;
          if (user?.role === 'super_admin' && tenantOrgId) {
            url += `?orgId=${encodeURIComponent(String(tenantOrgId))}`;
          }
          const res = await apiClient.get<{ employees?: DeptEmployee[] } & Department>(url);
          if (res.success && res.data) {
            const data = res.data as { employees?: DeptEmployee[] } & Department;
            setDetailEmployees(Array.isArray(data.employees) ? data.employees : []);
            return;
          }
        }
        const list = await DepartmentService.getEmployeesByDepartment(
          dept.name,
          user?.role === 'super_admin' && tenantOrgId ? String(tenantOrgId) : undefined
        );
        setDetailEmployees(list as DeptEmployee[]);
      } catch (err) {
        console.error('Error loading department employees:', err);
        toast.error('Failed to load employees for this department');
        setDetailEmployees([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [tenantOrgId, user?.role]
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
    if (!user?.id) return;
    realTimeSocket.connectFromAuth({
      id: user.id,
      role: user.role || 'admin',
      orgId: user.orgId,
      tenantId: user.tenantId,
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
  }, [user, scheduleRefresh, loadDepartments]);

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

  const handleSave = async () => {
    if (!formData.name.trim()) {
      const msg = 'Department name is required';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        headName: formData.headName.trim(),
        code: formData.code.trim() || undefined,
        isActive: formData.isActive,
      };
      const oid = user?.orgId || user?.tenantId;
      if (oid && user?.role === 'super_admin') {
        payload.orgId = String(oid);
      }

      if (editingDepartment?._id) {
        const res = await apiClient.put<Department>(`/departments/${editingDepartment._id}`, payload);
        if (res.success) {
          toast.success('Department updated');
          closeForm();
          await loadDepartments();
          if (selectedDept?._id === editingDepartment._id) {
            const updated = { ...selectedDept, ...payload, name: formData.name.trim() } as Department;
            setSelectedDept(updated);
            void loadDepartmentDetail(updated);
          }
        } else {
          throw new Error(res.message || 'Update failed');
        }
      } else {
        const res = await apiClient.post<Department>('/departments', payload);
        if (res.success) {
          toast.success('Department created');
          closeForm();
          await loadDepartments();
          if (selectedDept?.source === 'employees' && res.data?.name) {
            setSelectedDept({ ...res.data, source: 'database' });
          }
        } else {
          throw new Error(res.message || 'Create failed');
        }
      }
    } catch (err: unknown) {
      const msg =
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
    if (!deletingDepartmentId) return;
    setSaving(true);
    try {
      const res = await apiClient.delete(`/departments/${deletingDepartmentId}`);
      if (res.success) {
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
                {selectedDept.source === 'employees' && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900">
                    From employee records — create to manage formally
                  </span>
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
                <Button type="button" variant="outline" className="flex-1" onClick={(e) => openEditForm(selectedDept, e)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <Button type="button" className="flex-1" onClick={() => openAddForm(selectedDept.name)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create formal dept
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => navigate('/admin/employees')}
              >
                <Users className="w-4 h-4 mr-1" />
                All employees
              </Button>
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
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/admin/employees/${emp._id}/correspondence`)}
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

      {needsOrgContext && (
        <Card className="p-4 rounded-xl border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Super admin accounts need a valid organization on their profile to load departments. Assign an orgId to
          your user or log in as admin.
        </Card>
      )}

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Live data from your organization and employee records</p>
        </div>
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
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => void loadDepartments()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDepartments.length === 0 ? (
        <Card className="p-12 text-center rounded-xl">
          <p className="text-muted-foreground mb-4">No departments yet. Create one or assign employees to a department.</p>
          <Button type="button" onClick={() => openAddForm()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Department
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.map((department) => (
            <Card
              key={deptKey(department)}
              role="button"
              tabIndex={0}
              className="p-6 rounded-xl cursor-pointer transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => openDepartmentDetail(department)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDepartmentDetail(department);
                }
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      department.isActive !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {department.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                  {department.source === 'employees' && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-900">
                      From employees
                    </span>
                  )}
                </div>
              </div>
              <h3 className="font-semibold mb-1">{department.name}</h3>
              {department.code && (
                <p className="text-xs text-muted-foreground mb-2">Code: {department.code}</p>
              )}
              <p className="text-sm text-muted-foreground mb-4 min-h-[2.5rem] line-clamp-2">
                {department.description || 'No description'}
              </p>
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div className="flex items-center justify-between">
                  <span>Head:</span>
                  <span className="font-medium text-foreground">{department.headName || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Employees:</span>
                  <span className="font-medium text-foreground">{department.employeeCount ?? 0}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-primary font-medium mb-3">
                <span>View details</span>
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg flex-1"
                  onClick={(e) => openEditForm(department, e)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                {department._id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setDeletingDepartmentId(department._id);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
