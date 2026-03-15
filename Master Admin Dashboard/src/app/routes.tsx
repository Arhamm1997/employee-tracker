import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import Login from './pages/Login';
import Verify2FA from './pages/Verify2FA';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Plans from './pages/Plans';
import Subscriptions from './pages/Subscriptions';
import SubscriptionDetail from './pages/SubscriptionDetail';
import Invoices from './pages/Invoices';
import Revenue from './pages/Revenue';
import AgentsMonitor from './pages/AgentsMonitor';
import ErrorLogs from './pages/ErrorLogs';
import Tickets from './pages/Tickets';
import Analytics from './pages/Analytics';
import SystemHealth from './pages/SystemHealth';
import AuditLogs from './pages/AuditLogs';
import AdminUsers from './pages/AdminUsers';
import AgentVersions from './pages/AgentVersions';
import PaymentSettings from './pages/PaymentSettings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/admin/login" replace />,
  },
  {
    path: '/admin/login',
    element: <Login />,
  },
  {
    path: '/admin/verify-2fa',
    element: <Verify2FA />,
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Dashboard />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/customers',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Customers />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/customers/:id',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <CustomerDetail />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/plans',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Plans />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/subscriptions',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Subscriptions />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/subscriptions/:id',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <SubscriptionDetail />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/invoices',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Invoices />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/revenue',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Revenue />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/agents',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <AgentsMonitor />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/analytics',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Analytics />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/system-health',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <SystemHealth />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/logs/errors',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <ErrorLogs />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/tickets',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <Tickets />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/logs/audit',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <AuditLogs />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <AdminUsers />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/agent-versions',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <AgentVersions />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/payment-settings',
    element: (
      <ProtectedRoute>
        <AdminLayout>
          <PaymentSettings />
        </AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/admin/login" replace />,
  },
]);
