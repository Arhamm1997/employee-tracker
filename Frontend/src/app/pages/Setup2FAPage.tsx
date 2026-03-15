import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { KeyRound, Loader2, Copy, CheckCircle, ArrowLeft, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { api2FASetup, api2FAEnable } from "../lib/api";
import { useAuth } from "../lib/auth-types";

export function Setup2FAPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api2FASetup();
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to initialize 2FA setup";
        toast.error(msg);
        navigate("/dashboard/settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (step === 2) {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      await api2FAEnable(code);
      await refreshUser();
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      toast.error(msg);
      setCode("");
      codeInputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Generating 2FA setup…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-xl border-border">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-[#6366f1] flex items-center justify-center">
                {success ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : (
                  <KeyRound className="w-7 h-7 text-white" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#6366f1]" />
              <span className="text-xs font-medium text-[#6366f1]">MonitorHub</span>
            </div>
            <CardTitle>
              {success ? "2FA Enabled!" : "Set Up Two-Factor Authentication"}
            </CardTitle>
            <CardDescription>
              {success
                ? "Your account is now secured with two-factor authentication."
                : step === 1
                ? "Scan the QR code with Google Authenticator or any TOTP app"
                : "Enter the 6-digit code from your authenticator app to confirm"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait">
              {success ? (
                /* ── Success ─────────────────────────────────────────────── */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                    <p className="text-sm font-medium">Two-factor authentication is active.</p>
                    <p className="text-xs mt-1 text-green-600/80 dark:text-green-400/80">
                      You will be asked for a code from your authenticator app every time you log in.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate("/dashboard/settings")}
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                  >
                    Go to Settings
                  </Button>
                </motion.div>
              ) : step === 1 ? (
                /* ── Step 1: QR Code ─────────────────────────────────────── */
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#6366f1] text-white">Step 1 of 2</Badge>
                    <span className="text-xs text-muted-foreground">Scan QR Code</span>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-xl border border-border shadow-sm">
                      <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                    </div>
                  </div>

                  {/* Manual entry */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">
                      Can't scan? Enter this key manually:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded-md break-all">
                        {secret}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopySecret}
                        className="shrink-0"
                      >
                        {copied ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Supported apps:</strong> Google Authenticator,
                      Microsoft Authenticator, Authy, or any TOTP-compatible app.
                    </p>
                  </div>

                  <Button
                    onClick={() => setStep(2)}
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                  >
                    I've scanned the code — Continue
                  </Button>

                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/settings")}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Cancel
                  </button>
                </motion.div>
              ) : (
                /* ── Step 2: Confirm Code ─────────────────────────────────── */
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleEnable}
                  className="space-y-5"
                >
                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#6366f1] text-white">Step 2 of 2</Badge>
                    <span className="text-xs text-muted-foreground">Verify Code</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totp-code">Authentication Code</Label>
                    <Input
                      ref={codeInputRef}
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={handleCodeInput}
                      disabled={verifying}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Open your authenticator app and enter the 6-digit code shown
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                    disabled={verifying || code.length !== 6}
                  >
                    {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enable Two-Factor Authentication
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setStep(1); setCode(""); }}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to QR Code
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
