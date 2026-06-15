import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Send, Calendar, Loader2, Globe, Building2 } from 'lucide-react';
import { apiClient, ApiError } from '../../utils/api';
import { toast } from '../../utils/portalToast';

interface AnnouncementRow {
  _id: string;
  title: string;
  content: string;
  priority?: string;
  visibility?: string;
  scope?: 'global' | 'organization';
  orgId?: string;
  isPublished?: boolean;
  isDraft?: boolean;
  publishedAt?: string;
  createdAt?: string;
  authorId?: { name?: string; email?: string };
}

interface Organization {
  _id: string;
  name: string;
  isActive?: boolean;
}

type Audience = 'all' | 'super_admin' | 'admin' | 'employee';
type ScopeType = 'global' | 'organization';

export default function Announcements() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [scope, setScope] = useState<ScopeType>('global');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [filterScope, setFilterScope] = useState<'all' | 'global' | 'organization'>('all');
  const [filterOrgId, setFilterOrgId] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draftOrScheduled: 0,
    pinnedLive: 0,
  });

  // Load organizations
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setOrgLoading(true);
        const response = await apiClient.get<{ success?: boolean; data?: Organization[] }>('/organizations?limit=100');
        if (response.success && Array.isArray(response.data)) {
          setOrganizations(response.data.filter(org => org.isActive !== false));
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
        toast.error('Failed to load organizations');
      } finally {
        setOrgLoading(false);
      }
    };
    loadOrganizations();
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterScope !== 'all') {
        params.append('scope', filterScope);
      }
      if (filterOrgId) {
        params.append('orgId', filterOrgId);
      }
      params.append('limit', '50');
      params.append('page', '1');

      const listRes = await apiClient.get<any>(`/announcements?${params.toString()}`);
      if (listRes.success && Array.isArray(listRes.data)) {
        setRows(listRes.data);
      }
      if (listRes.stats) {
        setStats(listRes.stats);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof ApiError ? e.getUserMessage() : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [filterScope, filterOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter a title and message');
      return;
    }

    if (scope === 'organization' && !selectedOrgId) {
      toast.error('Please select an organization');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        title: title.trim(),
        content: message.trim(),
        audience,
        priority,
        type: 'system',
        scope,
      };

      if (scope === 'organization') {
        payload.orgId = selectedOrgId;
      }

      const res = await apiClient.post<AnnouncementRow>('/announcements', payload);
      if (res.success) {
        toast.success(res.message || 'Announcement published');
        setTitle('');
        setMessage('');
        setAudience('all');
        setPriority('medium');
        setScope('global');
        setSelectedOrgId('');
        await load();
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof ApiError ? e.getUserMessage() : 'Failed to send announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      const res = await apiClient.delete(`/announcements/${announcementId}`);
      if (res.success) {
        toast.success('Announcement deleted successfully');
        await load();
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof ApiError ? e.getUserMessage() : 'Failed to delete announcement');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Manage global and organization announcements</p>
        </div>
        <Button className="rounded-xl" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">Create New Announcement</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="sa-ann-title">
                  Title *
                </label>
                <input
                  id="sa-ann-title"
                  type="text"
                  placeholder="Enter announcement title..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="sa-ann-msg">
                  Message *
                </label>
                <textarea
                  id="sa-ann-msg"
                  placeholder="Enter your announcement message..."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="sa-ann-scope">
                  Target Scope *
                </label>
                <select
                  id="sa-ann-scope"
                  className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as ScopeType);
                    if (e.target.value === 'global') {
                      setSelectedOrgId('');
                    }
                  }}
                >
                  <option value="global">Global / System-wide</option>
                  <option value="organization">Specific Organization</option>
                </select>
              </div>
              {scope === 'organization' && (
                <div>
                  <label className="text-sm font-medium" htmlFor="sa-ann-org">
                    Organization *
                  </label>
                  <select
                    id="sa-ann-org"
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    disabled={orgLoading}
                  >
                    <option value="">Select organization...</option>
                    {organizations.map(org => (
                      <option key={org._id} value={org._id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="flex-1">
                  <label className="text-sm font-medium" htmlFor="sa-ann-audience">
                    Target Audience
                  </label>
                  <select
                    id="sa-ann-audience"
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as Audience)}
                  >
                    <option value="all">All Users</option>
                    <option value="super_admin">Super Admins</option>
                    <option value="admin">Admins</option>
                    <option value="employee">Employees</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium" htmlFor="sa-ann-priority">
                    Priority
                  </label>
                  <select
                    id="sa-ann-priority"
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <Button
                className="rounded-xl"
                type="button"
                onClick={handleSend}
                disabled={submitting || orgLoading}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Announcement
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Published</span>
                <span className="font-semibold">{stats.published}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Draft / Scheduled</span>
                <span className="font-semibold">{stats.draftOrScheduled}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pinned Live</span>
                <span className="font-semibold">{stats.pinnedLive}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Recent Announcements</h3>
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No announcements yet.</p>
              ) : (
                rows.slice(0, 5).map((r) => (
                  <div key={r._id} className="p-3 bg-accent/50 rounded-xl">
                    <h4 className="font-medium text-sm mb-1 flex items-center gap-2">
                      {r.title}
                      {r.scope === 'global' ? (
                        <Globe className="w-3 h-3 text-blue-600" />
                      ) : (
                        <Building2 className="w-3 h-3 text-amber-600" />
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{r.content}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {r.publishedAt
                          ? new Date(r.publishedAt).toLocaleDateString()
                          : r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString()
                            : '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Filters and List */}
      <Card className="p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">All Announcements</h2>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium">Scope</label>
            <select
              className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value as any)}
            >
              <option value="all">All Announcements</option>
              <option value="global">Global Only</option>
              <option value="organization">Organization-Specific</option>
            </select>
          </div>
          {filterScope !== 'global' && (
            <div>
              <label className="text-sm font-medium">Organization</label>
              <select
                className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                value={filterOrgId}
                onChange={(e) => setFilterOrgId(e.target.value)}
              >
                <option value="">All Organizations</option>
                {organizations.map(org => (
                  <option key={org._id} value={org._id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">Scope</th>
                <th className="text-left p-4">Priority</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No announcements yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b hover:bg-accent/50">
                    <td className="p-4">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{r.content}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {r.scope === 'global' ? (
                          <>
                            <Globe className="w-4 h-4 text-blue-600" />
                            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 rounded-full">
                              Global
                            </span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4 text-amber-600" />
                            <span className="text-sm text-muted-foreground">Organization</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full capitalize">
                        {r.priority || 'medium'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-sm">
                        {r.publishedAt
                          ? new Date(r.publishedAt).toLocaleDateString()
                          : r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString()
                            : '—'}
                      </p>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          r.isPublished && !r.isDraft
                            ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-muted dark:text-muted-foreground'
                        }`}
                      >
                        {r.isPublished && !r.isDraft ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(r._id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
