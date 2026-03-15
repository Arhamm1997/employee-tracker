import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import api from '../../lib/api';
import { Subscription, PaginatedResponse } from '../../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { CreditCard, Eye, XCircle, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const extendSchema = z.object({ days: z.number().int().min(1, 'Min 1 day') });
type ExtendFormData = z.infer<typeof extendSchema>;

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Subscription>>({
    queryKey: ['subscriptions', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const response = await api.get(`/admin/subscriptions?${params}`);
      return response.data.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/admin/subscriptions/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Subscription cancelled');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setCancellingId(null);
    },
    onError: () => toast.error('Failed to cancel subscription'),
  });

  const extendMutation = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const response = await api.post(`/admin/subscriptions/${id}/extend`, { days });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Subscription extended');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setExtendingId(null);
    },
    onError: () => toast.error('Failed to extend subscription'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExtendFormData>({
    resolver: zodResolver(extendSchema),
  });

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-500', active: 'bg-green-500',
      SUSPENDED: 'bg-yellow-500', suspended: 'bg-yellow-500',
      CANCELLED: 'bg-red-500', cancelled: 'bg-red-500',
    };
    return map[status] ?? 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 mt-1">Manage all customer subscriptions</p>
      </div>

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No subscriptions found"
            description="No subscriptions match your filters"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Plan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">MRR</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Expiry</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((sub) => (
                    <tr key={sub.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{sub.companyName}</td>
                      <td className="py-3 px-4 text-sm">{sub.planName}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${getStatusColor(sub.status)} text-white`}>
                          {sub.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">
                        PKR {sub.mrr.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {format(new Date(sub.currentPeriodEnd), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Link to={`/admin/customers/${sub.companyId}`}>
                            <Button variant="ghost" size="sm" title="View company">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Extend"
                            onClick={() => { setExtendingId(sub.id); reset(); }}
                          >
                            <CalendarPlus className="w-4 h-4 text-blue-500" />
                          </Button>
                          {sub.status !== 'CANCELLED' && sub.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cancel"
                              onClick={() => setCancellingId(sub.id)}
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * 20) + 1} – {Math.min(page * 20, data.total)} of {data.total}
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

      {/* Extend Dialog */}
      <Dialog open={!!extendingId} onOpenChange={() => setExtendingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Extend Subscription</DialogTitle></DialogHeader>
          <form
            onSubmit={handleSubmit(({ days }) => extendMutation.mutate({ id: extendingId!, days }))}
            className="space-y-4"
          >
            <div>
              <Label>Extend by (days)</Label>
              <Input {...register('days', { valueAsNumber: true })} type="number" placeholder="30" />
              {errors.days && <p className="text-sm text-red-500 mt-1">{errors.days.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={extendMutation.isPending}>
              {extendMutation.isPending ? 'Extending...' : 'Extend Subscription'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm Dialog */}
      <Dialog open={!!cancellingId} onOpenChange={() => setCancellingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Subscription</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to cancel this subscription? A cancellation email will be sent to the company.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCancellingId(null)} className="flex-1">Keep It</Button>
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate(cancellingId!)}
                disabled={cancelMutation.isPending}
                className="flex-1"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
