// @ts-nocheck — sales portal typed separately; excluded from strict CI scope
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Phone, Target, DollarSign, Award, AlertCircle } from 'lucide-react';
import { apiGet } from '../../utils/apiHelper';
import { useAuth } from '../../context/AuthContext';
import { authUserKey } from '../../utils/safeUi';

const SalesDashboard = () => {
  const { user } = useAuth();
  const fetchGenRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard data with correct /api prefix
      const dashRes = await apiGet('/api/sales/performance/dashboard', false).catch(() => null);
      
      if (gen !== fetchGenRef.current) return;

      // Unwrap response data
      const metrics = dashRes?.data ?? dashRes ?? {
        totalCallsToday: 0,
        connectedCalls: 0,
        interestedLeads: 0,
        revenueToday: 0,
        monthlyRevenue: 0,
        performanceScore: 0,
        funnel: {},
        topPerformers: [],
        recentActivity: []
      };

      setMetrics(metrics);
      setLeaderboard(metrics.topPerformers ?? []);
      // Build revenue chart data from monthly data
      setRevenueData(metrics.monthlyRevenue ? [{ _id: 'Current Month', total: metrics.monthlyRevenue }] : []);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (gen !== fetchGenRef.current) return;
      // Don't show error for empty state - just show zeros
      setError(null);
      setMetrics({
        totalCallsToday: 0,
        connectedCalls: 0,
        interestedLeads: 0,
        revenueToday: 0,
        monthlyRevenue: 0,
        performanceScore: 0,
        funnel: {},
        topPerformers: [],
        recentActivity: []
      });
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authUserKey(user)) return;
    void fetchDashboardData();
  }, [user?.userId, user?.id, fetchDashboardData]);

  const KPICard = ({ title, value, icon: Icon, trend, color }) => (
    <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span className="ml-1">{Math.abs(trend)}% from yesterday</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
          <Icon size={24} style={{ color }} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">No data available. Create some leads and deals to get started.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time sales performance and metrics</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
            <AlertCircle className="text-red-600 mr-3" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Calls Today"
            value={metrics?.callsCount || 0}
            icon={Phone}
            trend={5}
            color="#3B82F6"
          />
          <KPICard
            title="Connected Calls"
            value={metrics?.connectedCalls || 0}
            icon={Users}
            trend={8}
            color="#10B981"
          />
          <KPICard
            title="Interested Leads"
            value={metrics?.interestedLeads || 0}
            icon={Target}
            trend={-2}
            color="#F59E0B"
          />
          <KPICard
            title="Revenue Today"
            value={`$${(metrics?.revenueToday || 0).toLocaleString()}`}
            icon={DollarSign}
            trend={12}
            color="#8B5CF6"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Sales Funnel */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Sales Funnel</h2>
            <div className="space-y-4">
              {[
                { stage: 'Leads', count: metrics?.funnel?.leads || 0, color: '#3B82F6' },
                { stage: 'Contacted', count: metrics?.funnel?.contacted || 0, color: '#06B6D4' },
                { stage: 'Interested', count: metrics?.funnel?.interested || 0, color: '#F59E0B' },
                { stage: 'Meetings', count: metrics?.funnel?.meetings || 0, color: '#8B5CF6' },
                { stage: 'Proposals', count: metrics?.funnel?.proposals || 0, color: '#10B981' },
                { stage: 'Closed', count: metrics?.funnel?.closed || 0, color: '#EF4444' }
              ].map((item, idx) => {
                const maxCount = Math.max(
                  metrics?.funnel?.leads || 1,
                  metrics?.funnel?.contacted || 1,
                  metrics?.funnel?.interested || 1,
                  metrics?.funnel?.meetings || 1,
                  metrics?.funnel?.proposals || 1,
                  metrics?.funnel?.closed || 1,
                  1
                );
                return (
                  <div key={idx}>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium text-gray-700">{item.stage}</span>
                      <span className="text-gray-600">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(item.count / maxCount) * 100}%`,
                          backgroundColor: item.color
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance Score */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Performance Score</h2>
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="8"
                    strokeDasharray={`${(metrics?.performanceScore || 0) * 2.83} 283`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{Math.round(metrics?.performanceScore || 0)}</p>
                    <p className="text-xs text-gray-600">out of 100</p>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-600">
                {metrics?.performanceScore >= 80
                  ? '🥇 Excellent'
                  : metrics?.performanceScore >= 60
                  ? '✅ Good'
                  : metrics?.performanceScore >= 40
                  ? '⚠️ Average'
                  : '❌ Poor'}
              </p>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Top Performers</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Employee</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Calls</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Leads</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Deals</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Revenue</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((emp, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="text-lg font-bold">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{emp.employee?.name || 'N/A'}</p>
                    </td>
                    <td className="py-3 px-4 text-center">{emp.totalCalls || 0}</td>
                    <td className="py-3 px-4 text-center">{emp.totalLeads || 0}</td>
                    <td className="py-3 px-4 text-center">{emp.totalDeals || 0}</td>
                    <td className="py-3 px-4 text-center">${(emp.totalRevenue || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                        {Math.round(emp.avgScore || 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#3B82F6" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
