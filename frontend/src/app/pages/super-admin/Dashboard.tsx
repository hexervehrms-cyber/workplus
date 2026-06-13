import { KPICard } from '../../components/KPICard';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { FeatureShowcase } from '../../components/FeatureShowcase';
import OnboardingLinkGenerator from '../../components/OnboardingLinkGenerator';
import DocumentGenerator from '../../components/DocumentGenerator';
import ChatWidget from '../../components/ChatWidget';
import { useCurrency } from '../../context/CurrencyContext';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';
import { useNavigate } from 'react-router';
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
import { toast } from '../../utils/portalToast';

interface SuperAdminKpiChanges {
  revenueChange: number;
  organizationChange: number;
  userChange: number;
  sessionChange: number;
  expenseChange: number;
  pipelineChange: number;
  churnChange: number;
}

interface SuperAdminStatsPayload {
  totalRevenue?: number;
  totalOrganizations?: number;
  totalEmployees?: number;
  liveSessions?: number;
  totalSales?: number;
  pipelineValue?: number;
  commissionPaid?: number;
  churnRate?: number;
  kpiChanges?: SuperAdminKpiChanges;
}

interface GrowthTrendPoint {
  month: string;
  revenue?: number;
  users?: number;
}

interface OrganizationApiRow {
  _id: string;
  name?: string;
  employeeCount?: number;
  status?: string;
  subscriptionPlan?: string;
  monthlyRevenue?: number;
}

interface OrganizationRow {
  id: string;
  name: string;
  users: number;
  status: string;
  plan: string;
  revenue: number;
}

interface LiveUserRow {
  name: string;
  org: string;
  status: string;
  lastActive: string;
}

interface DashboardUpdateData {
  type: 'stats' | 'chart' | 'table' | 'activity';
  component: string;
  data: unknown;
  timestamp?: Date;
}

interface DashboardStatsState {
  totalRevenue: number;
  totalOrganizations: number;
  activeUsers: number;
  liveSessions: number;
  totalSales: number;
  pipelineValue: number;
  commissionPaid: number;
  churnRate: number;
  kpiChanges: SuperAdminKpiChanges;
}

