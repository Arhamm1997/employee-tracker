// Admin types
export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'support' | 'analyst';
  permissions: string[];
  createdAt: string;
}

// Customer types
export interface Customer {
  id: string;
  companyName: string;
  email: string;
  planId: string;
  planName: string;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  employeeCount: number;
  agentCount: number;
  onlineAgentCount: number;
  joinedAt: string;
  subscriptionEndDate: string;
  trialEndsAt?: string;
  mrr: number;
}

// Plan types
export interface Plan {
  id: string;
  name: string;
  price: number;          // alias for priceMonthly (backwards compat)
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  maxSeats: number;
  maxAdmins: number;
  features: string[];
  screenshotsEnabled: boolean;
  browserHistoryEnabled: boolean;
  usbMonitoringEnabled: boolean;
  alertsEnabled: boolean;
  advancedReports: boolean;
  keylogEnabled: boolean;
  fileActivityEnabled: boolean;
  printLogsEnabled: boolean;
  shutdownEnabled: boolean;
  livescreenEnabled: boolean;
  lockEnabled: boolean;
  isActive: boolean;
  customerCount: number;
  createdAt: string;
}

// Subscription types
export interface Subscription {
  id: string;
  customerId: string;
  companyName: string;
  planId: string;
  planName: string;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  seatsUsed: number;
  seatsTotal: number;
  mrr: number;
  autoRenew: boolean;
}

// Invoice types
export interface Invoice {
  id: string;
  customerId: string;
  companyName: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  dueDate: string;
  paidAt?: string;
  items: InvoiceItem[];
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Agent types
export interface Agent {
  id: string;
  machineId: string;
  customerId: string;
  companyName: string;
  employeeName: string;
  status: 'online' | 'offline' | 'idle';
  lastSeen: string;
  ipAddress: string;
  version: string;
  os: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

// Error Log types
export interface ErrorLog {
  id: string;
  timestamp: string;
  customerId?: string;
  companyName?: string;
  source: 'agent' | 'server' | 'api';
  severity: 'error' | 'warning' | 'info';
  message: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

// Ticket types
export interface Ticket {
  id: string;
  customerId: string;
  companyName: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedToName?: string;
  replies: TicketReply[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  adminId?: string;
  adminName?: string;
  customerId?: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

// Audit Log types
export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  resource: string;
  resourceId?: string;
  customerId?: string;
  companyName?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

// System Health types
export interface SystemHealth {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    status: 'healthy' | 'degraded' | 'down';
    connections: number;
    maxConnections: number;
  };
  api: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    requestsPerMinute: number;
  };
  agents: {
    total: number;
    online: number;
    offline: number;
  };
  lastUpdated: string;
}

// Analytics types
export interface SignupAnalytics {
  date: string;
  count: number;
}

export interface RevenueAnalytics {
  month: string;
  revenue: number;
  mrr: number;
}

export interface ChurnAnalytics {
  month: string;
  churned: number;
  churnRate: number;
}

export interface PlanDistribution {
  planName: string;
  count: number;
  revenue: number;
}

export interface TopCustomer {
  companyName: string;
  mrr: number;
  agentCount: number;
  employeeCount: number;
}

// Stats types
export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  trialCustomers: number;
  mrr: number;
  totalAgents: number;
  onlineAgents: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface Verify2FAFormData {
  code: string;
}

export interface CreateCustomerFormData {
  companyName: string;
  email: string;
  planId: string;
  employeeCount: number;
}

export interface CreatePlanFormData {
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  maxSeats: number;
  features: string[];
}

export interface CreateInvoiceFormData {
  customerId: string;
  amount: number;
  dueDate: string;
  items: InvoiceItem[];
}

export interface CreateAdminFormData {
  name: string;
  email: string;
  password: string;
  role: 'owner' | 'admin' | 'support' | 'analyst';
  permissions: string[];
}

export interface TicketReplyFormData {
  message: string;
  isInternal: boolean;
}

// Filter types
export interface CustomerFilters {
  search: string;
  status: string;
  page: number;
}

export interface ErrorLogFilters {
  companyId?: string;
  severity?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  page: number;
}

export interface AuditLogFilters {
  companyId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page: number;
}

export interface TicketFilters {
  priority?: string;
  status?: string;
  assignedTo?: string;
  page: number;
}
