"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, User as UserIcon, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

export default function AdminAccountPage() {
  const router = useRouter();
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const token = useMemo(() => {
    try {
      return localStorage.getItem("admin_token");
    } catch {
      return null;
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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

    if (!pwCurrent.trim() || !pwNew.trim() || !pwConfirm.trim()) {
      toast.error("Please fill out all password fields.");
      return;
    }
    if (pwNew.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error("New password and confirmation do not match.");
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
        toast.error((data as { error?: string }).error || "Failed to change password.");
        return;
      }
      toast.success("Password updated.");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPwSaving(false);
    }
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
            <form className="space-y-4" onSubmit={handleChangePassword}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  autoComplete="new-password"
                />
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
    </div>
  );
}

