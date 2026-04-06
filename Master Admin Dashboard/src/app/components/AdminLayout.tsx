import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuthStore } from '../../store/authStore';
import { Badge } from './ui/badge';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  FileText,
  DollarSign,
  Monitor,
  BarChart3,
  Activity,
  AlertCircle,
  Ticket,
  ScrollText,
  Shield,
  Bell,
  LogOut,
  Bot,
  Settings,
  UserPlus,
  Receipt,
  X,
  CheckCheck,
  TrendingUp,
  LifeBuoy,
  Slack,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import api from '../../lib/api';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface Notification {
  id: string;
  type: 'invoice' | 'signup' | 'upgrade_request' | 'ticket';
  title: string;
  body: string;
  time: string;
  link: string;
  isNew: boolean;
}

interface NotificationsResponse {
  total: number;
  pendingInvoicesCount: number;
  newSignupsToday: number;
  notifications: Notification[];
}

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Customers', href: '/admin/customers', icon: Users },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
  { name: 'Plans', href: '/admin/plans', icon: Package },
  { name: 'Invoices', href: '/admin/invoices', icon: FileText },
  { name: 'Revenue', href: '/admin/revenue', icon: DollarSign },
  { name: 'Agents', href: '/admin/agents', icon: Monitor },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'System Health', href: '/admin/system-health', icon: Activity },
  { name: 'Error Logs', href: '/admin/logs/errors', icon: AlertCircle },
  { name: 'Tickets', href: '/admin/tickets', icon: Ticket },
  { name: 'Audit Logs', href: '/admin/logs/audit', icon: ScrollText },
  { name: 'Admin Users', href: '/admin/users', icon: Shield },
  { name: 'Agent Versions', href: '/admin/agent-versions', icon: Bot },
  { name: 'Payment Settings', href: '/admin/payment-settings', icon: Settings },
  { name: 'Slack', href: '/admin/slack', icon: Slack },
];

const roleColors = {
  owner: 'bg-red-500',
  admin: 'bg-blue-500',
  support: 'bg-green-500',
  analyst: 'bg-purple-500',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const admin = useAuthStore((state) => state.admin);
  const logout = useAuthStore((state) => state.logout);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState<NotificationsResponse | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('admin_dismissed_notifs');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const res = await api.get<NotificationsResponse>('/admin/notifications');
      setNotifData(res.data);
    } catch {
      // silent fail
    } finally {
      setNotifLoading(false);
    }
  };

  // Poll every 60s and fetch on open
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    if (!notifData) return;
    const allIds = notifData.notifications.map((n) => n.id);
    const next = new Set([...dismissedIds, ...allIds]);
    setDismissedIds(next);
    localStorage.setItem('admin_dismissed_notifs', JSON.stringify([...next]));
  };

  const unreadCount = notifData
    ? notifData.notifications.filter((n) => !dismissedIds.has(n.id)).length
    : 0;

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = paths.map((path, index) => {
      const href = '/' + paths.slice(0, index + 1).join('/');
      const name = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
      return { name, href };
    });
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0f172a] text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold">StaffTrack</h1>
          <p className="text-sm text-gray-400 mt-1">Master Admin</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
                           (item.href !== '/admin' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
                {/* Badge for Invoices with unread pending count */}
                {item.name === 'Invoices' && (() => {
                  const unreadInvoices = notifData?.notifications.filter(
                    (n) => n.type === 'invoice' && !dismissedIds.has(n.id)
                  ).length ?? 0;
                  return unreadInvoices > 0 ? (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {unreadInvoices}
                    </span>
                  ) : null;
                })()}
                {/* Badge for Customers with unread signups today */}
                {item.name === 'Customers' && (() => {
                  const unreadSignups = notifData?.notifications.filter(
                    (n) => n.type === 'signup' && !dismissedIds.has(n.id)
                  ).length ?? 0;
                  return unreadSignups > 0 ? (
                    <span className="ml-auto bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      NEW
                    </span>
                  ) : null;
                })()}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={logout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.href}>{crumb.name}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => setNotifOpen((o) => !o)}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Notifications</p>
                        {notifData && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {notifData.pendingInvoicesCount} pending invoice{notifData.pendingInvoicesCount !== 1 ? 's' : ''} · {notifData.newSignupsToday} new signup{notifData.newSignupsToday !== 1 ? 's' : ''} today
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            title="Mark all as read"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark all read
                          </button>
                        )}
                        <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Notification list */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                      {notifLoading && !notifData && (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
                      )}
                      {!notifLoading && notifData?.notifications.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">No new notifications</div>
                      )}
                      {notifData?.notifications.map((n) => {
                        const isRead = dismissedIds.has(n.id);
                        return (
                          <Link
                            key={n.id}
                            to={n.link}
                            onClick={() => setNotifOpen(false)}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isRead ? 'opacity-50' : ''}`}
                          >
                            <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              n.type === 'invoice' ? 'bg-amber-100' :
                              n.type === 'upgrade_request' ? 'bg-purple-100' :
                              n.type === 'ticket' ? 'bg-blue-100' :
                              'bg-green-100'
                            }`}>
                              {n.type === 'invoice'
                                ? <Receipt className="w-4 h-4 text-amber-600" />
                                : n.type === 'upgrade_request'
                                ? <TrendingUp className="w-4 h-4 text-purple-600" />
                                : n.type === 'ticket'
                                ? <LifeBuoy className="w-4 h-4 text-blue-600" />
                                : <UserPlus className="w-4 h-4 text-green-600" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm truncate ${isRead ? 'text-gray-500 font-normal' : 'text-gray-900 font-medium'}`}>{n.title}</p>
                                {n.isNew && !isRead && (
                                  <span className="flex-shrink-0 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">NEW</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{n.body}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.time)}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
                      <Link
                        to="/admin/invoices"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View all invoices →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{admin?.name}</p>
                  <p className="text-xs text-gray-500">{admin?.email}</p>
                </div>
                <Badge className={`${roleColors[admin?.role as keyof typeof roleColors] || 'bg-blue-500'} text-white`}>
                  {admin?.role}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#f1f5f9] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
