import { Card } from '../../components/ui/card';
import { BarChart3, TrendingUp, Users, Building2, Activity, DollarSign, Loader2 } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useState, useEffect } from 'react';
import { apiGet } from '../../utils/apiHelper';
import { Loader } from 'lucide-react';

interface DashboardData {
  totalOrganizations: number;
  totalAdmins: number;
  totalEmployees: number;
  activeUsersToday: number;
  monthlyRevenue: number;
}

interface Organization {
  name: string;
  _id: string;
  employeeCount: number;
  monthlyRevenue: number;
}

export default function Analytics() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [dashboardRes, orgsRes] = await Promise.all([
          apiGet<{ success?: boolean; data?: DashboardData }>('/dashboard/superadmin', false),
          apiGet<{ success?: boolean; data?: Organization[] }>('/dashboard/superadmin/organizations', false),
        ]);

        if (dashboardRes?.success !== false && dashboardRes?.data) {
          setDashboardData(dashboardRes.data);
        }
        
        if (orgsRes?.success !== false && Array.isArray(orgsRes?.data)) {
          setOrganizations(orgsRes.data.slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">System-wide analytics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dashboardData?.totalAdmins ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Admins</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dashboardData?.totalOrganizations ?? 0}</p>
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
              <p className="text-2xl font-bold">{dashboardData?.totalEmployees ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Employees</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(dashboardData?.monthlyRevenue ?? 0)}</p>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
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
                <th className="text-left p-4">Employees</th>
                <th className="text-left p-4">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {organizations.length > 0 ? (
                organizations.map((org) => (
                  <tr key={org._id} className="border-b hover:bg-accent/50">
                    <td className="p-4 font-medium">{org.name}</td>
                    <td className="p-4">{org.employeeCount ?? 0}</td>
                    <td className="p-4">{formatCurrency(org.monthlyRevenue ?? 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    No organizations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
