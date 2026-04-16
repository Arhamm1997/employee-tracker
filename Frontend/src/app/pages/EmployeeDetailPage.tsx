import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft, Mail, Building, Hash, Clock, Camera, TrendingUp,
  AlertTriangle, Usb, Globe, ChevronLeft, ChevronRight, Upload,
  Wifi, WifiOff, Lock, Power, Monitor, Keyboard, FolderOpen, Printer, ExternalLink,
  Maximize, Minimize, Slack, Send, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { ScrollArea, ScrollBar } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/skeleton";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  apiGetEmployeeDetail, apiUploadAvatar, apiSendRemoteCommand,
  apiGetConnectionHistory, apiGetKeylogHistory, apiGetFileActivity, apiGetPrintLogs,
  apiSendSlackDirectMessage,
  type EmployeeDetailData,
} from "../lib/api";
import type { ConnectionEvent, KeylogEntry, FileActivityEntry, PrintLogEntry } from "../lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useSocket } from "../lib/socket-context";
import { useSubscription, hasFeature } from "../lib/subscription-context";

// STUN servers for WebRTC ICE (NAT traversal on LAN — usually not needed,
// but included for cross-subnet deployments).
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function fmt12(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
    return `${day}, ${time}`;
  } catch { return iso; }
}

