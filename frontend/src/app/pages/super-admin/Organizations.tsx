import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Building2, Plus, Search, Filter, X, Edit, Trash2, Loader2, Copy } from 'lucide-react';
import { apiClient, ApiError } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface OrganizationRow {
  _id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  employeeCount?: number;
  status?: string;
  isActive?: boolean;
  createdAt?: string;
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
};

export default function Organizations() {
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationRow | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [formData, setFormData] = useState(emptyForm);

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('page', '1');
      params.set('status', filterStatus === 'active' ? 'active' : filterStatus === 'inactive' ? 'inactive' : 'all');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const qs = params.toString();
      const res = await apiClient.get<OrganizationRow[]>(`/organizations?${qs}`);
      if (res.success && Array.isArray(res.data)) {
        setOrganizations(res.data);
      } else {
        setOrganizations([]);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load organizations');
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadOrganizations();
    }, searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadOrganizations, searchTerm]);

  const openAdd = () => {
    setEditingOrg(null);
    setFormData(emptyForm);
    setShowEditForm(false);
    setShowAddForm(true);
  };

  const openEdit = (org: OrganizationRow) => {
    setShowAddForm(false);
    setEditingOrg(org);
    setFormData({
      name: org.name || '',
      email: org.email || '',
      phone: org.phone || '',
    });
    setShowEditForm(true);
  };

  const closeForms = () => {
    setShowAddForm(false);
    setShowEditForm(false);
    setEditingOrg(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      if (editingOrg) {
        const res = await apiClient.put<OrganizationRow>(`/organizations/${editingOrg._id}`, {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
        });
        if (res.success) {
          toast.success('Organization updated');
          closeForms();
          await loadOrganizations();
        } else {
          throw new Error(res.message || 'Update failed');
        }
      } else {
        const res = await apiClient.post<OrganizationRow>('/organizations', {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
        });
        if (res.success) {
          toast.success(
            res.data?.code
              ? `Organization created (code: ${res.data.code})`
              : 'Organization created'
          );
          closeForms();
          await loadOrganizations();
        } else {
          throw new Error(res.message || 'Create failed');
        }
      }
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.getUserMessage() : e instanceof Error ? e.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingOrgId) return;
    setSaving(true);
    try {
      const res = await apiClient.delete(`/organizations/${deletingOrgId}`);
      if (res.success) {
        toast.success('Organization deactivated');
        setShowDeleteConfirm(false);
        setDeletingOrgId(null);
        await loadOrganizations();
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.getUserMessage() : 'Could not deactivate organization');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  const copyTenantId = async (tenantId: string) => {
    try {
      await navigator.clipboard.writeText(tenantId);
      toast.success('Tenant ID copied (use this in Document Generator and other org-scoped tools)');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {(showAddForm || showEditForm) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingOrg ? 'Edit Organization' : 'Add Organization'}
              </h2>
              <Button variant="ghost" size="icon" onClick={closeForms} disabled={saving}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              {editingOrg?.code && (
                <div>
                  <Label>Organization code</Label>
                  <Input value={editingOrg.code} readOnly className="mt-1 rounded-xl bg-muted" />
                </div>
              )}
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 rounded-xl"
                  disabled={saving}
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 rounded-xl"
                  disabled={saving}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 rounded-xl"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={closeForms} disabled={saving}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => void handleSave()} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingOrg ? 'Update' : 'Create'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Deactivate organization</h2>
              <p className="text-muted-foreground mb-6 text-sm">
                Organizations with active employees cannot be removed until employees are deactivated. This
                action marks the organization inactive.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingOrgId(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deactivate'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage organizations (live data from API). Each card shows the tenant ID employees and documents use
            (MongoDB id), not the display code alone.
          </p>
        </div>
        <Button className="rounded-xl" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-[180px] rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : organizations.length === 0 ? (
        <Card className="p-12 text-center rounded-xl">
          <p className="text-muted-foreground mb-4">No organizations match your filters.</p>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Organization
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <Card key={org._id} className="p-6 rounded-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    org.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {org.status || (org.isActive !== false ? 'Active' : 'Inactive')}
                </span>
              </div>
              <h3 className="font-semibold mb-1">{org.name}</h3>
              {org.code && <p className="text-xs text-muted-foreground mb-2">Display code: {org.code}</p>}
              <div className="mb-3 rounded-lg border bg-muted/40 p-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Tenant ID (for APIs)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 shrink-0"
                    onClick={() => void copyTenantId(org._id)}
                    title="Copy tenant id"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs font-mono break-all text-foreground leading-snug" title={org._id}>
                  {org._id}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{org.email || '—'}</p>
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div className="flex justify-between">
                  <span>Phone</span>
                  <span className="font-medium text-foreground">{org.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Employees</span>
                  <span className="font-medium text-foreground">{org.employeeCount ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created</span>
                  <span className="font-medium text-foreground">{formatDate(org.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg flex-1" onClick={() => openEdit(org)}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setDeletingOrgId(org._id);
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
