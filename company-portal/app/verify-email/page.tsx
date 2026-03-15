"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, saveToken } from "@/lib/api";

// ── Inner component (uses useSearchParams — must be inside Suspense) ───────────

function VerifyEmailInner() {
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const emailParam = searchParams.get("email") ?? "";

  type Status = "loading" | "success" | "expired" | "resend-only";
  const [status, setStatus] = useState<Status>(token ? "loading" : "resend-only");
  const [resendEmail, setResendEmail] = useState(emailParam);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendError, setResendError] = useState("");

  // Auto-verify on mount when token present
  useEffect(() => {
    if (!token) return;
    api
      .verifyEmail(token)
      .then((data) => {
        saveToken(data.token);
        setStatus("success");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message || "Verification failed");
        setStatus("expired");
      });
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendError("");
    setResendLoading(true);
    try {
      await api.resendVerification(resendEmail);
      setResendDone(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Failed to send email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-5 py-4">
          <div className="w-14 h-14 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="font-semibold text-gray-800">Verifying your email...</p>
            <p className="text-sm text-gray-400 mt-1">Please wait a moment</p>
          </div>
        </div>
      </Card>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <Card>
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
          <p className="text-gray-500 mb-8">
            Your account has been successfully verified. Select a plan to get started with monitoring.
          </p>
          <Link
            href="/select-plan"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-7 py-3 rounded-xl transition-colors"
          >
            Select a Plan
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </Card>
    );
  }

  // ── Expired / Error ───────────────────────────────────────────────────────
  if (status === "expired") {
    return (
      <Card>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h2>
          <p className="text-gray-500 mb-6">{errorMsg || "This verification link is no longer valid. Request a new one below."}</p>
        </div>
        <ResendForm
          email={resendEmail}
          setEmail={setResendEmail}
          onSubmit={handleResend}
          loading={resendLoading}
          done={resendDone}
          error={resendError}
        />
      </Card>
    );
  }

  // ── Resend only (no token in URL) ─────────────────────────────────────────
  return (
    <Card>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Resend Verification Email</h2>
        <p className="text-gray-500">Enter your email and we&apos;ll send you a new verification link.</p>
      </div>
      <ResendForm
        email={resendEmail}
        setEmail={setResendEmail}
        onSubmit={handleResend}
        loading={resendLoading}
        done={resendDone}
        error={resendError}
      />
      <p className="mt-5 text-center text-sm text-gray-400">
        <Link href="/signup" className="text-indigo-600 hover:underline font-medium">
          ← Back to Sign Up
        </Link>
      </p>
    </Card>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ResendForm({
  email,
  setEmail,
  onSubmit,
  loading,
  done,
  error,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  done: boolean;
  error: string;
}) {
  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 text-green-600 font-medium py-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Verification email sent!
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        required
        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {loading ? "Sending..." : "Send New Link"}
      </button>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        {children}
      </div>
    </div>
  );
}

// ── Page export (wraps in Suspense for useSearchParams) ───────────────────────

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
