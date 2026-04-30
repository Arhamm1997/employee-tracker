import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { ErrorLog, PaginatedResponse, Customer } from '../../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function ErrorLogs() {
  const [companyFilter, setCompanyFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery<PaginatedResponse<ErrorLog>>({
    queryKey: ['error-logs', companyFilter, severityFilter, sourceFilter, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(companyFilter !== 'all' && { customerId: companyFilter }),
        ...(severityFilter !== 'all' && { severity: severityFilter }),
        ...(sourceFilter !== 'all' && { source: sourceFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });
      const response = await api.get(`/admin/logs/errors?${params}`);
      return response.data.data;
    },
    refetchInterval: 30000,
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

    const headers = ['Timestamp', 'Company', 'Source', 'Severity', 'Message'];
    const rows = data.data.map(log => [
      format(new Date(log.timestamp), 'dd MMM yyyy HH:mm'),
      log.companyName || 'N/A',
      log.source,
      log.severity,
      log.message.replace(/,/g, ';'),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadText = () => {
    if (!data?.data) return;
    const lines = data.data.map(log => {
      const ts = format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss');
      const stack = log.stackTrace ? `\n  Stack: ${log.stackTrace.split('\n').join('\n    ')}` : '';
      return `[${ts}] [${log.severity.toUpperCase()}] [${log.source}]${log.companyName ? ` [${log.companyName}]` : ''}\n  ${log.message}${stack}`;
    });
    const text = `Employee Monitor - Error Report\nGenerated: ${format(new Date(), 'dd MMM yyyy HH:mm:ss')}\nTotal: ${data.data.length} entries\n${'='.repeat(80)}\n\n${lines.join('\n\n' + '─'.repeat(60) + '\n\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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

  const criticalErrors = data?.data.filter(log => log.severity === 'error').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Error Logs</h1>
          <p className="text-gray-500 mt-1">Monitor system and agent errors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleDownloadText}>
            <Download className="w-4 h-4 mr-2" />
            Download .txt
          </Button>
          <Button onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {criticalErrors > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Critical Errors Detected</p>
              <p className="text-sm text-red-700">{criticalErrors} critical error(s) in the current view</p>
            </div>
          </div>
        </div>
      )}

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
            <Label>Severity</Label>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Source</Label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="server">Server</SelectItem>
                <SelectItem value="api">API</SelectItem>
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
            icon={AlertCircle}
            title="No error logs found"
            description="No errors match your filters"
          />
        ) : (
          <>
            <div className="space-y-3">
              {data.data.map((log) => (
                <div key={log.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Badge className={`${getSeverityColor(log.severity)} text-white`}>
                      {log.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{log.source}</span>
                          {log.companyName && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm text-gray-600">{log.companyName}</span>
                            </>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mb-2">{log.message}</p>
                      {log.stackTrace && (
                        <details className="text-xs text-gray-600 bg-gray-50 p-3 rounded mt-2">
                          <summary className="cursor-pointer font-medium">Stack Trace</summary>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{log.stackTrace}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total} results
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