export default function SuperAdminDashboard() {
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsState>({
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
      expenseChange: 0,
      pipelineChange: 0,
      churnChange: 0,
    }
  });
  const [revenueData, setRevenueData] = useState<GrowthTrendPoint[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [liveUsers, setLiveUsers] = useState<LiveUserRow[]>([]);
  const [showOnboardingGenerator, setShowOnboardingGenerator] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Real-time dashboard integration
  const { requestRefresh, isConnected } = useRealTimeDashboard({
    dashboardType: 'superadmin',
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    onUpdate: useCallback((data: DashboardUpdateData) => {
      console.log('Super Admin dashboard update:', data);
      setLastUpdated(new Date());
      
      // Handle different types of updates
      if (data.type === 'stats' && data.component === 'kpi') {
        setDashboardStats(prev => ({ ...prev, ...(data.data as Partial<DashboardStatsState>) }));
      } else if (data.type === 'chart' && data.component === 'growth') {
        setRevenueData(data.data as GrowthTrendPoint[]);
      } else if (data.type === 'table' && data.component === 'organizations') {
        setOrganizations(data.data as OrganizationRow[]);
      } else if (data.component === 'live_users') {
        setLiveUsers(data.data as LiveUserRow[]);
      }
    }, []),
    onActivity: useCallback((activity: unknown) => {
      console.log('New activity:', activity);
      // Could update activity feed here
    }, []),
    onError: useCallback((error: unknown) => {
      console.error('Real-time dashboard error:', error);
      // toast removed
    }, [])
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = async () => {
    setLastUpdated(new Date());
    await fetchDashboardData();
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setApiErrors({});

      // PHASE 5 OPTIMIZATION: Fetch summary first for quick KPI display
      const summaryResponse = await apiClient.get<{ success?: boolean; data?: Record<string, unknown> }>('/dashboard/superadmin/summary');
      if (summaryResponse.success && summaryResponse.data?.kpis) {
        const kpis = summaryResponse.data.kpis as Record<string, unknown>;
        setDashboardStats({
          totalRevenue: Number(kpis.monthlyRevenue) || 0,
          totalOrganizations: Number(kpis.totalOrganizations) || 0,
          activeUsers: Number(kpis.totalEmployees) || 0,
          liveSessions: Number(kpis.systemActivity) || 0,
          totalSales: 0,
          pipelineValue: 0,
          commissionPaid: 0,
          churnRate: 0,
          kpiChanges: {
            revenueChange: 0,
            organizationChange: 0,
            userChange: 0,
            sessionChange: 0,
            expenseChange: 0,
            pipelineChange: 0,
            churnChange: 0,
          },
        });
      }

      // PHASE 5 OPTIMIZATION: Lazy-load tables/charts after KPIs
      const [statsResponse, trendsResponse, orgsResponse, liveUsersResponse] = 
        await Promise.allSettled([
          apiClient.get<SuperAdminStatsPayload>('/dashboard/superadmin'),
          apiClient.get<GrowthTrendPoint[]>('/dashboard/superadmin/growth-trends'),
          apiClient.get<OrganizationApiRow[]>('/organizations?limit=10'),
          apiClient.get<LiveUserRow[]>('/dashboard/superadmin/live-users?limit=5'),
        ]);

      const newErrors: Record<string, string> = {};

      // Handle full stats response for additional metrics
      if (statsResponse.status === 'fulfilled' && statsResponse.value.success && statsResponse.value.data) {
        const stats = statsResponse.value.data;
        setDashboardStats(prev => ({
          ...prev,
          totalRevenue: stats.totalRevenue || prev.totalRevenue,
          totalOrganizations: stats.totalOrganizations || prev.totalOrganizations,
          activeUsers: stats.totalEmployees || prev.activeUsers,
          liveSessions: stats.liveSessions || prev.liveSessions,
          totalSales: stats.totalSales || 0,
          pipelineValue: stats.pipelineValue || 0,
          commissionPaid: stats.commissionPaid || 0,
          churnRate: stats.churnRate || 0,
          kpiChanges: {
            revenueChange: 0,
            organizationChange: 0,
            userChange: 0,
            sessionChange: 0,
            expenseChange: 0,
            pipelineChange: 0,
            churnChange: 0,
            ...(stats.kpiChanges || {}),
          },
        }));
      } else if (statsResponse.status === 'rejected') {
        newErrors['stats'] = 'Failed to load dashboard statistics';
        console.error('Dashboard stats API failed:', statsResponse.reason);
      }

      // Handle trends
      if (trendsResponse.status === 'fulfilled' && trendsResponse.value.success && trendsResponse.value.data) {
        setRevenueData(trendsResponse.value.data);
      } else if (trendsResponse.status === 'rejected') {
        newErrors['trends'] = 'Failed to load growth trends';
        console.error('Growth trends API failed:', trendsResponse.reason);
        setRevenueData([]);
      }

      // Handle organizations
      if (orgsResponse.status === 'fulfilled' && orgsResponse.value.success && orgsResponse.value.data) {
        const orgArray = Array.isArray(orgsResponse.value.data) ? orgsResponse.value.data : [];
        setOrganizations(orgArray.map((org) => ({
          id: org._id,
          name: org.name || 'Organization',
          users: org.employeeCount || 0,
          status: org.status || 'Active',
          plan: org.subscriptionPlan || 'free',
          revenue: org.monthlyRevenue || 0
        })));
      } else if (orgsResponse.status === 'rejected') {
        newErrors['orgs'] = 'Failed to load organizations';
        console.error('Organizations API failed:', orgsResponse.reason);
        setOrganizations([]);
      }

      // Handle live users
      if (liveUsersResponse.status === 'fulfilled' && liveUsersResponse.value.success && liveUsersResponse.value.data) {
        const usersArray = Array.isArray(liveUsersResponse.value.data) ? liveUsersResponse.value.data : [];
        setLiveUsers(usersArray);
      } else if (liveUsersResponse.status === 'rejected') {
        newErrors['liveUsers'] = 'Failed to load active users';
        console.error('Live users API failed:', liveUsersResponse.reason);
        setLiveUsers([]);
      }

      setApiErrors(newErrors);

    } catch (error: unknown) {
      console.error('Error fetching dashboard data:', error);
      setApiErrors({ summary: 'Failed to load dashboard' });
      
      // Set loading state to false but don't show fake data
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
          expenseChange: 0,
          pipelineChange: 0,
          churnChange: 0,
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
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading control room…</p>
      </div>
    );
  }

  return (
    <>
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
            onClick={handleRefresh}
            disabled={loading}
          >
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setShowOnboardingGenerator(true)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Onboarding Link
          </Button>
          <Button 
            className="rounded-xl"
            onClick={() => navigate('/super-admin/organizations')}
          >
            Add Organization
          </Button>
        </div>
      </div>

      {/* Welcome Banner */}
      <WelcomeBanner />

      {/* Feature Showcase */}
      <FeatureShowcase />

      <OnboardingLinkGenerator
        isOpen={showOnboardingGenerator}
        onClose={() => setShowOnboardingGenerator(false)}
        isSuperAdmin={true}
      />

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
          change={dashboardStats.kpiChanges.pipelineChange}
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
          change={dashboardStats.kpiChanges.churnChange}
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
    </>
  );
}
