import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FileText, Search, Filter, Download, Eye } from 'lucide-react';

export default function AuditLogs() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">System audit trail and security logs</p>
        </div>
        <Button className="rounded-xl" disabled title="Available when audit API is connected">
          <Download className="w-4 h-4 mr-2" />
          Export Logs
        </Button>
      </div>

      <Card className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
        <p className="text-sm text-amber-900 dark:text-amber-100">
          <span className="font-semibold">Coming soon.</span> Real audit log search and export
          are not connected yet. The table below shows sample rows for UI preview only.
        </p>
      </Card>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search audit logs..."
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
            disabled
            aria-disabled
          />
        </div>
        <Button variant="outline" className="rounded-xl" disabled title="Coming soon">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <Card className="p-6 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Timestamp</th>
                <th className="text-left p-4">User</th>
                <th className="text-left p-4">Action</th>
                <th className="text-left p-4">Resource</th>
                <th className="text-left p-4">IP Address</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <tr key={i} className="border-b hover:bg-accent/50">
                  <td className="p-4">
                    <div>
                      <p className="font-medium">2024-01-{String(15 - i).padStart(2, '0')}</p>
                      <p className="text-sm text-muted-foreground">14:3{i}:00</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">U{i}</span>
                      </div>
                      <div>
                        <p className="font-medium">User {i}</p>
                        <p className="text-sm text-muted-foreground">user{i}@example.com</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {i === 1 ? 'CREATE' :
                       i === 2 ? 'UPDATE' :
                       i === 3 ? 'DELETE' :
                       i === 4 ? 'LOGIN' :
                       i === 5 ? 'LOGOUT' :
                       i === 6 ? 'VIEW' :
                       i === 7 ? 'EXPORT' : 'MODIFY'}
                    </span>
                  </td>
                  <td className="p-4">
                    {i === 1 ? 'Organization' :
                     i === 2 ? 'User Profile' :
                     i === 3 ? 'Expense Report' :
                     i === 4 ? 'System' :
                     i === 5 ? 'System' :
                     i === 6 ? 'Analytics' :
                     i === 7 ? 'Audit Logs' : 'Settings'}
                  </td>
                  <td className="p-4">192.168.1.{100 + i}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      i % 2 === 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {i % 2 === 0 ? 'Success' : 'Warning'}
                    </span>
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
