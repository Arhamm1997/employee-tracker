import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Plan } from '../../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Package, Plus, Edit, Trash2, Check, Users, Shield } from 'lucide-react';

const planSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  priceMonthly: z.number().min(0, 'Price must be non-negative'),
  priceYearly: z.number().min(0, 'Price must be non-negative'),
  maxSeats: z.number().int().min(-1, 'Use -1 for unlimited'),
  maxAdmins: z.number().int().min(-1, 'Use -1 for unlimited'),
  screenshotsEnabled: z.boolean(),
  browserHistoryEnabled: z.boolean(),
  usbMonitoringEnabled: z.boolean(),
  alertsEnabled: z.boolean(),
  advancedReports: z.boolean(),
  keylogEnabled: z.boolean(),
  fileActivityEnabled: z.boolean(),
  printLogsEnabled: z.boolean(),
  shutdownEnabled: z.boolean(),
  livescreenEnabled: z.boolean(),
  lockEnabled: z.boolean(),
  isActive: z.boolean(),
});

type PlanFormData = z.infer<typeof planSchema>;

const defaultFormValues: PlanFormData = {
  name: '',
  priceMonthly: 0,
  priceYearly: 0,
  maxSeats: 10,
  maxAdmins: 1,
  screenshotsEnabled: true,
  browserHistoryEnabled: false,
  usbMonitoringEnabled: false,
  alertsEnabled: false,
  advancedReports: false,
  keylogEnabled: false,
  fileActivityEnabled: false,
  printLogsEnabled: false,
  shutdownEnabled: false,
  livescreenEnabled: false,
  lockEnabled: false,
  isActive: true,
};

const featureToggles: { key: keyof PlanFormData; label: string }[] = [
  { key: 'screenshotsEnabled', label: 'Screenshots' },
  { key: 'browserHistoryEnabled', label: 'Browser History' },
  { key: 'usbMonitoringEnabled', label: 'USB Monitoring' },
  { key: 'alertsEnabled', label: 'Alerts' },
  { key: 'advancedReports', label: 'Advanced Reports' },
  { key: 'keylogEnabled', label: 'Keylogger' },
  { key: 'fileActivityEnabled', label: 'File Activity' },
  { key: 'printLogsEnabled', label: 'Print Logs' },
  { key: 'shutdownEnabled', label: 'Remote Shutdown' },
  { key: 'livescreenEnabled', label: 'Live Screen' },
  { key: 'lockEnabled', label: 'Remote Lock' },
];

