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

interface AdminLayoutProps {
  children: React.ReactNode;
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
];

const roleColors = {
  owner: 'bg-red-500',
  admin: 'bg-blue-500',
  support: 'bg-green-500',
  analyst: 'bg-purple-500',
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const admin = useAuthStore((state) => state.admin);
  const logout = useAuthStore((state) => state.logout);

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
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{admin?.name}</p>
                  <p className="text-xs text-gray-500">{admin?.email}</p>
                </div>
                <Badge className={`${roleColors[admin?.role || 'admin']} text-white`}>
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
