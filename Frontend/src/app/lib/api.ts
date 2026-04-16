import type {
  Employee,
  Activity,
  Screenshot,
  Alert,
  Admin,
  BrowserHistory,
  UsbEvent,
  DashboardStats,
  WeeklyProductivity,
  TopApp,
  HourlyActivity,
  DeptComparison,
  AfterHoursEmployee,
  AppSettings,
  TimelineBlock,
  HeatmapDay,
  EmployeeProductivity,
  EmployeeHourlyActivity,
  ReportSummary,
  TopAppHours,
  DailyBreakdown,
  EmployeeComparison,
  RadarDept,
  ConnectionEvent,
  KeylogEntry,
  FileActivityEntry,
  PrintLogEntry,
  BrowserHistoryReport,
} from "./types";
import type { SeatInfo } from "../types/subscription";

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getToken(): string | null {
  const token = localStorage.getItem("monitor_token");
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

function getHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    signal: AbortSignal.timeout(8000), // 8s timeout — fail fast when backend is off
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body: unknown) => request<T>("POST", path, body);
const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "super_admin" | "viewer";
    twoFactorEnabled?: boolean;
    companyId?: string;
    companyName?: string | null;
  };
}

export interface LoginWith2FAResponse {
  requires2FA: true;
  tempToken: string;
}

export type LoginResult = LoginResponse | LoginWith2FAResponse;

// Backend returns { success, data: { accessToken, user, company } } or { success, data: { requires2FA, tempToken } }
type RawLoginResponse = {
  success: boolean;
  data: {
    accessToken?: string;
    user?: LoginResponse["user"];
    company?: {
      id: string;
      name: string;
      subscriptionStatus: string | null;
      subscriptionExpiresAt: string | null;
    };
    requires2FA?: boolean;
    tempToken?: string;
  };
};

export const apiLogin = async (email: string, password: string): Promise<LoginResult> => {
  const raw = await post<RawLoginResponse>("/auth/login", { email, password });
  const d = raw.data;
  if (d.requires2FA) {
    return { requires2FA: true, tempToken: d.tempToken! };
  }
  const user = d.user!;
  if (d.company?.name && !user.companyName) {
    user.companyName = d.company.name;
  }
  return { token: d.accessToken!, user };
};

export const apiGetMe = () =>
  get<LoginResponse["user"] & { twoFactorEnabled: boolean }>("/auth/me");

// 2FA
export const api2FASetup = () =>
  post<{ secret: string; qrCodeUrl: string }>("/auth/2fa/setup", {});

export const api2FAEnable = (code: string) =>
  post<{ message: string }>("/auth/2fa/enable", { code });

export const api2FAVerify = async (tempToken: string, code: string): Promise<LoginResponse> => {
  const raw = await post<RawLoginResponse>("/auth/2fa/verify", { tempToken, code });
  return { token: raw.data.accessToken!, user: raw.data.user! };
};

export const api2FADisable = (code: string) =>
  post<{ message: string }>("/auth/2fa/disable", { code });

// Password reset
export const apiForgotPassword = (email: string) =>
  post<{ message: string }>("/auth/forgot-password", { email });

export const apiResetPassword = (token: string, newPassword: string) =>
  post<{ message: string }>("/auth/reset-password", { token, newPassword });

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardData {
  stats: DashboardStats;
  weeklyProductivity: WeeklyProductivity[];
  topApps: TopApp[];
  hourlyActivity: HourlyActivity[];
  deptComparison: DeptComparison[];
  afterHoursEmployees: AfterHoursEmployee[];
  recentEmployees: Employee[];
}

export const apiGetDashboard = () => get<DashboardData>("/dashboard");

// ─── Employees ───────────────────────────────────────────────────────────────

export const apiGetEmployees = () => get<Employee[]>("/employees");

export const apiGetEmployee = (id: string) => get<Employee>(`/employees/${id}`);

export interface CreateEmployeePayload {
  name: string;
  email: string;
  department: string;
}

export interface CreateEmployeeResponse {
  id: string;
  name: string;
  email: string;
  department: string;
  code: string;
  agentToken: string;
}

export const apiCreateEmployee = (data: CreateEmployeePayload) =>
  post<CreateEmployeeResponse>("/employees", data);

export interface EmployeeDetailData {
  employee: Employee;
  screenshots: Screenshot[];
  browserHistory: BrowserHistory[];
  alerts: Alert[];
  usbEvents: UsbEvent[];
  topApps: TopApp[];
  productivity: EmployeeProductivity;
  hourlyActivity: EmployeeHourlyActivity[];
  timeline: TimelineBlock[];
  heatmap: HeatmapDay[];
}

export const apiGetEmployeeDetail = (id: string) =>
  get<EmployeeDetailData>(`/employees/${id}/detail`);

// ─── Screenshots ─────────────────────────────────────────────────────────────

export interface ScreenshotFilters {
  employeeId?: string;
  department?: string;
  date?: string;
}

