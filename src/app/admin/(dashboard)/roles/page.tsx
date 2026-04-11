"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, Save, Plus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/context/PermissionsContext";

type Role = { id: number; name: string; description?: string | null };
type Permission = { id: number; name: string };
type RolePermissionRow = { role_id: number; permission_id: number };
type AdminUser = { id: string; email?: string; role_id?: number; is_active?: boolean };

export default function AdminRolesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("roles.manage");

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [selectedRolePermIds, setSelectedRolePermIds] = useState<Set<number>>(new Set());

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserPermIds, setSelectedUserPermIds] = useState<Set<number>>(new Set());
  const [userPermissionQuery, setUserPermissionQuery] = useState("");

  useEffect(() => {
    try {
      const t = localStorage.getItem("admin_token");
      if (!t) {
        router.replace("/admin/login");
        return;
      }
      setToken(t);
    } catch {
      router.replace("/admin/login");
    }
  }, [router]);

  const fetchAll = async (t: string) => {
    const [rolesRes, usersRes] = await Promise.all([
      fetch("/api/rbac/roles", { headers: { Authorization: `Bearer ${t}` } }),
      fetch("/api/admin/users", { headers: { Authorization: `Bearer ${t}` } }),
    ]);

    const rolesPayload = await rolesRes.json().catch(() => ({}));
    if (!rolesRes.ok) throw new Error(rolesPayload?.error || "Failed to load roles.");

    const usersPayload = await usersRes.json().catch(() => ({}));
    if (!usersRes.ok) throw new Error(usersPayload?.error || "Failed to load users.");

    setRoles(Array.isArray(rolesPayload.roles) ? rolesPayload.roles : []);
    setPermissions(Array.isArray(rolesPayload.permissions) ? rolesPayload.permissions : []);
    setRolePermissions(Array.isArray(rolesPayload.role_permissions) ? rolesPayload.role_permissions : []);
    setUsers(Array.isArray(usersPayload) ? usersPayload : []);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchAll(token)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load RBAC."))
      .finally(() => setLoading(false));
  }, [token]);

  const rolePermMap = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const rp of rolePermissions) {
      if (!m.has(rp.role_id)) m.set(rp.role_id, new Set());
      m.get(rp.role_id)!.add(rp.permission_id);
    }
    return m;
  }, [rolePermissions]);

  const filteredPermissions = useMemo(() => {
    const q = permissionQuery.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) => p.name.toLowerCase().includes(q));
  }, [permissionQuery, permissions]);

  const filteredUserPermissions = useMemo(() => {
    const q = userPermissionQuery.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) => p.name.toLowerCase().includes(q));
  }, [userPermissionQuery, permissions]);

  useEffect(() => {
    if (selectedRoleId == null) return;
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role) return;
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    setSelectedRolePermIds(new Set(rolePermMap.get(role.id) ?? []));
  }, [rolePermMap, roles, selectedRoleId]);

  const selectRole = (id: number) => {
    setSelectedRoleId(id);
  };

  const createRole = async () => {
    if (!token) return;
    const name = createName.trim();
    if (!name) {
      toast.error("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/rbac/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description: createDescription.trim() || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create role.");
      toast.success("Role created.");
      setCreateName("");
      setCreateDescription("");
      await fetchAll(token);
      if (payload?.id) selectRole(payload.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create role.");
    } finally {
      setSaving(false);
    }
  };

  const saveRoleMeta = async () => {
    if (!token || selectedRoleId == null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rbac/roles/${selectedRoleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: roleName.trim(), description: roleDescription.trim() || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update role.");
      toast.success("Role updated.");
      await fetchAll(token);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update role.");
    } finally {
      setSaving(false);
    }
  };

  const saveRolePermissions = async () => {
    if (!token || selectedRoleId == null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rbac/roles/${selectedRoleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permission_ids: Array.from(selectedRolePermIds) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update role permissions.");
      toast.success("Role permissions saved.");
      await fetchAll(token);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update role permissions.");
    } finally {
      setSaving(false);
    }
  };

  const loadUserOverrides = async (adminId: string) => {
    if (!token || !adminId) return;
    try {
      const res = await fetch(`/api/rbac/users/${adminId}/permissions`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load user overrides.");
      const ids = Array.isArray(payload.permission_ids) ? payload.permission_ids.map((x: any) => Number(x)).filter(Number.isFinite) : [];
      setSelectedUserPermIds(new Set(ids));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load user overrides.");
      setSelectedUserPermIds(new Set());
    }
  };

  const saveUserOverrides = async () => {
    if (!token || !selectedUserId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rbac/users/${selectedUserId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permission_ids: Array.from(selectedUserPermIds) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save user overrides.");
      toast.success("User overrides saved.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save user overrides.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedUserId) return;
    loadUserOverrides(selectedUserId);
  }, [selectedUserId]);

  const selectedRole = selectedRoleId != null ? roles.find((r) => r.id === selectedRoleId) : null;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground mt-1 text-sm">Customizable access control (RBAC)</p>
      </motion.div>

      <Card className="border border-slate-200/80 shadow-xs bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
          <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07008A]/10 text-[#07008A]">
              <KeyRound className="h-5 w-5" />
            </div>
            RBAC Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="roles" className="w-full">
                <TabsList className="w-full justify-start bg-transparent border-b rounded-none px-0 h-auto gap-8">
                  <TabsTrigger 
                    value="roles" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#07008A] rounded-none px-0 pb-3 text-sm font-semibold transition-all"
                  >
                    Role Permissions
                  </TabsTrigger>
                  <TabsTrigger 
                    value="users" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#07008A] rounded-none px-0 pb-3 text-sm font-semibold transition-all"
                  >
                    User Overrides
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="roles" className="mt-8 outline-none">
                  <div className="flex flex-col lg:flex-row gap-8 w-full">
                    {/* Sidebar / Role List */}
                    <div className="w-full lg:w-[320px] shrink-0 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">System Roles</h3>
                        {canManage && (
                          <Dialog>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-[#07008A] hover:bg-[#07008A]/10">
                                      <Plus className="h-5 w-5" />
                                    </Button>
                                  </DialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Create New Role</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create New Role</DialogTitle>
                                <DialogDescription>Define a new role for your system. You can assign permissions after creating it.</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Role Name</Label>
                                  <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Finance Manager" />
                                </div>
                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="What are the responsibilities?" />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={createRole} disabled={saving} className="bg-[#07008A] hover:bg-[#05006a]">
                                  {saving ? "Creating..." : "Create Role"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                        {roles.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectRole(r.id)}
                            className={`w-full group text-left p-4 rounded-xl border transition-all duration-200 ${
                              selectedRoleId === r.id 
                                ? "bg-white border-[#07008A] shadow-md shadow-[#07008A]/5 scale-[1.02]" 
                                : "bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:bg-white"
                            }`}
                          >
                            <div className={`font-bold transition-colors ${selectedRoleId === r.id ? "text-[#07008A]" : "text-slate-700"}`}>
                              {r.name}
                            </div>
                            {r.description ? (
                              <div className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed font-medium">
                                {r.description}
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mt-4">
                        <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                          <Search className="h-3 w-3" /> Quick Guide
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                          Select a role to modify its permissions. Permissions are effective immediately for all users assigned to that role.
                        </p>
                      </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0">
                      {!selectedRole ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30 p-12 text-center">
                          <div className="h-16 w-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-6">
                            <KeyRound className="h-8 w-8 text-slate-300" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-600">Select a role to manage</h3>
                          <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">
                            Choose a role from the sidebar to view and configure its permissions system.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          {/* Role Details Card */}
                          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                            <div className="flex flex-col md:flex-row items-end gap-4">
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                <div className="space-y-2">
                                  <Label className="text-xs font-bold text-slate-500 tracking-tight">ROLE IDENTITY</Label>
                                  <Input 
                                    value={roleName} 
                                    readOnly={!canManage}
                                    onChange={(e) => setRoleName(e.target.value)} 
                                    className="h-11 border-slate-200 focus:ring-[#07008A]/10 font-bold"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs font-bold text-slate-500 tracking-tight">ROLE DESCRIPTION</Label>
                                  <Input 
                                    value={roleDescription} 
                                    readOnly={!canManage}
                                    onChange={(e) => setRoleDescription(e.target.value)} 
                                    className="h-11 border-slate-200 focus:ring-[#07008A]/10 font-medium"
                                  />
                                </div>
                              </div>
                              {canManage && (
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  onClick={saveRoleMeta} 
                                  disabled={saving}
                                  className="h-11 px-6 border-[#07008A] text-[#07008A] hover:bg-[#07008A]/5 font-bold"
                                >
                                  <Save className="h-4 w-4 mr-2" />
                                  Save Identity
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Permissions Search/Actions Header */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative w-full sm:max-w-md">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                value={permissionQuery}
                                onChange={(e) => setPermissionQuery(e.target.value)}
                                placeholder="Search all permissions..."
                                className="pl-10 h-10 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 transition-all font-medium"
                              />
                            </div>
                            {canManage && (
                              <Button 
                                type="button" 
                                className="w-full sm:w-auto bg-[#07008A] hover:bg-[#05006a] text-white font-bold h-10 px-8 shadow-lg shadow-[#07008A]/10" 
                                onClick={saveRolePermissions} 
                                disabled={saving}
                              >
                                <Save className="h-4 w-4 mr-2" />
                                Save Permissions
                              </Button>
                            )}
                          </div>

                          {/* Grouped Permissions Grid */}
                          <div className="space-y-8">
                            {Object.entries(
                              filteredPermissions.reduce((acc, p) => {
                                const parts = p.name.split('.');
                                const groupName = parts.length >= 3 
                                  ? `${parts[0]} (${parts[1].replace(/_/g, ' ')})` 
                                  : (parts[0] || "General");
                                if (!acc[groupName]) acc[groupName] = [];
                                acc[groupName].push(p);
                                return acc;
                              }, {} as Record<string, Permission[]>)
                            ).map(([group, perms]) => (
                              <div key={group} className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-slate-700 capitalize tracking-tight px-1">{group} Module</h4>
                                  <div className="h-px flex-1 bg-slate-100"></div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                  {perms.map((p) => {
                                    const checked = selectedRolePermIds.has(p.id);
                                    return (
                                      <label 
                                        key={p.id} 
                                        className={`flex items-center gap-3 rounded-xl border p-4 transition-all cursor-pointer ${
                                          checked 
                                            ? "bg-white border-[#07008A]/20 shadow-sm" 
                                            : "bg-transparent border-slate-100 hover:border-slate-200 opacity-70 hover:opacity-100"
                                        }`}
                                      >
                                        <Checkbox
                                          checked={checked}
                                          disabled={!canManage}
                                          className="data-[state=checked]:bg-[#07008A] data-[state=checked]:border-[#07008A]"
                                          onCheckedChange={(v) => {
                                            setSelectedRolePermIds((prev) => {
                                              const next = new Set(prev);
                                              if (v) next.add(p.id);
                                              else next.delete(p.id);
                                              return next;
                                            });
                                          }}
                                        />
                                        <span className={`text-[13px] font-semibold transition-colors ${checked ? "text-[#07008A]" : "text-slate-600"}`}>
                                          {(() => {
                                            const parts = p.name.split('.');
                                            if (parts.length >= 3) return parts.slice(2).join(' ').replace(/_/g, ' ');
                                            if (parts.length === 2) return parts[1].replace(/_/g, ' ');
                                            return p.name.replace(/_/g, ' ');
                                          })()}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="users" className="mt-8 outline-none">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-8">
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-800">Individual Overrides</h3>
                        <p className="text-sm text-slate-500 font-medium">
                          Assign extra permissions to specific users regardless of their core role.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-3 space-y-2">
                          <Label className="text-xs font-bold text-slate-500 tracking-tight">SELECT ADMIN USER</Label>
                          <select
                            value={selectedUserId}
                            disabled={!canManage}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-[#07008A]/10 transition-all outline-none"
                          >
                            <option value="">Select an account...</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.email || u.id} {u.is_active === false ? "(inactive)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        {canManage && (
                          <Button 
                            type="button" 
                            className="h-12 bg-[#07008A] hover:bg-[#05006a] text-white font-bold rounded-xl shadow-lg shadow-[#07008A]/10" 
                            onClick={saveUserOverrides} 
                            disabled={saving || !selectedUserId}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        )}
                      </div>

                      {selectedUserId && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              value={userPermissionQuery}
                              onChange={(e) => setUserPermissionQuery(e.target.value)}
                              placeholder="Find permission to override..."
                              className="pl-11 h-11 bg-slate-50 border-none focus:bg-white focus:ring-2 focus:ring-slate-100 font-medium"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1 max-h-[460px] overflow-y-auto scrollbar-thin">
                            {filteredUserPermissions.map((p) => {
                              const checked = selectedUserPermIds.has(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={`flex items-center gap-3 rounded-xl border p-4 transition-all cursor-pointer ${
                                    checked 
                                      ? "bg-white border-[#07008A]/20 shadow-sm" 
                                      : "bg-slate-50/30 border-slate-100 hover:border-slate-200"
                                  }`}
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={!canManage}
                                    className="data-[state=checked]:bg-[#07008A] data-[state=checked]:border-[#07008A]"
                                    onCheckedChange={(v) => {
                                      setSelectedUserPermIds((prev) => {
                                        const next = new Set(prev);
                                        if (v) next.add(p.id);
                                        else next.delete(p.id);
                                        return next;
                                      });
                                    }}
                                  />
                                  <span className={`text-[13px] font-semibold ${checked ? "text-[#07008A]" : "text-slate-600"}`}>
                                    {p.name}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          
                          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3">
                            <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                              <KeyRound className="h-3 w-3" />
                            </div>
                            <p className="text-xs text-blue-700/80 leading-relaxed font-medium">
                              <span className="font-bold text-blue-700">Note:</span> Overrides are additive. If a user already has a permission via their role, adding it here will keep it enabled.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </>
  );
}
