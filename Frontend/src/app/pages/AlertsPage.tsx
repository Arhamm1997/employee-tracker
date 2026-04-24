import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle, Check, CheckCheck, Trash2,
  ShieldAlert, Clock, Usb, Download, Activity, MessageSquare
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "../components/ui/alert-dialog";
import { apiGetAlerts, apiMarkAlertRead, apiMarkAllAlertsRead, apiDeleteAlert, apiGetEmployees, apiGetSlackIntegration } from "../lib/api";
import type { Alert, Employee } from "../lib/types";
import { SlackRepliesBadge, SlackMessagesPanel } from "../components/slack/SlackMessagesPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSocket } from "../lib/socket-context";

const typeIcons: Record<string, React.ReactNode> = {
  blocked_site: <ShieldAlert className="w-5 h-5" />,
  after_hours: <Clock className="w-5 h-5" />,
  usb_connected: <Usb className="w-5 h-5" />,
  idle_long: <Clock className="w-5 h-5" />,
  new_software: <Download className="w-5 h-5" />,
  low_activity: <Activity className="w-5 h-5" />,
};

const typeLabels: Record<string, string> = {
  blocked_site: "Blocked Site",
  after_hours: "After Hours",
  usb_connected: "USB Connected",
  idle_long: "Idle 30min+",
  new_software: "New Software",
  low_activity: "Low Activity",
};

const severityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("All");
  const [type, setType] = useState("All");
  const [readFilter, setReadFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [slackPanelAlertId, setSlackPanelAlertId] = useState<string | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const { setUnreadAlerts, latestAlerts } = useSocket();

  // Check if Slack is connected
  useEffect(() => {
    apiGetSlackIntegration()
      .then(res => setSlackConnected(res.connected))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([apiGetAlerts(), apiGetEmployees()])
      .then(([alertsData, employeesData]) => {
        setAlerts(alertsData);
        setEmployees(employeesData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Keep unread count in sync whenever alerts list changes
  useEffect(() => {
    setUnreadAlerts(alerts.filter(a => !a.read).length);
  }, [alerts, setUnreadAlerts]);

  // Auto-update when new alerts arrive via WebSocket
  useEffect(() => {
    if (latestAlerts.length === 0) return;
    const newest = latestAlerts[0];
    setAlerts(prev => {
      if (prev.some(a => a.id === newest.id)) return prev;
      return [newest, ...prev];
    });
  }, [latestAlerts]);

  const filtered = useMemo(() => {
    let data = [...alerts];
    if (severity !== "All") data = data.filter(a => a.severity === severity);
    if (type !== "All") data = data.filter(a => a.type === type);
    if (readFilter === "unread") data = data.filter(a => !a.read);
    if (readFilter === "read") data = data.filter(a => a.read);
    if (employeeFilter !== "All") data = data.filter(a => a.employeeId === employeeFilter);
    return data;
  }, [alerts, severity, type, readFilter, employeeFilter]);

  const markRead = async (id: string) => {
    try {
      await apiMarkAlertRead(id);
      setAlerts(prev => {
        const updated = prev.map(a => a.id === id ? { ...a, read: true } : a);
        setUnreadAlerts(updated.filter(a => !a.read).length);
        return updated;
      });
    } catch {
      toast.error("Failed to mark alert as read");
    }
  };

  const markAllRead = async () => {
    try {
      await apiMarkAllAlertsRead();
      setAlerts(prev => {
        const updated = prev.map(a => ({ ...a, read: true }));
        setUnreadAlerts(0);
        return updated;
      });
      toast.success("All alerts marked as read");
    } catch {
      toast.error("Failed to mark all alerts as read");
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await apiDeleteAlert(id);
      setAlerts(prev => {
        const updated = prev.filter(a => a.id !== id);
        setUnreadAlerts(updated.filter(a => !a.read).length);
        return updated;
      });
      setDeleteId(null);
      toast.success("Alert deleted");
    } catch {
      toast.error("Failed to delete alert");
    }
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-36" />)}
        </div>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2>Alerts</h2>
          {unreadCount > 0 && (
            <Badge className="bg-[#ef4444] hover:bg-[#ef4444] text-white">{unreadCount} unread</Badge>
          )}
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck className="w-4 h-4 mr-2" />
          Mark All Read
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Severity</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Read Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Employees</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.length > 0 ? filtered.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card className={`border-l-4 ${!alert.read ? "bg-muted/30" : ""}`} style={{ borderLeftColor: severityColors[alert.severity] }}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div style={{ color: severityColors[alert.severity] }}>
                    {typeIcons[alert.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p style={{ fontSize: "14px" }}>{alert.message}</p>
                      {!alert.read && (
                        <span className="w-2 h-2 rounded-full bg-[#6366f1] shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-muted-foreground" style={{ fontSize: "12px" }}>{alert.employeeName}</span>
                      <span className="text-muted-foreground" style={{ fontSize: "12px" }}>|</span>
                      <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
                        {format(new Date(alert.timestamp), "PPpp")}
                      </span>
                      {slackConnected && alert.sentToSlack && (
                        <SlackRepliesBadge
                          alertId={alert.id}
                          initialUnreadCount={alert.slackUnreadCount ?? 0}
                          onClick={() => setSlackPanelAlertId(alert.id)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge style={{ backgroundColor: severityColors[alert.severity], color: "white", fontSize: "10px" }}>
                      {alert.severity}
                    </Badge>
                    {!alert.read && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markRead(alert.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(alert.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )) : (
            <div className="text-center py-16">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No alerts match your filters</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this alert? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#ef4444] hover:bg-[#dc2626]" onClick={() => deleteId && deleteAlert(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Slack Messages Panel (Sheet) */}
      <Sheet open={!!slackPanelAlertId} onOpenChange={(open) => !open && setSlackPanelAlertId(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[480px] p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Slack Thread</SheetTitle>
          </SheetHeader>
          {slackPanelAlertId && (
            <SlackMessagesPanel
              alertId={slackPanelAlertId}
              onClose={() => setSlackPanelAlertId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
