"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [otpId, setOtpId] = useState<string>("");
  const [otpMaskedTo, setOtpMaskedTo] = useState<string>("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<string>("");
  const [otp, setOtp] = useState("");
  const router = useRouter();

  useEffect(() => {
    try {
      const existing = localStorage.getItem("admin_token");
      if (existing) router.replace("/admin");
    } catch {
      // ignore
    }
  }, [router]);

  const otpExpiresLabel = useMemo(() => {
    if (!otpExpiresAt) return "";
    const d = new Date(otpExpiresAt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [otpExpiresAt]);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      let data: { error?: string; token?: string; requires_otp?: boolean; otp_id?: string; to?: string; expires_at?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // Non-JSON response
      }
      if (!res.ok) {
        toast.error(data.error || "Invalid email or password");
        return;
      }
      if (data.requires_otp && data.otp_id) {
        setOtpId(data.otp_id);
        setOtpMaskedTo(data.to || "");
        setOtpExpiresAt(data.expires_at || "");
        setOtp("");
        setStep("otp");
        toast.success("OTP sent to your email.");
        return;
      }
      toast.error("Login requires OTP. Please try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp_id: otpId, otp }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((payload as { error?: string }).error || "Invalid OTP.");
        return;
      }
      const token = (payload as { token?: string }).token;
      if (!token) {
        toast.error("Login failed.");
        return;
      }
      localStorage.setItem("admin_token", token);
      toast.success("Signed in successfully");
      router.push("/admin");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#07008A]/5 via-[#F7F7F7] to-[#FED501]/10 p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#07008A]/[0.04]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#FED501]/[0.06]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[#07008A]/[0.06]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#07008A]/10 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#07008A] via-[#07008A] to-[#FED501]" />
          <div className="p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#07008A] text-[#FED501] shadow-lg shadow-[#07008A]/20">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#07008A]">Admin Login</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Sign in to manage D&amp;M Travelers Inn</p>
              </div>
            </div>
            {step === "credentials" ? (
              <form onSubmit={requestOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-[#07008A]/90 font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn("pl-10 h-11 rounded-lg border-[#07008A]/20 bg-muted/30", "focus-visible:ring-[#07008A] focus-visible:border-[#07008A]/40")}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-[#07008A]/90 font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn("pl-10 pr-11 h-11 rounded-lg border-[#07008A]/20 bg-muted/30", "focus-visible:ring-[#07008A] focus-visible:border-[#07008A]/40")}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-[#07008A] hover:bg-[#07008A]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07008A]/30"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className={cn("w-full h-12 rounded-lg font-semibold text-base", "bg-[#07008A] hover:bg-[#05006a] text-white", "shadow-lg shadow-[#07008A]/25 hover:shadow-[#07008A]/30 transition-all")}
                >
                  {loading ? "Sending OTP..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-5">
                <div className="rounded-lg border bg-slate-50/60 p-4 text-sm text-slate-700">
                  OTP sent to <span className="font-semibold">{otpMaskedTo || email}</span>
                  {otpExpiresLabel ? <span className="text-slate-500"> · Expires at {otpExpiresLabel}</span> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-otp" className="text-[#07008A]/90 font-medium">OTP</Label>
                  <Input
                    id="admin-otp"
                    placeholder="6 characters"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))}
                    className={cn("h-11 rounded-lg border-[#07008A]/20 bg-muted/30", "focus-visible:ring-[#07008A] focus-visible:border-[#07008A]/40")}
                    required
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      setStep("credentials");
                      setOtp("");
                      setOtpId("");
                    }}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className={cn("h-11 px-6 rounded-lg font-semibold", "bg-[#07008A] hover:bg-[#05006a] text-white")}
                  >
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                </div>
              </form>
            )}
            <p className="mt-6 text-center">
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#07008A] hover:text-[#05006a] transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to website
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
