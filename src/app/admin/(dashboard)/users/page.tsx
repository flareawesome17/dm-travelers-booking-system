"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users as UsersIcon, Plus, Eye, EyeOff, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

type AdminUser = { id: string; name?: string | null; email?: string; role_id?: number; is_active?: boolean; created_at?: string };
const ROLE_LABELS: Record<number, string> = { 1: "Super Admin", 2: "Manager", 3: "Staff", 4: "Housekeeping" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<string>("3");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string>("3");
  const [editIsActive, setEditIsActive] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadUsers = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    setLoading(true);
    fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? (data as AdminUser[]) : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    if (!name.trim()) { toast.error("Name is required."); return; }
    if (!email.trim() || !password.trim()) { toast.error("Email and password are required."); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role_id: Number(roleId) || 3, is_active: isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error((data as { error?: string }).error || "Failed to create admin user."); return; }
      setUsers((prev) => { const c = data as AdminUser; if (!c.id) return prev; return [c, ...prev]; });
      toast.success("Admin user created.");
      setOpen(false); setName(""); setEmail(""); setPassword(""); setRoleId("3"); setIsActive(true); setShowPassword(false);
    } catch { toast.error("Something went wrong."); } finally { setSaving(false); }
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setEditName(user.name || "");
    setEditEmail(user.email || "");
    setEditPassword("");
    setEditRoleId(String(user.role_id || 3));
    setEditIsActive(user.is_active ?? true);
    setEditShowPassword(false);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    if (editPassword && editPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim() || "",
          email: editEmail.trim() || undefined,
          password: editPassword || undefined,
          role_id: Number(editRoleId) || 3,
          is_active: editIsActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error((data as { error?: string }).error || "Failed to update admin user."); return; }
      setUsers((prev) => prev.map(u => u.id === editingUser.id ? { ...u, ...data } : u));
      toast.success("Admin user updated.");
      setEditOpen(false);
    } catch { toast.error("Something went wrong."); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this admin user?")) return;
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || "Failed to delete user."); return;
      }
      setUsers((prev) => prev.filter(u => u.id !== id));
      toast.success("Admin user deleted.");
    } catch { toast.error("Something went wrong."); } finally { setDeletingId(null); }
  };

  const filteredUsers = users.filter((u) => {
    const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? u.is_active : !u.is_active;
    const term = search.trim().toLowerCase();
    if (!term) return matchesStatus;
    const haystack = [u.name, u.email, ROLE_LABELS[u.role_id || 3]].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && haystack.includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Admin Users</h1>
        <p className="text-muted-foreground mt-1">Manage admin accounts and roles</p>
      </motion.div>
      <Card className="border-0 shadow-lg bg-white overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2"><UsersIcon className="h-5 w-5" /> All Users</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button type="button" size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add user</Button>
            <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add admin user</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={handleSave}>
                <div className="space-y-2">
                  <Label htmlFor="admin-name-u">Name</Label>
                  <Input id="admin-name-u" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" required />
                </div>
                <div className="space-y-2"><Label htmlFor="admin-email-u">Email</Label><Input id="admin-email-u" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required /></div>
                <div className="space-y-2"><Label htmlFor="admin-password-u">Password</Label><div className="relative"><Input id="admin-password-u" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required className="pr-10" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <div className="space-y-2"><Label htmlFor="admin-role">Role</Label><select id="admin-role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roleId} onChange={(e) => setRoleId(e.target.value)}><option value="1">Super Admin</option><option value="2">Manager</option><option value="3">Staff</option><option value="4">Housekeeping</option></select></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /><span>Active</span></label>
                <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create user"}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit admin user</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={handleEdit}>
                <div className="space-y-2">
                  <Label htmlFor="edit-admin-name">Name</Label>
                  <Input id="edit-admin-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Juan Dela Cruz" />
                </div>
                <div className="space-y-2"><Label htmlFor="edit-admin-email">Email</Label><Input id="edit-admin-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="admin@example.com" /></div>
                <div className="space-y-2"><Label htmlFor="edit-admin-password">Password (Optional)</Label><div className="relative"><Input id="edit-admin-password" type={editShowPassword ? "text" : "password"} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave blank to keep current password" className="pr-10" /><button type="button" onClick={() => setEditShowPassword(!editShowPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">{editShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                <div className="space-y-2"><Label htmlFor="edit-admin-role">Role</Label><select id="edit-admin-role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)}><option value="1">Super Admin</option><option value="2">Manager</option><option value="3">Staff</option><option value="4">Housekeeping</option></select></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} /><span>Active</span></label>
                <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b bg-slate-50/60 gap-4">
            <div className="relative w-full sm:max-w-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search absolute left-3 top-2.5 h-4 w-4 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" placeholder="Search email, role..." className="h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#07008A]/60 transition-all font-medium" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
            </div>
            <div className="w-full sm:w-auto">
              <select className="h-9 w-full sm:w-[200px] rounded-md border border-input bg-white px-3 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#07008A]/60 transition-all" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          {loading ? <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full"><thead><tr className="border-b bg-slate-50/80"><th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th><th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th><th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th><th className="text-left py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Active</th><th className="text-right py-3 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th></tr></thead>
                  <tbody>{paginatedUsers.map((u) => <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors"><td className="py-4 px-6 font-medium text-slate-800">{u.name ?? "—"}</td><td className="py-4 px-6 font-medium text-[#07008A]">{u.email ?? "—"}</td><td className="py-4 px-6 text-sm text-slate-600">{u.role_id != null ? ROLE_LABELS[u.role_id] ?? u.role_id : "—"}</td><td className="py-4 px-6"><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Yes" : "No"}</Badge></td><td className="py-4 px-6 text-right"><div className="flex items-center justify-end gap-2"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-[#07008A]" onClick={() => openEditModal(u)}><Edit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Edit user</p></TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => handleDelete(u.id)} disabled={deletingId === u.id}>{deletingId === u.id ? <Skeleton className="h-4 w-4 rounded-full" /> : <Trash2 className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent><p>Delete user</p></TooltipContent></Tooltip></TooltipProvider></div></td></tr>)}</tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="py-4 px-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-sm text-slate-500">
                    Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
                  </span>
                  <Pagination className="justify-end w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                      </PaginationItem>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink onClick={() => setCurrentPage(i + 1)} isActive={currentPage === i + 1} className="cursor-pointer">
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
