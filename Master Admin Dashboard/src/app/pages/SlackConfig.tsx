import React, { useState, useEffect } from 'react';
import { Slack, Loader2, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import api from '../../lib/api';
import { toast } from 'sonner';

interface SlackIntegrationRow {
  id: string;
  companyId: string;
  companyName: string;
  companyEmail: string;
  teamId: string;
  teamName: string;
  isActive: boolean;
  installedAt: string;
}

interface PlanRow {
  id: string;
  name: string;
  slackEnabled: boolean;
  isActive: boolean;
}

export default function SlackConfig() {
  const [integrations, setIntegrations] = useState<SlackIntegrationRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [togglingPlan, setTogglingPlan] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [integRes, plansRes] = await Promise.all([
        api.get<{ integrations: SlackIntegrationRow[] }>('/admin/slack/integrations'),
        api.get<{ plans: PlanRow[] }>('/admin/slack/plans'),
      ]);
      setIntegrations(integRes.data.integrations);
      setPlans(plansRes.data.plans);
    } catch {
      toast.error('Failed to load Slack data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDisconnect() {
    if (!disconnectId) return;
    setDisconnecting(true);
    try {
      await api.delete(`/admin/slack/integration/${disconnectId}`);
      toast.success('Slack integration disconnected');
      setIntegrations(prev => prev.filter(i => i.id !== disconnectId));
      setDisconnectId(null);
    } catch {
      toast.error('Failed to disconnect integration');
    } finally {
      setDisconnecting(false);
    }
  }

  async function togglePlanSlack(planId: string, enabled: boolean) {
    setTogglingPlan(planId);
    try {
      await api.put(`/admin/slack/plan/${planId}`, { enabled });
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, slackEnabled: enabled } : p));
      toast.success(`Slack ${enabled ? 'enabled' : 'disabled'} for plan`);
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setTogglingPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Slack className="w-6 h-6 text-[#4A154B]" />
          <div>
            <h1 className="text-2xl font-bold">Slack Integration</h1>
            <p className="text-sm text-muted-foreground">Manage Slack integrations across all company workspaces</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Connected Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Slack className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No companies have connected Slack yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Slack Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map(integration => (
                  <TableRow key={integration.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{integration.companyName}</p>
                        <p className="text-xs text-muted-foreground">{integration.companyEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{integration.teamName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{integration.teamId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={integration.isActive ? 'default' : 'secondary'} className={integration.isActive ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : ''}>
                        {integration.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(integration.installedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDisconnectId(integration.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Plan Feature Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature Access by Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Enable or disable the Slack integration feature for each subscription plan.
          </p>
          <div className="space-y-3">
            {plans.map(plan => (
              <div key={plan.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{plan.name}</span>
                  {!plan.isActive && (
                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{plan.slackEnabled ? 'Enabled' : 'Disabled'}</span>
                  <Switch
                    checked={plan.slackEnabled}
                    disabled={togglingPlan === plan.id}
                    onCheckedChange={(v) => togglePlanSlack(plan.id, v)}
                  />
                  {togglingPlan === plan.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectId} onOpenChange={(open) => { if (!disconnecting && !open) setDisconnectId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Slack Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the Slack workspace for this company. They will no longer receive alerts in Slack until they reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
