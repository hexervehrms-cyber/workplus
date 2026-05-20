import { useState, useEffect, useCallback } from 'react';
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
import { Building2, Plus, Search, Filter, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '../../utils/api';
import { toast } from '../../utils/portalToast';

interface Department {
  _id: string;
  name: string;
  description?: string;
  headName?: string;
  code?: string;
  employeeCount?: number;
  isActive?: boolean;
  createdAt?: string;
}

const emptyForm = {
  name: '',
  description: '',
  headName: '',
  code: '',
  isActive: true,
};

export default function AdminDepartments() {
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

  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (filterStatus !== 'active') params.set('status', filterStatus);
      const qs = params.toString();
      const response = await apiClient.get<Department[]>(`/departments${qs ? `?${qs}` : ''}`);
      if (response.success && Array.isArray(response.data)) {
        setDepartments(response.data);
      } else {
        setDepartments([]);
      }
    } catch (err) {
      console.error('Error loading departments:', err);
      toast.error('Failed to load departments');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDepartments();
    }, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadDepartments, searchTerm]);

  const openAddForm = () => {
    setEditingDepartment(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (department: Department) => {
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
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        headName: formData.headName.trim(),
        code: formData.code.trim() || undefined,
        isActive: formData.isActive,
      };

      if (editingDepartment) {
        const res = await apiClient.put<Department>(`/departments/${editingDepartment._id}`, payload);
        if (res.success) {
          toast.success('Department updated');
          closeForm();
          await loadDepartments();
        } else {
          throw new Error(res.message || 'Update failed');
        }
      } else {
        const res = await apiClient.post<Department>('/departments', payload);
        if (res.success) {
          toast.success('Department created');
          closeForm();
          await loadDepartments();
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

  return (
    <div className="p-6 space-y-6">
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingDepartment ? 'Edit Department' : 'Add New Department'}
              </h2>
              <Button variant="ghost" size="icon" onClick={closeForm} disabled={saving}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
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
              <Button variant="outline" onClick={closeForm} disabled={saving} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingDepartment ? (
                  'Update Department'
                ) : (
                  'Save Department'
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
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingDepartmentId(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Manage organization departments</p>
        </div>
        <Button className="rounded-xl" onClick={openAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

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
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDepartments.length === 0 ? (
        <Card className="p-12 text-center rounded-xl">
          <p className="text-muted-foreground mb-4">No departments match your search or filter.</p>
          <Button onClick={openAddForm}>
            <Plus className="w-4 h-4 mr-2" />
            Add Department
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.map((department) => (
            <Card key={department._id} className="p-6 rounded-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    department.isActive !== false
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {department.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h3 className="font-semibold mb-1">{department.name}</h3>
              {department.code && (
                <p className="text-xs text-muted-foreground mb-2">Code: {department.code}</p>
              )}
              <p className="text-sm text-muted-foreground mb-4 min-h-[2.5rem]">
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg flex-1" onClick={() => openEditForm(department)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
