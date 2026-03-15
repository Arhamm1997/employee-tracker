import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Subscription } from '../../types';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ['subscription', id],
    queryFn: async () => {
      const response = await api.get(`/admin/subscriptions/${id}`);
      return response.data.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/admin/subscriptions/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Subscription cancelled');
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      setIsCancelOpen(false);
    },
    onError: () => {
      toast.error('Failed to cancel subscription');
    },
  });

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!subscription) {
    return <div>Subscription not found</div>;
  }

  const seatPercentage = (subscription.seatsUsed / subscription.seatsTotal) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/subscriptions">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{subscription.companyName}</h1>
          <p className="text-gray-500 mt-1">Subscription Details</p>
        </div>
        <Badge className={`${getStatusColor(subscription.status)} text-white ml-auto`}>
          {subscription.status}
        </Badge>
      </div>

      <Card className="p-6 bg-white rounded-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600">Subscription ID</p>
            <p className="text-lg font-semibold mt-1 font-mono">{subscription.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Plan</p>
            <p className="text-lg font-semibold mt-1">{subscription.planName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">MRR</p>
            <p className="text-lg font-semibold mt-1">PKR {subscription.mrr.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Current Period Start</p>
            <p className="text-lg font-semibold mt-1">
              {format(new Date(subscription.currentPeriodStart), 'dd MMM yyyy')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Current Period End</p>
            <p className="text-lg font-semibold mt-1">
              {format(new Date(subscription.currentPeriodEnd), 'dd MMM yyyy')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Auto Renew</p>
            <Badge className={`mt-1 ${subscription.autoRenew ? 'bg-green-500' : 'bg-gray-500'}`}>
              {subscription.autoRenew ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>

        <div className="pt-6 border-t">
          <p className="text-sm text-gray-600 mb-3">Seats Usage</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {subscription.seatsUsed} / {subscription.seatsTotal} seats used
              </span>
              <span className="text-gray-600">{seatPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={seatPercentage} className="h-3" />
          </div>
        </div>

        {subscription.status !== 'cancelled' && (
          <div className="pt-6 border-t mt-6">
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
        )}
      </Card>
    </div>
  );
}
