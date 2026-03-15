"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, saveToken, Plan } from "@/lib/api";

type Cycle = "monthly" | "yearly";

export default function SelectPlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selectError, setSelectError] = useState("");

  useEffect(() => {
    // Accept token passed via URL query param (from company-frontend verify-email redirect)
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("company_token");
    if (tokenFromUrl) {
      saveToken(tokenFromUrl);
      window.history.replaceState({}, "", "/select-plan");
    }
    if (!getToken() && !tokenFromUrl) router.replace("/signup");
  }, [router]);

  useEffect(() => {
    api
      .getPlans()
      .then(setPlans)
      .catch(() => setPlansError("Failed to load plans. Please refresh."))
      .finally(() => setLoadingPlans(false));
  }, []);

  async function handleSelect(plan: Plan) {
    setSelecting(plan.id);
    setSelectError("");
    try {
      const price = cycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
      if (price === 0) {
        // Free plan — activate subscription directly, no invoice needed
        const data = await api.selectPlan({ planId: plan.id, billingCycle: cycle });
        if (data.token) {
          const { saveToken } = await import("@/lib/api");
          saveToken(data.token);
        }
        router.push("/dashboard-ready");
      } else {
        // Paid plan — create invoice → redirect to payment page
        const data = await api.createInvoice({ planId: plan.id, billingCycle: cycle });
        router.push(`/payment/${data.invoice.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process plan selection";
      setSelectError(msg);
    } finally {
      setSelecting(null);
    }
  }

  if (loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (plansError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-sm w-full text-center">
          <p className="text-red-600 font-medium mb-4">{plansError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
        <p className="text-gray-500 mt-2">Select the right plan for your team</p>

        {/* Billing cycle toggle */}
        <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 mt-6">
          <button
            onClick={() => setCycle("monthly")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              cycle === "monthly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              cycle === "yearly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Yearly
            <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-md font-bold">Save 17%</span>
          </button>
        </div>
      </div>

      {selectError && (
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
            {selectError}
          </div>
        </div>
      )}

      {plans.length === 0 && (
        <div className="text-center text-gray-400 py-12">No plans available at the moment.</div>
      )}

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, idx) => {
          const price = cycle === "monthly" ? plan.priceMonthly : plan.priceYearly / 12;
          const isPopular = idx === Math.floor(plans.length / 2);
          const isSelecting = selecting === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border flex flex-col transition-all hover:shadow-md ${
                isPopular
                  ? "border-indigo-300 ring-2 ring-indigo-200 shadow-md relative"
                  : "border-gray-100"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="p-6 flex-1">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-3 mb-5">
                  <span className="text-4xl font-extrabold text-gray-900">
                    PKR {price.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-gray-400 text-sm ml-1">/month</span>
                  {cycle === "yearly" && (
                    <p className="text-xs text-green-600 font-medium mt-0.5">
                      Billed PKR {plan.priceYearly.toLocaleString("en-PK", { maximumFractionDigits: 0 })}/year
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-5">
                  <span className="font-semibold text-gray-800">
                    {plan.maxSeats === -1 ? "Unlimited" : plan.maxSeats}
                  </span>{" "}
                  employees
                </p>
                <ul className="space-y-2.5">
                  <Feature enabled={plan.screenshotsEnabled} label="Screenshots" />
                  <Feature enabled={plan.browserHistoryEnabled} label="Browser History" />
                  <Feature enabled={plan.usbMonitoringEnabled} label="USB Monitoring" />
                  <Feature enabled={plan.alertsEnabled} label="Alerts & Notifications" />
                  <Feature enabled={plan.advancedReports} label="Advanced Reports" />
                  <Feature enabled={plan.keylogEnabled} label="Keylogger" />
                  <Feature enabled={plan.fileActivityEnabled} label="File Activity" />
                  <Feature enabled={plan.printLogsEnabled} label="Print Logs" />
                  <Feature enabled={plan.shutdownEnabled} label="Remote Shutdown" />
                  <Feature enabled={plan.livescreenEnabled} label="Live Screen" />
                  <Feature enabled={plan.lockEnabled} label="Remote Lock" />
                </ul>
              </div>
              <div className="px-6 pb-6">
                <button
                  onClick={() => handleSelect(plan)}
                  disabled={!!selecting}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    isPopular
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-gray-900 hover:bg-gray-800 text-white"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isSelecting && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {isSelecting
                    ? (cycle === "monthly" ? plan.priceMonthly : plan.priceYearly) === 0
                      ? "Activating..."
                      : "Creating Invoice..."
                    : (cycle === "monthly" ? plan.priceMonthly : plan.priceYearly) === 0
                      ? "Start Free →"
                      : "Get Started →"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-10">
        Free plans activate instantly. Paid plans: Invoice → Offline payment → Admin verification → Subscription active
      </p>
    </div>
  );
}

function Feature({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {enabled ? (
        <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={enabled ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </li>
  );
}
