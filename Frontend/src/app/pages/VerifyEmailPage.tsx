import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useLocation } from "react-router";
import { motion } from "motion/react";
import { Shield, Loader2, Mail, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || "/api";

const PORTAL_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_PORTAL_URL ||
  "https://monitorhub.live";

async function apiVerifyEmail(token: string): Promise<{ message: string; token?: string }> {
  const res = await fetch(`${API_BASE}/company/auth/verify-email?token=${token}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Verification failed");
  return json;
}

async function apiResendVerification(email: string) {
  const res = await fetch(`${API_BASE}/company/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to resend");
  return json;
}

type VerifyStatus = "idle" | "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get("token");

  // Email passed from signup page via router state
  const emailFromState = (location.state as { email?: string } | null)?.email || "";
  const [email, setEmail] = useState(emailFromState);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [status, setStatus] = useState<VerifyStatus>(token ? "verifying" : "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [companyToken, setCompanyToken] = useState<string | null>(null);

  // Auto-verify if token present in URL
  useEffect(() => {
    if (!token) return;
    setStatus("verifying");
    apiVerifyEmail(token)
      .then((data: unknown) => {
        // Backend returns { token } — save it so we can pass to the portal
        const t = (data as { token?: string })?.token;
        if (t) setCompanyToken(t);
        setStatus("success");
      })
      .catch(err => {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email) { toast.error("Please enter your email address"); return; }
    setResendLoading(true);
    try {
      await apiResendVerification(email);
      toast.success("Verification email sent!");
      setResendCooldown(60);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResendLoading(false);
    }
  };

  // ── Auto-verify states ─────────────────────────────────────────────────────
  if (status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <Card className="shadow-xl border-border">
            <CardContent className="pt-10 pb-8 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-[#6366f1] animate-spin mx-auto" />
              <p className="font-semibold text-lg">Verifying your email…</p>
              <p className="text-sm text-muted-foreground">Please wait a moment.</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <Card className="shadow-xl border-border">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-[#6366f1] flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-[#6366f1]" />
                <span className="text-xs font-medium text-[#6366f1]">MonitorHub</span>
              </div>
              <CardTitle>Email Verified!</CardTitle>
              <CardDescription>Your email has been verified successfully.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                <p className="text-sm font-medium">Account is ready</p>
                <p className="text-xs mt-1 text-green-600/80 dark:text-green-400/80">
                  Now select a plan to activate your account.
                </p>
              </div>
              <a
                href={companyToken
                  ? `${PORTAL_URL}/select-plan?company_token=${encodeURIComponent(companyToken)}`
                  : `${PORTAL_URL}/select-plan`}
              >
                <Button className="w-full bg-[#6366f1] hover:bg-[#5558e6]">
                  Choose a Plan →
                </Button>
              </a>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <Card className="shadow-xl border-border">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500 flex items-center justify-center">
                  <XCircle className="w-7 h-7 text-white" />
                </div>
              </div>
              <CardTitle>Verification Failed</CardTitle>
              <CardDescription>{errorMsg || "This link is invalid or expired."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                <p className="text-sm">The verification link may have expired. Request a new one below.</p>
              </div>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  onClick={handleResend}
                  variant="outline"
                  className="w-full"
                  disabled={resendLoading || resendCooldown > 0}
                >
                  {resendLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : <><RefreshCw className="w-4 h-4 mr-2" /> Resend Verification Email</>
                  }
                </Button>
              </div>
              <Link to="/login">
                <Button variant="ghost" className="w-full text-muted-foreground">Back to Login</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Default: "Check your inbox" (after signup, no token yet) ──────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl border-border">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-[#6366f1] flex items-center justify-center">
                <Mail className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#6366f1]" />
              <span className="text-xs font-medium text-[#6366f1]">MonitorHub</span>
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to{" "}
              {email ? <strong>{email}</strong> : "your email address"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <p className="text-sm font-medium">Verification email sent!</p>
              <p className="text-xs mt-1 text-blue-600/80 dark:text-blue-400/80">
                Click the link in the email to verify your account. The link expires in 24 hours.
                Check your spam folder if you don't see it.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Didn't receive it?</p>
              {!emailFromState && (
                <input
                  type="email"
                  placeholder="Enter your email to resend"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}
              <Button
                onClick={handleResend}
                variant="outline"
                className="w-full"
                disabled={resendLoading || resendCooldown > 0 || !email}
              >
                {resendLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : <><RefreshCw className="w-4 h-4 mr-2" /> Resend Verification Email</>
                }
              </Button>
            </div>

            <Link to="/login">
              <Button variant="ghost" className="w-full text-muted-foreground">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
