import { Card } from '../../components/ui/card';
import { BarChart3, TrendingUp, Users, Building2, Activity, DollarSign } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';

export default function Analytics() {
  const { formatCurrency } = useCurrency();
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">System-wide analytics and insights</p>
      </div>

      <Card className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
        <p className="text-sm text-amber-900 dark:text-amber-100">
          <span className="font-semibold">Coming soon.</span> Live analytics from your
          organizations are not connected yet. The numbers and charts below are placeholders
          for layout preview only.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">12,345</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">456</p>
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
              <p className="text-2xl font-bold">89,012</p>
              <p className="text-sm text-muted-foreground">Total Actions</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(2400000)}</p>
              <p className="text-sm text-muted-foreground">Revenue</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">User Growth</h2>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="h-64 bg-accent/20 rounded-xl flex items-center justify-center">
            <p className="text-muted-foreground">Chart visualization here</p>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Revenue Trend</h2>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="h-64 bg-accent/20 rounded-xl flex items-center justify-center">
            <p className="text-muted-foreground">Chart visualization here</p>
          </div>
        </Card>
      </div>

      <Card className="p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Top Organizations</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Organization</th>
                <th className="text-left p-4">Users</th>
                <th className="text-left p-4">Actions</th>
                <th className="text-left p-4">Revenue</th>
                <th className="text-left p-4">Growth</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b hover:bg-accent/50">
                  <td className="p-4 font-medium">Organization {i}</td>
                  <td className="p-4">{100 + i * 50}</td>
                  <td className="p-4">{1000 + i * 200}</td>
                  <td className="p-4">{formatCurrency(i * 10000)}</td>
                  <td className="p-4">
                    <span className="text-green-600">+{i * 5}%</span>
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
