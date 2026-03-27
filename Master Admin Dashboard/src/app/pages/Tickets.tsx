import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Ticket, PaginatedResponse, Admin, TicketReply } from '../../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Ticket as TicketIcon, Eye, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const replySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  isInternal: z.boolean().default(false),
});

type ReplyFormData = z.infer<typeof replySchema>;

export default function Tickets() {
  const queryClient = useQueryClient();
  const admin = useAuthStore((state) => state.admin);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Ticket>>({
    queryKey: ['tickets', priorityFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const response = await api.get(`/admin/tickets?${params}`);
      return response.data.data;
    },
  });

  const { data: adminUsers } = useQuery<Admin[]>({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const response = await api.get('/admin/users');
      return response.data.data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ ticketId, adminId }: { ticketId: string; adminId: string }) => {
      const response = await api.post(`/admin/tickets/${ticketId}/assign`, { adminId });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Ticket assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: () => {
      toast.error('Failed to assign ticket');
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: string; data: ReplyFormData }) => {
      const response = await api.post(`/admin/tickets/${ticketId}/reply`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reply sent successfully');
      queryClient.invalidateQueries({ queryKey: ['ticket', viewingTicket?.id] });
      reset();
    },
    onError: () => {
      toast.error('Failed to send reply');
    },
  });

  const { data: ticketDetail } = useQuery<Ticket>({
    queryKey: ['ticket', viewingTicket?.id],
    queryFn: async () => {
      const response = await api.get(`/admin/tickets/${viewingTicket?.id}`);
      return response.data.data;
    },
    enabled: !!viewingTicket,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: { message: '', isInternal: false },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const response = await api.patch(`/admin/tickets/${ticketId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', viewingTicket?.id] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const handleReply = (data: ReplyFormData) => {
    if (viewingTicket) {
      replyMutation.mutate({ ticketId: viewingTicket.id, data });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500';
      case 'in_progress':
        return 'bg-yellow-500';
      case 'resolved':
        return 'bg-green-500';
      case 'closed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-gray-500 mt-1">Manage customer support requests</p>
      </div>

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={TicketIcon}
            title="No tickets found"
            description="No tickets match your filters"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Subject</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Priority</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Assigned To</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ticket) => (
                    <tr key={ticket.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono">#{ticket.id.slice(0, 8)}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{ticket.subject}</p>
                      </td>
                      <td className="py-3 px-4 text-sm">{ticket.companyName}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${getPriorityColor(ticket.priority)} text-white`}>
                          {ticket.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${getStatusColor(ticket.status)} text-white`}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <Select
                          value={ticket.assignedTo || 'unassigned'}
                          onValueChange={(value) => assignMutation.mutate({ ticketId: ticket.id, adminId: value })}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue placeholder="Assign" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {adminUsers?.map((adminUser) => (
                              <SelectItem key={adminUser.id} value={adminUser.id}>
                                {adminUser.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4 text-sm">{format(new Date(ticket.createdAt), 'dd MMM yyyy')}</td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="sm" onClick={() => setViewingTicket(ticket)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
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

      {/* Ticket Detail Modal */}
      <Dialog open={!!viewingTicket} onOpenChange={() => setViewingTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket #{viewingTicket?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {ticketDetail && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Company</p>
                  <p className="font-medium">{ticketDetail.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(ticketDetail.status)} text-white`}>
                      {ticketDetail.status.replace('_', ' ')}
                    </Badge>
                    <Select
                      value={ticketDetail.status}
                      onValueChange={(s) => statusMutation.mutate({ ticketId: ticketDetail.id, status: s })}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <RefreshCw className="w-3 h-3 mr-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Priority</p>
                  <Badge className={`${getPriorityColor(ticketDetail.priority)} text-white`}>
                    {ticketDetail.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-medium">{format(new Date(ticketDetail.createdAt), 'dd MMM yyyy HH:mm')}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Subject</p>
                <p className="font-medium text-lg">{ticketDetail.subject}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Description</p>
                <p className="text-gray-900">{ticketDetail.description}</p>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-4">Conversation ({ticketDetail.replies.length})</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {ticketDetail.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`p-4 rounded-lg ${reply.adminId ? 'bg-blue-50 ml-8' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {reply.adminName || 'Customer'}
                          </span>
                          {reply.isInternal && (
                            <Badge className="bg-purple-500 text-white text-xs">Internal</Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {format(new Date(reply.createdAt), 'dd MMM HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{reply.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit(handleReply)} className="pt-4 border-t">
                <div className="space-y-4">
                  <div>
                    <Label>Reply</Label>
                    <Textarea
                      {...register('message')}
                      placeholder="Type your reply..."
                      rows={4}
                      className="mt-1"
                    />
                    {errors.message && (
                      <p className="text-sm text-red-500 mt-1">{errors.message.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isInternal"
                      checked={watch('isInternal')}
                      onCheckedChange={(checked) => setValue('isInternal', checked as boolean)}
                    />
                    <Label htmlFor="isInternal" className="cursor-pointer">
                      Internal note (not visible to customer)
                    </Label>
                  </div>
                  <Button type="submit" disabled={replyMutation.isPending} className="w-full">
                    {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
