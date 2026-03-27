import React, { useState, useEffect } from "react";
import { SeatLimitCard } from "../components/SeatLimit";
import { useSubscription } from "../lib/subscription-context";

const PORTAL_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_PORTAL_URL ||
  "http://localhost:3001";

const BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("monitor_token") || "";
}

interface PlanOption { id: string; name: string; priceMonthly: number; }
interface PendingRequest { id: string; requestedPlan: { name: string }; createdAt: string; status: string; }

export function BillingPage() {
  const { seatInfo, loading, error } = useSubscription();
  const [_portalOpened, setPortalOpened] = useState(false);

  // Upgrade request state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    // Fetch available plans
    fetch(`${BASE_URL}/plans`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then((data: { plans?: PlanOption[] } | PlanOption[]) => {
        const arr = Array.isArray(data) ? data : (data.plans ?? []);
        setPlans(arr);
      })
      .catch(() => {});

    // Fetch pending upgrade request
    fetch(`${BASE_URL}/upgrade-request/status`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then((data: { pending?: PendingRequest | null }) => setPendingRequest(data.pending ?? null))
      .catch(() => {});
  }, [requestSuccess]);

  const submitUpgradeRequest = async () => {
    if (!selectedPlanId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/upgrade-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ planId: selectedPlanId, note }),
      });
      if (!res.ok) throw new Error("Failed");
      setShowUpgradeModal(false);
      setRequestSuccess(s => !s);
      setNote("");
      setSelectedPlanId("");
    } catch {
      alert("Request submit karne mein masla aaya. Dobara koshish karein.");
    } finally {
      setSubmitting(false);
    }
  };

  const sub = seatInfo as {
    plan?: { name?: string; price_pkr?: number };
    subscription_status?: string;
    current_period_end?: string;
    billing_cycle?: string;
    plan_name?: string;
    price_pkr?: number;
    status?: string;
  } | null;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-40 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!seatInfo) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-muted-foreground text-sm">
        No subscription information available.
      </div>
    );
  }

  const planName = sub?.plan?.name ?? sub?.plan_name ?? "—";
  const price = sub?.plan?.price_pkr ?? sub?.price_pkr ?? 0;
  const subStatus = sub?.subscription_status ?? sub?.status ?? "ACTIVE";
  const periodEnd = sub?.current_period_end;
  const billingCycle = sub?.billing_cycle;

  let daysLeft = 0;
  if (periodEnd) {
    daysLeft = Math.ceil((new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  const isExpiringSoon = daysLeft > 0 && daysLeft <= 7;
  const isExpired = subStatus === "EXPIRED";

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Billing &amp; Subscription</h1>
          <p className="text-muted-foreground text-sm">
            Current plan, seat usage, and payment management.
          </p>
        </div>
        <a
          href={`${PORTAL_URL}/billing`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setPortalOpened(true)}
          className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Manage Billing →
        </a>
      </div>

      {/* ── Expiry warning ──────────────────────────────────────────────────── */}
      {(isExpiringSoon || isExpired) && (
        <div className={`rounded-lg p-4 border flex items-center gap-3 ${
          isExpired
            ? "bg-destructive/10 border-destructive/30 text-destructive"
            : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200"
        }`}>
          <span className="text-xl">{isExpired ? "🔴" : "⚠️"}</span>
          <div>
            <p className="font-semibold text-sm">
              {isExpired
                ? "Subscription expire ho gayi — Dashboard access limited hai"
                : `⚠️ Subscription ${daysLeft} din mein expire ho rahi hai — Renew karein`}
            </p>
            <a
              href={`${PORTAL_URL}/billing`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              Billing portal mein renew karein →
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* ── Current Plan card ─────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold">Current Plan</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                subStatus === "ACTIVE" ? "bg-green-100 text-green-700" :
                subStatus === "EXPIRED" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {subStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="p-4 rounded-lg bg-primary/5">
                <p className="text-muted-foreground text-xs mb-1">Plan</p>
                <p className="text-xl font-bold">{planName}</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-500/5">
                <p className="text-muted-foreground text-xs mb-1">Monthly Cost</p>
                <p className="text-xl font-bold">
                  {price === 0 ? "Free" : `PKR ${price.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`}
                </p>
              </div>
              {periodEnd && (
                <div className="p-4 rounded-lg bg-blue-500/5">
                  <p className="text-muted-foreground text-xs mb-1">Next Renewal</p>
                  <p className="font-semibold text-sm">
                    {new Date(periodEnd).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
              {billingCycle && (
                <div className="p-4 rounded-lg bg-violet-500/5">
                  <p className="text-muted-foreground text-xs mb-1">Billing Cycle</p>
                  <p className="font-semibold text-sm capitalize">{billingCycle}</p>
                </div>
              )}
            </div>

            {/* Days remaining bar */}
            {periodEnd && (
              <div className="mb-5">
                <div className="flex justify-between text-sm text-muted-foreground mb-1.5">
                  <span>Subscription period</span>
                  <span className={daysLeft <= 7 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                    {daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${daysLeft <= 7 ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(Math.max((daysLeft / 30) * 100, 0), 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pending upgrade request banner */}
            {pendingRequest && (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-center gap-2 text-amber-800 text-sm dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200">
                <span className="text-lg">⏳</span>
                <div>
                  <p className="font-semibold">Upgrade Request Pending</p>
                  <p className="text-xs opacity-80">
                    {pendingRequest.requestedPlan.name} plan ke liye request submit ho gayi — Admin review kar raha hai.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="flex-1 bg-primary text-primary-foreground text-center py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                🚀 Upgrade Plan Request
              </button>
              <a href={`${PORTAL_URL}/billing`} target="_blank" rel="noopener noreferrer"
                className="flex-1 bg-muted text-foreground text-center py-2.5 rounded-lg text-sm font-semibold hover:bg-muted/80 transition-colors">
                Manage Billing
              </a>
            </div>

            {/* Upgrade Request Modal */}
            {showUpgradeModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">🚀 Plan Upgrade Request</h3>
                    <button onClick={() => setShowUpgradeModal(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Apna desired plan select karein. Admin review karke approve karega.
                  </p>
                  <div>
                    <label className="block text-sm font-medium mb-1">Desired Plan</label>
                    <select
                      value={selectedPlanId}
                      onChange={e => setSelectedPlanId(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Plan select karein --</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — PKR {p.priceMonthly.toLocaleString()}/month
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Note (optional)</label>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Admin ko koi message likhein..."
                      rows={3}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowUpgradeModal(false)}
                      className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitUpgradeRequest}
                      disabled={!selectedPlanId || submitting}
                      className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Request Bhejein 🚀"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Payment history ──────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Payment History</h3>
              <a href={`${PORTAL_URL}/billing`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline font-medium">
                All invoices →
              </a>
            </div>
            <div className="bg-muted/40 rounded-lg p-6 text-center">
              <div className="text-3xl mb-2">🧾</div>
              <p className="text-muted-foreground text-sm">
                Invoices aur payment history billing portal mein available hain.
              </p>
              <a href={`${PORTAL_URL}/billing`} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-3 text-sm text-primary font-semibold hover:underline">
                Billing Portal Kholein →
              </a>
            </div>
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <SeatLimitCard />
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Quick Links
            </h3>
            <a href={`${PORTAL_URL}/select-plan`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
              <span>📋</span> Select New Plan
            </a>
            <a href={`${PORTAL_URL}/billing`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
              <span>💳</span> Payment History
            </a>
            <a href={`${PORTAL_URL}/billing`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
              <span>⬆️</span> Upgrade / Downgrade
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

