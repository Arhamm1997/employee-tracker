import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { AuditLog, PaginatedResponse, Customer } from '../../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ScrollText, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditLogs() {
  const [companyFilter, setCompanyFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit-logs', companyFilter, actionFilter, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50',
        ...(companyFilter !== 'all' && { customerId: companyFilter }),
        ...(actionFilter !== 'all' && { action: actionFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });
      const response = await api.get(`/admin/logs/audit?${params}`);
      return response.data.data;
    },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const response = await api.get('/admin/customers?pageSize=1000');
      return response.data.data.data;
    },
  });

  const handleExportCSV = () => {
    if (!data?.data) return;
    
    const headers = ['Timestamp', 'Admin', 'Action', 'Resource', 'Company', 'IP Address'];
    const rows = data.data.map(log => [
      format(new Date(log.timestamp), 'dd MMM yyyy HH:mm'),
      log.adminName,
      log.action,
      log.resource,
      log.companyName || 'N/A',
      log.ipAddress,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actionTypes = [
    'create',
    'update',
    'delete',
    'login',
    'logout',
    'assign',
    'suspend',
    'activate',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">Track all admin actions and changes</p>
        </div>
        <Button onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <Label>Company</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Action</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No audit logs found"
            description="No logs match your filters"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Timestamp</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Admin</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Resource</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Resource ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm')}
                      </td>
                      <td className="py-3 px-4 text-sm">{log.adminName}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{log.resource}</td>
                      <td className="py-3 px-4 text-sm font-mono text-xs">
                        {log.resourceId ? log.resourceId.slice(0, 12) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm">{log.companyName || '-'}</td>
                      <td className="py-3 px-4 text-sm font-mono">{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.total)} of {data.total} results
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
