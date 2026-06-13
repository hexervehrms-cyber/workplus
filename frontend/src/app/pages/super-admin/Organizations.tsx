import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Building2, Plus, Search, Filter, X, Edit, Trash2, Loader2, Copy, AlertCircle, Check } from 'lucide-react';
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
  customDomain?: string;
  customDomainStatus?: string;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  purpose?: string;
  warning?: string;
}

interface DomainSetupData {
  domain: string;
  status: string;
  dnsRecords: DnsRecord[];
  customDomainUrl?: string;
  defaultTenantUrl?: string;
  verificationRequired?: boolean;
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  adminPassword: '',
  confirmPassword: '',
  customDomain: '',
  showPassword: false,
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
  const [showDnsSetup, setShowDnsSetup] = useState(false);
  const [dnsSetupData, setDnsSetupData] = useState<DomainSetupData | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);

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
      adminPassword: '',
      confirmPassword: '',
      customDomain: '',
      showPassword: false,
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
    
    // When creating new organization, password is required
    if (!editingOrg) {
      if (!formData.adminPassword || formData.adminPassword.length < 8) {
        toast.error('Admin password is required and must be at least 8 characters');
        return;
      }
    }
    
    // When editing organization, validate password if provided
    if (editingOrg && formData.adminPassword) {
      if (formData.adminPassword.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (formData.adminPassword !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }
    
    // Validate custom domain if provided
    if (formData.customDomain.trim()) {
      let domain = formData.customDomain.trim().toLowerCase();
      domain = domain.replace(/^https?:\/\//, '');
      domain = domain.replace(/\/$/, '');
      
      if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z0-9]+(-[a-z0-9]+)*$/.test(domain)) {
        toast.error('Invalid custom domain format');
        return;
      }
    }
    
    setSaving(true);
    try {
      if (editingOrg) {
        const updatePayload: Record<string, unknown> = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
        };
        
        // Add password reset if provided
        if (formData.adminPassword) {
          updatePayload.adminPassword = formData.adminPassword;
        }
        
        const res = await apiClient.put<OrganizationRow>(`/organizations/${editingOrg._id}`, updatePayload);
        if (res.success) {
          const msg = res.message || 'Organization updated';
          toast.success(msg);
          closeForms();
          await loadOrganizations();
        } else {
          throw new Error(res.message || 'Update failed');
        }
      } else {
        const payload: Record<string, unknown> = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
          adminPassword: formData.adminPassword,
        };
        
        if (formData.customDomain.trim()) {
          payload.customDomain = formData.customDomain.trim().toLowerCase();
        }
        
        const res = await apiClient.post<any>('/organizations', payload);
        if (res.success) {
          let successMsg = 'Organization and admin account created';
          if (res.data?.code) {
            successMsg += ` (code: ${res.data.code})`;
          }
          toast.success(successMsg);
          
          // Show DNS records if custom domain was configured
          if (res.data?.customDomain) {
            setDnsSetupData(res.data.customDomain);
            setShowDnsSetup(true);
          }
          
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

  const handleVerifyDomain = async () => {
    if (!dnsSetupData?.domain) return;
    
    setVerifyingDomain(true);
    try {
      const org = organizations.find(o => o.customDomain === dnsSetupData.domain);
      if (!org) {
        toast.error('Organization not found');
        return;
      }
      
      const res = await apiClient.post<any>(`/organizations/${org._id}/verify-domain`, {});
      
      if (res.success) {
        toast.success('Domain verified successfully!');
        if (dnsSetupData) {
          setDnsSetupData({
            ...dnsSetupData,
            status: 'verified'
          });
        }
        await loadOrganizations();
        setTimeout(() => {
          setShowDnsSetup(false);
        }, 2000);
      } else {
        if (res.code === 'DNS_NOT_CONFIGURED') {
          toast.error('DNS records not yet configured. Please add the DNS records and try again.');
        } else if (res.code === 'PARTIAL_VERIFICATION') {
          toast.warning('Some DNS records verified. Checking again in a moment...');
        } else {
          toast.error(res.message || 'Domain verification failed');
        }
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.getUserMessage() : 'Verification failed');
    } finally {
      setVerifyingDomain(false);
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* DNS Setup Modal */}
      {showDnsSetup && dnsSetupData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Custom Domain Setup</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowDnsSetup(false)} disabled={verifyingDomain}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-2 block">Domain</Label>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm">{dnsSetupData.domain}</div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">Status</Label>
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-100 text-yellow-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {dnsSetupData.status === 'verified' ? 'Verified' : 'Pending DNS Configuration'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Login URLs</Label>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Default (Always Available)</div>
                  <div className="flex gap-2">
                    <Input 
                      value={dnsSetupData.defaultTenantUrl || ''} 
                      readOnly 
                      className="bg-muted text-xs"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(dnsSetupData.defaultTenantUrl || '', 'Default URL')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Custom Domain {dnsSetupData.status === 'verified' ? '✓' : '(Pending DNS)'}
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      value={dnsSetupData.customDomainUrl || `https://${dnsSetupData.domain}`} 
                      readOnly 
                      className="bg-muted text-xs"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(dnsSetupData.customDomainUrl || `https://${dnsSetupData.domain}`, 'Custom Domain URL')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">DNS Records to Add</Label>
                {dnsSetupData.dnsRecords && dnsSetupData.dnsRecords.length > 0 ? (
                  <div className="space-y-2">
                    {dnsSetupData.dnsRecords.map((record, idx) => (
                      <div key={idx} className="border rounded-lg p-3 bg-muted/40 space-y-2">
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground font-medium">Type</div>
                            <div className="font-mono font-semibold">{record.type}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground font-medium">Host/Name</div>
                            <div className="font-mono text-xs">{record.name || '@'}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs text-muted-foreground font-medium">Value/Target</div>
                            <div className="flex items-center gap-1">
                              <div className="font-mono text-xs break-all flex-1">{record.value}</div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 shrink-0"
                                onClick={() => copyToClipboard(record.value, 'Value')}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        {record.purpose && (
                          <div className="text-xs text-muted-foreground">Purpose: {record.purpose}</div>
                        )}
                        {record.warning && (
                          <div className="text-xs bg-amber-50 text-amber-800 p-2 rounded border border-amber-200">
                            ⚠️ {record.warning}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No DNS records required</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-sm text-blue-900 mb-2">Next Steps</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Log in to your domain provider (GoDaddy, Namecheap, etc.)</li>
                  <li>Go to DNS settings for {dnsSetupData.domain}</li>
                  <li>Add the DNS records shown above</li>
                  <li>Wait for DNS propagation (up to 48 hours)</li>
                  <li>Come back here and click "Verify Domain" to confirm</li>
                </ol>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowDnsSetup(false)} disabled={verifyingDomain}>
                Close
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => void handleVerifyDomain()} 
                disabled={verifyingDomain || dnsSetupData.status === 'verified'}
              >
                {verifyingDomain && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {dnsSetupData.status === 'verified' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Verified
                  </>
                ) : (
                  'Verify Domain'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add/Edit Form Modal */}
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
              
              {!editingOrg && (
                <div>
                  <Label>Admin Password *</Label>
                  <div className="relative">
                    <Input
                      type={formData.showPassword ? 'text' : 'password'}
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      placeholder="Min 8 characters"
                      className="mt-1 rounded-xl pr-10"
                      disabled={saving}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {formData.showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">This will be the admin login password</p>
                </div>
              )}

              {editingOrg && (
                <div className="space-y-3 border-t pt-4">
                  <Label className="text-sm font-semibold">Admin Password Reset (Optional)</Label>
                  <p className="text-xs text-muted-foreground">Leave blank to keep current admin password</p>
                  
                  <div>
                    <Label className="text-sm">New Admin Password</Label>
                    <div className="relative">
                      <Input
                        type={formData.showPassword ? 'text' : 'password'}
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                        placeholder="Min 8 characters"
                        className="mt-1 rounded-xl pr-10"
                        disabled={saving}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {formData.showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        type={formData.showPassword ? 'text' : 'password'}
                        value={formData.confirmPassword || ''}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="Confirm password"
                        className="mt-1 rounded-xl pr-10"
                        disabled={saving}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, showPassword: !formData.showPassword })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {formData.showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <Label>Custom Domain (optional)</Label>
                <Input
                  value={formData.customDomain}
                  onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                  placeholder="e.g., clientdomain.com"
                  className="mt-1 rounded-xl"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground mt-1">Custom domain for your organization (DNS setup will be provided)</p>
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

      {/* Delete Confirmation Modal */}
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

      {/* Main Content */}
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
              <p className="text-sm text-muted-foreground mb-2">{org.email || '—'}</p>
              
              {org.customDomain && (
                <div className="mb-3 p-2 rounded-lg border bg-blue-50 border-blue-200">
                  <p className="text-xs font-medium text-blue-900 mb-1">Custom Domain</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-mono text-blue-800">{org.customDomain}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                      org.customDomainStatus === 'verified' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {org.customDomainStatus === 'verified' ? '✓ Verified' : 'Pending'}
                    </span>
                  </div>
                </div>
              )}

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
