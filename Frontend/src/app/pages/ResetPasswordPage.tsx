import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { Shield, Loader2, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { apiResetPassword } from "../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordRequirements = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /[0-9]/.test(newPassword) },
  ];
  const passwordValid = passwordRequirements.every(r => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="shadow-xl border-border w-full max-w-md">
          <CardContent className="pt-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
            <p className="font-semibold text-lg">Invalid Reset Link</p>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or missing. Please request a new one.
            </p>
            <Link to="/forgot-password">
              <Button className="bg-[#6366f1] hover:bg-[#5558e6]">Request New Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast.error("Please meet all password requirements");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiResetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password";
      toast.error(msg);
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
                {success ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : (
                  <Shield className="w-7 h-7 text-white" />
                )}
              </div>
            </div>
            <CardTitle>{success ? "Password Reset!" : "Reset Password"}</CardTitle>
            <CardDescription>
              {success
                ? "Your password has been updated successfully."
                : "Enter your new password below"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">
                  <p className="text-sm font-medium">Password changed successfully!</p>
                  <p className="text-xs mt-1 text-green-600/80 dark:text-green-400/80">
                    You can now sign in with your new password.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                >
                  Go to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password requirements */}
                  {newPassword.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {passwordRequirements.map(req => (
                        <div key={req.label} className="flex items-center gap-1.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${req.met ? "bg-green-500" : "bg-muted-foreground/40"}`}
                          />
                          <span
                            className={`text-xs ${req.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                          >
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
                  disabled={loading || !passwordValid || !passwordsMatch}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Reset Password
                </Button>

                <Link to="/forgot-password">
                  <Button variant="ghost" className="w-full text-muted-foreground" type="button">
                    Request a new link
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
