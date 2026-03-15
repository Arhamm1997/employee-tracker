import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { SignupAnalytics, RevenueAnalytics, ChurnAnalytics, PlanDistribution, TopCustomer } from '../../types';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ChartSkeleton } from '../components/LoadingSkeleton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, DollarSign, Users, UserX } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7'];

export default function Analytics() {
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: growthData, isLoading: growthLoading } = useQuery<SignupAnalytics[]>({
    queryKey: ['analytics-growth', startDate, endDate],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/growth?startDate=${startDate}&endDate=${endDate}`);
      return response.data.data;
    },
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueAnalytics[]>({
    queryKey: ['analytics-revenue', startDate, endDate],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/revenue?startDate=${startDate}&endDate=${endDate}`);
      return response.data.data;
    },
  });

  const { data: churnData, isLoading: churnLoading } = useQuery<ChurnAnalytics[]>({
    queryKey: ['analytics-churn', startDate, endDate],
    queryFn: async () => {
      const response = await api.get(`/admin/analytics/churn?startDate=${startDate}&endDate=${endDate}`);
      return response.data.data;
    },
  });

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['analytics-status'],
    queryFn: async () => {
      const response = await api.get('/admin/analytics/status-distribution');
      return response.data.data;
    },
  });

  const { data: planData, isLoading: planLoading } = useQuery<PlanDistribution[]>({
    queryKey: ['analytics-plans'],
    queryFn: async () => {
      const response = await api.get('/admin/analytics/plan-distribution');
      return response.data.data;
    },
  });

  const { data: topCustomers, isLoading: topLoading } = useQuery<TopCustomer[]>({
    queryKey: ['analytics-top-customers'],
    queryFn: async () => {
      const response = await api.get('/admin/analytics/top-customers?limit=10');
      return response.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Comprehensive business analytics and insights</p>
      </div>

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Customer Growth</h2>
          </div>
          {growthLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Signups" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">Revenue Trend</h2>
          </div>
          {revenueLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip formatter={(value: number) => `PKR ${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <UserX className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold">Churn Rate</h2>
          </div>
          {churnLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={churnData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="churned" fill="#ef4444" name="Churned Customers" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Status Distribution</h2>
          </div>
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

        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Plan Distribution</h2>
          {planLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={planData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="planName" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#a855f7" name="Customers" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Top Customers by MRR</h2>
          {topLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">MRR</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Agents</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers?.map((customer, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-2 text-sm">{customer.companyName}</td>
                      <td className="py-2 px-2 text-sm font-medium">PKR {customer.mrr.toLocaleString()}</td>
                      <td className="py-2 px-2 text-sm">{customer.agentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
