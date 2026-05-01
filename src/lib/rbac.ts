import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { apiError, dbError } from "@/lib/api-security";

/* ── In-memory TTL cache for admin is_active check ───────────────────
 *
 * Without this, EVERY API call triggers: SELECT is_active FROM admin_users WHERE id = ?
 * With 3 admin tabs open, that's ~40+ redundant identical queries per minute.
 *
 * Cache entries expire after 5 minutes. If an admin account is disabled,
 * the worst case is they retain access for up to 5 more minutes — acceptable
 * for a hotel admin panel where deactivation is a rare, manual action.
 * ─────────────────────────────────────────────────────────────────── */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const activeCache = new Map<string, CacheEntry<boolean | null>>();
const permissionsCache = new Map<string, CacheEntry<Set<string>>>();

/** Check if an admin is active, with 5-minute in-memory caching. */
async function checkAdminActive(adminId: string): Promise<boolean | null> {
  const now = Date.now();
  const cached = activeCache.get(adminId);
  if (cached && cached.expiresAt > now) return cached.value;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_users")
    .select("is_active")
    .eq("id", adminId)
    .single();

  if (error || !data) {
    activeCache.set(adminId, { value: null, expiresAt: now + CACHE_TTL_MS });
    return null;
  }

  activeCache.set(adminId, { value: data.is_active, expiresAt: now + CACHE_TTL_MS });
  return data.is_active;
}

/** Load permissions for a given role + user, with 5-minute caching. */
async function loadPermissions(args: { roleId: number; adminId: string }): Promise<Set<string>> {
  const cacheKey = `${args.adminId}:${args.roleId}`;
  const now = Date.now();
  const cached = permissionsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

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

  const result = new Set(names);
  permissionsCache.set(cacheKey, { value: result, expiresAt: now + CACHE_TTL_MS });
  return result;
}

/** Force-clear the cache for a specific admin (call after role/permission changes). */
export function invalidateAdminCache(adminId: string) {
  activeCache.delete(adminId);
  // Clear all permission entries for this admin
  for (const key of permissionsCache.keys()) {
    if (key.startsWith(`${adminId}:`)) permissionsCache.delete(key);
  }
}

export async function requirePermission(req: NextRequest, permission: string) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return { error: auth.error } as const;

  const roleId = Number(auth.payload.role_id);
  const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
  if (!adminId || !Number.isFinite(roleId)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  // Check if admin is still active (cached — avoids a DB hit on every API call)
  const isActive = await checkAdminActive(adminId);
  if (isActive === null) {
    return { error: apiError("unauthorized", "Authentication required", 401) } as const;
  }
  if (!isActive) {
    return { 
      error: apiError("forbidden", "Sorry, your account is disabled, please contact your administrator.", 403) 
    } as const;
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

export async function requireAnyPermission(req: NextRequest, permissions: string[]) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return { error: auth.error } as const;

  const roleId = Number(auth.payload.role_id);
  const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
  if (!adminId || !Number.isFinite(roleId)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  // Check if admin is still active (cached)
  const isActive = await checkAdminActive(adminId);
  if (isActive === null) {
    return { error: apiError("unauthorized", "Authentication required", 401) } as const;
  }
  if (!isActive) {
    return { 
      error: apiError("forbidden", "Sorry, your account is disabled, please contact your administrator.", 403) 
    } as const;
  }

  if (roleId === 1) return { payload: auth.payload } as const;

  try {
    const perms = await loadPermissions({ roleId, adminId });
    const hasAny = permissions.some((p) => perms.has(p));
    if (!hasAny) {
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

  // Check if admin is still active (cached)
  const isActive = await checkAdminActive(adminId);
  if (isActive === null) {
    return { error: apiError("unauthorized", "Authentication required", 401) } as const;
  }
  if (!isActive) {
    return { 
      error: apiError("forbidden", "Sorry, your account is disabled, please contact your administrator.", 403) 
    } as const;
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

