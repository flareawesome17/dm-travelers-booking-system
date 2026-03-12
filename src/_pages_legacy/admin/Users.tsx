import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users as UsersIcon, Plus } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

const API_URL = import.meta.env.VITE_API_URL || "";

type AdminUser = {
  id: string;
  email?: string;
  role_id?: number;
  is_active?: boolean;
  created_at?: string;
};

const ROLE_LABELS: Record<number, string> = {
  1: "Super Admin",
  2: "Manager",
  3: "Staff",
  4: "Housekeeping",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<string>("3");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const loadUsers = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? (data as AdminUser[]) : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role_id: Number(roleId) || 3,
          is_active: isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to create admin user.");
        return;
      }
      setUsers((prev) => {
        const created = data as AdminUser;
        if (!created.id) return prev;
        return [created, ...prev];
      });
      toast.success("Admin user created.");
      setOpen(false);
      setEmail("");
      setPassword("");
      setRoleId("3");
      setIsActive(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Admin Users</h1>
            <p className="text-muted-foreground mt-1">Manage admin accounts and roles</p>
          </motion.div>
          <Card className="border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                <UsersIcon className="h-5 w-5" /> All Users
              </CardTitle>
              <Dialog open={open} onOpenChange={setOpen}>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add user
                </Button>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add admin user</DialogTitle>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={handleSave}>
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-role">Role</Label>
                      <select
                        id="admin-role"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={roleId}
                        onChange={(e) => setRoleId(e.target.value)}
                      >
                        <option value="1">Super Admin</option>
                        <option value="2">Manager</option>
                        <option value="3">Staff</option>
                        <option value="4">Housekeeping</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span>Active</span>
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Creating..." : "Create user"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50/80">
                        <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Active
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b last:border-0 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-4 px-6 font-medium text-[#07008A]">{u.email ?? "—"}</td>
                          <td className="py-4 px-6 text-sm text-slate-600">
                            {u.role_id != null ? ROLE_LABELS[u.role_id] ?? u.role_id : "—"}
                          </td>
                          <td className="py-4 px-6">
                            <Badge variant={u.is_active ? "default" : "secondary"}>
                              {u.is_active ? "Yes" : "No"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