export const apiGetScreenshots = (filters: ScreenshotFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.employeeId && filters.employeeId !== "All") params.set("employeeId", filters.employeeId);
  if (filters.department && filters.department !== "All") params.set("department", filters.department);
  if (filters.date) params.set("date", filters.date);
  const qs = params.toString();
  return get<Screenshot[]>(`/screenshots${qs ? `?${qs}` : ""}`);
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const apiGetAlerts = () => get<Alert[]>("/alerts");

export const apiMarkAlertRead = (id: string) => put<Alert>(`/alerts/${id}/read`);

export const apiMarkAllAlertsRead = () => put<{ success: boolean }>("/alerts/read-all");

export const apiDeleteAlert = (id: string) => del<{ success: boolean }>(`/alerts/${id}`);

// ─── Admins ──────────────────────────────────────────────────────────────────

export const apiGetAdmins = () => get<Admin[]>("/admins");

export interface CreateAdminPayload {
  name: string;
  email: string;
  password: string;
  role: "super_admin" | "viewer";
}

export const apiCreateAdmin = (data: CreateAdminPayload) =>
  post<Admin>("/admins", data);

export const apiToggleAdmin = (id: string) =>
  put<Admin>(`/admins/${id}/toggle`);

// ─── Settings ────────────────────────────────────────────────────────────────

export const apiGetSettings = () => get<AppSettings>("/settings");

export const apiSaveSettings = (data: AppSettings) =>
  put<AppSettings>("/settings", data);

// ─── Subscription / Seats ─────────────────────────────────────────────────────

export interface SubscriptionSeatInfoResponse {
  subscription: SeatInfo;
}

export const apiGetSubscriptionInfo = () =>
  get<SubscriptionSeatInfoResponse>("/subscription/info");

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateRange: string;
  employeeId?: string;
}

export interface ReportData {
  summary: ReportSummary;
  weeklyProductivity: WeeklyProductivity[];
  topApps: TopAppHours[];
  dailyBreakdown: DailyBreakdown[];
  employeeComparison: EmployeeComparison[];
  deptComparison: RadarDept[];
  browserHistory: BrowserHistoryReport[];
}

export const apiGetReports = (filters: ReportFilters) => {
  const params = new URLSearchParams({ dateRange: filters.dateRange });
  if (filters.employeeId && filters.employeeId !== "All") params.set("employeeId", filters.employeeId);
  return get<ReportData>(`/reports?${params.toString()}`);
};

// ─── Employee management extras ──────────────────────────────────────────────

export const apiDeleteEmployee = (id: string) => del<{ success: boolean }>(`/employees/${id}`);

export const apiResetAllData = () => del<{ success: boolean; message: string }>("/employees/reset-all-data");

export const apiSendRemoteCommand = (id: string, command: "lock" | "shutdown" | "clear" | "start_live" | "stop_live") =>
  post<{ success: boolean; command: string }>(`/employees/${id}/command`, { command });

export const apiUploadAvatar = (id: string, file: File) => {
  const token = localStorage.getItem("monitor_token");
  const form = new FormData();
  form.append("avatar", file);
  return fetch(`${BASE_URL}/employees/${id}/avatar`, {
    method: "PUT",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(8000),
    body: form,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<{ success: boolean; avatarUrl: string }>;
  });
};

export const apiGetConnectionHistory = (id: string) =>
  get<ConnectionEvent[]>(`/employees/${id}/connection-history`);

export const apiGetKeylogHistory = (id: string, date?: string) =>
  get<KeylogEntry[]>(`/employees/${id}/keylog${date ? `?date=${date}` : ""}`);

export const apiGetFileActivity = (id: string, date?: string) =>
  get<FileActivityEntry[]>(`/employees/${id}/file-activity${date ? `?date=${date}` : ""}`);

export const apiGetPrintLogs = (id: string, date?: string) =>
  get<PrintLogEntry[]>(`/employees/${id}/print-logs${date ? `?date=${date}` : ""}`);

// ─── System ──────────────────────────────────────────────────────────────────

