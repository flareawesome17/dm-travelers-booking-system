"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, User as UserIcon, Shield, Check, X as XIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (c: string) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

type PasswordCheck = { label: string; passed: boolean };

function getPasswordChecks(pw: string): PasswordCheck[] {
  return [
    { label: "8–64 characters", passed: pw.length >= 8 && pw.length <= 64 },
    { label: "One uppercase letter", passed: /[A-Z]/.test(pw) },
    { label: "One lowercase letter", passed: /[a-z]/.test(pw) },
    { label: "One number", passed: /\d/.test(pw) },
    { label: "One special character (!@#$%^&*…)", passed: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function getPasswordStrength(checks: PasswordCheck[]): { score: number; label: string; color: string } {
  const passed = checks.filter(c => c.passed).length;
  if (passed <= 1) return { score: 1, label: "Very weak", color: "bg-red-500" };
  if (passed === 2) return { score: 2, label: "Weak", color: "bg-orange-500" };
  if (passed === 3) return { score: 3, label: "Fair", color: "bg-amber-500" };
  if (passed === 4) return { score: 4, label: "Strong", color: "bg-emerald-500" };
  return { score: 5, label: "Very strong", color: "bg-emerald-600" };
}

export default function AdminAccountPage() {
  const router = useRouter();
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  const [preConfirmOpen, setPreConfirmOpen] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      setToken(localStorage.getItem("admin_token"));
    } catch {
      setToken(null);
    }
  }, []);

  const me = useMemo(() => {
    if (!token) return null;
    const p = decodeJwtPayload(token);
    if (!p) return null;
    const name = typeof p.name === "string" ? p.name : null;
    const email = typeof p.email === "string" ? p.email : null;
    const roleId = typeof p.role_id === "number" ? p.role_id : Number(p.role_id);
    const roleLabel =
      roleId === 1 ? "Super Admin" : roleId === 2 ? "Manager" : roleId === 3 ? "Staff" : roleId === 4 ? "Housekeeping" : null;
    return { name, email, roleLabel };
  }, [token]);

  const validateAndPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwCurrent.trim() || !pwNew.trim() || !pwConfirm.trim()) {
      toast.error("Please fill out all password fields.");
      return;
    }
    if (pwNew.length < 8 || pwNew.length > 64) {
      toast.error("Password must be between 8 and 64 characters.");
      return;
    }
    const checks = getPasswordChecks(pwNew);
    const allPassed = checks.every(c => c.passed);
    if (!allPassed) {
      toast.error("Password does not meet all strength requirements.");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setPreConfirmOpen(true);
  };

  const executeChangePassword = async () => {
    setPreConfirmOpen(false);
    const t = (() => {
      try {
        return localStorage.getItem("admin_token");
      } catch {
        return null;
      }
    })();
    if (!t) {
      router.replace("/admin/login");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/admin/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = getErrorMessage(data);
        toast.error(errMsg || "Failed to change password.");
        return;
      }
      toast.success("Password updated.");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setShowPwCurrent(false);
      setShowPwNew(false);
      setShowPwConfirm(false);
      
      setPostConfirmOpen(true);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogoutOption = async (doLogout: boolean) => {
    setPostConfirmOpen(false);
    if (!doLogout) return;

    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_last_activity");
    } catch {
      // ignore
    }
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">My Account</h1>
          <p className="text-muted-foreground mt-1 text-sm">Profile and security settings</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="border-b bg-slate-50/30">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Profile
            </CardTitle>
            <CardDescription>Current signed-in admin</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-semibold text-slate-800">{me?.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="font-semibold text-slate-800">{me?.roleLabel || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email (hidden in sidebar)</p>
              <p className="text-sm text-slate-600 break-all">{me?.email || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="border-b bg-slate-50/30">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="h-4 w-4" /> Change Password
            </CardTitle>
            <CardDescription>Update your own admin password</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form className="space-y-4" onSubmit={validateAndPrompt}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPwCurrent ? "text" : "password"}
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwCurrent(!showPwCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPwCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPwNew ? "text" : "password"}
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew(!showPwNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPwNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {pwNew.length > 0 && (() => {
                const checks = getPasswordChecks(pwNew);
                const strength = getPasswordStrength(checks);
                return (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-colors duration-300 ${
                              i <= strength.score ? strength.color : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-[10px] font-bold tracking-wide uppercase ${
                        strength.score <= 2 ? "text-red-500" : strength.score <= 3 ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        {strength.label}
                      </span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                      {checks.map(c => (
                        <li key={c.label} className={`flex items-center gap-1.5 text-[11px] font-medium ${
                          c.passed ? "text-emerald-600" : "text-slate-400"
                        }`}>
                          {c.passed ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showPwConfirm ? "text" : "password"}
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwConfirm(!showPwConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPwConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwConfirm.length > 0 && (
                  <p className={`flex items-center gap-1.5 text-[11px] font-medium mt-1.5 ${
                    pwNew === pwConfirm ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {pwNew === pwConfirm ? <Check className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                    {pwNew === pwConfirm ? "Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={pwSaving} className="bg-[#07008A] hover:bg-[#05006a] text-white">
                  {pwSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {pwSaving ? "Updating..." : "Update password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={preConfirmOpen} onOpenChange={setPreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change your password? This action cannot be undone, you will need the new password to log in next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeChangePassword} disabled={pwSaving} className="bg-[#07008A] text-white hover:bg-[#05006a]">
              Yes, change password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={postConfirmOpen} onOpenChange={setPostConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Password Successfully Updated</AlertDialogTitle>
            <AlertDialogDescription>
              Your password has been changed. For security reasons, would you like to log out of your current session now or keep your session active?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleLogoutOption(false)}>
              Keep me logged in
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleLogoutOption(true)} className="bg-red-600 text-white hover:bg-red-700">
              Logout now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

