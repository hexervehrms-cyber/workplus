import { KPICard } from '../../components/KPICard';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { FeatureShowcase } from '../../components/FeatureShowcase';
import OnboardingLinkGenerator from '../../components/OnboardingLinkGenerator';
import DocumentGenerator from '../../components/DocumentGenerator';
import { useCurrency } from '../../context/CurrencyContext';
import { useState } from 'react';
import {
  DollarSign,
  Users,
  Activity,
  Zap,
  TrendingUp,
  Target,
  Award,
  XCircle,
  FileText
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const revenueData = [
  { month: 'Jan', revenue: 45000, users: 120 },
  { month: 'Feb', revenue: 52000, users: 145 },
  { month: 'Mar', revenue: 48000, users: 138 },
  { month: 'Apr', revenue: 61000, users: 167 },
  { month: 'May', revenue: 72000, users: 189 },
  { month: 'Jun', revenue: 85000, users: 215 },
];

const organizations = [
  { id: 1, name: 'TechCorp Solutions', users: 245, status: 'Active', plan: 'Enterprise', revenue: 24500 },
  { id: 2, name: 'Digital Innovations', users: 128, status: 'Active', plan: 'Pro', revenue: 12800 },
  { id: 3, name: 'StartupHub Inc', users: 67, status: 'Active', plan: 'Business', revenue: 6700 },
  { id: 4, name: 'CloudWorks Ltd', users: 189, status: 'Suspended', plan: 'Enterprise', revenue: 0 },
  { id: 5, name: 'DataDrive Corp', users: 98, status: 'Active', plan: 'Pro', revenue: 9800 },
];

const liveUsers = [
  { name: 'John Smith', org: 'TechCorp', status: 'Online', lastActive: 'Now' },
  { name: 'Sarah Johnson', org: 'Digital Innovations', status: 'Meeting', lastActive: '2m ago' },
  { name: 'Mike Chen', org: 'StartupHub', status: 'Break', lastActive: '5m ago' },
  { name: 'Emma Wilson', org: 'TechCorp', status: 'Online', lastActive: 'Now' },
  { name: 'Alex Brown', org: 'DataDrive', status: 'Offline', lastActive: '1h ago' },
];

export default function SuperAdminDashboard() {
  const { formatCurrency } = useCurrency();
  const [selectedTab, setSelectedTab] = useState('overview');

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Control Room</h1>
          <p className="text-muted-foreground">Global platform overview and management</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={() => window.location.href = '/admin/employee-onboarding'}
          >
            <FileText className="w-4 h-4 mr-2" />
            Employee Onboarding
          </Button>
          <Button className="rounded-xl">Add Organization</Button>
        </div>
      </div>

      {/* Welcome Banner */}
      <WelcomeBanner />

      {/* Feature Showcase */}
      <FeatureShowcase />

      {/* Onboarding Link Generator */}
      <OnboardingLinkGenerator isSuperAdmin={true} />

      {/* Document Generator */}
      <DocumentGenerator isSuperAdmin={true} />

      {/* Global Announcement Banner */}
      <Card className="p-4 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border-primary/20 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">System Status: All systems operational</p>
            <p className="text-sm text-muted-foreground">Last updated: 2 minutes ago</p>
          </div>
          <Badge variant="default" className="bg-secondary text-secondary-foreground">Live</Badge>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(362000)}
          change={12.5}
          icon={DollarSign}
          color="primary"
          onClick={() => console.log('Revenue clicked')}
        />
        <KPICard
          title="Tenant Organizations"
          value="156"
          change={8.3}
          icon={Users}
          color="secondary"
          onClick={() => console.log('Tenants clicked')}
        />
        <KPICard
          title="Active Users"
          value="8,547"
          change={15.2}
          icon={Activity}
          color="accent"
          onClick={() => console.log('Users clicked')}
        />
        <KPICard
          title="Live Sessions"
          value="1,234"
          change={-2.4}
          icon={Zap}
          color="destructive"
          onClick={() => console.log('Sessions clicked')}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Sales"
          value={formatCurrency(1200000)}
          change={18.7}
          icon={TrendingUp}
          color="secondary"
        />
        <KPICard
          title="Pipeline Value"
          value={formatCurrency(847000)}
          change={9.2}
          icon={Target}
          color="accent"
        />
        <KPICard
          title="Commission Paid"
          value={formatCurrency(124000)}
          change={5.8}
          icon={Award}
          color="primary"
        />
        <KPICard
          title="Churn Rate"
          value="2.3%"
          change={-0.5}
          icon={XCircle}
          color="destructive"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* User Growth */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">User Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Bar dataKey="users" fill="#22C55E" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Organizations</h3>
            <p className="text-sm text-muted-foreground">Manage tenant organizations</p>
          </div>
          <Button className="rounded-xl">Add Organization</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell>{org.users}</TableCell>
                <TableCell>
                  <Badge variant="outline">{org.plan}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={org.status === 'Active' ? 'default' : 'destructive'}>
                    {org.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatCurrency(org.revenue)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive">Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Live Activity Monitor */}
      <Card className="rounded-2xl">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Live Activity Monitor</h3>
          <p className="text-sm text-muted-foreground">Real-time user status</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {liveUsers.map((user, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-accent/50">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background
                      ${user.status === 'Online' ? 'bg-secondary' : 
                        user.status === 'Meeting' ? 'bg-accent' : 
                        user.status === 'Break' ? 'bg-amber-500' : 'bg-muted'}`}
                    />
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.org}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={user.status === 'Online' ? 'default' : 'secondary'}>
                    {user.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{user.lastActive}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}