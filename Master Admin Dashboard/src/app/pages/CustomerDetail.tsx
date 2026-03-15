import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Customer, Subscription, Agent, Invoice, ErrorLog, Plan } from '../../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { ArrowLeft, Users, CreditCard, Monitor, FileText, AlertCircle, BanIcon, CheckCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';

const changePlanSchema = z.object({
  planId: z.string().min(1, 'Plan is required'),
});

const extendSubscriptionSchema = z.object({
  days: z.number().min(1, 'Must be at least 1 day'),
});

type ChangePlanFormData = z.infer<typeof changePlanSchema>;
type ExtendSubscriptionFormData = z.infer<typeof extendSubscriptionSchema>;

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch customer
  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.get(`/admin/customers/${id}`);
      return response.data.data;
    },
  });

  // Fetch subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<Subscription>({
    queryKey: ['customer-subscription', id],
    queryFn: async () => {
      const response = await api.get(`/admin/customers/${id}/subscription`);
      return response.data.data;
    },
  });

  // Fetch agents
  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['customer-agents', id],
    queryFn: async () => {
      const response = await api.get(`/admin/customers/${id}/agents`);
      return response.data.data;
    },
  });

  // Fetch invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['customer-invoices', id],
    queryFn: async () => {
      const response = await api.get(`/admin/customers/${id}/invoices`);
      return response.data.data;
    },
  });

  // Fetch error logs
  const { data: errorLogs, isLoading: logsLoading } = useQuery<ErrorLog[]>({
    queryKey: ['customer-errors', id],
    queryFn: async () => {
      const response = await api.get(`/admin/logs/errors?customerId=${id}`);
      return response.data.data.data;
    },
  });

  // Fetch plans
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['plans-list'],
    queryFn: async () => {
      const response = await api.get('/admin/plans');
      return response.data.data;
    },
  });

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: async (data: ChangePlanFormData) => {
      const response = await api.post(`/admin/customers/${id}/change-plan`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Plan changed successfully');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscription', id] });
      setIsChangePlanOpen(false);
    },
    onError: () => {
      toast.error('Failed to change plan');
    },
  });

  // Extend subscription mutation
  const extendMutation = useMutation({
    mutationFn: async (data: ExtendSubscriptionFormData) => {
      const response = await api.post(`/admin/customers/${id}/extend-subscription`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Subscription extended successfully');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscription', id] });
      setIsExtendOpen(false);
    },
    onError: () => {
      toast.error('Failed to extend subscription');
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/admin/customers/${id}/cancel-subscription`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Subscription cancelled');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscription', id] });
      setIsCancelOpen(false);
    },
    onError: () => {
      toast.error('Failed to cancel subscription');
    },
  });

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/admin/customers/${id}/suspend`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Company suspended');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: () => toast.error('Failed to suspend company'),
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/admin/customers/${id}/activate`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Company activated');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: () => toast.error('Failed to activate company'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/admin/customers/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Company deleted');
      navigate('/admin/customers');
    },
    onError: () => toast.error('Failed to delete company'),
  });

  const {
    register: registerChangePlan,
    handleSubmit: handleSubmitChangePlan,
    formState: { errors: changePlanErrors },
  } = useForm<ChangePlanFormData>({
    resolver: zodResolver(changePlanSchema),
  });

  const {
    register: registerExtend,
    handleSubmit: handleSubmitExtend,
    formState: { errors: extendErrors },
  } = useForm<ExtendSubscriptionFormData>({
    resolver: zodResolver(extendSubscriptionSchema),
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      trial: 'bg-blue-500',
      suspended: 'bg-yellow-500',
      cancelled: 'bg-red-500',
      online: 'bg-green-500',
      offline: 'bg-gray-500',
      idle: 'bg-yellow-500',
      paid: 'bg-green-500',
      pending: 'bg-yellow-500',
      failed: 'bg-red-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (customerLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!customer) {
    return <div>Customer not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{customer.companyName}</h1>
          <p className="text-gray-500 mt-1">{customer.email}</p>
        </div>
        <Badge className={`${getStatusColor(customer.status)} text-white ml-auto`}>
          {customer.status}
        </Badge>
        {customer.status === 'suspended' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Activate
          </Button>
        ) : customer.status === 'active' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => suspendMutation.mutate()}
            disabled={suspendMutation.isPending}
          >
            <BanIcon className="w-4 h-4 mr-1" />
            Suspend
          </Button>
        ) : null}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Delete
        </Button>
      </div>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to permanently delete <strong>{customer.companyName}</strong>?
              This will delete all employees, screenshots, and data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="flex-1">Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Everything'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <p className="text-sm text-gray-600">Plan</p>
          <p className="text-2xl font-bold mt-2">{customer.planName}</p>
        </Card>
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <p className="text-sm text-gray-600">MRR</p>
          <p className="text-2xl font-bold mt-2">PKR {customer.mrr.toLocaleString()}</p>
        </Card>
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <p className="text-sm text-gray-600">Employees</p>
          <p className="text-2xl font-bold mt-2">{customer.employeeCount}</p>
        </Card>
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <p className="text-sm text-gray-600">Agents</p>
          <p className="text-2xl font-bold mt-2">
            {customer.agentCount} <span className="text-sm text-gray-500">({customer.onlineAgentCount} online)</span>
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList>
          <TabsTrigger value="subscription">
            <CreditCard className="w-4 h-4 mr-2" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Monitor className="w-4 h-4 mr-2" />
            Agents ({agents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="w-4 h-4 mr-2" />
            Invoices ({invoices?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="errors">
            <AlertCircle className="w-4 h-4 mr-2" />
            Error Logs
          </TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card className="p-6 bg-white rounded-xl shadow-sm">
            {subscriptionLoading ? (
              <CardSkeleton />
            ) : subscription ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600">Current Period</p>
                    <p className="font-medium mt-1">
                      {format(new Date(subscription.currentPeriodStart), 'dd MMM yyyy')} -{' '}
                      {format(new Date(subscription.currentPeriodEnd), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Seats</p>
                    <p className="font-medium mt-1">
                      {subscription.seatsUsed} / {subscription.seatsTotal}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Auto Renew</p>
                    <p className="font-medium mt-1">{subscription.autoRenew ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">MRR</p>
                    <p className="font-medium mt-1">PKR {subscription.mrr.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Dialog open={isChangePlanOpen} onOpenChange={setIsChangePlanOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Change Plan</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Plan</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={handleSubmitChangePlan((data) => changePlanMutation.mutate(data))}
                        className="space-y-4"
                      >
                        <div>
                          <Label>New Plan</Label>
                          <Select
                            onValueChange={(value) =>
                              registerChangePlan('planId').onChange({ target: { value } })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select plan" />
                            </SelectTrigger>
                            <SelectContent>
                              {plans?.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.name} - PKR {plan.price.toLocaleString()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {changePlanErrors.planId && (
                            <p className="text-sm text-red-500 mt-1">{changePlanErrors.planId.message}</p>
                          )}
                        </div>
                        <Button type="submit" className="w-full" disabled={changePlanMutation.isPending}>
                          {changePlanMutation.isPending ? 'Changing...' : 'Change Plan'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isExtendOpen} onOpenChange={setIsExtendOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Extend Subscription</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Extend Subscription</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={handleSubmitExtend((data) => extendMutation.mutate(data))}
                        className="space-y-4"
                      >
                        <div>
                          <Label>Extend by (days)</Label>
                          <Input
                            {...registerExtend('days', { valueAsNumber: true })}
                            type="number"
                            placeholder="30"
                          />
                          {extendErrors.days && (
                            <p className="text-sm text-red-500 mt-1">{extendErrors.days.message}</p>
                          )}
                        </div>
                        <Button type="submit" className="w-full" disabled={extendMutation.isPending}>
                          {extendMutation.isPending ? 'Extending...' : 'Extend'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive">Cancel Subscription</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel Subscription</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-gray-600">
                          Are you sure you want to cancel this subscription? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                          <Button variant="outline" onClick={() => setIsCancelOpen(false)} className="flex-1">
                            No, Keep It
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => cancelMutation.mutate()}
                            disabled={cancelMutation.isPending}
                            className="flex-1"
                          >
                            {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No subscription data</p>
            )}
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <Card className="p-6 bg-white rounded-xl shadow-sm">
            {agentsLoading ? (
              <TableSkeleton />
            ) : agents && agents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Machine ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Employee</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Last Seen</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">IP Address</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-mono">{agent.machineId}</td>
                        <td className="py-3 px-4 text-sm">{agent.employeeName}</td>
                        <td className="py-3 px-4">
                          <Badge className={`${getStatusColor(agent.status)} text-white`}>
                            {agent.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(agent.lastSeen), 'dd MMM yyyy HH:mm')}
                        </td>
                        <td className="py-3 px-4 text-sm font-mono">{agent.ipAddress}</td>
                        <td className="py-3 px-4 text-sm">{agent.version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No agents found</p>
            )}
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card className="p-6 bg-white rounded-xl shadow-sm">
            {invoicesLoading ? (
              <TableSkeleton />
            ) : invoices && invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Invoice ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Due Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Paid At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-mono">{invoice.id}</td>
                        <td className="py-3 px-4 text-sm font-medium">
                          PKR {invoice.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`${getStatusColor(invoice.status)} text-white`}>
                            {invoice.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(invoice.dueDate), 'dd MMM yyyy')}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {invoice.paidAt ? format(new Date(invoice.paidAt), 'dd MMM yyyy HH:mm') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No invoices found</p>
            )}
          </Card>
        </TabsContent>

        {/* Error Logs Tab */}
        <TabsContent value="errors">
          <Card className="p-6 bg-white rounded-xl shadow-sm">
            {logsLoading ? (
              <TableSkeleton />
            ) : errorLogs && errorLogs.length > 0 ? (
              <div className="space-y-3">
                {errorLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Badge className={`${getStatusColor(log.severity)} text-white`}>
                        {log.severity}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{log.source}</span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 mb-2">{log.message}</p>
                        {log.stackTrace && (
                          <details className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            <summary className="cursor-pointer">Stack Trace</summary>
                            <pre className="mt-2 overflow-x-auto">{log.stackTrace}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No error logs found</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
