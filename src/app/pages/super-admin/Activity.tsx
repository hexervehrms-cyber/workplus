import { Card } from '../../components/ui/card';
import { Activity, Users, Building2, TrendingUp } from 'lucide-react';

export default function LiveActivity() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live Activity</h1>
        <p className="text-muted-foreground">Real-time system activity monitoring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">1,234</p>
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
              <p className="text-2xl font-bold">45</p>
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
              <p className="text-2xl font-bold">892</p>
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
              <p className="text-2xl font-bold">+12%</p>
              <p className="text-sm text-muted-foreground">Growth Rate</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">User {i} performed action</p>
                <p className="text-sm text-muted-foreground">
                  {i === 1 ? 'Logged in' : 
                   i === 2 ? 'Created new organization' :
                   i === 3 ? 'Updated profile' :
                   i === 4 ? 'Submitted expense' : 'Generated report'}
                </p>
                <p className="text-xs text-muted-foreground">{i} minutes ago</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
