import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Shield, Loader2, Upload, CheckCircle, Clock, XCircle,
  Copy, Check, MessageCircle, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || "http://localhost:5001/api";

const PORTAL_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_PORTAL_URL ||
  "http://localhost:3001";

// ── Types ───────────────────────────────────────────────────────────────────

interface PaymentSettings {
  bankName?: string;
  bankAccountTitle?: string;
  bankAccountNumber?: string;
  bankIBAN?: string;
  easypaisaNumber?: string;
  nayapayNumber?: string;
  sadapayNumber?: string;
  jsbankNumber?: string;
  whatsappNumber?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: "PENDING" | "PAID" | "APPROVED" | "REJECTED";
  plan?: { name: string };
  billingCycle?: string;
  createdAt: string;
  screenshotUrl?: string;
  rejectionReason?: string;
}

// ── API helpers ─────────────────────────────────────────────────────────────

async function apiGetPaymentSettings(): Promise<PaymentSettings> {
  const res = await fetch(`${API_BASE}/payment/settings`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to load payment settings");
  return json;
}

async function apiGetInvoice(invoiceId: string): Promise<Invoice> {
  const token = localStorage.getItem("company_token");
  const res = await fetch(`${API_BASE}/payment/invoice/${invoiceId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to load invoice");
  return json;
}

async function apiUploadScreenshot(invoiceId: string, file: File): Promise<void> {
  const token = localStorage.getItem("company_token");
  const fd = new FormData();
  fd.append("screenshot", file);
  const res = await fetch(`${API_BASE}/payment/upload-screenshot/${invoiceId}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    body: fd,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Upload failed");
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="ml-1.5 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center">
        <span className="text-sm font-medium">{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const map: Record<Invoice["status"], { label: string; className: string; icon: React.ReactNode }> = {
    PENDING:  { label: "Pending",  className: "bg-amber-100 text-amber-700 border-amber-200",   icon: <Clock className="w-3 h-3" /> },
    PAID:     { label: "Paid",     className: "bg-blue-100 text-blue-700 border-blue-200",       icon: <Clock className="w-3 h-3" /> },
    APPROVED: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200",   icon: <CheckCircle className="w-3 h-3" /> },
    REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200",         icon: <XCircle className="w-3 h-3" /> },
  };
  const { label, className, icon } = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${className}`}>
      {icon} {label}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function PaymentPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => {
    if (!invoiceId) return;
    Promise.all([apiGetPaymentSettings(), apiGetInvoice(invoiceId)])
      .then(([s, inv]) => { setSettings(s); setInvoice(inv); })
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  // Poll invoice status every 15s after screenshot uploaded
  useEffect(() => {
    if (!uploadDone || !invoiceId) return;
    pollRef.current = setInterval(async () => {
      try {
        const inv = await apiGetInvoice(invoiceId);
        setInvoice(inv);
        if (inv.status === "APPROVED") {
          clearInterval(pollRef.current!);
          toast.success("Payment approved! Redirecting…");
          setTimeout(() => navigate("/dashboard"), 2000);
        } else if (inv.status === "REJECTED") {
          clearInterval(pollRef.current!);
        }
      } catch {}
    }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [uploadDone, invoiceId, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File size must be under 5MB"); return; }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !invoiceId) return;
    setUploading(true);
    try {
      await apiUploadScreenshot(invoiceId, file);
      setUploadDone(true);
      const inv = await apiGetInvoice(invoiceId);
      setInvoice(inv);
      toast.success("Payment screenshot submitted! We'll verify within 24 hours.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const whatsappUrl = settings?.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hi, I've made payment for invoice ${invoice?.invoiceNumber || invoiceId}. Please verify.`
      )}`
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading invoice…</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="shadow-xl border-border w-full max-w-md">
          <CardContent className="pt-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
            <p className="font-semibold text-lg">Invoice Not Found</p>
            <p className="text-sm text-muted-foreground">This invoice doesn't exist or you don't have access.</p>
            <Button onClick={() => window.open(`${PORTAL_URL}/select-plan`, '_blank')} className="bg-[#6366f1] hover:bg-[#5558e6]">
              Back to Plans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Approved ─────────────────────────────────────────────────────────────
  if (invoice.status === "APPROVED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <Card className="shadow-xl border-border">
            <CardContent className="pt-10 pb-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="font-bold text-xl">Payment Approved!</p>
              <p className="text-sm text-muted-foreground">Your subscription is now active. Welcome to MonitorHub!</p>
              <Button onClick={() => navigate("/dashboard")} className="w-full bg-[#6366f1] hover:bg-[#5558e6]">
                Go to Dashboard →
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-2xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[#6366f1]" />
            <span className="text-xs font-medium text-[#6366f1]">MonitorHub</span>
          </div>
          <h1 className="text-2xl font-bold">Complete Your Payment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Transfer the amount and upload your payment screenshot below
          </p>
        </div>

        {/* ── Invoice Summary ──────────────────────────────────────────────── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Invoice #{invoice.invoiceNumber}</CardTitle>
              <StatusBadge status={invoice.status} />
            </div>
            <CardDescription>
              {invoice.plan?.name} — {invoice.billingCycle ?? "Monthly"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-[#6366f1]/5 border border-[#6366f1]/20 text-center">
              <p className="text-xs text-muted-foreground mb-1">Amount Due</p>
              <p className="text-3xl font-bold text-[#6366f1]">
                PKR {invoice.amount.toLocaleString("en-PK")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Rejected notice ─────────────────────────────────────────────── */}
        {invoice.status === "REJECTED" && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex gap-3">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Payment Rejected</p>
              <p className="text-xs mt-0.5">{invoice.rejectionReason || "Please resubmit a clear payment screenshot."}</p>
            </div>
          </div>
        )}

        {/* ── Payment Details ──────────────────────────────────────────────── */}
        {settings && (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Details</CardTitle>
              <CardDescription>Transfer to any of the following accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Bank Transfer */}
              {(settings.bankName || settings.bankAccountNumber) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    🏦 Bank Transfer
                  </p>
                  <div className="bg-muted/40 rounded-lg p-3 space-y-0.5">
                    {settings.bankName          && <DetailRow label="Bank"           value={settings.bankName} />}
                    {settings.bankAccountTitle  && <DetailRow label="Account Title"  value={settings.bankAccountTitle} />}
                    {settings.bankAccountNumber && <DetailRow label="Account Number" value={settings.bankAccountNumber} />}
                    {settings.bankIBAN          && <DetailRow label="IBAN"           value={settings.bankIBAN} />}
                  </div>
                </div>
              )}

              {/* Mobile Wallets */}
              {(settings.easypaisaNumber || settings.nayapayNumber || settings.sadapayNumber || settings.jsbankNumber) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    📱 Mobile Wallets
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {settings.easypaisaNumber && (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Easypaisa</p>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{settings.easypaisaNumber}</span>
                          <CopyButton value={settings.easypaisaNumber} />
                        </div>
                      </div>
                    )}
                    {settings.nayapayNumber && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">NayaPay</p>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{settings.nayapayNumber}</span>
                          <CopyButton value={settings.nayapayNumber} />
                        </div>
                      </div>
                    )}
                    {settings.sadapayNumber && (
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">SadaPay</p>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{settings.sadapayNumber}</span>
                          <CopyButton value={settings.sadapayNumber} />
                        </div>
                      </div>
                    )}
                    {settings.jsbankNumber && (
                      <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">JS Bank</p>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{settings.jsbankNumber}</span>
                          <CopyButton value={settings.jsbankNumber} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Upload Screenshot ────────────────────────────────────────────── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload Payment Screenshot</CardTitle>
            <CardDescription>
              After transferring, upload a screenshot of your transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.screenshotUrl && !previewUrl ? (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-border">
                  <img src={invoice.screenshotUrl} alt="Payment screenshot" className="w-full object-cover max-h-64" />
                </div>
                {invoice.status === "PAID" && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Waiting for admin verification…
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-[#6366f1]/50 hover:bg-[#6366f1]/3 transition-colors"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Click to upload screenshot</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <Button
                  onClick={handleUpload}
                  className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                  disabled={uploading || !previewUrl}
                >
                  {uploading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
                    : <><Upload className="w-4 h-4 mr-2" /> Submit Payment Screenshot</>
                  }
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── WhatsApp Button ──────────────────────────────────────────────── */}
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full border-green-500/40 text-green-600 hover:bg-green-500/5 hover:text-green-700">
              <MessageCircle className="w-4 h-4 mr-2 fill-current" />
              Confirm Payment via WhatsApp
            </Button>
          </a>
        )}

        <p className="text-center text-xs text-muted-foreground pb-6">
          Payments are manually verified within 24 hours. For urgent queries, use WhatsApp above.
        </p>
      </motion.div>
    </div>
  );
}
