"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/lib/api";

const schema = z
  .object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type Fields = z.infer<typeof schema>;
type Errors = Partial<Record<keyof Fields, string>>;

export default function SignupPage() {
  const [form, setForm] = useState<Fields>({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");
  const [directVerifyUrl, setDirectVerifyUrl] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setApiError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const fe: Errors = {};
      result.error.issues.forEach((i) => {
        fe[i.path[0] as keyof Fields] = i.message;
      });
      setErrors(fe);
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        companyName: form.companyName,
        email: form.email,
        password: form.password,
      });
      if (res.verificationUrl) setDirectVerifyUrl(res.verificationUrl);
      setSuccessEmail(form.email);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (successEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {directVerifyUrl ? "Account Created!" : "Check Your Email!"}
          </h2>
          <p className="text-gray-500 mb-1">
            {directVerifyUrl ? "Click below to verify your account:" : "We sent a verification link to:"}
          </p>
          <p className="font-semibold text-gray-800 mb-5">{successEmail}</p>
          {directVerifyUrl ? (
            <a
              href={directVerifyUrl}
              className="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors mb-4"
            >
              Verify My Account →
            </a>
          ) : (
            <p className="text-sm text-gray-400 mb-4">
              The link expires in 24 hours. Check your inbox and spam folder.
            </p>
          )}
          <div className="mt-2">
            <Link
              href={`/verify-email?email=${encodeURIComponent(successEmail)}`}
              className="text-indigo-600 text-sm font-medium hover:underline"
            >
              Didn&apos;t receive it? Resend →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header card */}
        <div className="bg-gray-900 rounded-t-2xl px-8 py-6 text-center">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-white text-lg font-bold">EmployeeMonitor</h1>
          <p className="text-indigo-400 text-sm mt-0.5">Company Registration</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-b-2xl shadow-sm border border-t-0 border-gray-100 px-8 py-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Create Your Account</h2>

          {apiError && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Company Name" name="companyName" type="text" placeholder="Your company name" value={form.companyName} error={errors.companyName} onChange={handleChange} />
            <Field label="Email Address" name="email" type="email" placeholder="company@example.com" value={form.email} error={errors.email} onChange={handleChange} />
            <Field label="Password" name="password" type="password" placeholder="At least 8 characters" value={form.password} error={errors.password} onChange={handleChange} />
            <Field label="Confirm Password" name="confirmPassword" type="password" placeholder="Re-enter your password" value={form.confirmPassword} error={errors.confirmPassword} onChange={handleChange} />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-600 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  value,
  error,
  onChange,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : undefined}
        className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
          error ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
        }`}
      />
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
