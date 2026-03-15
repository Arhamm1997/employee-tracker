import React, { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Shield, Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { apiForgotPassword } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      await apiForgotPassword(email);
      setSent(true);
    } catch {
      // Always show success (same as backend for security)
      setSent(true);
    } finally {
      setLoading(false);
    }
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
                {sent ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : (
                  <Mail className="w-7 h-7 text-white" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#6366f1]" />
              <span className="text-xs font-medium text-[#6366f1]">MonitorHub</span>
            </div>
            <CardTitle>{sent ? "Check Your Email" : "Forgot Password"}</CardTitle>
            <CardDescription>
              {sent
                ? "If this email is registered, a reset link has been sent."
                : "Enter your email address to receive a password reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                  <p className="text-sm font-medium">Reset link sent!</p>
                  <p className="text-xs mt-1 text-green-600/80 dark:text-green-400/80">
                    Check your inbox for a password reset link. The link expires in 1 hour.
                    If you don't see it, check your spam folder.
                  </p>
                </div>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                  disabled={loading || !email}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Reset Link
                </Button>
                <Link to="/login">
                  <Button variant="ghost" className="w-full text-muted-foreground" type="button">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
