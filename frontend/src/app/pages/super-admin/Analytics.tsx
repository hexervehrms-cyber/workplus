import { Card } from '../../components/ui/card';
import { BarChart3, TrendingUp, Users, Building2, Activity, DollarSign, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/apiHelper';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Input } from '../../components/ui/input';

interface KPIs {
  totalOrganizations: number;
  totalAdmins: number;
  totalEmployees: number;
  monthlyRevenue: number;
}

interface Organization {
  _id: string;
  name: string;
  code: string;
  email: string;
  employeeCount: number;
  adminCount: number;
  monthlyRevenue: number;
  status: string;
  createdAt: string;
}

interface AnalyticsResponse {
  success: boolean;
  data: {
    kpis: KPIs;
    topOrganizations: Organization[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

interface OrgListResponse {
  success: boolean;
  data: Organization[];
}

export default function Analytics() {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  
  // Filters
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrgs, setTotalOrgs] = useState(0);

  // Fetch organizations for dropdown
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const result = await apiRequest<OrgListResponse>('/organizations?limit=100');
        if (result?.success && Array.isArray(result.data)) {
          setAllOrganizations(result.data);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      }
    };

    fetchOrganizations();
  }, []);

  // Fetch analytics data
  const fetchAnalytics = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize);
      if (selectedOrgId) {
        params.append('orgId', selectedOrgId);
      }
      if (search) {
        params.append('search', search);
      }

      const result = await apiRequest<AnalyticsResponse>(
        `/dashboard/superadmin/analytics?${params.toString()}`
      );

      if (result?.success && result.data) {
        setKpis(result.data.kpis);
        setOrganizations(result.data.topOrganizations);
        setTotalPages(result.data.pagination.pages);
        setTotalOrgs(result.data.pagination.total);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOrgId, search, pageSize]);

  useEffect(() => {
    fetchAnalytics(currentPage);
  }, [selectedOrgId, search, pageSize, currentPage]);

  const handleRefresh = () => {
    setCurrentPage(1);
    fetchAnalytics(1);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const startRow = (currentPage - 1) * parseInt(pageSize) + 1;
  const endRow = Math.min(currentPage * parseInt(pageSize), totalOrgs);

  if (loading && !kpis) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">System-wide analytics and insights</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Organization Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Organization</label>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All organizations</SelectItem>
                {allOrganizations.map((org) => (
                  <SelectItem key={org._id} value={org._id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Filter */}
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Rows Per Page */}
          <div>
            <label className="text-sm font-medium mb-2 block">Rows per page</label>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Info */}
          <div className="flex items-end">
            <div className="text-sm text-muted-foreground">
              Showing {totalOrgs > 0 ? startRow : 0}-{endRow} of {totalOrgs}
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis?.totalAdmins ?? 0}</p>
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
              <p className="text-2xl font-bold">{kpis?.totalOrganizations ?? 0}</p>
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
              <p className="text-2xl font-bold">{kpis?.totalEmployees ?? 0}</p>
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
              <p className="text-2xl font-bold">{formatCurrency(kpis?.monthlyRevenue ?? 0)}</p>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Organizations Table */}
      <Card className="p-6 rounded-xl">
        <h2 className="text-xl font-semibold mb-4">Top Organizations</h2>
        {organizations.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">Organization</th>
                    <th className="text-left p-4">Code</th>
                    <th className="text-center p-4">Admins</th>
                    <th className="text-center p-4">Employees</th>
                    <th className="text-right p-4">Monthly Revenue</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => (
                    <tr key={org._id} className="border-b hover:bg-accent/50">
                      <td className="p-4 font-medium">{org.name}</td>
                      <td className="p-4 text-sm text-muted-foreground">{org.code}</td>
                      <td className="p-4 text-center">{org.adminCount}</td>
                      <td className="p-4 text-center">{org.employeeCount}</td>
                      <td className="p-4 text-right">{formatCurrency(org.monthlyRevenue)}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          org.status === 'Active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {org.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentPage === 1}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  className="gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-muted-foreground">
              {loading ? 'Loading organizations...' : 'No organizations found'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
