export interface Employee {
  id: string;
  name: string;
  email: string;
  code: string;
  department: string;
  avatar: string;
  status: "online" | "idle" | "offline";
  currentApp: string;
  lastSeen: string | null;
  hoursToday: number;
  productivityPercent: number;
  screenshotCount: number;
}

export interface Activity {
  id: string;
  employeeId: string;
  employeeName: string;
  avatar: string;
  app: string;
  windowTitle: string;
  time: string;
  type: "productive" | "idle" | "neutral";
}

export interface Screenshot {
  id: string;
  employeeId: string;
  employeeName: string;
  avatar: string;
  imageUrl: string;
  timestamp: string;
  app: string;
  windowTitle: string;
  department: string;
}

export interface Alert {
  id: string;
  type: "blocked_site" | "after_hours" | "usb_connected" | "idle_long" | "new_software" | "low_activity";
  severity: "high" | "medium" | "low";
  employeeId: string;
  employeeName: string;
  message: string;
  timestamp: string;
  read: boolean;
  slackUnreadCount?: number;
  sentToSlack?: boolean;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "viewer";
  enabled: boolean;
  lastLogin: string;
}

export interface BrowserHistory {
  id: string;
  url: string;
  title: string;
  browser: string;
  time: string;
  duration: string;
  blocked: boolean;
}

export interface UsbEvent {
  id: string;
  device: string;
  type: "connected" | "disconnected";
  time: string;
}

export interface DashboardStats {
  totalEmployees: number;
  online: number;
  idle: number;
  offline: number;
  avgProductivity: number;
  alertsToday: number;
}

export interface WeeklyProductivity {
  day: string;
  productive: number;
  idle: number;
}

export interface TopApp {
  name: string;
  value: number;
  fill: string;
}

export interface HourlyActivity {
  hour: string;
  active: number;
  idle: number;
}

export interface DeptComparison {
  department: string;
  productivity: number;
}

export interface AfterHoursEmployee extends Employee {
  afterHoursTime: string;
}

export interface TimelineBlock {
  start: number;
  end: number;
  type: "productive" | "idle" | "offline" | "blocked";
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface AppSettings {
  workSchedule: {
    startTime: string;
    endTime: string;
    workDays: number[];
    timezone: string;
  };
  monitoring: {
    screenshotInterval: number;
    screenshotQuality: "low" | "medium" | "high";
    idleThreshold: number;
    enableScreenshots: boolean;
    enableBrowserHistory: boolean;
    enableUsb: boolean;
    enableClipboard: boolean;
    enableAfterHours: boolean;
  };
  blockedSites: string[];
  appCategories: {
    productive: string[];
    nonProductive: string[];
    neutral: string[];
  };
  notifications: {
    emailAddresses: string[];
    alertTypes: {
      blocked_site: boolean;
      after_hours: boolean;
      usb_connected: boolean;
      idle_long: boolean;
      new_software: boolean;
      low_activity: boolean;
    };
    idleThresholdMinutes: number;
  };
  dataRetention: {
    activityDays: number;
    screenshotDays: number;
    alertDays: number;
  };
}

export interface EmployeeProductivity {
  productive: number;
  nonProductive: number;
  neutral: number;
}

export interface EmployeeHourlyActivity {
  hour: string;
  productive: number;
  idle: number;
}

export interface ReportSummary {
  totalHours: string;
  productive: string;
  idleTime: string;
  screenshots: string;
  alerts: string;
}

export interface TopAppHours {
  name: string;
  hours: number;
}

export interface DailyBreakdown {
  date: string;
  hours: number;
  productive: number;
  idle: number;
  screenshots: number;
  alerts: number;
}

export interface EmployeeComparison {
  name: string;
  productivity: number;
}

export interface RadarDept {
  subject: string;
  A: number;
  fullMark: number;
}

export interface ConnectionEvent {
  id: string;
  event: "online" | "offline" | "shutdown";
  timestamp: string;
}

export interface KeylogEntry {
  id: string;
  appName: string;
  keys: string;
  timestamp: string;
}

export interface FileActivityEntry {
  id: string;
  action: string;
  filePath: string;
  appName: string;
  timestamp: string;
}

export interface PrintLogEntry {
  id: string;
  printer: string;
  document: string;
  pages: number;
  appName: string;
  timestamp: string;
}

export interface BrowserHistoryReport {
  id: string;
  employeeId: string;
  employeeName: string;
  browser: string;
  url: string;
  title: string;
  visitedAt: string;
  duration: number;
  isBlocked: boolean;
}