function PlanForm({
  onSubmit,
  isPending,
  initialValues,
}: {
  onSubmit: (data: PlanFormData) => void;
  isPending: boolean;
  initialValues?: Partial<PlanFormData>;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: { ...defaultFormValues, ...initialValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input {...register('name')} placeholder="Professional" className="mt-1" />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Monthly (PKR)</Label>
          <Input {...register('priceMonthly', { valueAsNumber: true })} type="number" placeholder="5000" className="mt-1" />
          {errors.priceMonthly && <p className="text-xs text-red-500 mt-1">{errors.priceMonthly.message}</p>}
        </div>
        <div>
          <Label>Yearly (PKR)</Label>
          <Input {...register('priceYearly', { valueAsNumber: true })} type="number" placeholder="50000" className="mt-1" />
          {errors.priceYearly && <p className="text-xs text-red-500 mt-1">{errors.priceYearly.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Max Seats <span className="text-gray-400 font-normal">(-1 = unlimited)</span></Label>
          <Input {...register('maxSeats', { valueAsNumber: true })} type="number" placeholder="10" className="mt-1" />
          {errors.maxSeats && <p className="text-xs text-red-500 mt-1">{errors.maxSeats.message}</p>}
        </div>
        <div>
          <Label>Max Admins <span className="text-gray-400 font-normal">(-1 = unlimited)</span></Label>
          <Input {...register('maxAdmins', { valueAsNumber: true })} type="number" placeholder="1" className="mt-1" />
          {errors.maxAdmins && <p className="text-xs text-red-500 mt-1">{errors.maxAdmins.message}</p>}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Features</Label>
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
          {featureToggles.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{label}</span>
              <Controller
                control={control}
                name={key as keyof PlanFormData}
                render={({ field }) => (
                  <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-2 border rounded-lg px-3">
        <span className="text-sm font-medium text-gray-700">Active</span>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save Plan'}
      </Button>
    </form>
  );
}

export default function Plans() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await api.get('/admin/plans');
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      const response = await api.post('/admin/plans', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Plan created successfully');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setIsCreateOpen(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to create plan');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlanFormData> }) => {
      const response = await api.put(`/admin/plans/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Plan updated');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setEditingPlan(null);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to update plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/admin/plans/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Plan deleted');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setDeletingPlan(null);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to delete plan');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plans</h1>
          <p className="text-gray-500 mt-1">Manage subscription plans</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Plan</DialogTitle></DialogHeader>
            <PlanForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !plans || plans.length === 0 ? (
        <Card className="p-6 bg-white rounded-xl shadow-sm">
          <EmptyState
            icon={Package}
            title="No plans found"
            description="Create your first subscription plan to get started"
            actionLabel="Create Plan"
            onAction={() => setIsCreateOpen(true)}
          />
        </Card>
      ) : (
        <Card className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">Monthly</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">Yearly</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Seats
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      Admins
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Features</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">Customers</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">Active</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{plan.name}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">PKR {plan.priceMonthly.toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">PKR {plan.priceYearly.toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className="font-medium">{plan.maxSeats === -1 ? '∞' : plan.maxSeats}</span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className="font-medium">{plan.maxAdmins === -1 ? '∞' : plan.maxAdmins}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {plan.features.map((f, i) => (
                          <Badge key={i} variant="outline" className="text-xs py-0">
                            <Check className="w-2.5 h-2.5 mr-1 text-green-500" />
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{plan.customerCount}</td>
                    <td className="py-3 px-4">
                      <Switch
                        checked={plan.isActive}
                        onCheckedChange={(checked) =>
                          updateMutation.mutate({ id: plan.id, data: { isActive: checked } })
                        }
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingPlan(plan)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingPlan(plan)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Plan</DialogTitle></DialogHeader>
          {editingPlan && (
            <PlanForm
              initialValues={{
                name: editingPlan.name,
                priceMonthly: editingPlan.priceMonthly,
                priceYearly: editingPlan.priceYearly,
                maxSeats: editingPlan.maxSeats,
                maxAdmins: editingPlan.maxAdmins ?? 1,
                screenshotsEnabled: editingPlan.screenshotsEnabled,
                browserHistoryEnabled: editingPlan.browserHistoryEnabled,
                usbMonitoringEnabled: editingPlan.usbMonitoringEnabled,
                alertsEnabled: editingPlan.alertsEnabled,
                advancedReports: editingPlan.advancedReports,
                keylogEnabled: editingPlan.keylogEnabled,
                fileActivityEnabled: editingPlan.fileActivityEnabled,
                printLogsEnabled: editingPlan.printLogsEnabled,
                shutdownEnabled: editingPlan.shutdownEnabled,
                livescreenEnabled: editingPlan.livescreenEnabled,
                lockEnabled: editingPlan.lockEnabled,
                isActive: editingPlan.isActive,
              }}
              onSubmit={(data) => updateMutation.mutate({ id: editingPlan.id, data })}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{deletingPlan?.name}</strong>?
            </p>
            {(deletingPlan?.customerCount || 0) > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> {deletingPlan?.customerCount} compan{deletingPlan?.customerCount === 1 ? 'y' : 'ies'} using this plan must be migrated first.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeletingPlan(null)} className="flex-1">Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deletingPlan && deleteMutation.mutate(deletingPlan.id)}
                disabled={deleteMutation.isPending}
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