export const apiDownloadBackup = async () => {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/system/backup`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || `Download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `employee-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const apiDeleteAccount = () =>
  del<{ success: boolean; message: string }>("/auth/me");

export const apiResetCompleteApp = (confirmation: string) =>
  post<{ success: boolean; message: string }>("/system/reset-complete-app", { confirmation });

// ─── Agent Download ───────────────────────────────────────────────────────────

export interface AgentDownloadInfo {
  downloadUrl: string | null;
  checksum: string | null;
  version: string | null;
  config: {
    employeeCode: string;
    agentToken: string;
    serverUrl: string;
    screenshotInterval: number;
    screenshotQuality: number;
    idleThreshold: number;
    screenshotsEnabled: boolean;
    browserHistoryEnabled: boolean;
    usbMonitoringEnabled: boolean;
    clipboardEnabled: boolean;
    blockedSites: string[];
  };
}

export const apiGetAgentDownload = (employeeId: string) =>
  get<AgentDownloadInfo>(`/agent/download/${employeeId}`);

export interface AgentLatestVersion {
  version: string | null;
  downloadUrl: string | null;
  checksum: string | null;
  watchdogDownloadUrl: string | null;
  watchdogChecksum: string | null;
}

export const apiGetAgentLatestVersion = async (): Promise<AgentLatestVersion | null> => {
  try {
    return await get<AgentLatestVersion>("/agent/latest-version");
  } catch {
    return null;
  }
};

// ─── Slack Integration ────────────────────────────────────────────────────────

export interface SlackIntegration {
  id: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  isActive: boolean;
  installedAt: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export interface SlackMessage {
  id: string;
  alertId?: string;
  channelId: string;
  slackTs: string;
  slackThreadTs?: string;
  direction: "outbound" | "inbound";
  content: string;
  slackUserId?: string;
  slackUserName?: string;
  isRead: boolean;
  createdAt: string;
}

export interface SlackSettings {
  slackEnabled: boolean;
  slackChannelId: string | null;
  slackAlertTypes: string[];
  slackThreadReplies: boolean;
}

export const apiGetSlackOAuthUrl = () =>
  get<{ url: string }>("/slack/auth-url");

export const apiGetSlackIntegration = () =>
  get<{ connected: boolean; integration?: SlackIntegration }>("/slack/integration");

export const apiDisconnectSlack = () =>
  del<{ success: boolean; message: string }>("/slack/integration");

export const apiGetSlackChannels = () =>
  get<{ channels: SlackChannel[] }>("/slack/channels");

export const apiGetSlackSettings = () =>
  get<SlackSettings>("/slack/settings");

export const apiUpdateSlackSettings = (data: Partial<SlackSettings>) =>
  put<{ success: boolean }>("/slack/settings", data);

export const apiSendSlackTestAlert = (channelId?: string) =>
  post<{ success: boolean; message: string }>("/slack/test-alert", { channelId });

export const apiSendSlackDirectMessage = (employeeId: string, message: string) =>
  post<{ success: boolean; slackTs: string }>(`/slack/message/employee/${employeeId}`, { message });

export const apiMarkSlackMessageRead = (messageId: string) =>
  post<{ success: boolean }>(`/slack/message/read/${messageId}`, {});

export const apiGetAlertSlackMessages = (alertId: string) =>
  get<{ messages: SlackMessage[] }>(`/slack/alert/${alertId}/messages`);

// ─── Slack Conversations (Messages page) ─────────────────────────────────────

export interface SlackConversationEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  avatar: string | null;
  lastSeenAt: string | null;
}

export interface SlackConversation {
  employee: SlackConversationEmployee;
  lastMessage: string | null;
  lastMessageDirection: "outbound" | "inbound" | null;
  lastSentAt: string | null;
  unreadCount: number;
  totalMessages: number;
}

export interface SlackDmMessage {
  id: string;
  direction: "outbound" | "inbound";
  content: string;
  slackUserId: string | null;
  slackUserName: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SlackEmployeeMessages {
  employee: SlackConversationEmployee;
  messages: SlackDmMessage[];
  total: number;
  page: number;
  pages: number;
}

export const apiGetSlackConversations = (q?: string) =>
  get<{ connected: boolean; conversations: SlackConversation[] }>(
    `/slack/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`
  );

export const apiGetSlackEmployeeMessages = (employeeId: string, page = 1) =>
  get<SlackEmployeeMessages>(`/slack/conversations/${employeeId}?page=${page}`);

// ─── Changelog ────────────────────────────────────────────────────────────────

export interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  type: string;
  planTarget: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  isRead: boolean;
}

export const apiGetChangelog = () =>
  get<{ entries: ChangelogEntry[]; unreadCount: number }>("/changelog");

export const apiMarkChangelogRead = (id: string) =>
  post<{ success: boolean }>(`/changelog/${id}/read`, {});

export const apiMarkAllChangelogRead = () =>
  post<{ success: boolean }>("/changelog/read-all", {});

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderRole: "admin" | "employee";
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  avatar: string | null;
  lastSeenAt: string | null;
}

export interface Conversation {
  id: string;
  employee: ConversationEmployee | null;
  lastMessage: string | null;
  lastSentAt: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: {
    id: string;
    employee: ConversationEmployee | null;
    lastMessage: string | null;
    lastSentAt: string | null;
    createdAt: string;
  };
  messages: ConversationMessage[];
  total: number;
  page: number;
  pages: number;
}

export const apiGetConversations = (q?: string) =>
  get<Conversation[]>(`/messages/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`);

export const apiGetConversation = (conversationId: string, page = 1) =>
  get<ConversationDetail>(`/messages/${conversationId}?page=${page}`);

export const apiSendMessage = (employeeId: string, content: string) =>
  post<{ message: ConversationMessage; conversation: { id: string } }>("/messages", { employeeId, content });

export const apiReplyMessage = (conversationId: string, content: string) =>
  post<ConversationMessage>(`/messages/${conversationId}/reply`, { content });

export const apiMarkConversationRead = (conversationId: string) =>
  put<{ ok: boolean }>(`/messages/${conversationId}/read`);

// ─── Update AppSettings type (local augmentation) ────────────────────────────

export type { BrowserHistoryReport };