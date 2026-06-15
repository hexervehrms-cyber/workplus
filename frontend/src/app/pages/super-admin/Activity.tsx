import { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Activity, Users, Building2, TrendingUp, Plus, Search, Filter, Edit, Trash2, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet, apiDelete, apiPost } from '../../utils/apiHelper';
import { ensureAccessToken } from '../../utils/sessionAuth';
import { toast } from '../../utils/portalToast';

interface ActivityRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  organizationId: string;
  action: string;
  module: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  status: 'success' | 'failed';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ActivityStats {
  activeUsers: number;
  organizations: number;
  actionsToday: number;
  growthRate: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function LiveActivity() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    activeUsers: 0,
    organizations: 0,
    actionsToday: 0,
    growthRate: 0
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadActivities = async () => {
    try {
      setLoading(true);
      await ensureAccessToken();
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString()
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (actionFilter) params.append('action', actionFilter);
      
      const response = await apiGet<any>(
        `/superadmin/live-activity?${params.toString()}`,
        false
      );
      
      if (response?.success && response.data) {
        setActivities(response.data.activities || []);
        setStats(response.data.stats || {
          activeUsers: 0,
          organizations: 0,
          actionsToday: 0,
          growthRate: 0
        });
        setPagination(response.data.pagination || {
          page,
          limit: pageSize,
          total: 0,
          pages: 1
        });
        setSelectedActivityIds(new Set());
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Failed to load activities');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, [page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    void loadActivities();
  };

  const toggleActivitySelection = (activityId: string) => {
    const newSelected = new Set(selectedActivityIds);
    if (newSelected.has(activityId)) {
      newSelected.delete(activityId);
    } else {
      newSelected.add(activityId);
    }
    setSelectedActivityIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedActivityIds.size === activities.length) {
      setSelectedActivityIds(new Set());
    } else {
      setSelectedActivityIds(new Set(activities.map(a => a.id)));
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    setDeletingActivityId(activityId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingActivityId) return;
    
    setDeleting(true);
    try {
      await ensureAccessToken();
      const response = await apiDelete(`/superadmin/live-activity/${deletingActivityId}`);
      
      if (response?.success) {
        toast.success('Activity log deleted');
        setShowDeleteConfirm(false);
        setDeletingActivityId(null);
        await loadActivities();
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to delete activity';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedActivityIds.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedActivityIds.size === 0) return;
    
    setDeleting(true);
    try {
      await ensureAccessToken();
      const activityIds = Array.from(selectedActivityIds);
      const response = await apiPost<any>(
        `/superadmin/live-activity/bulk-delete`,
        { activityIds }
      );
      
      if (response?.success && response.data) {
        const { deleted, skipped } = response.data;
        toast.success(`${deleted} activities deleted${skipped > 0 ? `, ${skipped} skipped` : ''}`);
        setShowBulkDeleteConfirm(false);
        setSelectedActivityIds(new Set());
        await loadActivities();
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to delete activities';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Delete Activity Log</h2>
              <p className="text-muted-foreground mb-6">
                This will permanently delete this activity log record.
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingActivityId(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Delete Activity Logs</h2>
              <p className="text-muted-foreground mb-6">
                This will permanently delete {selectedActivityIds.size} activity log record(s).
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => void confirmBulkDelete()}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Live Activity</h1>
        <p className="text-muted-foreground">Real-time system activity monitoring</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeUsers}</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.organizations}</p>
              <p className="text-sm text-muted-foreground">Organizations</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.actionsToday}</p>
              <p className="text-sm text-muted-foreground">Actions Today</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.growthRate > 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Growth Rate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, action, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
          />
        </div>
        <Button 
          variant="outline" 
          className="rounded-xl"
          onClick={handleSearch}
          disabled={loading}
        >
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedActivityIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-medium">{selectedActivityIds.size} activities selected</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedActivityIds(new Set())}
              disabled={deleting}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Bulk Delete
            </Button>
          </div>
        </div>
      )}

      {/* Activities Table */}
      <Card className="rounded-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No activity found yet.</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedActivityIds.size === activities.length && activities.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">Action</th>
                    <th className="text-left p-4">Module</th>
                    <th className="text-left p-4">Time</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Severity</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id} className="border-b hover:bg-accent/50">
                      <td className="p-4 w-12">
                        <input
                          type="checkbox"
                          checked={selectedActivityIds.has(activity.id)}
                          onChange={() => toggleActivitySelection(activity.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-sm">{activity.userName}</p>
                          <p className="text-xs text-muted-foreground">{activity.userEmail}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {activity.action}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{activity.module}</td>
                      <td className="p-4 text-sm text-muted-foreground">{formatTime(activity.createdAt)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          activity.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {activity.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(activity.severity)}`}>
                          {activity.severity}
                        </span>
                      </td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteActivity(activity.id)}
                          disabled={loading || deleting}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((page - 1) * pageSize + 1, pagination.total)}-{Math.min(page * pageSize, pagination.total)} of {pagination.total} activities
                </div>
                <div className="flex items-center gap-4">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setPage(1);
                    }}
                    className="px-3 py-2 border rounded-lg bg-background text-sm"
                  >
                    <option value="10">10 per page</option>
                    <option value="15">15 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                  </select>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1 || loading}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm px-2 py-1">Page {page} of {pagination.pages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                      disabled={page >= pagination.pages || loading}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
