"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getToken, Invoice, PaymentSettings } from "@/lib/api";

type PaymentMethod = "easypaisa" | "nayapay" | "sadapay" | "bank";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  easypaisa: "Easypaisa",
  nayapay: "NayaPay",
  sadapay: "SadaPay",
  bank: "Bank Transfer",
};

export default function PaymentPage() {
  const params = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const invoiceId = params.invoiceId;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upload state
  const [method, setMethod] = useState<PaymentMethod>("easypaisa");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confetti for PAID
  const [paid, setPaid] = useState(false);

  // Poll invoice status every 30s
  useEffect(() => {
    if (!getToken()) { router.replace("/signup"); return; }

    const load = async () => {
      try {
        const data = await api.getInvoice(invoiceId);
        setInvoice(data.invoice);
        setSettings(data.paymentSettings);
        if (data.invoice.status === "PAID") setPaid(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(async () => {
      try {
        const data = await api.getInvoice(invoiceId);
        setInvoice(data.invoice);
        if (data.invoice.status === "PAID") { setPaid(true); clearInterval(interval); }
      } catch { /* silent */ }
    }, 30000);

    return () => clearInterval(interval);
  }, [invoiceId, router]);

  async function handleUpload() {
    if (!file) { setUploadError("Please select a screenshot"); return; }
    setUploading(true);
    setUploadError("");
    try {
      const updated = await api.uploadScreenshot(invoiceId, method, file);
      setInvoice(updated.invoice);
      setUploadDone(true);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center border border-red-100">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button onClick={() => router.push("/select-plan")}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700">
            Back to Plans
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const amountStr = invoice.amount.toLocaleString("en-PK", { maximumFractionDigits: 0 });
  const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

  const waText = `Payment Screenshot%0AInvoice ID: ${invoice.invoiceNumber}%0AAmount: ${amountStr} PKR%0APlan: ${invoice.planName}`;
  const waUrl = settings?.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}?text=${waText}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── PAID banner ─────────────────────────────────────────────────── */}
        {paid && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center animate-pulse">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-xl font-bold text-green-700">Payment Verified!</h2>
            <p className="text-green-600 mt-1 mb-4">Your subscription is now active.</p>
            <a href={DASHBOARD_URL}
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold px-7 py-3 rounded-xl transition-colors">
              Open Dashboard →
            </a>
          </div>
        )}

        {/* ── REJECTED banner ──────────────────────────────────────────────── */}
        {invoice.status === "REJECTED" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <p className="font-semibold text-red-700">Payment Rejected</p>
                <p className="text-red-600 text-sm mt-1">Reason: {invoice.rejectionReason}</p>
                <button onClick={() => router.push("/select-plan")}
                  className="mt-3 text-sm text-indigo-600 hover:underline font-medium">
                  Try Again →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PENDING processing banner ─────────────────────────────────────── */}
        {invoice.status === "PENDING" && invoice.hasScreenshot && !uploadDone && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">🟡</span>
            <p className="text-yellow-800 font-medium text-sm">
              Payment screenshot received. We will verify within 24 hours.
            </p>
          </div>
        )}

        {/* ── Invoice card ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">Invoice</h1>
              <p className="text-indigo-300 text-sm font-mono">{invoice.invoiceNumber}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {/* Line items table */}
          <div className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Subscription</th>
                  <th className="text-center py-2 text-gray-500 font-medium">Qty</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Unit Price</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="py-3 font-medium text-gray-900">
                    {invoice.planName}
                    <span className="ml-2 text-xs text-gray-400 capitalize">({invoice.billingCycle})</span>
                  </td>
                  <td className="py-3 text-center text-gray-600">1</td>
                  <td className="py-3 text-right text-gray-600">PKR {amountStr}</td>
                  <td className="py-3 text-right font-semibold text-gray-900">PKR {amountStr}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 border-t border-gray-100 pt-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>PKR {amountStr}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base">
                <span>Total</span>
                <span>PKR {amountStr}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Subscription Terms: PKR {amountStr} per {invoice.billingCycle === "yearly" ? "year" : "month"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Payment methods grid ──────────────────────────────────────────── */}
        {settings && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-indigo-600 text-white px-6 py-3">
              <h2 className="font-semibold text-sm tracking-wide uppercase">Pay Offline — Any Method</h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
              {/* Bank */}
              {settings.bankIban && (
                <PayMethodCard
                  icon="🏦"
                  title={settings.bankName || "Bank Transfer"}
                  line1={`IBAN: ${settings.bankIban}`}
                  line2={settings.bankTitle}
                />
              )}
              {/* JS Bank */}
              {settings.jsbankNumber && (
                <PayMethodCard
                  icon="🏦"
                  title="JS Bank"
                  line1={settings.jsbankNumber}
                  line2={settings.jsbankName}
                />
              )}
              {/* NayaPay */}
              {settings.nayapayNumber && (
                <PayMethodCard
                  icon="💙"
                  title="NayaPay"
                  line1={settings.nayapayNumber}
                  line2={settings.nayapayName}
                />
              )}
              {/* SadaPay */}
              {settings.sadapayNumber && (
                <PayMethodCard
                  icon="💜"
                  title="SadaPay"
                  line1={settings.sadapayNumber}
                  line2={settings.sadapayName}
                />
              )}
              {/* Easypaisa — full width if odd */}
              {settings.easypaisaNumber && (
                <div className="col-span-2 p-4 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📱</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Easypaisa</p>
                      <p className="text-gray-700 text-sm font-mono">{settings.easypaisaNumber}</p>
                      <p className="text-gray-500 text-xs">{settings.easypaisaName}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── After payment instructions ───────────────────────────────────── */}
        {settings?.whatsappNumber && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
            <h3 className="font-semibold text-yellow-800 mb-3">After payment:</h3>
            <ol className="text-sm text-yellow-700 space-y-2 list-decimal list-inside">
              <li>Send screenshot + Invoice ID via WhatsApp</li>
              <li>For bank transfers, also include your account name</li>
            </ol>
            <div className="mt-4 pt-4 border-t border-yellow-200 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 font-medium">WhatsApp:</span>
                <span className="font-mono text-yellow-800">{settings.whatsappNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 font-medium">Invoice ID:</span>
                <span className="font-mono text-yellow-800">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 font-medium">Amount:</span>
                <span className="font-mono text-yellow-800">PKR {amountStr}</span>
              </div>
            </div>
            {settings.instructions && (
              <p className="mt-3 text-xs text-yellow-700 border-t border-yellow-200 pt-3">
                {settings.instructions}
              </p>
            )}
          </div>
        )}

        {/* ── Upload screenshot ────────────────────────────────────────────── */}
        {invoice.status === "PENDING" && !paid && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Upload Payment Screenshot</h3>

            {uploadDone ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-green-700 font-medium">✅ Screenshot uploaded! An admin will verify your payment.</p>
                <p className="text-green-600 text-sm mt-1">Status will auto-refresh every 30 seconds.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payment method select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {(Object.entries(METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {/* File upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot (JPG/PNG/WEBP, max 5MB)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 text-center text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  >
                    {file ? (
                      <span className="text-sm font-medium text-indigo-600">📎 {file.name}</span>
                    ) : (
                      <span className="text-sm">Click to select screenshot</span>
                    )}
                  </button>
                </div>

                {uploadError && (
                  <p className="text-red-600 text-sm">{uploadError}</p>
                )}

                <button
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {uploading ? "Uploading..." : "Upload Screenshot"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── WhatsApp button ──────────────────────────────────────────────── */}
        {waUrl && invoice.status === "PENDING" && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3.5 rounded-2xl transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.523 5.847L0 24l6.335-1.498A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.359-.213-3.726.88.897-3.633-.234-.374A9.818 9.818 0 0112 2.182c5.427 0 9.818 4.391 9.818 9.818 0 5.428-4.391 9.818-9.818 9.818z"/>
            </svg>
            Send Payment Screenshot via WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "🟡 Pending", cls: "bg-yellow-100 text-yellow-800" },
    PAID: { label: "🟢 Paid", cls: "bg-green-100 text-green-800" },
    REJECTED: { label: "🔴 Rejected", cls: "bg-red-100 text-red-800" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-800" };
  return (
    <span className={`${s.cls} text-xs font-semibold px-3 py-1 rounded-full`}>{s.label}</span>
  );
}

function PayMethodCard({ icon, title, line1, line2 }: { icon: string; title: string; line1: string; line2: string }) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{title}</p>
          <p className="text-gray-700 text-sm font-mono">{line1}</p>
          {line2 && <p className="text-gray-500 text-xs">{line2}</p>}
        </div>
      </div>
    </div>
  );
}
