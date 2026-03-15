import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import api from '../../lib/api';
import { DashboardStats, Customer, ErrorLog, SystemHealth, SignupAnalytics } from '../../types';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { StatCardSkeleton, TableSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, UserCheck, UserCog, DollarSign, Monitor, Circle, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444'];

export default function Dashboard() {
  const [refreshInterval, setRefreshInterval] = useState(60000);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/stats');
      return response.data.data;
    },
    refetchInterval: refreshInterval,
  });

  // Fetch signup analytics
  const { data: signupData, isLoading: signupLoading } = useQuery<SignupAnalytics[]>({
    queryKey: ['signup-analytics'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/signups?days=30');
      return response.data.data;
    },
  });

  // Fetch subscription status distribution
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/subscription-status');
      return response.data.data;
    },
  });

  // Fetch recent customers
  const { data: recentCustomers, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ['recent-customers'],
    queryFn: async () => {
      const response = await api.get('/admin/customers?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc');
      return response.data.data.data;
    },
  });

  // Fetch system health
  const { data: systemHealth, isLoading: healthLoading } = useQuery<SystemHealth>({
    queryKey: ['system-health-mini'],
    queryFn: async () => {
      const response = await api.get('/admin/system/health');
      return response.data.data;
    },
    refetchInterval: 60000,
  });

  // Fetch recent error logs
  const { data: errorLogs, isLoading: logsLoading } = useQuery<ErrorLog[]>({
    queryKey: ['recent-errors'],
    queryFn: async () => {
      const response = await api.get('/admin/logs/errors?page=1&pageSize=5');
      return response.data.data.data;
    },
  });

  const statCards = [
    {
      title: 'Total Customers',
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Customers',
      value: stats?.activeCustomers || 0,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Trial Customers',
      value: stats?.trialCustomers || 0,
      icon: UserCog,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Monthly Recurring Revenue',
      value: `PKR ${(stats?.mrr || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Total Agents',
      value: stats?.totalAgents || 0,
      icon: Monitor,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Online Agents',
      value: stats?.onlineAgents || 0,
      icon: Circle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'trial':
        return 'bg-blue-500';
      case 'suspended':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'info':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome to StaffTrack Master Admin</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          statCards.map((stat) => (
            <Card key={stat.title} className="p-6 bg-white rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signup Trend */}
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Signups (Last 30 Days)</h2>
          </div>
          {signupLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={signupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Subscription Status Distribution */}
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Subscription Status</h2>
          {statusLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData?.map((_: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent Customers and System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Customers */}
        <Card className="lg:col-span-2 p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Recent Customers</h2>
            <Link to="/admin/customers" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {customersLoading ? (
            <TableSkeleton rows={5} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Plan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCustomers?.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{customer.companyName}</p>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{customer.planName}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${getStatusColor(customer.status)} text-white`}>
                          {customer.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {format(new Date(customer.joinedAt), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* System Health Mini Panel */}
        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold">System Health</h2>
            </div>
            {healthLoading ? (
              <StatCardSkeleton />
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU Usage</span>
                    <span className="font-medium">{systemHealth?.cpu.usage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (systemHealth?.cpu.usage || 0) > 80 ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${systemHealth?.cpu.usage}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Memory Usage</span>
                    <span className="font-medium">{systemHealth?.memory.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (systemHealth?.memory.percentage || 0) > 80 ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${systemHealth?.memory.percentage}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-gray-600">Database</span>
                  <Badge className={systemHealth?.database.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}>
                    {systemHealth?.database.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API</span>
                  <Badge className={systemHealth?.api.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}>
                    {systemHealth?.api.status}
                  </Badge>
                </div>
                <Link to="/admin/system-health" className="block text-center text-sm text-blue-600 hover:underline pt-2">
                  View Details
                </Link>
              </div>
            )}
          </Card>

          {/* Recent Errors */}
          <Card className="p-6 bg-white rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold">Recent Errors</h2>
            </div>
            {logsLoading ? (
              <TableSkeleton rows={3} />
            ) : (
              <div className="space-y-3">
                {errorLogs?.slice(0, 5).map((log) => (
                  <div key={log.id} className="text-sm">
                    <div className="flex items-start gap-2">
                      <Badge className={`${getSeverityColor(log.severity)} text-white text-xs`}>
                        {log.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 truncate">{log.message}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(log.timestamp), 'dd MMM HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <Link to="/admin/logs/errors" className="block text-center text-sm text-blue-600 hover:underline pt-2">
                  View All Errors
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
