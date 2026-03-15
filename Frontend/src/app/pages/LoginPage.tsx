import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Eye, EyeOff, Loader2, ServerOff, Wifi, KeyRound, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { useAuth } from "../lib/auth-types";
import { useSocket } from "../lib/socket-context";

export function LoginPage() {
  // Step 1 state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 2 (2FA) state
  const [step, setStep] = useState<1 | 2>(1);
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const twoFAInputRef = useRef<HTMLInputElement>(null);

  const { login, verify2FA, isAuthenticated } = useAuth();
  const { connectionStatus } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const isBackendDown =
    connectionStatus.backend === "disconnected" && !connectionStatus.backendChecking;
  const isBackendUp =
    connectionStatus.backend === "connected" && !connectionStatus.backendChecking;
  const kickedByBackendOffline =
    (location.state as { reason?: string } | null)?.reason === "backend_offline";

  const isDisabled = loading || isBackendDown || connectionStatus.backendChecking;

  React.useEffect(() => {
    if (isAuthenticated && isBackendUp) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isBackendUp, navigate]);

  // Auto-focus 2FA input when entering step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => twoFAInputRef.current?.focus(), 100);
    }
  }, [step]);

  // Handle step 1 (email + password)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBackendDown) {
      toast.error("Backend is offline. Please start the backend server first.");
      return;
    }
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requires2FA) {
        setTempToken(result.tempToken);
        setStep(2);
      } else {
        toast.success("Login successful!");
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid email or password";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle step 2 (2FA code)
  const handleTwoFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFACode.length !== 6 || !/^\d+$/.test(twoFACode)) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await verify2FA(tempToken, twoFACode);
      toast.success("Login successful!");
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      toast.error(msg);
      setTwoFACode("");
      twoFAInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setTwoFACode(val);
  };

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
                {step === 2 ? (
                  <KeyRound className="w-7 h-7 text-white" />
                ) : (
                  <Shield className="w-7 h-7 text-white" />
                )}
              </div>
            </div>
            <CardTitle>
              {step === 2 ? "Two-Factor Authentication" : "MonitorHub"}
            </CardTitle>
            <CardDescription>
              {step === 2
                ? "Enter the 6-digit code from your authenticator app"
                : "Employee Monitoring Dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>

            {/* ── Backend status banner ───────────────────────────────────── */}
            {step === 1 && (
              <AnimatePresence mode="wait">
                {isBackendDown ? (
                  <motion.div
                    key="offline"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="mb-4 px-3 py-3 rounded-md bg-red-500/10 border border-red-500/25 text-red-500"
                  >
                    <div className="flex items-start gap-2">
                      <ServerOff className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        {kickedByBackendOffline ? (
                          <>
                            <p className="text-xs font-semibold">Session ended — backend disconnected</p>
                            <p className="text-xs mt-0.5 opacity-80">
                              Please connect the backend server before logging in again.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-semibold">Backend server is offline</p>
                            <p className="text-xs mt-0.5 opacity-80">
                              Please connect the backend before login.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : connectionStatus.backendChecking ? (
                  <motion.div
                    key="checking"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="mb-4 px-3 py-2.5 rounded-md bg-muted/60 border border-border text-muted-foreground flex items-center gap-2"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <p className="text-xs">Connecting to backend server…</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="online"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="mb-4 px-3 py-2.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 flex items-center gap-2"
                  >
                    <Wifi className="w-3.5 h-3.5 shrink-0" />
                    <p className="text-xs font-medium">Backend server is online</p>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* ── Step 1: Email + Password ────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLoginSubmit}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={isDisabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-[#6366f1] hover:underline"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={isDisabled}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isDisabled}
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {connectionStatus.backendChecking
                      ? "Connecting…"
                      : isBackendDown
                      ? "Backend Offline — Cannot Login"
                      : "Sign In"}
                  </Button>
                </motion.form>
              ) : (
                /* ── Step 2: 2FA Code ───────────────────────────────────── */
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleTwoFASubmit}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="twofa-code">Authentication Code</Label>
                    <Input
                      ref={twoFAInputRef}
                      id="twofa-code"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={twoFACode}
                      onChange={handleCodeInput}
                      disabled={loading}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Open your authenticator app and enter the 6-digit code
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                    disabled={loading || twoFACode.length !== 6}
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Verify Code
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setTwoFACode(""); setTempToken(""); }}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
