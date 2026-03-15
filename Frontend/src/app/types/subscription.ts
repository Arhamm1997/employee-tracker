export interface Plan {
  id: string;
  name: "Free" | "Basic" | "Standard" | "Premium";
  slug: string;
  price_pkr: number;
  max_admins: number;
  max_employees: number;
  features: {
    screenshotsEnabled?: boolean;
    browserHistoryEnabled?: boolean;
    usbMonitoringEnabled?: boolean;
    alertsEnabled?: boolean;
    advancedReports?: boolean;
    keylogEnabled?: boolean;
    fileActivityEnabled?: boolean;
    printLogsEnabled?: boolean;
    shutdownEnabled?: boolean;
    livescreenEnabled?: boolean;
    lockEnabled?: boolean;
    // Allow additional feature flags without breaking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: boolean | undefined;
  };
  description?: string;
}

export interface SeatInfo {
  plan?: Plan;
  admin_seats: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  employee_seats: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  can_add_admin: boolean;
  can_add_employee: boolean;
  features?: Plan["features"];
}

export interface SubscriptionInfo {
  plan_name: string;
  price_pkr: number;
  subscription_status: "active" | "trial" | "expired" | "cancelled";
  is_trial: boolean;
  trial_end?: string;
  // Using any here because backend seat shape may differ from SeatInfo
  // and we want to avoid breaking changes during initial integration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin_seats: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  employee_seats: any;
  can_add_admin: boolean;
  can_add_employee: boolean;
}

