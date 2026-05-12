import { KPICard } from '../../components/KPICard';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { FeatureShowcase } from '../../components/FeatureShowcase';
import OnboardingLinkGenerator from '../../components/OnboardingLinkGenerator';
import DocumentGenerator from '../../components/DocumentGenerator';
import ChatWidget from '../../components/ChatWidget';
import { useCurrency } from '../../context/CurrencyContext';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';
import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Users,
  Activity,
  Zap,
  TrendingUp,
  Target,
  Award,
  XCircle,
  FileText,
  Loader2
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
import { apiClient } from '../../utils/api';
import { toast } from 'sonner';

export default function SuperAdminDashboard() {
  const { formatCurrency } = useCurrency();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    totalRevenue: 0,
    totalOrganizations: 0,
    activeUsers: 0,
    liveSessions: 0,
    totalSales: 0,
    pipelineValue: 0,
    commissionPaid: 0,
    churnRate: 0,
    kpiChanges: {
      revenueChange: 0,
      organizationChange: 0,
      userChange: 0,
      sessionChange: 0,
      expenseChange: 0
    }
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Real-time dashboard integration
  const { requestRefresh, isConnected } = useRealTimeDashboard({
    dashboardType: 'superadmin',
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    onUpdate: useCallback((data) => {
      console.log('Super Admin dashboard update:', data);
      setLastUpdated(new Date());
      
      // Handle different types of updates
      if (data.type === 'stats' && data.component === 'kpi') {
        setDashboardStats(prev => ({ ...prev, ...data.data }));
      } else if (data.type === 'chart' && data.component === 'growth') {
        setRevenueData(data.data);
      } else if (data.type === 'table' && data.component === 'organizations') {
        setOrganizations(data.data);
      } else if (data.component === 'live_users') {
        setLiveUsers(data.data);
      }
    }, []),
    onActivity: useCallback((activity) => {
      console.log('New activity:', activity);
      // Could update activity feed here
    }, []),
    onError: useCallback((error) => {
      console.error('Real-time dashboard error:', error);
      toast.error('Real-time connection error');
    }, [])
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch super admin dashboard stats
      const statsResponse = await apiClient.get('/dashboard/superadmin');
      if (statsResponse.data?.success && statsResponse.data?.data) {
        const stats = statsResponse.data.data;
        setDashboardStats({
          totalRevenue: stats.totalRevenue || 0,
          totalOrganizations: stats.totalOrganizations || 0,
          activeUsers: stats.totalEmployees || 0,
          liveSessions: stats.liveSessions || 0,
          totalSales: stats.totalSales || 0, // Use real sales data from API
          pipelineValue: stats.pipelineValue || 0, // Use real pipeline data from API
          commissionPaid: stats.commissionPaid || 0, // Use real commission data from API
          churnRate: stats.churnRate || 0,
          kpiChanges: stats.kpiChanges || {
            revenueChange: 0,
            organizationChange: 0,
            userChange: 0,
            sessionChange: 0,
            expenseChange: 0
          }
        });
      }

      // Fetch growth trends for charts
      const trendsResponse = await apiClient.get('/dashboard/superadmin/growth-trends');
      if (trendsResponse.data?.success && trendsResponse.data?.data) {
        setRevenueData(trendsResponse.data.data);
      }

      // Fetch organizations
      const orgsResponse = await apiClient.get('/organizations?limit=10');
      if (orgsResponse.data?.success && orgsResponse.data?.data) {
        setOrganizations(orgsResponse.data.data.map((org: any) => ({
          id: org._id,
          name: org.name || 'Organization',
          users: org.employeeCount || 0,
          status: org.status || 'Active',
          plan: org.subscriptionPlan || 'free',
          revenue: org.monthlyRevenue || 0
        })));
      }

      // Fetch live users
      const liveUsersResponse = await apiClient.get('/dashboard/superadmin/live-users?limit=5');
      if (liveUsersResponse.data?.success && liveUsersResponse.data?.data) {
        setLiveUsers(liveUsersResponse.data.data);
      }

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
      
      // Set loading state to false but don't show fake data
      // Let the UI show empty states or error states instead
      setDashboardStats({
        totalRevenue: 0,
        totalOrganizations: 0,
        activeUsers: 0,
        liveSessions: 0,
        totalSales: 0,
        pipelineValue: 0,
        commissionPaid: 0,
        churnRate: 0,
        kpiChanges: {
          revenueChange: 0,
          organizationChange: 0,
          userChange: 0,
          sessionChange: 0,
          expenseChange: 0
        }
      });
      
      setRevenueData([]);
      setOrganizations([]);
      setLiveUsers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    // Don't show loading spinner - let content load in background
    return null;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Control Room</h1>
          <p className="text-muted-foreground">
            Global platform overview and management
            {lastUpdated && (
              <span className="ml-2 text-xs">
                • Last updated: {lastUpdated.toLocaleTimeString()}
                {isConnected() && <span className="text-green-500 ml-1">● Live</span>}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={requestRefresh}
            disabled={loading}
          >
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
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
          value={formatCurrency(dashboardStats.totalRevenue)}
          change={dashboardStats.kpiChanges.revenueChange}
          icon={DollarSign}
          color="primary"
        />
        <KPICard
          title="Tenant Organizations"
          value={dashboardStats.totalOrganizations.toString()}
          change={dashboardStats.kpiChanges.organizationChange}
          icon={Users}
          color="secondary"
        />
        <KPICard
          title="Active Users"
          value={dashboardStats.activeUsers.toString()}
          change={dashboardStats.kpiChanges.userChange}
          icon={Activity}
          color="accent"
        />
        <KPICard
          title="Live Sessions"
          value={dashboardStats.liveSessions.toString()}
          change={dashboardStats.kpiChanges.sessionChange}
          icon={Zap}
          color="destructive"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Sales"
          value={formatCurrency(dashboardStats.totalSales)}
          change={dashboardStats.kpiChanges.expenseChange}
          icon={TrendingUp}
          color="secondary"
        />
        <KPICard
          title="Pipeline Value"
          value={formatCurrency(dashboardStats.pipelineValue)}
          change={0} // TODO: Calculate pipeline change
          icon={Target}
          color="accent"
        />
        <KPICard
          title="Commission Paid"
          value={formatCurrency(dashboardStats.commissionPaid)}
          change={dashboardStats.kpiChanges.revenueChange * 0.5} // Commission follows revenue
          icon={Award}
          color="primary"
        />
        <KPICard
          title="Churn Rate"
          value={`${dashboardStats.churnRate}%`}
          change={-0.5} // TODO: Calculate churn change
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
        {organizations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No organizations found</p>
          </div>
        ) : (
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
        )}
      </Card>

      {/* Live Activity Monitor */}
      <Card className="rounded-2xl">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Live Activity Monitor</h3>
          <p className="text-sm text-muted-foreground">Real-time user status</p>
        </div>
        <div className="p-6">
          {liveUsers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active users</p>
            </div>
          ) : (
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
          )}
        </div>
      </Card>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}