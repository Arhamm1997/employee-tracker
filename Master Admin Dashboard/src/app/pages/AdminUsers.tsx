import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Admin } from '../../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Shield, Plus, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const adminSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['owner', 'admin', 'support', 'analyst']),
});

type AdminFormData = z.infer<typeof adminSchema>;

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const currentAdmin = useAuthStore((state) => state.admin);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);

  const { data: admins, isLoading } = useQuery<Admin[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await api.get('/admin/users');
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AdminFormData) => {
      const response = await api.post('/admin/users', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Admin user created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: () => {
      toast.error('Failed to create admin user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AdminFormData> }) => {
      const response = await api.put(`/admin/users/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Admin user updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingAdmin(null);
      reset();
    },
    onError: () => {
      toast.error('Failed to update admin user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/admin/users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Admin user deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeletingAdmin(null);
    },
    onError: () => {
      toast.error('Failed to delete admin user');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AdminFormData>({
    resolver: zodResolver(adminSchema),
  });

  const handleCreateAdmin = (data: AdminFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdateAdmin = (data: AdminFormData) => {
    if (editingAdmin) {
      const { password, ...updateData } = data;
      updateMutation.mutate({ id: editingAdmin.id, data: updateData });
    }
  };

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setValue('name', admin.name);
    setValue('email', admin.email);
    setValue('role', admin.role);
    setValue('password', '********'); // Placeholder
  };

  const handleDeleteConfirm = () => {
    if (deletingAdmin) {
      deleteMutation.mutate(deletingAdmin.id);
    }
  };

  const roleColors = {
    owner: 'bg-red-500',
    admin: 'bg-blue-500',
    support: 'bg-green-500',
    analyst: 'bg-purple-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-gray-500 mt-1">Manage admin accounts and permissions</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Admin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleCreateAdmin)} className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input {...register('name')} placeholder="John Doe" />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label>Email</Label>
                <Input {...register('email')} type="email" placeholder="john@stafftrack.com" />
                {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label>Password</Label>
                <Input {...register('password')} type="password" placeholder="••••••••" />
                {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <Label>Role</Label>
                <Select onValueChange={(value) => register('role').onChange({ target: { value } })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && <p className="text-sm text-red-500 mt-1">{errors.role.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Admin'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        {isLoading ? (
          <TableSkeleton />
        ) : !admins || admins.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No admin users found"
            description="Create your first admin user to get started"
            actionLabel="Create Admin"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{admin.name}</p>
                      {admin.id === currentAdmin?.id && (
                        <span className="text-xs text-gray-500">(You)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">{admin.email}</td>
                    <td className="py-3 px-4">
                      <Badge className={`${roleColors[admin.role]} text-white`}>
                        {admin.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {format(new Date(admin.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(admin)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingAdmin(admin)}
                          disabled={admin.id === currentAdmin?.id}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAdmin} onOpenChange={() => setEditingAdmin(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Admin User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleUpdateAdmin)} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input {...register('email')} type="email" />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Role</Label>
              <Select
                defaultValue={editingAdmin?.role}
                onValueChange={(value) => register('role').onChange({ target: { value } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500">Leave password unchanged</p>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update Admin'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingAdmin} onOpenChange={() => setDeletingAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{deletingAdmin?.name}</strong>? This action cannot be undone.
            </p>
            {deletingAdmin?.id === currentAdmin?.id && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> You cannot delete your own account.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeletingAdmin(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending || deletingAdmin?.id === currentAdmin?.id}
                className="flex-1"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
