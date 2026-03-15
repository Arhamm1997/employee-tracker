import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import api from '../../lib/api';
import { SystemHealth } from '../../types';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Cpu, Database, Server, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function SystemHealthPage() {
  const { data: health, isLoading } = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await api.get('/admin/system/health');
      return response.data.data;
    },
    refetchInterval: 30000,
  });

  const { data: historical, isLoading: historicalLoading } = useQuery({
    queryKey: ['system-health-history'],
    queryFn: async () => {
      const response = await api.get('/admin/system/health/history?hours=24');
      return response.data.data;
    },
    refetchInterval: 60000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    return status === 'healthy' ? CheckCircle : AlertCircle;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 mt-1">Monitor system performance and status</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const cpuPercentage = health?.cpu.usage || 0;
  const memoryPercentage = health?.memory.percentage || 0;
  const dbConnPercentage = ((health?.database.connections || 0) / (health?.database.maxConnections || 1)) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500 mt-1">Monitor system performance and status</p>
        </div>
        <p className="text-sm text-gray-500">
          Last updated: {health ? format(new Date(health.lastUpdated), 'HH:mm:ss') : '-'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU Usage */}
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`${cpuPercentage > 80 ? 'bg-red-50' : 'bg-blue-50'} p-3 rounded-lg`}>
              <Cpu className={`w-6 h-6 ${cpuPercentage > 80 ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">CPU Usage</p>
              <p className="text-2xl font-bold">{cpuPercentage}%</p>
            </div>
          </div>
          <Progress value={cpuPercentage} className={`h-2 ${cpuPercentage > 80 ? 'bg-red-200' : ''}`} />
          <p className="text-xs text-gray-500 mt-2">{health?.cpu.cores} cores</p>
        </Card>

        {/* Memory Usage */}
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`${memoryPercentage > 80 ? 'bg-red-50' : 'bg-green-50'} p-3 rounded-lg`}>
              <Server className={`w-6 h-6 ${memoryPercentage > 80 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Memory Usage</p>
              <p className="text-2xl font-bold">{memoryPercentage}%</p>
            </div>
          </div>
          <Progress value={memoryPercentage} className={`h-2 ${memoryPercentage > 80 ? 'bg-red-200' : ''}`} />
          <p className="text-xs text-gray-500 mt-2">
            {(health?.memory.used || 0).toFixed(2)} GB / {(health?.memory.total || 0).toFixed(2)} GB
          </p>
        </Card>

        {/* Database Status */}
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`${getStatusColor(health?.database.status || 'down').replace('bg-', 'bg-').replace('500', '50')} p-3 rounded-lg`}>
              <Database className={`w-6 h-6 ${getStatusColor(health?.database.status || 'down').replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Database</p>
              <Badge className={`${getStatusColor(health?.database.status || 'down')} text-white mt-1`}>
                {health?.database.status}
              </Badge>
            </div>
          </div>
          <Progress value={dbConnPercentage} className="h-2" />
          <p className="text-xs text-gray-500 mt-2">
            {health?.database.connections} / {health?.database.maxConnections} connections
          </p>
        </Card>

        {/* API Status */}
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`${getStatusColor(health?.api.status || 'down').replace('bg-', 'bg-').replace('500', '50')} p-3 rounded-lg`}>
              <Activity className={`w-6 h-6 ${getStatusColor(health?.api.status || 'down').replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">API</p>
              <Badge className={`${getStatusColor(health?.api.status || 'down')} text-white mt-1`}>
                {health?.api.status}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Response Time: <span className="font-medium">{health?.api.responseTime}ms</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {health?.api.requestsPerMinute} req/min
          </p>
        </Card>
      </div>

      {/* Agent Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <p className="text-sm text-gray-600">Total Agents</p>
          <p className="text-3xl font-bold mt-2">{health?.agents.total || 0}</p>
        </Card>
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <p className="text-sm text-gray-600">Online Agents</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{health?.agents.online || 0}</p>
        </Card>
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <p className="text-sm text-gray-600">Offline Agents</p>
          <p className="text-3xl font-bold text-gray-600 mt-2">{health?.agents.offline || 0}</p>
        </Card>
      </div>

      {/* Historical Chart */}
      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold mb-6">System Performance (Last 24 Hours)</h2>
        {historicalLoading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historical}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} tickFormatter={(value) => format(new Date(value), 'HH:mm')} />
              <YAxis />
              <Tooltip labelFormatter={(value) => format(new Date(value), 'dd MMM HH:mm')} />
              <Legend />
              <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU %" />
              <Line type="monotone" dataKey="memory" stroke="#22c55e" name="Memory %" />
              <Line type="monotone" dataKey="responseTime" stroke="#eab308" name="API Response (ms)" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Actions */}
      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Need more details?</h3>
            <p className="text-sm text-gray-600 mt-1">Check error logs for system issues</p>
          </div>
          <Link to="/admin/logs/errors">
            <Button>View Error Logs</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
