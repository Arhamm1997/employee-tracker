import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { RevenueAnalytics, PlanDistribution } from '../../types';
import { Card } from '../components/ui/card';
import { StatCardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Repeat } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#ec4899'];

export default function Revenue() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['revenue-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/revenue/stats');
      return response.data.data;
    },
  });

  const { data: monthlyRevenue, isLoading: monthlyLoading } = useQuery<RevenueAnalytics[]>({
    queryKey: ['monthly-revenue'],
    queryFn: async () => {
      const response = await api.get('/admin/revenue/monthly?months=12');
      return response.data.data;
    },
  });

  const { data: planDistribution, isLoading: planLoading } = useQuery<PlanDistribution[]>({
    queryKey: ['plan-distribution'],
    queryFn: async () => {
      const response = await api.get('/admin/revenue/by-plan');
      return response.data.data;
    },
  });

  const statCards = [
    {
      title: 'All-Time Revenue',
      value: `PKR ${(stats?.allTime || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'This Month',
      value: `PKR ${(stats?.thisMonth || 0).toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Last Month',
      value: `PKR ${(stats?.lastMonth || 0).toLocaleString()}`,
      icon: TrendingDown,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Monthly Recurring Revenue',
      value: `PKR ${(stats?.mrr || 0).toLocaleString()}`,
      icon: Repeat,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Revenue</h1>
        <p className="text-gray-500 mt-1">Track revenue and financial metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          statCards.map((stat) => (
            <Card key={stat.title} className="p-6 bg-white rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Monthly Revenue (Last 12 Months)</h2>
          {monthlyLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip formatter={(value: number) => `PKR ${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                <Bar dataKey="mrr" fill="#22c55e" name="MRR" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-6">Revenue by Plan</h2>
          {planLoading ? (
            <ChartSkeleton />
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.planName}: ${entry.count}`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {planDistribution?.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `PKR ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {planDistribution?.map((plan, index) => (
                  <div key={plan.planName} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span>{plan.planName}</span>
                    </div>
                    <span className="font-medium">PKR {plan.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
