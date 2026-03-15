import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import { Customer, PaginatedResponse, Plan } from '../../types';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Search, Plus, Users, Eye, BanIcon } from 'lucide-react';
import { format } from 'date-fns';

const createCustomerSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  email: z.string().email('Invalid email'),
  planId: z.string().min(1, 'Plan is required'),
  employeeCount: z.number().min(1, 'Must have at least 1 employee'),
});

type CreateCustomerFormData = z.infer<typeof createCustomerSchema>;

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 500);

  // Fetch customers
  const { data, isLoading } = useQuery<PaginatedResponse<Customer>>({
    queryKey: ['customers', debouncedSearch, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const response = await api.get(`/admin/customers?${params}`);
      return response.data.data;
    },
  });

  // Fetch plans for create modal
  const { data: plansData } = useQuery<Plan[]>({
    queryKey: ['plans-list'],
    queryFn: async () => {
      const response = await api.get('/admin/plans');
      return response.data.data;
    },
  });

  // Create customer mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateCustomerFormData) => {
      const response = await api.post('/admin/customers', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Customer created successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: () => {
      toast.error('Failed to create customer');
    },
  });

  // Bulk suspend mutation
  const suspendMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      const response = await api.post('/admin/customers/bulk-suspend', { ids: customerIds });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Customers suspended successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomers([]);
    },
    onError: () => {
      toast.error('Failed to suspend customers');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCustomerFormData>({
    resolver: zodResolver(createCustomerSchema),
  });

  const handleCreateCustomer = (data: CreateCustomerFormData) => {
    createMutation.mutate(data);
  };

  const handleBulkSuspend = () => {
    if (selectedCustomers.length === 0) {
      toast.error('No customers selected');
      return;
    }
    if (confirm(`Are you sure you want to suspend ${selectedCustomers.length} customer(s)?`)) {
      suspendMutation.mutate(selectedCustomers);
    }
  };

  const toggleSelectCustomer = (customerId: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.length === data?.data.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(data?.data.map((c) => c.id) || []);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage all customer accounts</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleCreateCustomer)} className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input {...register('companyName')} placeholder="Acme Corp" />
                {errors.companyName && (
                  <p className="text-sm text-red-500 mt-1">{errors.companyName.message}</p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                <Input {...register('email')} type="email" placeholder="contact@acme.com" />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Label>Plan</Label>
                <Select onValueChange={(value) => register('planId').onChange({ target: { value } })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plansData?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - PKR {plan.price.toLocaleString()}/{plan.billingCycle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.planId && (
                  <p className="text-sm text-red-500 mt-1">{errors.planId.message}</p>
                )}
              </div>
              <div>
                <Label>Employee Count</Label>
                <Input
                  {...register('employeeCount', { valueAsNumber: true })}
                  type="number"
                  placeholder="50"
                />
                {errors.employeeCount && (
                  <p className="text-sm text-red-500 mt-1">{errors.employeeCount.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Customer'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search by company or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {selectedCustomers.length > 0 && (
            <Button variant="destructive" onClick={handleBulkSuspend}>
              <BanIcon className="w-4 h-4 mr-2" />
              Suspend ({selectedCustomers.length})
            </Button>
          )}
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers found"
            description="No customers match your search criteria"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.length === data.data.length}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Plan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Employees</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Agents</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Joined</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.includes(customer.id)}
                          onChange={() => toggleSelectCustomer(customer.id)}
                          className="rounded"
                        />
                      </td>
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
                      <td className="py-3 px-4 text-sm">{customer.employeeCount}</td>
                      <td className="py-3 px-4 text-sm">
                        {customer.agentCount} ({customer.onlineAgentCount} online)
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {format(new Date(customer.joinedAt), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3 px-4">
                        <Link to={`/admin/customers/${customer.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total} results
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.totalPages}
                >
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
