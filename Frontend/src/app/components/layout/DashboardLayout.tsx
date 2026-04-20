import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { usePlanUpgradeConfetti } from "../../hooks/usePlanUpgradeConfetti";
import {
  LayoutDashboard, Users, Camera, AlertTriangle, FileText,
  Settings, Shield, Bell, Moon, Sun, LogOut, Menu, ChevronLeft,
  ChevronDown, LifeBuoy, Megaphone, Sparkles, Slack, MessageSquare
} from "lucide-react";
import {
  apiGetChangelog, apiMarkAllChangelogRead,
  type ChangelogEntry,
} from "../../lib/api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useAuth } from "../../lib/auth-types";
import { useTheme } from "../../lib/theme-context";
import { useSocket } from "../../lib/socket-context";
import { useSubscription, hasFeature } from "../../lib/subscription-context";
import { ConnectionStatus } from "./ConnectionStatus";

const ALL_NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, feature: null },
  { path: "/dashboard/employees", label: "Employees", icon: Users, feature: null },
  { path: "/dashboard/screenshots", label: "Screenshots", icon: Camera, feature: "screenshots" },
  { path: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle, hasBadge: true, feature: "alerts" },
  { path: "/dashboard/reports", label: "Reports", icon: FileText, feature: null },
  { path: "/dashboard/messages", label: "Messages", icon: MessageSquare, hasBadge: true, badgeKey: "messages" as const, feature: null },
  { path: "/dashboard/settings", label: "Settings", icon: Settings, feature: null },
  { path: "/dashboard/settings?tab=integrations", label: "Integrations", icon: Slack, feature: null },
  { path: "/dashboard/support", label: "Support", icon: LifeBuoy, feature: null },
];

const adminItem = { path: "/dashboard/admins", label: "Admin", icon: Shield, feature: null };

