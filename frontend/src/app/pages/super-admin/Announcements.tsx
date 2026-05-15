import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Send, Calendar, Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '../../utils/api';
import { toast } from 'sonner';

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

type Audience = 'all' | 'super_admin' | 'admin' | 'employee';

export default function Announcements() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
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
      toast.error(e instanceof ApiError ? e.getUserMessage() : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        type: 'system',
      });
      if (res.success) {
        toast.success(res.message || 'Announcement published');
        setTitle('');
        setMessage('');
        setAudience('all');
        setPriority('medium');
        await load();
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Manage system-wide announcements</p>
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
                  Title
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
                  Message
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
                    <option value="medium">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
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
            </div>
          </Card>
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
    </div>
  );
}