export function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { latestActivities, subscribeToMessage, sendWsMessage } = useSocket();
  const { seatInfo, loading: planLoading } = useSubscription();
  const [data, setData] = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenshotModal, setScreenshotModal] = useState<number | null>(null);

  // New feature states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionEvent[]>([]);
  const [keylogHistory, setKeylogHistory] = useState<KeylogEntry[]>([]);
  const [fileActivity, setFileActivity] = useState<FileActivityEntry[]>([]);
  const [printLogs, setPrintLogs] = useState<PrintLogEntry[]>([]);
  const [remoteCommandDialog, setRemoteCommandDialog] = useState<"lock" | "shutdown" | null>(null);
  const [sendingCommand, setSendingCommand] = useState(false);
  const [slackMessageDialog, setSlackMessageDialog] = useState(false);
  const [slackMessage, setSlackMessage] = useState("");
  const [sendingSlackMessage, setSendingSlackMessage] = useState(false);

  // ─── Live screen WebRTC state ─────────────────────────────────────────────
  const [liveScreenOpen, setLiveScreenOpen] = useState(false);
  const [liveViewState, setLiveViewState] = useState<"connecting" | "connected" | "error">("connecting");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [isDialogFullscreen, setIsDialogFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  // Fullscreen toggle for live screen dialog
  const toggleDialogFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      dialogContentRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Sync fullscreen state when user presses Esc or exits fullscreen
  useEffect(() => {
    const handler = () => setIsDialogFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (!id) return;
    apiGetEmployeeDetail(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Load additional data in parallel
    apiGetConnectionHistory(id).then(setConnectionHistory).catch(() => {});
    apiGetKeylogHistory(id).then(setKeylogHistory).catch(() => {});
    apiGetFileActivity(id).then(setFileActivity).catch(() => {});
    apiGetPrintLogs(id).then(setPrintLogs).catch(() => {});
  }, [id]);

  // ─── WebRTC live screen: request → offer → answer → P2P stream ────────────
  useEffect(() => {
    if (!liveScreenOpen || !id) return;

    setLiveViewState("connecting");
    setLiveError(null);

    let offerTimer: ReturnType<typeof setTimeout> | null = null;
    let iceTimer: ReturnType<typeof setTimeout> | null = null;

    // 1. Ask server to tell the agent to start a WebRTC session
    sendWsMessage("webrtc:request", { employeeId: id });

    // Timeout: if no offer arrives in 15s the agent is likely unreachable or crashed
    offerTimer = setTimeout(() => {
      setLiveViewState("error");
      setLiveError("No response from agent. Ensure it is running and aiortc is installed.");
    }, 15000);

    const unsubs: Array<() => void> = [];

    // 2. Server confirms session ID
    unsubs.push(subscribeToMessage("webrtc:session", (_data) => {
      const { sessionId } = _data as { sessionId: string };
      sessionIdRef.current = sessionId;
    }));

    // 3. Agent sent an SDP offer — create RTCPeerConnection and answer
    unsubs.push(subscribeToMessage("webrtc:offer", async (raw) => {
      if (offerTimer) { clearTimeout(offerTimer); offerTimer = null; }

      const { sessionId, sdp } = raw as { sessionId: string; sdp: RTCSessionDescriptionInit; employeeId: string };

      // Ensure we're handling the right session
      if (sessionIdRef.current && sessionIdRef.current !== sessionId) return;
      sessionIdRef.current = sessionId;

      // Close any stale peer connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      // When the video track arrives, attach it to the <video> element
      pc.ontrack = (event) => {
        if (iceTimer) { clearTimeout(iceTimer); iceTimer = null; }
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setLiveViewState("connected");
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          if (iceTimer) { clearTimeout(iceTimer); iceTimer = null; }
          setLiveViewState("error");
          setLiveError("WebRTC connection lost. Close and reopen to retry.");
        }
      };

      try {
        // Set agent's offer as remote description
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Create our answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Trickleless ICE: wait for gathering to complete before sending answer
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") { resolve(); return; }
          const check = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", check);
          // Timeout fallback: send after 5s even if not complete
          setTimeout(resolve, 5000);
        });

        // Send complete SDP answer (with embedded ICE candidates)
        sendWsMessage("webrtc:answer", {
          sessionId,
          sdp: {
            type: pc.localDescription!.type,
            sdp: pc.localDescription!.sdp,
          },
        });

        // ICE timeout: if P2P doesn't connect within 20s, show error
        iceTimer = setTimeout(() => {
          if (pc.connectionState !== "connected") {
            setLiveViewState("error");
            setLiveError("Connection timed out. Agent may be unreachable due to NAT or firewall.");
          }
        }, 20000);
      } catch (err) {
        console.error("WebRTC answer failed:", err);
        setLiveViewState("error");
        setLiveError("Failed to establish WebRTC connection.");
      }
    }));

    // 4. Handle agent disconnecting mid-stream
    unsubs.push(subscribeToMessage("webrtc:disconnected", (raw) => {
      const { employeeId: empId } = raw as { employeeId: string };
      if (empId === id) {
        setLiveViewState("error");
        setLiveError("Agent disconnected from the server.");
      }
    }));

    // 5. Server reported an error (e.g. agent offline or offer creation failed)
    unsubs.push(subscribeToMessage("webrtc:error", (raw) => {
      if (offerTimer) { clearTimeout(offerTimer); offerTimer = null; }
      if (iceTimer) { clearTimeout(iceTimer); iceTimer = null; }
      const { message } = raw as { message: string };
      setLiveViewState("error");
      setLiveError(message || "Failed to start live view.");
    }));

    // Cleanup: close PC and tell server to stop the session
    return () => {
      if (offerTimer) clearTimeout(offerTimer);
      if (iceTimer) clearTimeout(iceTimer);
      unsubs.forEach(u => u());
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (sessionIdRef.current) {
        sendWsMessage("webrtc:stop", { sessionId: sessionIdRef.current });
        sessionIdRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [liveScreenOpen, id, subscribeToMessage, sendWsMessage]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingAvatar(true);
    try {
      const result = await apiUploadAvatar(id, file);
      setData(prev => prev ? { ...prev, employee: { ...prev.employee, avatar: result.avatarUrl } } : prev);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoteCommand = async () => {
    if (!remoteCommandDialog || !id) return;
    setSendingCommand(true);
    try {
      await apiSendRemoteCommand(id, remoteCommandDialog);
      toast.success(`Command "${remoteCommandDialog}" sent successfully`);
      setRemoteCommandDialog(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send command");
    } finally {
      setSendingCommand(false);
    }
  };

  const handleSendSlackMessage = async () => {
    if (!id || !slackMessage.trim()) return;
    setSendingSlackMessage(true);
    try {
      await apiSendSlackDirectMessage(id, slackMessage);
      toast.success("Message sent to Slack!");
      setSlackMessageDialog(false);
      setSlackMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingSlackMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!data || !data.employee) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Employee not found</p>
        <Button onClick={() => navigate("/dashboard/employees")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>
      </div>
    );
  }

  const { employee, screenshots, browserHistory, alerts, usbEvents, topApps, productivity, hourlyActivity, timeline, heatmap } = data;

  const statusColor = employee.status === "online" ? "#22c55e" : employee.status === "idle" ? "#f59e0b" : "#ef4444";

  const timelineColors: Record<string, string> = {
    productive: "#22c55e",
    idle: "#f59e0b",
    offline: "#374151",
    blocked: "#ef4444",
  };

  const productiveData = [
    { name: "Productive", value: productivity.productive, fill: "#22c55e" },
    { name: "Non-Productive", value: productivity.nonProductive, fill: "#ef4444" },
    { name: "Neutral", value: productivity.neutral, fill: "#94a3b8" },
  ];

  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7));
  }

  // Current employee's latest activity from live feed
  const liveActivity = latestActivities.find(a => a.employeeId === id);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/dashboard/employees")} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Employees
      </Button>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Avatar with upload */}
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={employee.avatar} />
                <AvatarFallback style={{ fontSize: "20px" }}>{employee.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
              </Avatar>
              <button
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
                title="Change profile picture"
              >
                <Upload className="w-5 h-5 text-white" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold">{employee.name}</h2>
                <Badge style={{ backgroundColor: statusColor, color: "white", fontSize: "12px" }}>
                  {employee.status}
                </Badge>
                {liveActivity && (
                  <Badge className="bg-[#6366f1] text-white" style={{ fontSize: "11px" }}>
                    Live: {liveActivity.app}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-muted-foreground" style={{ fontSize: "13px" }}>
                <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{employee.code}</span>
                <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5" />{employee.department}</span>
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{employee.email}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Last seen: {employee.lastSeen ? formatDistanceToNow(new Date(employee.lastSeen), { addSuffix: true }) : "Never"}
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-4 mr-2">
              {[
                { label: "Hours", value: `${employee.hoursToday}h`, color: "#6366f1" },
                { label: "Productive", value: `${employee.productivityPercent}%`, color: "#22c55e" },
                { label: "Idle", value: `${productivity.neutral}%`, color: "#f59e0b" },
                { label: "Screenshots", value: String(employee.screenshotCount), color: "#8b5cf6" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="font-bold" style={{ fontSize: "20px", color: s.color }}>{s.value}</p>
                  <p className="text-muted-foreground" style={{ fontSize: "11px" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Remote Commands */}
            {!planLoading && (
              <div className="flex flex-col gap-2">
                {hasFeature(seatInfo, "live_screen") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setLiveScreenOpen(true)}
                >
                  <Monitor className="w-4 h-4" />
                  Live Screen
                </Button>
                )}
                {hasFeature(seatInfo, "lock") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50"
                    onClick={() => setRemoteCommandDialog("lock")}
                  >
                    <Lock className="w-4 h-4" />
                    Lock PC
                  </Button>
                )}
                {hasFeature(seatInfo, "shutdown") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => setRemoteCommandDialog("shutdown")}
                  >
                    <Power className="w-4 h-4" />
                    Shutdown
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-[#4A154B] border-[#4A154B] hover:bg-purple-50"
                  onClick={() => setSlackMessageDialog(true)}
                  title="Send Slack message"
                >
                  <Slack className="w-4 h-4" />
                  Message
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle style={{ fontSize: "16px" }}>Activity Timeline (Today)</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="relative h-14 min-w-[800px]">
              <div className="absolute top-0 left-0 right-0 flex">
                {Array.from({ length: 25 }, (_, i) => (
                  <div key={i} className="flex-1 text-muted-foreground text-center" style={{ fontSize: "10px" }}>
                    {i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`}
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-muted rounded flex overflow-hidden">
                {timeline.map((block, i) => (
                  <div
                    key={i}
                    className="h-full relative group"
                    style={{
                      marginLeft: i === 0 ? `${(block.start / (24 * 60)) * 100}%` : undefined,
                      width: `${((block.end - block.start) / (24 * 60)) * 100}%`,
                      backgroundColor: timelineColors[block.type],
                    }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-card border border-border rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none" style={{ fontSize: "11px" }}>
                      {block.type} | {Math.floor(block.start / 60)}:{String(block.start % 60).padStart(2, "0")} - {Math.floor(block.end / 60)}:{String(block.end % 60).padStart(2, "0")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <div className="flex gap-4 mt-3">
            {Object.entries(timelineColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-muted-foreground capitalize" style={{ fontSize: "11px" }}>{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="charts">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="charts">Charts</TabsTrigger>
          {hasFeature(seatInfo, "screenshots") && <TabsTrigger value="screenshots">Screenshots</TabsTrigger>}
          {hasFeature(seatInfo, "browserHistory") && <TabsTrigger value="browser">Browser History</TabsTrigger>}
          {hasFeature(seatInfo, "alerts") && <TabsTrigger value="alerts">Alerts</TabsTrigger>}
          {hasFeature(seatInfo, "usbMonitoring") && <TabsTrigger value="usb">USB Events</TabsTrigger>}
          <TabsTrigger value="connection">Connection Log</TabsTrigger>
          {hasFeature(seatInfo, "keylogger") && <TabsTrigger value="keylog">Keylog</TabsTrigger>}
          {hasFeature(seatInfo, "file_monitor") && <TabsTrigger value="files">File Activity</TabsTrigger>}
          {hasFeature(seatInfo, "print_logs") && <TabsTrigger value="prints">Print Logs</TabsTrigger>}
        </TabsList>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle style={{ fontSize: "14px" }}>App Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={topApps}
                      cx="50%" cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                      labelLine={false}
                      style={{ fontSize: "10px" }}
                    >
                      {topApps.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle style={{ fontSize: "14px" }}>Productivity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={productiveData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name} ${value}%`}
                      labelLine={false}
                      style={{ fontSize: "10px" }}
                    >
                      {productiveData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle style={{ fontSize: "14px" }}>Hourly Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hour" stroke="var(--muted-foreground)" style={{ fontSize: "11px" }} />
                    <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "11px" }} />
                    <RTooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                    <Bar dataKey="productive" fill="#22c55e" radius={[2, 2, 0, 0]} name="Productive" />
                    <Bar dataKey="idle" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Idle" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle style={{ fontSize: "14px" }}>Weekly Activity Heatmap (26 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="flex gap-[2px] min-w-[700px]">
                  {weeks.slice(-26).map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[2px]">
                      {week.map((day, di) => {
                        const colors = ["#1e1e2e", "#1a3a1a", "#22c55e66", "#22c55eaa", "#22c55e"];
                        return (
                          <div
                            key={di}
                            className="w-3 h-3 rounded-sm group relative"
                            style={{ backgroundColor: colors[Math.min(day.count, 4)] || colors[0] }}
                          >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-card border border-border rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none" style={{ fontSize: "10px" }}>
                              {day.date}: {day.count} slots
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Screenshots Tab */}
        <TabsContent value="screenshots">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {screenshots.length > 0 ? screenshots.map((ss, i) => (
              <motion.div
                key={ss.id}
                whileHover={{ scale: 1.03 }}
                className="cursor-pointer rounded-lg overflow-hidden border border-border"
                onClick={() => setScreenshotModal(i)}
              >
                <img src={ss.imageUrl} alt="" className="w-full h-24 object-cover" />
                <div className="p-2">
                  <p className="truncate text-muted-foreground" style={{ fontSize: "11px" }}>{ss.app}</p>
                  <p className="text-muted-foreground" style={{ fontSize: "10px" }}>
                    {format(new Date(ss.timestamp), "h:mm a")}
                  </p>
                </div>
              </motion.div>
            )) : (
              <div className="col-span-full text-center py-10">
                <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No screenshots available</p>
              </div>
            )}
          </div>

          <Dialog open={screenshotModal !== null} onOpenChange={() => setScreenshotModal(null)}>
            <DialogContent className="max-w-4xl p-0">
              {screenshotModal !== null && screenshots[screenshotModal] && (
                <div>
                  <img src={screenshots[screenshotModal].imageUrl} alt="" className="w-full rounded-t-lg" />
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: "14px" }}>{screenshots[screenshotModal].app}</p>
                      <p className="text-muted-foreground" style={{ fontSize: "12px" }}>
                        {fmt12(screenshots[screenshotModal].timestamp)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={screenshotModal === 0}
                        onClick={() => setScreenshotModal(p => p !== null ? p - 1 : null)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={screenshotModal === screenshots.length - 1}
                        onClick={() => setScreenshotModal(p => p !== null ? p + 1 : null)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Browser History Tab */}
        <TabsContent value="browser">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {browserHistory.length > 0 ? browserHistory.map(bh => (
                    <TableRow key={bh.id} className={bh.blocked ? "bg-[#ef4444]/5" : ""}>
                      <TableCell style={{ fontSize: "12px" }} className="max-w-[200px] truncate">
                        <div className="flex items-center gap-1.5">
                          {bh.blocked && <Badge className="bg-red-500 text-white" style={{ fontSize: "9px", padding: "1px 4px" }}>Blocked</Badge>}
                          <span className="truncate">{bh.url}</span>
                        </div>
                      </TableCell>
                      <TableCell style={{ fontSize: "12px" }}>{bh.title}</TableCell>
                      <TableCell style={{ fontSize: "12px" }}>{bh.browser}</TableCell>
                      <TableCell style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{fmt12(bh.time)}</TableCell>
                      <TableCell style={{ fontSize: "12px" }}>{bh.duration}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No browser history available</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <div className="space-y-3">
            {alerts.length > 0 ? alerts.map(alert => (
              <Card key={alert.id} className={`border-l-4 ${
                alert.severity === "high" ? "border-l-[#ef4444]" : alert.severity === "medium" ? "border-l-[#f59e0b]" : "border-l-[#22c55e]"
              }`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: alert.severity === "high" ? "#ef4444" : alert.severity === "medium" ? "#f59e0b" : "#22c55e" }} />
                  <div className="flex-1">
                    <p style={{ fontSize: "14px" }}>{alert.message}</p>
                    <p className="text-muted-foreground" style={{ fontSize: "12px" }}>{fmt12(alert.timestamp)}</p>
                  </div>
                  <Badge style={{ backgroundColor: alert.severity === "high" ? "#ef4444" : alert.severity === "medium" ? "#f59e0b" : "#22c55e", color: "white", fontSize: "11px" }}>
                    {alert.severity}
                  </Badge>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-10">
                <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No alerts for this employee</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* USB Events Tab */}
        <TabsContent value="usb">
          <div className="space-y-3">
            {usbEvents.length > 0 ? usbEvents.map(evt => (
              <Card key={evt.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Usb className="w-5 h-5 shrink-0" style={{ color: evt.type === "connected" ? "#22c55e" : "#ef4444" }} />
                  <div className="flex-1">
                    <p style={{ fontSize: "14px" }}>{evt.device}</p>
                    <p className="text-muted-foreground" style={{ fontSize: "12px" }}>{fmt12(evt.time)}</p>
                  </div>
                  <Badge style={{ backgroundColor: evt.type === "connected" ? "#22c55e" : "#ef4444", color: "white", fontSize: "11px" }}>
                    {evt.type}
                  </Badge>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-10">
                <Usb className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No USB events recorded</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Connection Log Tab */}
        <TabsContent value="connection">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
                <Wifi className="w-4 h-4" />
                Connection History (Online / Offline / Shutdown)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead>Relative</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectionHistory.length > 0 ? connectionHistory.map(ev => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: ev.event === "online" ? "#22c55e" : ev.event === "shutdown" ? "#6366f1" : "#ef4444",
                            color: "white", fontSize: "11px",
                          }}
                          className="gap-1"
                        >
                          {ev.event === "online" ? <Wifi className="w-3 h-3" /> : ev.event === "shutdown" ? <Power className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {ev.event}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ fontSize: "13px", whiteSpace: "nowrap" }}>{fmt12(ev.timestamp)}</TableCell>
                      <TableCell className="text-muted-foreground" style={{ fontSize: "12px" }}>
                        {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        <WifiOff className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No connection history recorded yet</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keylog Tab */}
        <TabsContent value="keylog">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
                <Keyboard className="w-4 h-4" />
                Keylog Entries
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {keylogHistory.length === 0 ? (
                <div className="text-center py-10">
                  <Keyboard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No keylog data. Enable Keylogger in Settings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>App</TableHead>
                      <TableHead>Keys</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keylogHistory.map(e => (
                      <TableRow key={e.id}>
                        <TableCell style={{ fontSize: "12px" }}>{e.appName}</TableCell>
                        <TableCell style={{ fontSize: "12px", maxWidth: "300px" }}>
                          <code className="bg-muted px-1 py-0.5 rounded text-xs break-all">{e.keys}</code>
                        </TableCell>
                        <TableCell style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{fmt12(e.timestamp)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Activity Tab */}
        <TabsContent value="files">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
                <FolderOpen className="w-4 h-4" />
                File Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {fileActivity.length === 0 ? (
                <div className="text-center py-10">
                  <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No file activity data. Enable File Monitor in Settings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>File Path</TableHead>
                      <TableHead>App</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fileActivity.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Badge variant="outline" style={{ fontSize: "11px" }}>{a.action}</Badge>
                        </TableCell>
                        <TableCell style={{ fontSize: "12px", maxWidth: "250px" }}>
                          <span className="truncate block">{a.filePath}</span>
                        </TableCell>
                        <TableCell style={{ fontSize: "12px" }}>{a.appName}</TableCell>
                        <TableCell style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{fmt12(a.timestamp)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Print Logs Tab */}
        <TabsContent value="prints">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
                <Printer className="w-4 h-4" />
                Print Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {printLogs.length === 0 ? (
                <div className="text-center py-10">
                  <Printer className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No print logs. Enable Print Monitor in Settings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Printer</TableHead>
                      <TableHead>Pages</TableHead>
                      <TableHead>App</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printLogs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell style={{ fontSize: "12px" }}>{l.document}</TableCell>
                        <TableCell style={{ fontSize: "12px" }}>{l.printer}</TableCell>
                        <TableCell style={{ fontSize: "12px" }}>{l.pages}</TableCell>
                        <TableCell style={{ fontSize: "12px" }}>{l.appName}</TableCell>
                        <TableCell style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{fmt12(l.timestamp)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Live Screen Dialog — WebRTC P2P */}
      <Dialog open={liveScreenOpen} onOpenChange={(open) => {
        setLiveScreenOpen(open);
        if (!open) {
          setLiveViewState("connecting");
          // Exit fullscreen if dialog is closed while fullscreen
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        }
      }}>
        <DialogContent
          ref={dialogContentRef}
          className={
            isDialogFullscreen
              ? "fixed inset-0 max-w-none w-screen h-screen rounded-none border-none bg-black flex flex-col p-0"
              : "max-w-5xl"
          }
        >
          <DialogHeader className={isDialogFullscreen ? "px-4 py-2 bg-[#0f0f1a] border-b border-white/10 shrink-0" : "pr-8"}>
            <div className="flex items-center justify-between">
              <DialogTitle className={`flex items-center gap-2 ${isDialogFullscreen ? "text-white" : ""}`}>
                <Monitor className="w-5 h-5 text-[#6366f1]" />
                Live Screen — {employee.name}
                {liveViewState === "connected" && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
                  </span>
                )}
              </DialogTitle>
              <div className="flex items-center gap-1">
                <button
                  className={`p-1.5 rounded transition-colors ${isDialogFullscreen ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}
                  title={isDialogFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  onClick={toggleDialogFullscreen}
                >
                  {isDialogFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
                <button
                  className={`p-1.5 rounded transition-colors ${isDialogFullscreen ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}
                  title="Open in new tab"
                  onClick={() => {
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                    setLiveScreenOpen(false);
                    window.open(`/live-screen/${id}`, "_blank");
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
            <DialogDescription className={isDialogFullscreen ? "text-white/40 text-xs" : ""}>
              {liveViewState === "connected"
                ? "WebRTC P2P — video streams directly from agent to your browser."
                : liveViewState === "connecting"
                ? "Establishing WebRTC connection…"
                : "Connection error — close and retry."}
            </DialogDescription>
          </DialogHeader>

          <div className={`relative bg-black overflow-hidden flex items-center justify-center ${isDialogFullscreen ? "flex-1" : "rounded-lg min-h-[400px]"}`}>
            {/* Video element — always in DOM so srcObject assignment works */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onDoubleClick={toggleDialogFullscreen}
              className={`w-full h-full object-contain ${liveViewState === "connected" ? "block" : "hidden"}`}
            />

            {liveViewState === "connecting" && (
              <div className="text-center text-white/60">
                <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm">Connecting to agent via WebRTC…</p>
                <p className="text-xs mt-1 opacity-50">This usually takes 1–3 seconds on a local network.</p>
              </div>
            )}

            {liveViewState === "error" && (
              <div className="text-center text-white/60 px-6">
                <Monitor className="w-14 h-14 mx-auto mb-3 opacity-20" />
                <p className="text-sm text-red-400">{liveError || "Connection failed."}</p>
                <p className="text-xs mt-2 opacity-50">Make sure the agent is online and has aiortc installed.</p>
                <button
                  className="mt-4 px-4 py-1.5 text-xs rounded border border-white/20 hover:bg-white/10 transition-colors text-white"
                  onClick={() => {
                    setLiveViewState("connecting");
                    setLiveError(null);
                    sendWsMessage("webrtc:request", { employeeId: id });
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote Command Confirmation Dialog */}
      <Dialog open={!!remoteCommandDialog} onOpenChange={() => setRemoteCommandDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${remoteCommandDialog === "shutdown" ? "text-red-600" : "text-orange-600"}`}>
              {remoteCommandDialog === "lock" ? <Lock className="w-5 h-5" /> : <Power className="w-5 h-5" />}
              {remoteCommandDialog === "lock" ? "Lock Computer" : "Shutdown Computer"}
            </DialogTitle>
            <DialogDescription>
              {remoteCommandDialog === "lock"
                ? `This will lock ${employee.name}'s computer. They will need to enter their password to log back in.`
                : `This will shut down ${employee.name}'s computer. Any unsaved work will be lost.`}
              {" "}The command will be executed the next time the agent checks in (within 1 minute).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoteCommandDialog(null)}>Cancel</Button>
            <Button
              variant={remoteCommandDialog === "shutdown" ? "destructive" : "default"}
              className={remoteCommandDialog === "lock" ? "bg-orange-500 hover:bg-orange-600" : ""}
              onClick={handleRemoteCommand}
              disabled={sendingCommand}
            >
              {sendingCommand ? "Sending..." : `Send ${remoteCommandDialog === "lock" ? "Lock" : "Shutdown"} Command`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slack Message Dialog */}
      <Dialog open={slackMessageDialog} onOpenChange={setSlackMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#4A154B]">
              <Slack className="w-5 h-5" />
              Send Slack Message to {data?.employee?.name}
            </DialogTitle>
            <DialogDescription>
              Send a direct message to {data?.employee?.name} via Slack. They'll receive it as a DM from the Employee Monitor bot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <textarea
              placeholder="Type your message here..."
              value={slackMessage}
              onChange={(e) => setSlackMessage(e.target.value)}
              className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#4A154B] resize-none"
              rows={4}
              disabled={sendingSlackMessage}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlackMessageDialog(false)} disabled={sendingSlackMessage}>
              Cancel
            </Button>
            <Button
              onClick={handleSendSlackMessage}
              disabled={sendingSlackMessage || !slackMessage.trim()}
              className="bg-[#4A154B] hover:bg-[#3d0f3d] gap-2"
            >
              {sendingSlackMessage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}