import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

async function loadPermissions(args: { roleId: number; adminId: string }) {
  const supabase = getSupabaseAdmin();

  const { data: rolePerms, error: rpErr } = await supabase
    .from("role_permissions")
    .select("permissions(name)")
    .eq("role_id", args.roleId);
  if (rpErr) throw rpErr;

  const { data: userPerms, error: upErr } = await supabase
    .from("admin_user_permissions")
    .select("permissions(name)")
    .eq("admin_id", args.adminId);
  if (upErr) throw upErr;

  const names: string[] = [];
  for (const r of rolePerms ?? []) {
    const n = (r as any)?.permissions?.name;
    if (typeof n === "string") names.push(n);
  }
  for (const r of userPerms ?? []) {
    const n = (r as any)?.permissions?.name;
    if (typeof n === "string") names.push(n);
  }

  return new Set(names);
}

export async function requirePermission(req: NextRequest, permission: string) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return { error: auth.error } as const;

  const roleId = Number(auth.payload.role_id);
  const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
  if (!adminId || !Number.isFinite(roleId)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  if (roleId === 1) return { payload: auth.payload } as const;

  try {
    const perms = await loadPermissions({ roleId, adminId });
    if (!perms.has(permission)) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
    }
    return { payload: auth.payload } as const;
  } catch (e: any) {
    return { error: NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 }) } as const;
  }
}

export async function getCurrentAdminPermissions(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return { error: auth.error } as const;

  const roleId = Number(auth.payload.role_id);
  const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
  if (!adminId || !Number.isFinite(roleId)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  if (roleId === 1) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("permissions").select("name").order("name");
    if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) } as const;
    return { payload: auth.payload, permissions: (data ?? []).map((p) => p.name) } as const;
  }

  try {
    const perms = await loadPermissions({ roleId, adminId });
    return { payload: auth.payload, permissions: Array.from(perms).sort() } as const;
  } catch (e: any) {
    return { error: NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 }) } as const;
  }
}

