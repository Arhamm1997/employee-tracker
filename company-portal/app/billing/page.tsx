"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, Invoice, SubscriptionUsage, Plan } from "@/lib/api";

type Cycle = "monthly" | "yearly";
type ModalType = "upgrade" | "downgrade" | null;

export default function BillingPage() {
  const router = useRouter();
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/signup"); return; }

    Promise.all([
      api.getSubscriptionUsage().catch(() => null),
      api.getMyInvoices().catch(() => ({ invoices: [] })),
      api.getPlans().catch(() => []),
    ]).then(([usageData, invData, plansData]) => {
      if (usageData) setUsage(usageData);
      setInvoices(invData.invoices);
      setPlans(plansData);
    }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load billing info"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handlePlanChange() {
    if (!selectedPlanId) { setActionError("Please select a plan"); return; }
    setActionLoading(true);
    setActionError("");
    try {
      if (modal === "upgrade") {
        await api.upgradeSubscription({ planId: selectedPlanId, billingCycle: cycle });
        setActionSuccess("Plan upgraded successfully!");
      } else {
        await api.downgradeSubscription({ planId: selectedPlanId, billingCycle: cycle });
        setActionSuccess("Plan changed successfully!");
      }
      // Refresh usage
      const fresh = await api.getSubscriptionUsage();
      setUsage(fresh);
      setTimeout(() => { setModal(null); setActionSuccess(""); }, 2000);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const daysLeft = usage?.usage.daysRemaining ?? 0;
  const showExpiry = usage && (usage.usage.status === "EXPIRING_SOON" || usage.usage.status === "EXPIRED");

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <button onClick={() => router.push("/select-plan")}
            className="text-sm text-indigo-600 hover:underline font-medium">
            Select New Plan →
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
        )}

        {/* ── Expiry warning banner ────────────────────────────────────────── */}
        {showExpiry && (
          <div className={`rounded-2xl p-4 border flex items-center gap-3 ${
            usage!.usage.status === "EXPIRED"
              ? "bg-red-50 border-red-200"
              : "bg-yellow-50 border-yellow-200"
          }`}>
            <span className="text-2xl">{usage!.usage.status === "EXPIRED" ? "🔴" : "⚠️"}</span>
            <div>
              <p className={`font-semibold text-sm ${usage!.usage.status === "EXPIRED" ? "text-red-700" : "text-yellow-800"}`}>
                {usage!.usage.status === "EXPIRED"
                  ? "Subscription has expired — Dashboard access has been suspended"
                  : `Subscription expires in ${daysLeft} days — Please renew`}
              </p>
              {usage!.usage.status !== "EXPIRED" && (
                <button onClick={() => router.push("/select-plan")}
                  className="text-xs text-yellow-700 underline mt-0.5">
                  Renew now
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Current Plan ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Current Plan</h2>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {usage?.usage.status ?? "—"}
              </span>
            </div>
            {usage ? (
              <>
                <p className="text-2xl font-extrabold text-gray-900 mb-1">{usage.plan.name}</p>
                <p className="text-gray-500 text-sm mb-4">
                  PKR {usage.plan.priceMonthly.toLocaleString("en-PK", { maximumFractionDigits: 0 })}/month
                </p>
                <ul className="space-y-1.5 mb-5">
                  {usage.plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModal("upgrade"); setSelectedPlanId(""); setActionError(""); }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                  >
                    Upgrade Plan
                  </button>
                  <button
                    onClick={() => { setModal("downgrade"); setSelectedPlanId(""); setActionError(""); }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2 rounded-xl transition-colors"
                  >
                    Downgrade Plan
                  </button>
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-sm text-center py-6">No active subscription</div>
            )}
          </div>

          {/* ── Usage card ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Usage & Billing</h2>
            {usage ? (
              <div className="space-y-5">
                {/* Seat usage */}
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600 font-medium">Seats Used</span>
                    <span className="font-semibold text-gray-900">
                      {usage.usage.seats.used}
                      {usage.usage.seats.total === -1 ? " / Unlimited" : ` / ${usage.usage.seats.total}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        usage.usage.seats.percentage >= 90 ? "bg-red-500" :
                        usage.usage.seats.percentage >= 70 ? "bg-yellow-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${Math.min(usage.usage.seats.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {usage.usage.seats.total === -1 ? "Unlimited seats" : `${usage.usage.seats.percentage}% used`}
                  </p>
                </div>

                {/* Billing info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Billing Cycle</span>
                    <span className="font-medium text-gray-900 capitalize">{usage.usage.billingCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Next Renewal</span>
                    <span className="font-medium text-gray-900">
                      {new Date(usage.usage.currentPeriodEnd).toLocaleDateString("en-PK", {
                        year: "numeric", month: "short", day: "numeric"
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Days Remaining</span>
                    <span className={`font-semibold ${daysLeft <= 7 ? "text-red-600" : "text-green-600"}`}>
                      {daysLeft} days
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm text-center py-6">No usage data</div>
            )}
          </div>
        </div>

        {/* ── Payment History ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Payment History</h2>
          </div>
          {invoices.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">No invoices yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-3 px-6 text-gray-500 font-medium">Invoice #</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Plan</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-medium">Amount</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-6 font-mono text-gray-800">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 text-gray-700">{inv.planName}</td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        PKR {inv.amount.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(inv.createdAt).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {inv.status === "PENDING" && (
                          <a href={`/payment/${inv.id}`}
                            className="text-indigo-600 hover:underline text-xs font-medium">
                            View Invoice
                          </a>
                        )}
                        {inv.status === "PAID" && (
                          <a href={`/payment/${inv.id}`}
                            className="text-green-600 hover:underline text-xs font-medium">
                            Receipt
                          </a>
                        )}
                        {inv.status === "REJECTED" && (
                          <a href="/select-plan"
                            className="text-red-600 hover:underline text-xs font-medium">
                            Try Again
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Plan change modal ──────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {modal === "upgrade" ? "Upgrade Plan" : "Downgrade Plan"}
            </h3>
            <p className="text-gray-500 text-sm mb-5">
              {modal === "upgrade"
                ? "Select a plan with more features or seats"
                : "Select a smaller plan (employee limit will be verified)"}
            </p>

            {/* Billing cycle */}
            <div className="flex gap-2 mb-4">
              {(["monthly", "yearly"] as Cycle[]).map((c) => (
                <button key={c} onClick={() => setCycle(c)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${cycle === c ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {c === "monthly" ? "Monthly" : "Yearly (Save 17%)"}
                </button>
              ))}
            </div>

            {/* Plan list */}
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {plans
                .filter((p) => p.id !== usage?.plan.id)
                .map((plan) => {
                  const price = cycle === "monthly" ? plan.priceMonthly : plan.priceYearly / 12;
                  const isCurrentPlan = plan.id === usage?.plan.id;
                  return (
                    <label key={plan.id}
                      className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                        selectedPlanId === plan.id
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      } ${isCurrentPlan ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <input type="radio" name="plan" value={plan.id}
                        checked={selectedPlanId === plan.id}
                        onChange={() => setSelectedPlanId(plan.id)}
                        disabled={isCurrentPlan}
                        className="accent-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{plan.name}</p>
                        <p className="text-gray-500 text-xs">
                          {plan.maxSeats === -1 ? "Unlimited" : plan.maxSeats} seats
                          {" · "} PKR {price.toLocaleString("en-PK", { maximumFractionDigits: 0 })}/mo
                        </p>
                      </div>
                      {isCurrentPlan && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Current</span>
                      )}
                    </label>
                  );
                })}
            </div>

            {actionError && <p className="text-red-600 text-sm mb-3">{actionError}</p>}
            {actionSuccess && <p className="text-green-600 text-sm mb-3">{actionSuccess}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setActionError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handlePlanChange} disabled={actionLoading || !selectedPlanId}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {actionLoading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {actionLoading ? "Processing..." : modal === "upgrade" ? "Upgrade Plan" : "Downgrade Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    PAID: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  const icons: Record<string, string> = { PENDING: "🟡", PAID: "🟢", REJECTED: "🔴" };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {icons[status] ?? "⚪"} {status}
    </span>
  );
}
