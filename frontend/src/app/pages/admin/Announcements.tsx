import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Send, Calendar, Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '../../utils/api';
import { toast } from '../../utils/portalToast';
import { useAuth } from '../../context/AuthContext';
import { OrgRequiredNotice } from '../../components/OrgRequiredNotice';

interface AnnouncementRow {
  _id: string;
  title: string;
  content: string;
  priority?: string;
  visibility?: string;
  isPublished?: boolean;
  isDraft?: boolean;
  publishedAt?: string;
  createdAt?: string;
  authorId?: { name?: string; email?: string };
}

export default function AnnouncementsAdmin() {
  const { user } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'all' | 'management'>('all');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [stats, setStats] = useState({
    totalAnnouncements: 0,
    publishedAnnouncements: 0,
    scheduledAnnouncements: 0,
    pinnedAnnouncements: 0,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, statsRes] = await Promise.all([
        apiClient.get<AnnouncementRow[]>('/announcements', { limit: '50', page: '1' }),
        apiClient.get<typeof stats>('/announcements/dashboard-stats'),
      ]);
      if (listRes.success && Array.isArray(listRes.data)) {
        setRows(listRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data as typeof stats);
      }
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError && (e.code === 'MISSING_ORG_CONTEXT' || e.status === 403)) {
        toast.error('Organization context missing. Please sign out and sign in again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const focusCreateForm = () => {
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      titleInputRef.current?.focus();
    });
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter a title and message');
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiClient.post<AnnouncementRow>('/announcements', {
        title: title.trim(),
        content: message.trim(),
        audience,
        priority,
        type: 'general',
      });
      if (res.success) {
        toast.success(res.message || 'Announcement published');
        setTitle('');
        setMessage('');
        setAudience('all');
        setPriority('medium');
        window.dispatchEvent(new CustomEvent('notifications:refresh'));
        await load();
      } else {
        toast.error(res.message || 'Failed to send announcement');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof ApiError ? e.getUserMessage() : 'Failed to send announcement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <OrgRequiredNotice user={user} />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Manage organization announcements</p>
        </div>
        <Button className="rounded-xl" type="button" onClick={focusCreateForm}>
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {showForm && (
            <Card ref={formRef} className="p-6 rounded-xl border-primary/20">
              <h2 className="text-xl font-semibold mb-4">Create New Announcement</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium" htmlFor="ann-title">
                    Title
                  </label>
                  <input
                    ref={titleInputRef}
                    id="ann-title"
                    type="text"
                    placeholder="Enter announcement title..."
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="ann-msg">
                    Message
                  </label>
                  <textarea
                    id="ann-msg"
                    placeholder="Enter your announcement message..."
                    rows={4}
                    className="w-full mt-1 px-3 py-2 border rounded-xl bg-background resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 flex-col sm:flex-row">
                  <div className="flex-1">
                    <label className="text-sm font-medium" htmlFor="ann-audience">
                      Target Audience
                    </label>
                    <select
                      id="ann-audience"
                      className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as 'all' | 'management')}
                    >
                      <option value="all">All Employees</option>
                      <option value="management">Management Only</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium" htmlFor="ann-priority">
                      Priority
                    </label>
                    <select
                      id="ann-priority"
                      className="w-full mt-1 px-3 py-2 border rounded-xl bg-background"
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                      }
                    >
                      <option value="medium">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="rounded-xl"
                    type="button"
                    onClick={handleSend}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Announcement
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {!showForm && (
            <Card className="p-6 rounded-xl text-center text-muted-foreground">
              <p className="mb-3">Create a new announcement for your organization.</p>
              <Button type="button" onClick={focusCreateForm}>
                <Plus className="w-4 h-4 mr-2" />
                New Announcement
              </Button>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-semibold">{stats.totalAnnouncements}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Published</span>
                <span className="font-semibold">{stats.publishedAnnouncements}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Draft / scheduled</span>
                <span className="font-semibold">{stats.scheduledAnnouncements}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pinned live</span>
                <span className="font-semibold">{stats.pinnedAnnouncements}</span>
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
                    <h4 className="font-medium text-sm mb-1">{r.title}</h4>
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

      <Card className="p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">All Announcements</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">Audience</th>
                <th className="text-left p-4">Priority</th>
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
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
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 text-xs rounded-full capitalize">
                        {r.visibility === 'role' ? 'Management / role' : 'All'}
                      </span>
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
