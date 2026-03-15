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
import { toast } from "@/components/ui/sonner";

type Role = { id: number; name: string; description?: string | null };
type Permission = { id: number; name: string };
type RolePermissionRow = { role_id: number; permission_id: number };
type AdminUser = { id: string; email?: string; role_id?: number; is_active?: boolean };

export default function AdminRolesPage() {
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
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground mt-1">Customizable access control (RBAC)</p>
      </motion.div>

      <Card className="border-0 shadow-lg bg-white/95 backdrop-blur-sm overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
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
              <TabsList className="w-full justify-start">
                <TabsTrigger value="roles">Role Permissions</TabsTrigger>
                <TabsTrigger value="users">User Overrides</TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className="mt-6">
                <div className="flex flex-col lg:flex-row gap-6 w-full">
                  <div className="w-full lg:w-[360px] shrink-0">
                    <div className="rounded-lg border p-4">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                          <Label>New Role</Label>
                          <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Role name" />
                        </div>
                        <div className="space-y-1">
                          <Label>Description</Label>
                          <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Optional" />
                        </div>
                        <Button type="button" onClick={createRole} disabled={saving}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Role
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border overflow-hidden">
                      <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold text-slate-700">Roles</div>
                      <div className="max-h-[420px] overflow-y-auto">
                        {roles.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectRole(r.id)}
                            className={`w-full text-left px-4 py-3 border-b last:border-0 hover:bg-slate-50 transition-colors ${
                              selectedRoleId === r.id ? "bg-[#07008A]/5" : ""
                            }`}
                          >
                            <div className="font-semibold text-slate-800">{r.name}</div>
                            {r.description ? <div className="text-xs text-slate-500 mt-0.5">{r.description}</div> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {!selectedRole ? (
                      <div className="rounded-lg border p-6 text-sm text-slate-600">Select a role to manage permissions.</div>
                    ) : (
                      <div className="rounded-lg border p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label>Role Name</Label>
                            <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Description</Label>
                            <Input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
                          </div>
                        </div>

                        <div className="flex justify-end mt-3">
                          <Button type="button" variant="outline" onClick={saveRoleMeta} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Role
                          </Button>
                        </div>

                        <div className="mt-6 flex items-center justify-between gap-3">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                              value={permissionQuery}
                              onChange={(e) => setPermissionQuery(e.target.value)}
                              placeholder="Search permissions..."
                              className="pl-9"
                            />
                          </div>
                          <Button type="button" className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={saveRolePermissions} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Permissions
                          </Button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                          {filteredPermissions.map((p) => {
                            const checked = selectedRolePermIds.has(p.id);
                            return (
                              <label key={p.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-slate-50 transition-colors">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setSelectedRolePermIds((prev) => {
                                      const next = new Set(prev);
                                      if (v) next.add(p.id);
                                      else next.delete(p.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-sm text-slate-800 break-words">{p.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="users" className="mt-6">
                <div className="rounded-lg border p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2 space-y-1">
                      <Label>Admin User</Label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20"
                      >
                        <option value="">Select user...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.email || u.id} {u.is_active === false ? "(inactive)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="button" className="bg-[#07008A] hover:bg-[#05006a] text-white" onClick={saveUserOverrides} disabled={saving || !selectedUserId}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Overrides
                    </Button>
                  </div>

                  <div className="mt-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        value={userPermissionQuery}
                        onChange={(e) => setUserPermissionQuery(e.target.value)}
                        placeholder="Search permissions..."
                        className="pl-9"
                        disabled={!selectedUserId}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                    {filteredUserPermissions.map((p) => {
                      const checked = selectedUserPermIds.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                            selectedUserId ? "hover:bg-slate-50" : "opacity-60"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!selectedUserId}
                            onCheckedChange={(v) => {
                              setSelectedUserPermIds((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(p.id);
                                else next.delete(p.id);
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm text-slate-800">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Overrides are added on top of the role permissions (not subtractive).
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
