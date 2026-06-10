import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FileText, Search, Filter, Download, Eye, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiGet } from '../../utils/apiHelper';

interface AuditLog {
  id: string;
  type: string;
  description: string;
  user: string;
  timestamp: string;
  severity: string;
  orgId?: string;
}

export default function AuditLogs() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<AuditLog[]>([]);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        const response = await apiGet<{ success?: boolean; data?: AuditLog[] }>(
          '/dashboard/superadmin/recent-activities?limit=50',
          false
        );

        if (response?.success !== false && Array.isArray(response?.data)) {
          setActivities(response.data);
        }
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, []);

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      'critical': 'bg-red-100 text-red-800',
      'high': 'bg-orange-100 text-orange-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">System audit trail and security logs</p>
        </div>
        <Button className="rounded-xl" disabled title="Export feature coming soon">
          <Download className="w-4 h-4 mr-2" />
          Export Logs
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search audit logs..."
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
            disabled
          />
        </div>
        <Button variant="outline" className="rounded-xl" disabled title="Filter coming soon">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <Card className="p-6 rounded-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : activities.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Timestamp</th>
                  <th className="text-left p-4">User</th>
                  <th className="text-left p-4">Action</th>
                  <th className="text-left p-4">Severity</th>
                  <th className="text-left p-4">Description</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id} className="border-b hover:bg-accent/50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-sm">{formatDate(activity.timestamp)}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-sm">{activity.user}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full uppercase">
                        {activity.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getSeverityBadge(activity.severity)}`}>
                        {activity.severity}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">
                      {activity.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