function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/dashboard/employees/")) return "Employee Details";
  if (pathname === "/dashboard/employees") return "Employees";
  if (pathname === "/dashboard/screenshots") return "Screenshots";
  if (pathname === "/dashboard/alerts") return "Alerts";
  if (pathname === "/dashboard/reports") return "Reports";
  if (pathname === "/dashboard/settings") return "Settings";
  if (pathname === "/dashboard/admins") return "Admin Panel";
  if (pathname === "/dashboard/support") return "Support";
  if (pathname === "/dashboard/whats-new") return "What's New";
  return "Dashboard";
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [changelogUnread, setChangelogUnread] = useState(0);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout, isAuthenticated, loading } = useAuth();
  const { isDark, toggle } = useTheme();
  const { unreadAlerts, latestAlerts, unreadMessages } = useSocket();
  const { seatInfo } = useSubscription();
  const { upgradedTo, dismissBanner } = usePlanUpgradeConfetti(seatInfo);

  const loadChangelog = useCallback(async () => {
    try {
      const res = await apiGetChangelog();
      setChangelogEntries(res.entries);
      setChangelogUnread(res.unreadCount);
    } catch {
      // silently fail — changelog is non-critical
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadChangelog();
    }
  }, [isAuthenticated, loadChangelog]);

  async function handleOpenChangelog() {
    setChangelogOpen(true);
    if (changelogUnread > 0) {
      try {
        await apiMarkAllChangelogRead();
        setChangelogEntries(prev => prev.map(e => ({ ...e, isRead: true })));
        setChangelogUnread(0);
      } catch {
        // non-critical
      }
    }
  }

  const TYPE_ICONS: Record<string, string> = {
    feature: "✨",
    improvement: "⚡",
    fix: "🔧",
    security: "🔒",
  };

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-[#6366f1] border-t-transparent rounded-full" />
      </div>
    );
  }

  const isSuperAdmin = user?.role === "super_admin";

  // Filter nav items based on plan features using hasFeature for consistent logic
  const filteredNavItems = ALL_NAV_ITEMS.filter(item => {
    if (item.feature === null) return true;
    return hasFeature(seatInfo, item.feature);
  });
  const allNavItems = isSuperAdmin ? [...filteredNavItems, adminItem] : filteredNavItems;
  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
    const expanded = sidebarOpen || mobile;
    return (
    <div className="flex flex-col h-full bg-[#1e1e2e] text-[#e2e8f0]">
      {/* Logo */}
      <div className={`flex items-center border-b border-[#2a2a3e] h-16 shrink-0 ${expanded ? "gap-3 px-5" : "justify-center px-2"}`}>
        <div className="w-9 h-9 rounded-lg bg-[#6366f1] flex items-center justify-center shrink-0">
          <Shield className="w-4.5 h-4.5 text-white" />
        </div>
        {expanded && (
          <div className="flex flex-col">
            <span className="text-white font-semibold whitespace-nowrap" style={{ fontSize: "15px" }}>MonitorHub</span>
            {user?.companyName && (
              <span className="text-[#a78bfa] whitespace-nowrap truncate" style={{ fontSize: "11px" }}>{user.companyName}</span>
            )}
          </div>
        )}
        {!mobile && expanded && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-[#94a3b8] hover:text-white hidden lg:block p-1 rounded-md hover:bg-[#2a2a3e] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 transition-transform" />
          </button>
        )}
        {!mobile && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute -right-3 top-5 w-6 h-6 bg-[#2a2a3e] border border-[#3a3a4e] rounded-full flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-[#6366f1] transition-colors hidden lg:flex z-10"
          >
            <ChevronLeft className="w-3 h-3 rotate-180" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${expanded ? "px-3" : "px-2"}`}>
        {allNavItems.map(item => {
          // Parse the item path — may include a query string (e.g. ?tab=integrations)
          const [itemPathname, itemQuery] = item.path.split("?");
          const itemSearchParam = itemQuery ? new URLSearchParams(itemQuery) : null;
          const isActive = item.path === "/dashboard"
            ? location.pathname === "/dashboard"
            : itemSearchParam
              // Items with a query string: match pathname AND the specific query param
              ? location.pathname === itemPathname && searchParams.get(itemSearchParam.keys().next().value) === itemSearchParam.values().next().value
              : location.pathname.startsWith(itemPathname);
          return (
            <TooltipProvider key={item.path} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    onClick={() => mobile && setMobileOpen(false)}
                    className={`flex items-center rounded-lg transition-colors relative ${
                      expanded ? "gap-3 px-3 py-2.5" : "justify-center py-2.5 mx-auto"
                    } ${
                      isActive
                        ? "bg-[#6366f1] text-white"
                        : "text-[#94a3b8] hover:bg-[#2a2a3e] hover:text-white"
                    }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {expanded && <span style={{ fontSize: "14px" }}>{item.label}</span>}
                    {item.hasBadge && (() => {
                      const count = (item as { badgeKey?: string }).badgeKey === "messages" ? unreadMessages : unreadAlerts;
                      if (count <= 0) return null;
                      const color = (item as { badgeKey?: string }).badgeKey === "messages" ? "bg-[#6366f1]" : "bg-[#ef4444]";
                      return expanded ? (
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 ${color} text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5`} style={{ fontSize: "11px" }}>
                          {count}
                        </span>
                      ) : (
                        <span className={`absolute -top-1 -right-1 ${color} text-white rounded-full w-4 h-4 flex items-center justify-center`} style={{ fontSize: "9px" }}>
                          {count > 9 ? "9+" : count}
                        </span>
                      );
                    })()}
                  </Link>
                </TooltipTrigger>
                {!sidebarOpen && !mobile && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </nav>

      {/* User at bottom */}
      <div className={`border-t border-[#2a2a3e] ${expanded ? "p-4" : "py-4 flex justify-center"}`}>
        <div className={`flex items-center ${expanded ? "gap-3" : "justify-center"}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-[#6366f1] text-white" style={{ fontSize: "12px" }}>
              {user?.name?.split(" ").map(n => n[0]).join("") || "A"}
            </AvatarFallback>
          </Avatar>
          {expanded && (
            <div className="flex-1 min-w-0">
              <p className="text-white truncate" style={{ fontSize: "13px" }}>{user?.name}</p>
              <p className="text-[#64748b] truncate" style={{ fontSize: "11px" }}>{user?.role === "super_admin" ? "Super Admin" : "Viewer"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 relative ${
          sidebarOpen ? "w-60" : "w-[68px]"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 z-50 lg:hidden"
            >
              <SidebarContent mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="hidden sm:block" style={{ fontSize: "18px" }}>{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Connection Status */}
            <ConnectionStatus />

            {/* What's New */}
            <Popover open={changelogOpen} onOpenChange={setChangelogOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" onClick={handleOpenChangelog}>
                  <Megaphone className="w-5 h-5" />
                  {changelogUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#6366f1] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" style={{ fontSize: "10px" }}>
                      {changelogUnread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#6366f1]" />
                    <p className="text-sm font-semibold">What&apos;s New</p>
                  </div>
                  {changelogUnread === 0 && (
                    <span className="text-xs text-muted-foreground">All caught up!</span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-border">
                  {changelogEntries.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                      <p className="text-sm text-muted-foreground">No updates yet</p>
                    </div>
                  ) : (
                    changelogEntries.map(entry => (
                      <div
                        key={entry.id}
                        className={`px-4 py-3 transition-colors ${!entry.isRead ? "bg-[#6366f1]/5" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base mt-0.5 shrink-0">
                            {TYPE_ICONS[entry.type] || "📢"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium leading-tight">{entry.title}</p>
                              {!entry.isRead && (
                                <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
                            {entry.publishedAt && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(entry.publishedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Bell / Notifications Dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadAlerts > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#ef4444] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" style={{ fontSize: "10px" }}>
                      {unreadAlerts}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Notifications</p>
                    {unreadAlerts > 0 && (
                      <p className="text-xs text-muted-foreground">{unreadAlerts} unread alert{unreadAlerts !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                  {unreadAlerts > 0 && (
                    <Badge className="bg-[#ef4444] hover:bg-[#ef4444] text-white" style={{ fontSize: "10px" }}>
                      {unreadAlerts}
                    </Badge>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {latestAlerts.length > 0 ? (
                    latestAlerts.slice(0, 5).map((alert, i) => (
                      <div key={alert.id || i} className="px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/dashboard/alerts")}>
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            alert.severity === "high" ? "bg-[#ef4444]" :
                            alert.severity === "medium" ? "bg-[#f59e0b]" : "bg-[#22c55e]"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{alert.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {alert.severity} &middot; {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <Badge variant="outline" className={`shrink-0 text-[10px] ${
                            alert.severity === "high" ? "border-[#ef4444] text-[#ef4444]" :
                            alert.severity === "medium" ? "border-[#f59e0b] text-[#f59e0b]" : "border-[#22c55e] text-[#22c55e]"
                          }`}>
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                      <p className="text-sm text-muted-foreground">No recent alerts</p>
                    </div>
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-border">
                  <Button
                    variant="ghost"
                    className="w-full h-8 text-xs text-[#6366f1] hover:text-[#5558e6]"
                    onClick={() => navigate("/dashboard/alerts")}
                  >
                    View All Alerts
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={toggle}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 hidden sm:flex h-9 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-[#6366f1] text-white" style={{ fontSize: "11px" }}>
                      {user?.name?.split(" ").map(n => n[0]).join("") || "A"}
                    </AvatarFallback>
                  </Avatar>
                  <span style={{ fontSize: "14px" }}>{user?.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    {user?.companyName && (
                      <p className="text-xs text-muted-foreground">{user.companyName}</p>
                    )}
                    <Badge
                      variant={isSuperAdmin ? "default" : "secondary"}
                      className={`w-fit mt-1 ${isSuperAdmin ? "bg-[#6366f1] hover:bg-[#6366f1]" : ""}`}
                      style={{ fontSize: "10px" }}
                    >
                      {isSuperAdmin ? "Super Admin" : "Viewer"}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                {isSuperAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/dashboard/admins")}>
                    <Shield className="w-4 h-4 mr-2" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-[#ef4444] focus:text-[#ef4444]">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Plan Upgrade Banner — outside the page-keyed motion.div so it doesn't re-animate on navigation */}
        <AnimatePresence>
          {upgradedTo && (
            <motion.div
              initial={{ opacity: 0, y: -60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -60 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="mx-4 mt-4 rounded-xl overflow-hidden shrink-0"
            >
              <div className="relative bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#ec4899] p-4 flex items-center gap-3 shadow-lg">
                <span className="text-3xl select-none">🎉</span>
                <div className="flex-1">
                  <p className="text-white font-bold text-base leading-tight">
                    Plan Upgraded! Welcome to {upgradedTo}!
                  </p>
                  <p className="text-white/80 text-xs mt-0.5">
                    Your new features are now available. Enjoy! 🚀
                  </p>
                </div>
                <span className="text-3xl select-none">🎊</span>
                <button
                  onClick={dismissBanner}
                  className="ml-2 text-white/70 hover:text-white transition-colors text-xl leading-none"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}