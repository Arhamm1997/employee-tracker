import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Wifi, Clock, WifiOff, TrendingUp, AlertTriangle,
  Activity, Monitor
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { ScrollArea } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/skeleton";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { apiGetDashboard, type DashboardData } from "../lib/api";
import { useSocket } from "../lib/socket-context";
import { useAuth } from "../lib/auth-types";
import { formatDistanceToNow } from "date-fns";

export function DashboardPage() {
  const navigate = useNavigate();
  const { latestActivities } = useSocket();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load dashboard data.</p>
      </div>
    );
  }

  const { stats, weeklyProductivity, topApps, hourlyActivity, deptComparison, afterHoursEmployees, recentEmployees } = data;

  const statCards = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users, color: "#6366f1", bg: "bg-[#6366f1]/10" },
    { label: "Online", value: stats.online, icon: Wifi, color: "#22c55e", bg: "bg-[#22c55e]/10", pulse: true },
    { label: "Idle", value: stats.idle, icon: Clock, color: "#f59e0b", bg: "bg-[#f59e0b]/10" },
    { label: "Offline", value: stats.offline, icon: WifiOff, color: "#ef4444", bg: "bg-[#ef4444]/10" },
    { label: "Avg Productivity", value: `${stats.avgProductivity}%`, icon: TrendingUp, color: "#8b5cf6", bg: "bg-[#8b5cf6]/10" },
    { label: "Alerts Today", value: stats.alertsToday, icon: AlertTriangle, color: "#f59e0b", bg: "bg-[#f59e0b]/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
        {user?.companyName && (
          <p className="text-muted-foreground text-sm">{user.companyName}</p>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  {stat.pulse && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22c55e]" />
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground" style={{ fontSize: "12px" }}>{stat.label}</p>
                <p style={{ fontSize: "24px", color: stat.color }}>{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Productivity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle style={{ fontSize: "16px" }}>7-Day Productivity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyProductivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                <RTooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }}
                />
                <Bar dataKey="productive" fill="#6366f1" radius={[4, 4, 0, 0]} name="Productive %" />
                <Bar dataKey="idle" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Idle %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 5 Apps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle style={{ fontSize: "16px" }}>Top 5 Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={topApps}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {topApps.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }}
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value, entry: any) => {
                    const total = topApps.reduce((s, a) => s + (a.value || 0), 0);
                    const pct = total > 0 ? Math.round(((entry.payload?.value || 0) / total) * 100) : 0;
                    return (
                      <span style={{ fontSize: "12px", color: "var(--foreground)" }}>
                        {value} {pct}%
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active vs Idle Hourly */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle style={{ fontSize: "16px" }}>Active vs Idle (Hourly)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                <RTooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }}
                />
                <Line type="monotone" dataKey="active" stroke="#22c55e" strokeWidth={2} dot={false} name="Active" />
                <Line type="monotone" dataKey="idle" stroke="#f59e0b" strokeWidth={2} dot={false} name="Idle" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle style={{ fontSize: "16px" }}>Department Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={deptComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="department" stroke="var(--muted-foreground)" style={{ fontSize: "11px" }} />
                <YAxis stroke="var(--muted-foreground)" style={{ fontSize: "12px" }} />
                <RTooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }}
                />
                <Area type="monotone" dataKey="productivity" fill="#6366f1" fillOpacity={0.2} stroke="#6366f1" strokeWidth={2} name="Productivity %" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Live Feed + Employee Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Activity Feed */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
              <Activity className="w-4 h-4 text-[#22c55e]" />
              Live Feed
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] overflow-y-auto">
              <div className="px-4 pb-4 space-y-2">
                <AnimatePresence initial={false}>
                  {latestActivities.length > 0 ? latestActivities.slice(0, 20).map((act, i) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={act.avatar} />
                        <AvatarFallback style={{ fontSize: "11px" }}>{act.employeeName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ fontSize: "13px" }}>{act.employeeName}</p>
                        <p className="text-muted-foreground truncate" style={{ fontSize: "11px" }}>
                          {act.app} - {act.windowTitle}
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-muted-foreground" style={{ fontSize: "10px" }}>
                          {formatDistanceToNow(new Date(act.time), { addSuffix: true })}
                        </span>
                        <Badge
                          variant={act.type === "productive" ? "default" : act.type === "idle" ? "secondary" : "outline"}
                          className={`mt-0.5 ${act.type === "productive" ? "bg-[#22c55e] hover:bg-[#22c55e]" : act.type === "idle" ? "bg-[#f59e0b] hover:bg-[#f59e0b] text-white" : ""}`}
                          style={{ fontSize: "10px", padding: "0 6px", height: "18px" }}
                        >
                          {act.type}
                        </Badge>
                      </div>
                    </motion.div>
                  )) : (
                    <p className="text-muted-foreground text-center py-8" style={{ fontSize: "13px" }}>
                      No live activity yet
                    </p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
              <Monitor className="w-4 h-4" />
              Employee Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {recentEmployees.slice(0, 16).map(emp => (
                <motion.div
                  key={emp.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/dashboard/employees/${emp.id}`)}
                  className={`cursor-pointer rounded-lg border-2 p-3 transition-colors hover:bg-muted/50 ${
                    emp.status === "online" ? "border-[#22c55e]" :
                    emp.status === "idle" ? "border-[#f59e0b]" : "border-[#ef4444]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={emp.avatar} />
                      <AvatarFallback style={{ fontSize: "10px" }}>{emp.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: "12px" }}>{emp.name}</p>
                      <p className="text-muted-foreground truncate" style={{ fontSize: "10px" }}>{emp.department}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground truncate" style={{ fontSize: "11px" }}>
                    {emp.currentApp}
                  </p>
                  <p className="text-muted-foreground" style={{ fontSize: "10px" }}>
                    {emp.status === "online" ? "Active now" : emp.lastSeen ? formatDistanceToNow(new Date(emp.lastSeen), { addSuffix: true }) : "Never"}
                  </p>
                </motion.div>
              ))}
              {recentEmployees.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <p className="text-muted-foreground" style={{ fontSize: "13px" }}>No employees found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* After-Hours Widget */}
      <Card className="border-[#f59e0b]/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2" style={{ fontSize: "16px" }}>
            <Clock className="w-4 h-4 text-[#f59e0b]" />
            After-Hours Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {afterHoursEmployees.length > 0 ? (
            <div className="space-y-3">
              {afterHoursEmployees.map(emp => (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={emp.avatar} />
                    <AvatarFallback style={{ fontSize: "10px" }}>{emp.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p style={{ fontSize: "14px" }}>{emp.name}</p>
                    <p className="text-muted-foreground" style={{ fontSize: "12px" }}>{emp.department}</p>
                  </div>
                  <Badge className="bg-[#f59e0b] hover:bg-[#f59e0b] text-white" style={{ fontSize: "12px" }}>
                    {emp.afterHoursTime}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No after-hours activity detected</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
