import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Clock, Camera, Globe, AppWindow, Bell, Database,
  Plus, X, Trash2, Download, AlertTriangle, Lock,
  Shield, KeyRound, Loader2, CheckCircle, Slack,
  MessageSquare, Send, PlugZap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Slider } from "../components/ui/slider";
import { Skeleton } from "../components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "../components/ui/alert-dialog";
import {
  apiGetSettings, apiSaveSettings, apiResetAllData, apiDownloadBackup, apiDeleteAccount,
  apiResetCompleteApp, api2FADisable, apiGetAgentLatestVersion,
  apiGetSlackIntegration, apiGetSlackSettings, apiUpdateSlackSettings, apiGetSlackChannels,
  apiSendSlackTestAlert, apiDisconnectSlack,
  type SlackIntegration, type SlackSettings, type SlackChannel,
} from "../lib/api";
import type { AgentLatestVersion } from "../lib/api";
import { SlackOAuthModal } from "../components/slack/SlackOAuthModal";
import type { AppSettings } from "../lib/types";
import { toast } from "sonner";
import { useAuth } from "../lib/auth-types";
import { useSubscription } from "../lib/subscription-context";

const daysOfWeek = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const defaultSettings: AppSettings = {
  workSchedule: {
    startTime: "09:00",
    endTime: "18:00",
    workDays: [1, 2, 3, 4, 5],
    timezone: "America/New_York",
  },
  monitoring: {
    screenshotInterval: 10,
    screenshotQuality: "medium",
    idleThreshold: 5,
    enableScreenshots: true,
    enableBrowserHistory: true,
    enableUsb: true,
    enableClipboard: false,
    enableAfterHours: true,
  },
  blockedSites: [],
  appCategories: {
    productive: [],
    nonProductive: [],
    neutral: [],
  },
  notifications: {
    emailAddresses: [],
    alertTypes: {
      blocked_site: true,
      after_hours: true,
      usb_connected: true,
      idle_long: true,
      new_software: false,
      low_activity: false,
    },
    idleThresholdMinutes: 30,
  },
  dataRetention: {
    activityDays: 90,
    screenshotDays: 30,
    alertDays: 60,
  },
};

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { seatInfo } = useSubscription();
  // Use the same feature key resolution as hasFeature() in subscription-context
  const planFeatures = (seatInfo?.plan?.features ?? (seatInfo as any)?.features ?? {}) as Record<string, boolean | undefined>;

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [newSite, setNewSite] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newApp, setNewApp] = useState("");
  const [appCategory, setAppCategory] = useState<"productive" | "nonProductive" | "neutral">("productive");
  const [showCleanup, setShowCleanup] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDownloadBackup, setShowDownloadBackup] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [showResetComplete, setShowResetComplete] = useState(false);
  const [resetCompleteConfirm, setResetCompleteConfirm] = useState("");
  const [resettingComplete, setResettingComplete] = useState(false);
  const planMaxEmployees = seatInfo?.employee_seats?.limit ?? 100;
  const [maxEmployees, setMaxEmployees] = useState(10);

  // Agent version (for Downloads tab)
  const [agentVersion, setAgentVersion] = useState<AgentLatestVersion | null>(null);
  const [agentVersionLoading, setAgentVersionLoading] = useState(true);

  // 2FA disable flow
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [disable2FACode, setDisable2FACode] = useState("");
  const [disabling2FALoading, setDisabling2FALoading] = useState(false);

  // Slack integration state
  const [slackIntegration, setSlackIntegration] = useState<SlackIntegration | null>(null);
  const [slackSettings, setSlackSettings] = useState<SlackSettings>({
    slackEnabled: false, slackChannelId: null, slackAlertTypes: [], slackThreadReplies: true,
  });
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [slackLoading, setSlackLoading] = useState(true);
  const [slackConnectOpen, setSlackConnectOpen] = useState(false);
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackChannelsLoading, setSlackChannelsLoading] = useState(false);
  const [slackDisconnecting, setSlackDisconnecting] = useState(false);

  const loadSlackData = useCallback(async () => {
    setSlackLoading(true);
    try {
      const [integrationRes, settingsRes] = await Promise.all([
        apiGetSlackIntegration().catch(() => ({ connected: false })),
        apiGetSlackSettings().catch(() => null),
      ]);
      if (integrationRes.connected && integrationRes.integration) {
        setSlackIntegration(integrationRes.integration);
      } else {
        setSlackIntegration(null);
      }
      if (settingsRes) setSlackSettings(settingsRes);
    } finally {
      setSlackLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlackData();
  }, [loadSlackData]);

  // Handle Slack OAuth callback redirect
  useEffect(() => {
    const slackParam = searchParams.get("slack");
    const tab = searchParams.get("tab");
    if (tab === "integrations" && slackParam === "success") {
      toast.success("Slack workspace connected successfully!");
      loadSlackData();
    } else if (tab === "integrations" && slackParam === "error") {
      toast.error("Failed to connect Slack workspace. Please try again.");
    }
  }, [searchParams, loadSlackData]);

  const loadSlackChannels = async () => {
    setSlackChannelsLoading(true);
    try {
      const { channels } = await apiGetSlackChannels();
      setSlackChannels(channels);
    } catch {
      toast.error("Failed to load Slack channels");
    } finally {
      setSlackChannelsLoading(false);
    }
  };

  const saveSlackSettings = async (patch: Partial<SlackSettings>) => {
    setSlackSaving(true);
    try {
      const updated = { ...slackSettings, ...patch };
      setSlackSettings(updated);
      await apiUpdateSlackSettings(patch);
      toast.success("Slack settings saved");
    } catch {
      toast.error("Failed to save Slack settings");
    } finally {
      setSlackSaving(false);
    }
  };

  const sendSlackTestAlert = async () => {
    setSlackTesting(true);
    try {
      const res = await apiSendSlackTestAlert(slackSettings.slackChannelId ?? undefined);
      toast.success(res.message || "Test alert sent to Slack!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send test alert");
    } finally {
      setSlackTesting(false);
    }
  };

  const disconnectSlack = async () => {
    setSlackDisconnecting(true);
    try {
      await apiDisconnectSlack();
      setSlackIntegration(null);
      setSlackSettings(prev => ({ ...prev, slackEnabled: false }));
      toast.success("Slack workspace disconnected");
    } catch {
      toast.error("Failed to disconnect Slack");
    } finally {
      setSlackDisconnecting(false);
    }
  };

  const ALERT_TYPE_LABELS: Record<string, string> = {
    blocked_site: "Blocked Site",
    idle_long: "Long Idle",
    new_software: "New Software",
    after_hours: "After Hours",
    usb_connected: "USB Connected",
    clipboard_sensitive: "Clipboard Alert",
    low_activity: "Low Activity",
  };

  useEffect(() => {
    apiGetSettings()
      .then(s => {
        setSettings(s);
        setMaxEmployees((s as any).maxEmployees ?? planMaxEmployees);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiGetAgentLatestVersion()
      .then(setAgentVersion)
      .finally(() => setAgentVersionLoading(false));
  }, []);

  const handleResetAllData = async () => {
    setResetting(true);
    try {
      await apiResetAllData();
      toast.success("All monitoring data has been reset.");
      setShowReset(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset data");
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await apiDeleteAccount();
      toast.success("Account deleted successfully. Logging out...");
      setTimeout(() => {
        localStorage.removeItem("monitor_token");
        window.location.href = "/login";
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
      setDeletingAccount(false);
      setShowDeleteAccount(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      await apiDownloadBackup();
      toast.success("Backup downloaded successfully!");
      setShowDownloadBackup(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to download backup");
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleResetComplete = async () => {
    setResettingComplete(true);
    try {
      await apiResetCompleteApp(resetCompleteConfirm);
      toast.success("Application has been completely reset.");
      setShowResetComplete(false);
      setResetCompleteConfirm("");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset application");
    } finally {
      setResettingComplete(false);
    }
  };

  const handle2FADisable = async () => {
    if (disable2FACode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    setDisabling2FALoading(true);
    try {
      await api2FADisable(disable2FACode);
      await refreshUser();
      setDisabling2FA(false);
      setDisable2FACode("");
      toast.success("Two-factor authentication disabled.");
    } catch (err: any) {
      toast.error(err.message || "Invalid code. Please try again.");
    } finally {
      setDisabling2FALoading(false);
    }
  };

  const save = async () => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can change settings.");
      return;
    }
    try {
      await apiSaveSettings({ ...settings, maxEmployees } as any);
      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const addBlockedSite = () => {
    if (!isSuperAdmin || !newSite.trim()) return;
    setSettings(prev => ({
      ...prev,
      blockedSites: [...prev.blockedSites, newSite.trim()],
    }));
    setNewSite("");
    toast.success("Site added — remember to Save Changes");
  };

  const removeBlockedSite = (site: string) => {
    if (!isSuperAdmin) return;
    setSettings(prev => ({
      ...prev,
      blockedSites: prev.blockedSites.filter(s => s !== site),
    }));
  };

  const addEmail = () => {
    if (!isSuperAdmin || !newEmail.trim() || !newEmail.includes("@")) return;
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        emailAddresses: [...prev.notifications.emailAddresses, newEmail.trim()],
      },
    }));
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    if (!isSuperAdmin) return;
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        emailAddresses: prev.notifications.emailAddresses.filter(e => e !== email),
      },
    }));
  };

  const addApp = () => {
    if (!isSuperAdmin || !newApp.trim()) return;
    setSettings(prev => ({
      ...prev,
      appCategories: {
        ...prev.appCategories,
        [appCategory]: [...prev.appCategories[appCategory], newApp.trim()],
      },
    }));
    setNewApp("");
  };

  const removeApp = (cat: keyof AppSettings["appCategories"], app: string) => {
    if (!isSuperAdmin) return;
    setSettings(prev => ({
      ...prev,
      appCategories: {
        ...prev.appCategories,
        [cat]: prev.appCategories[cat].filter(a => a !== app),
      },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Viewer read-only notice ─────────────────────────────────────────── */}
      {!isSuperAdmin && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400">
          <Lock className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            Read-only — only <span className="font-semibold">Super Admin</span> can edit settings.
          </p>
        </div>
      )}

      <Tabs defaultValue={searchParams.get("tab") === "integrations" ? "integrations" : "schedule"}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="schedule" className="gap-1.5"><Clock className="w-3.5 h-3.5" />Work Schedule</TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-1.5"><Camera className="w-3.5 h-3.5" />Monitoring</TabsTrigger>
          {planFeatures["browserHistory"] === true && (
            <TabsTrigger value="blocked" className="gap-1.5"><Globe className="w-3.5 h-3.5" />Blocked Sites</TabsTrigger>
          )}
          <TabsTrigger value="apps" className="gap-1.5"><AppWindow className="w-3.5 h-3.5" />App Categories</TabsTrigger>
          {planFeatures["alerts"] === true && (
            <TabsTrigger value="notifications" className="gap-1.5"><Bell className="w-3.5 h-3.5" />Notifications</TabsTrigger>
          )}
          <TabsTrigger value="retention" className="gap-1.5"><Database className="w-3.5 h-3.5" />Data Retention</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="w-3.5 h-3.5" />Security</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5"><PlugZap className="w-3.5 h-3.5" />Integrations</TabsTrigger>
          {isSuperAdmin && (
            <>
              <TabsTrigger value="downloads" className="gap-1.5"><Download className="w-3.5 h-3.5" />Downloads</TabsTrigger>
              <TabsTrigger value="account" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Account & System</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ── Work Schedule ───────────────────────────────────────────────── */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "16px" }}>Work Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={settings.workSchedule.startTime}
                    onChange={e => isSuperAdmin && setSettings(prev => ({ ...prev, workSchedule: { ...prev.workSchedule, startTime: e.target.value } }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={settings.workSchedule.endTime}
                    onChange={e => isSuperAdmin && setSettings(prev => ({ ...prev, workSchedule: { ...prev.workSchedule, endTime: e.target.value } }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Work Days</Label>
                <div className="flex flex-wrap gap-3">
                  {daysOfWeek.map(day => (
                    <div key={day.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={settings.workSchedule.workDays.includes(day.value)}
                        disabled={!isSuperAdmin}
                        onCheckedChange={(checked) => {
                          if (!isSuperAdmin) return;
                          setSettings(prev => ({
                            ...prev,
                            workSchedule: {
                              ...prev.workSchedule,
                              workDays: checked
                                ? [...prev.workSchedule.workDays, day.value]
                                : prev.workSchedule.workDays.filter(d => d !== day.value),
                            },
                          }));
                        }}
                      />
                      <label
                        htmlFor={`day-${day.value}`}
                        className={isSuperAdmin ? "cursor-pointer" : "cursor-default opacity-70"}
                        style={{ fontSize: "14px" }}
                      >
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.workSchedule.timezone}
                  onValueChange={v => isSuperAdmin && setSettings(prev => ({ ...prev, workSchedule: { ...prev.workSchedule, timezone: v } }))}
                  disabled={!isSuperAdmin}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Karachi">Pakistan Time (PKT, UTC+5)</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isSuperAdmin && (
                <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={save}>Save Changes</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Monitoring ──────────────────────────────────────────────────── */}
        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "16px" }}>Monitoring Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Screenshot Interval</Label>
                <Select
                  value={String(settings.monitoring.screenshotInterval)}
                  onValueChange={v => isSuperAdmin && setSettings(prev => ({ ...prev, monitoring: { ...prev.monitoring, screenshotInterval: Number(v) } }))}
                  disabled={!isSuperAdmin}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 30].map(v => <SelectItem key={v} value={String(v)}>{v} minutes</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Screenshot Quality</Label>
                <Select
                  value={settings.monitoring.screenshotQuality}
                  onValueChange={(v: "low" | "medium" | "high") => isSuperAdmin && setSettings(prev => ({ ...prev, monitoring: { ...prev.monitoring, screenshotQuality: v } }))}
                  disabled={!isSuperAdmin}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Idle Threshold (minutes): {settings.monitoring.idleThreshold}</Label>
                <Slider
                  value={[settings.monitoring.idleThreshold]}
                  onValueChange={([v]) => isSuperAdmin && setSettings(prev => ({ ...prev, monitoring: { ...prev.monitoring, idleThreshold: v } }))}
                  min={1}
                  max={30}
                  step={1}
                  className="w-64"
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-4">
                {[
                  { key: "enableScreenshots", label: "Enable Screenshots", show: planFeatures["screenshots"] !== false },
                  { key: "enableBrowserHistory", label: "Track Browser History", show: planFeatures["browserHistory"] === true },
                  { key: "enableUsb", label: "Monitor USB Devices", show: planFeatures["usbMonitoring"] === true },
                  { key: "enableClipboard", label: "Monitor Clipboard", show: true },
                  { key: "enableAfterHours", label: "After-Hours Detection", show: true },
                  { key: "enableKeylog", label: "Keylogger (record keystrokes)", show: planFeatures["keylogger"] === true },
                  { key: "enableFileMonitor", label: "File Activity Monitor", show: planFeatures["file_monitor"] === true },
                  { key: "enablePrintMonitor", label: "Print Monitor", show: planFeatures["print_logs"] === true },
                ].filter(item => item.show).map(item => (
                  <div key={item.key} className="flex items-center justify-between max-w-sm">
                    <Label className={isSuperAdmin ? "cursor-pointer" : "cursor-default"}>{item.label}</Label>
                    <Switch
                      checked={(settings.monitoring as any)[item.key] ?? false}
                      onCheckedChange={v => isSuperAdmin && setSettings(prev => ({ ...prev, monitoring: { ...prev.monitoring, [item.key]: v } }))}
                      disabled={!isSuperAdmin}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-4 border-t border-border">
                <Label>Max Employees Allowed: {maxEmployees}</Label>
                <Slider
                  value={[maxEmployees]}
                  onValueChange={([v]) => isSuperAdmin && setMaxEmployees(v)}
                  min={1}
                  max={planMaxEmployees === -1 ? 500 : planMaxEmployees}
                  step={1}
                  className="w-64"
                  disabled={!isSuperAdmin}
                />
                <p className="text-muted-foreground" style={{ fontSize: "12px" }}>
                  Limit the number of employees that can be added to the system.
                </p>
              </div>
              {isSuperAdmin && (
                <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={save}>Save Changes</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Blocked Sites ───────────────────────────────────────────────── */}
        <TabsContent value="blocked">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "16px" }}>Blocked Sites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSuperAdmin && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter domain to block (e.g. facebook.com)"
                    value={newSite}
                    onChange={e => setNewSite(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addBlockedSite()}
                    className="max-w-sm"
                  />
                  <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={addBlockedSite}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {settings.blockedSites.map(site => (
                  <Badge key={site} variant="secondary" className="gap-1 pr-1 py-1">
                    {site}
                    {isSuperAdmin && (
                      <button onClick={() => removeBlockedSite(site)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {settings.blockedSites.length === 0 && (
                  <p className="text-muted-foreground" style={{ fontSize: "13px" }}>No blocked sites configured</p>
                )}
              </div>
              {isSuperAdmin && (
                <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={save}>Save Changes</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── App Categories ──────────────────────────────────────────────── */}
        <TabsContent value="apps">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "16px" }}>Application Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isSuperAdmin && (
                <div className="flex gap-2">
                  <Input
                    placeholder="App name..."
                    value={newApp}
                    onChange={e => setNewApp(e.target.value)}
                    className="max-w-xs"
                  />
                  <Select value={appCategory} onValueChange={(v: any) => setAppCategory(v)}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="productive">Productive</SelectItem>
                      <SelectItem value="nonProductive">Non-Productive</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={addApp}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {(["productive", "nonProductive", "neutral"] as const).map(cat => (
                <div key={cat} className="space-y-2">
                  <h4 className="capitalize flex items-center gap-2" style={{ fontSize: "14px" }}>
                    <span className="w-3 h-3 rounded-full" style={{
                      backgroundColor: cat === "productive" ? "#22c55e" : cat === "nonProductive" ? "#ef4444" : "#94a3b8"
                    }} />
                    {cat === "nonProductive" ? "Non-Productive" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {settings.appCategories[cat].map(app => (
                      <Badge key={app} variant="outline" className="gap-1 pr-1">
                        {app}
                        {isSuperAdmin && (
                          <button onClick={() => removeApp(cat, app)} className="ml-1 hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {settings.appCategories[cat].length === 0 && (
                      <p className="text-muted-foreground" style={{ fontSize: "12px" }}>None</p>
                    )}
                  </div>
                </div>
              ))}
              {isSuperAdmin && (
                <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={save}>Save Changes</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "16px" }}>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Alert Email Addresses</Label>
                {isSuperAdmin && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="email@company.com"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addEmail()}
                      className="max-w-sm"
                    />
                    <Button variant="outline" onClick={addEmail}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {settings.notifications.emailAddresses.map(email => (
                    <Badge key={email} variant="secondary" className="gap-1 pr-1 py-1">
                      {email}
                      {isSuperAdmin && (
                        <button onClick={() => removeEmail(email)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Alert Types</Label>
                {Object.entries(settings.notifications.alertTypes).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between max-w-sm">
                    <label className={`capitalize ${isSuperAdmin ? "cursor-pointer" : "cursor-default"}`} style={{ fontSize: "14px" }}>
                      {key.replace(/_/g, " ")}
                    </label>
                    <Switch
                      checked={enabled}
                      disabled={!isSuperAdmin}
                      onCheckedChange={v => isSuperAdmin && setSettings(prev => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          alertTypes: { ...prev.notifications.alertTypes, [key]: v },
                        },
                      }))}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Idle Threshold (minutes): {settings.notifications.idleThresholdMinutes}</Label>
                <Slider
                  value={[settings.notifications.idleThresholdMinutes]}
                  onValueChange={([v]) => isSuperAdmin && setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, idleThresholdMinutes: v } }))}
                  min={5}
                  max={60}
                  step={5}
                  className="w-64"
                  disabled={!isSuperAdmin}
                />
              </div>
              {isSuperAdmin && (
                <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={save}>Save Changes</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Data Retention ──────────────────────────────────────────────── */}
        <TabsContent value="retention">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "16px" }}>Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { key: "activityDays", label: "Activity Data Retention" },
                { key: "screenshotDays", label: "Screenshot Retention" },
                { key: "alertDays", label: "Alert Retention" },
              ].map(item => (
                <div key={item.key} className="space-y-2">
                  <Label>{item.label}: {(settings.dataRetention as any)[item.key]} days</Label>
                  <Slider
                    value={[(settings.dataRetention as any)[item.key]]}
                    onValueChange={([v]) => isSuperAdmin && setSettings(prev => ({
                      ...prev,
                      dataRetention: { ...prev.dataRetention, [item.key]: v },
                    }))}
                    min={7}
                    max={365}
                    step={1}
                    className="w-80"
                    disabled={!isSuperAdmin}
                  />
                </div>
              ))}
              {isSuperAdmin && (
                <div className="pt-4 border-t border-border space-y-3">
                  <Button variant="destructive" onClick={() => setShowCleanup(true)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Manual Cleanup
                  </Button>
                  <div>
                    <Button
                      variant="destructive"
                      className="bg-red-700 hover:bg-red-800"
                      onClick={() => setShowReset(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Reset ALL Data (Super Admin)
                    </Button>
                    <p className="text-muted-foreground mt-1" style={{ fontSize: "12px" }}>
                      Deletes all activities, screenshots, alerts, browser history — keeps employees and settings.
                    </p>
                  </div>
                  <Button className="bg-[#6366f1] hover:bg-[#5558e6]" onClick={save}>Save Changes</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <AlertDialog open={showCleanup} onOpenChange={setShowCleanup}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Manual Cleanup</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all data older than the retention periods specified above. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-[#ef4444] hover:bg-[#dc2626]" onClick={() => { setShowCleanup(false); toast.success("Cleanup completed!"); }}>
                  Proceed with Cleanup
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showReset} onOpenChange={setShowReset}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600">⚠️ Reset ALL Monitoring Data</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete ALL activities, screenshots, alerts, browser history, keylog, file activity, print logs, and connection events for ALL employees.
                  Employee accounts, admins, and settings will be kept. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-700 hover:bg-red-800"
                  onClick={handleResetAllData}
                  disabled={resetting}
                >
                  {resetting ? "Resetting..." : "Yes, Reset Everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* ── Security (2FA) ──────────────────────────────────────────────── */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: "16px" }}>Account Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 2FA Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#6366f1]" />
                      <span className="text-sm font-semibold">Two-Factor Authentication</span>
                      {user?.twoFactorEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
                          <CheckCircle className="w-3 h-3" /> Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user?.twoFactorEnabled
                        ? "Your account is protected with two-factor authentication. A code from your authenticator app will be required on every login."
                        : "Add an extra layer of security. You'll need a code from an authenticator app (e.g. Google Authenticator) each time you log in."}
                    </p>
                  </div>
                </div>

                {user?.twoFactorEnabled ? (
                  /* Disable 2FA flow */
                  disabling2FA ? (
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                      <p className="text-sm font-medium">Enter your authenticator code to disable 2FA:</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d{6}"
                          maxLength={6}
                          placeholder="000000"
                          value={disable2FACode}
                          onChange={e => setDisable2FACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          disabled={disabling2FALoading}
                          className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-center text-sm font-mono tracking-widest shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <Button
                          onClick={handle2FADisable}
                          disabled={disabling2FALoading || disable2FACode.length !== 6}
                          variant="destructive"
                          size="sm"
                        >
                          {disabling2FALoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                          Confirm Disable
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setDisabling2FA(false); setDisable2FACode(""); }}
                          disabled={disabling2FALoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => setDisabling2FA(true)}
                    >
                      Disable Two-Factor Authentication
                    </Button>
                  )
                ) : (
                  <Button
                    size="sm"
                    className="bg-[#6366f1] hover:bg-[#5558e6] text-white"
                    onClick={() => navigate("/setup-2fa")}
                  >
                    <Shield className="w-3.5 h-3.5 mr-1.5" />
                    Set Up Two-Factor Authentication
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Downloads (Super Admin only) ────────────────────────────────── */}
        {isSuperAdmin && (
          <TabsContent value="downloads">
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: "16px" }}>Agent Downloads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {agentVersionLoading ? (
                  <Skeleton className="h-24 w-full rounded-lg" />
                ) : agentVersion?.downloadUrl ? (
                  <>
                    {/* Chrome download warning notice */}
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Chrome Download Warning</p>
                        <p className="text-xs">
                          Chrome may show a &quot;This file may be dangerous&quot; warning for .exe files.
                          This is normal for unsigned executables. To proceed:{" "}
                          <span className="font-medium">click the arrow (&or;) next to the download → Keep → Keep anyway</span>.
                          Or use a different browser (Edge, Firefox) to avoid this prompt.
                        </p>
                      </div>
                    </div>

                    {/* EmployeeMonitor.exe */}
                    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <p className="font-semibold text-sm">EmployeeMonitor.exe</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Version {agentVersion.version}
                            {agentVersion.checksum && (
                              <> &bull; SHA256: {agentVersion.checksum.slice(0, 20)}&hellip;</>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Main monitoring agent</p>
                        </div>
                        <a href={agentVersion.downloadUrl} target="_blank" rel="noreferrer" download>
                          <Button size="sm" className="bg-[#6366f1] hover:bg-[#5558e6] gap-2">
                            <Download className="w-4 h-4" />
                            Download
                          </Button>
                        </a>
                      </div>
                    </div>

                    {/* EMWatchdog.exe */}
                    {agentVersion.watchdogDownloadUrl ? (
                      <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-1">
                        <div className="flex items-start justify-between flex-wrap gap-3">
                          <div>
                            <p className="font-semibold text-sm">EMWatchdog.exe</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Version {agentVersion.version}
                              {agentVersion.watchdogChecksum && (
                                <> &bull; SHA256: {agentVersion.watchdogChecksum.slice(0, 20)}&hellip;</>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Watchdog service — keeps the agent running</p>
                          </div>
                          <a href={agentVersion.watchdogDownloadUrl} target="_blank" rel="noreferrer" download>
                            <Button size="sm" variant="outline" className="gap-2">
                              <Download className="w-4 h-4" />
                              Download
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Installation Instructions</p>
                      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Download both <span className="font-medium text-foreground">EmployeeMonitor.exe</span> and <span className="font-medium text-foreground">EMWatchdog.exe</span> to the employee&apos;s Windows PC.</li>
                        <li>If Chrome shows a download warning, click the <span className="font-medium text-foreground">arrow (&or;) next to the file → Keep → Keep anyway</span>.</li>
                        <li>Right-click <span className="font-medium text-foreground">EmployeeMonitor.exe</span> and select <span className="font-medium text-foreground">Run as Administrator</span>.</li>
                        <li>Enter the <span className="font-medium text-foreground">Server URL</span> and the employee&apos;s <span className="font-medium text-foreground">Agent Token</span> (found on the Employees page).</li>
                        <li>Place <span className="font-medium text-foreground">EMWatchdog.exe</span> in the same folder — it starts automatically and restarts the agent if it stops.</li>
                        <li>The employee&apos;s activity will appear in this dashboard within a few minutes.</li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <Download className="w-10 h-10 text-muted-foreground mx-auto opacity-30" />
                    <p className="text-sm text-muted-foreground">No installer has been published yet.</p>
                    <p className="text-xs text-muted-foreground">Contact your system administrator to publish the agent executable via the Master Admin panel.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Account & System (Super Admin only) ─────────────────────────── */}
        {isSuperAdmin && (
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: "16px" }}>Account & System Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Data Backup</h3>
                  <p className="text-muted-foreground text-sm">Download a complete backup of all application data in JSON format.</p>
                  <Button
                    variant="outline"
                    onClick={() => setShowDownloadBackup(true)}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Backup
                  </Button>
                </div>

                <div className="border-t pt-6 space-y-3">
                  <h3 className="text-sm font-medium">Delete Account</h3>
                  <p className="text-muted-foreground text-sm">Permanently delete your admin account. You must have at least one other admin in the system.</p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteAccount(true)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete My Account
                  </Button>
                </div>

                <div className="border-t pt-6 space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                    Complete App Reset
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Permanently delete all application data including employees, monitoring data, and settings. All admin accounts will be preserved. This action cannot be undone.
                  </p>
                  <Button
                    className="bg-red-700 hover:bg-red-800 gap-2"
                    onClick={() => setShowResetComplete(true)}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Reset Complete App
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Integrations Tab ─────────────────────────────────────────────── */}
        <TabsContent value="integrations">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Slack className="w-5 h-5 text-[#4A154B]" />
                  Slack Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {slackLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />Loading...
                  </div>
                ) : !slackIntegration ? (
                  /* ── Not connected ─────────────────────────────────────── */
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-5 text-center space-y-3">
                      <Slack className="w-10 h-10 mx-auto text-[#4A154B] opacity-60" />
                      <div>
                        <p className="font-medium">Connect your Slack workspace</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Receive employee monitoring alerts in Slack and send messages to employees directly.
                        </p>
                      </div>
                      {isSuperAdmin && (
                        <Button onClick={() => setSlackConnectOpen(true)} className="gap-2 mt-2">
                          <Slack className="w-4 h-4" />
                          Connect to Slack
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Connected ──────────────────────────────────────────── */
                  <div className="space-y-5">
                    {/* Workspace info */}
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                      <div>
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          Connected to <span className="font-bold">{slackIntegration.teamName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Connected on {new Date(slackIntegration.installedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {isSuperAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto text-destructive hover:text-destructive"
                          onClick={disconnectSlack}
                          disabled={slackDisconnecting}
                        >
                          {slackDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Disconnect"}
                        </Button>
                      )}
                    </div>

                    {/* Enable Slack notifications */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Send Alerts to Slack</Label>
                        <p className="text-xs text-muted-foreground">Post employee monitoring alerts to a Slack channel</p>
                      </div>
                      <Switch
                        checked={slackSettings.slackEnabled}
                        disabled={!isSuperAdmin || slackSaving}
                        onCheckedChange={(v) => saveSlackSettings({ slackEnabled: v })}
                      />
                    </div>

                    {slackSettings.slackEnabled && (
                      <>
                        {/* Channel selector */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Alert Channel</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={loadSlackChannels}
                              disabled={slackChannelsLoading}
                            >
                              {slackChannelsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
                            </Button>
                          </div>
                          <Select
                            value={slackSettings.slackChannelId ?? ""}
                            onValueChange={(v) => saveSlackSettings({ slackChannelId: v || null })}
                            disabled={!isSuperAdmin || slackSaving}
                            onOpenChange={(open) => open && slackChannels.length === 0 && loadSlackChannels()}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a channel..." />
                            </SelectTrigger>
                            <SelectContent>
                              {slackChannels.map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  {ch.isPrivate ? "🔒" : "#"} {ch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Choose which Slack channel receives alert notifications.
                          </p>
                        </div>

                        {/* Alert type filter */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Alert Types to Post</Label>
                          <p className="text-xs text-muted-foreground -mt-1">Leave all unchecked to send all alert types.</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(ALERT_TYPE_LABELS).map(([key, label]) => {
                              const checked = slackSettings.slackAlertTypes.length === 0 || slackSettings.slackAlertTypes.includes(key);
                              return (
                                <div key={key} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`slack-alert-${key}`}
                                    checked={checked}
                                    disabled={!isSuperAdmin}
                                    onCheckedChange={(v) => {
                                      const current = slackSettings.slackAlertTypes.length === 0
                                        ? Object.keys(ALERT_TYPE_LABELS)
                                        : [...slackSettings.slackAlertTypes];
                                      const updated = v ? [...new Set([...current, key])] : current.filter(t => t !== key);
                                      const allSelected = updated.length === Object.keys(ALERT_TYPE_LABELS).length;
                                      saveSlackSettings({ slackAlertTypes: allSelected ? [] : updated });
                                    }}
                                  />
                                  <Label htmlFor={`slack-alert-${key}`} className="text-sm font-normal cursor-pointer">{label}</Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Threading option */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">Thread Replies</Label>
                            <p className="text-xs text-muted-foreground">Keep Slack replies organized in threads</p>
                          </div>
                          <Switch
                            checked={slackSettings.slackThreadReplies}
                            disabled={!isSuperAdmin || slackSaving}
                            onCheckedChange={(v) => saveSlackSettings({ slackThreadReplies: v })}
                          />
                        </div>

                        {/* Test alert button */}
                        {isSuperAdmin && (
                          <div className="pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={sendSlackTestAlert}
                              disabled={slackTesting || !slackSettings.slackChannelId}
                            >
                              {slackTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              Send Test Alert
                            </Button>
                            {!slackSettings.slackChannelId && (
                              <p className="text-xs text-muted-foreground mt-1">Select a channel first to send a test alert.</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <SlackOAuthModal open={slackConnectOpen} onClose={() => setSlackConnectOpen(false)} />

      {/* ── Dialogs (super_admin only - these are never shown to viewers) ── */}
      <AlertDialog open={showDeleteAccount} onOpenChange={(open) => { if (!deletingAccount) setShowDeleteAccount(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">⚠️ Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your admin account. You must have at least one other admin in the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={deletingAccount} onClick={() => setShowDeleteAccount(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-700 hover:bg-red-800"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? "Deleting..." : "Yes, Delete Account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDownloadBackup} onOpenChange={(open) => { if (!downloadingBackup) setShowDownloadBackup(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Download Backup</AlertDialogTitle>
            <AlertDialogDescription>
              This will download a complete backup of all application data. Sensitive information like passwords and keystrokes will be redacted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={downloadingBackup} onClick={() => setShowDownloadBackup(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#6366f1] hover:bg-[#5558e6]"
              onClick={handleDownloadBackup}
              disabled={downloadingBackup}
            >
              {downloadingBackup ? "Downloading..." : "Download"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showResetComplete}
        onOpenChange={(open) => {
          if (!resettingComplete) {
            setShowResetComplete(open);
            if (!open) setResetCompleteConfirm("");
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 text-lg">
              ⚠️ Complete App Reset
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 mt-1 text-sm text-muted-foreground">
                <p>
                  This will permanently delete <strong>ALL</strong> data including employees, monitoring data, activities, screenshots, alerts, and settings.
                </p>
                <p className="font-semibold text-foreground">This action cannot be undone.</p>
                <p>Type the following phrase to confirm:</p>
                <code className="block bg-muted p-2 rounded text-center font-mono text-sm font-bold text-foreground">
                  RESET_COMPLETE_APP
                </code>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Type confirmation phrase..."
            value={resetCompleteConfirm}
            onChange={(e) => setResetCompleteConfirm(e.target.value)}
            className="mt-2"
            disabled={resettingComplete}
          />
          <AlertDialogFooter className="mt-2">
            <Button
              variant="outline"
              disabled={resettingComplete}
              onClick={() => { setShowResetComplete(false); setResetCompleteConfirm(""); }}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-700 hover:bg-red-800"
              onClick={handleResetComplete}
              disabled={resettingComplete || resetCompleteConfirm !== "RESET_COMPLETE_APP"}
            >
              {resettingComplete ? "Resetting..." : "Yes, Reset Completely"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
