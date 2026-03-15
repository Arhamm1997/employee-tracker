import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Agent, PaginatedResponse } from '../../types';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { StatCardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Monitor, Circle, CircleOff, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function AgentsMonitor() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/agents/stats');
      return response.data.data;
    },
    refetchInterval: 30000,
  });

  const { data, isLoading } = useQuery<PaginatedResponse<Agent>>({
    queryKey: ['agents', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const response = await api.get(`/admin/agents?${params}`);
      return response.data.data;
    },
    refetchInterval: 30000,
  });

  const statCards = [
    { title: 'Total Agents', value: stats?.total || 0, icon: Monitor, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { title: 'Online', value: stats?.online || 0, icon: Circle, color: 'text-green-600', bgColor: 'bg-green-50' },
    { title: 'Offline', value: stats?.offline || 0, icon: CircleOff, color: 'text-gray-600', bgColor: 'bg-gray-50' },
    { title: 'Idle', value: stats?.idle || 0, icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-500';
      case 'idle':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Agents Monitor</h1>
        <p className="text-gray-500 mt-1">Real-time agent monitoring and status</p>
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

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Agents</TabsTrigger>
            <TabsTrigger value="online">Online</TabsTrigger>
            <TabsTrigger value="offline">Offline</TabsTrigger>
            <TabsTrigger value="idle">Idle</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <TableSkeleton />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No agents found"
            description="No agents match your filters"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Machine ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Employee</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Last Seen</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">IP Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Version</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">OS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((agent) => (
                    <tr key={agent.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono">{agent.machineId}</td>
                      <td className="py-3 px-4 text-sm">{agent.companyName}</td>
                      <td className="py-3 px-4 text-sm">{agent.employeeName}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}></div>
                          <Badge className={`${getStatusColor(agent.status)} text-white`}>
                            {agent.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{format(new Date(agent.lastSeen), 'dd MMM yyyy HH:mm')}</td>
                      <td className="py-3 px-4 text-sm font-mono">{agent.ipAddress}</td>
                      <td className="py-3 px-4 text-sm">{agent.version}</td>
                      <td className="py-3 px-4 text-sm">{agent.os}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total} results
              </p>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <button
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
