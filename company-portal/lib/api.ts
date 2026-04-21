const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const TOKEN_KEY = "company_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data as T;
}

async function requestMultipart<T>(path: string, body: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body });
  const data = await res.json();

  if (!res.ok) throw new Error(data.message || "Upload failed");
  return data as T;
}

export interface Plan {
  id: string; name: string; priceMonthly: number; priceYearly: number;
  maxSeats: number; screenshotsEnabled: boolean; browserHistoryEnabled: boolean;
  usbMonitoringEnabled: boolean; alertsEnabled: boolean; advancedReports: boolean;
  keylogEnabled: boolean; fileActivityEnabled: boolean; printLogsEnabled: boolean;
  shutdownEnabled: boolean; livescreenEnabled: boolean; lockEnabled: boolean;
}

export interface Subscription {
  id: string; planName: string; maxSeats: number;
  status: string; currentPeriodEnd: string; billingCycle: string;
}

export interface PaymentSettings {
  id: string; bankName: string; bankIban: string; bankTitle: string;
  easypaisaNumber: string; easypaisaName: string; nayapayNumber: string;
  nayapayName: string; sadapayNumber: string; sadapayName: string;
  jsbankNumber: string; jsbankName: string; whatsappNumber: string; instructions: string;
}

export interface Invoice {
  id: string; invoiceNumber: string; planId?: string; planName: string;
  billingCycle: string; amount: number; currency: string;
  status: "PENDING" | "PAID" | "REJECTED";
  paymentMethod?: string | null; hasScreenshot?: boolean;
  rejectionReason?: string | null; paidAt?: string | null; createdAt: string;
}

export interface SubscriptionUsage {
  plan: { id: string; name: string; maxSeats: number; priceMonthly: number; priceYearly: number; features: string[] };
  usage: { seats: { used: number; total: number; percentage: number }; billingCycle: string; currentPeriodEnd: string; daysRemaining: number; status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" };
}

export const api = {
  login(body: { email: string; password: string }) {
    return request<{ message: string; token: string; companyName: string }>("/company/auth/login", { method: "POST", body: JSON.stringify(body) });
  },
  register(body: { companyName: string; email: string; password: string }) {
    return request<{ message: string; verificationUrl?: string }>("/company/auth/register", { method: "POST", body: JSON.stringify(body) });
  },
  verifyEmail(token: string) {
    return request<{ message: string; companyId: string; token: string }>(`/company/auth/verify-email?token=${encodeURIComponent(token)}`);
  },
  resendVerification(email: string) {
    return request<{ message: string }>("/company/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
  },
  getPlans() { return request<Plan[]>("/plans"); },
  selectPlan(body: { planId: string; billingCycle: "monthly" | "yearly" }) {
    return request<{ message: string; subscription: Subscription; token: string }>("/company/subscription/select", { method: "POST", body: JSON.stringify(body) });
  },
  getSubscriptionUsage() { return request<SubscriptionUsage>("/subscription/usage"); },
  upgradeSubscription(body: { planId: string; billingCycle: "monthly" | "yearly" }) {
    return request<{ message: string; subscription: Subscription }>("/subscription/upgrade", { method: "POST", body: JSON.stringify(body) });
  },
  downgradeSubscription(body: { planId: string; billingCycle: "monthly" | "yearly" }) {
    return request<{ message: string; subscription: Subscription }>("/subscription/downgrade", { method: "POST", body: JSON.stringify(body) });
  },
  getPaymentSettings() { return request<{ settings: PaymentSettings }>("/payment/settings"); },
  createInvoice(body: { planId: string; billingCycle: "monthly" | "yearly" }) {
    return request<{ message: string; invoice: Invoice }>("/payment/create-invoice", { method: "POST", body: JSON.stringify(body) });
  },
  getMyInvoices() { return request<{ invoices: Invoice[] }>("/payment/my-invoices"); },
  getInvoice(id: string) {
    return request<{ invoice: Invoice; paymentSettings: PaymentSettings | null }>(`/payment/invoice/${id}`);
  },
  uploadScreenshot(invoiceId: string, paymentMethod: string, file: File) {
    const form = new FormData();
    form.append("screenshot", file);
    form.append("paymentMethod", paymentMethod);
    return requestMultipart<{ message: string; invoice: Invoice }>(`/payment/upload-screenshot/${invoiceId}`, form);
  },
};
