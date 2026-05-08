import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Phone, Target, DollarSign, Award, AlertCircle } from 'lucide-react';

const SalesDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('authToken') || localStorage.getItem('token');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch today's metrics
      const metricsRes = await axios.get('/api/sales/performance/today', { headers });
      setMetrics(metricsRes.data.data);

      // Fetch leaderboard
      const leaderboardRes = await axios.get('/api/sales/performance/leaderboard/today', { headers });
      setLeaderboard(leaderboardRes.data.data || []);

      // Fetch monthly revenue
      const revenueRes = await axios.get('/api/sales/revenue/month', { headers });
      setRevenueData(revenueRes.data.data || []);

      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
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
            value={metrics?.leadsGenerated || 0}
            icon={Target}
            trend={-2}
            color="#F59E0B"
          />
          <KPICard
            title="Revenue Today"
            value={`$${(metrics?.revenueGenerated || 0).toLocaleString()}`}
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
                { stage: 'Leads', count: 150, color: '#3B82F6' },
                { stage: 'Contacted', count: 120, color: '#06B6D4' },
                { stage: 'Interested', count: 85, color: '#F59E0B' },
                { stage: 'Meetings', count: 45, color: '#8B5CF6' },
                { stage: 'Proposals', count: 25, color: '#10B981' },
                { stage: 'Closed', count: 12, color: '#EF4444' }
              ].map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-gray-700">{item.stage}</span>
                    <span className="text-gray-600">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(item.count / 150) * 100}%`,
                        backgroundColor: item.color
                      }}
                    ></div>
                  </div>
                </div>
              ))}
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
