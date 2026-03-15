import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "roles.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const roleId = Number(id);
    if (!Number.isFinite(roleId)) return NextResponse.json({ error: "Invalid role id." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("role_permissions").select("permission_id").eq("role_id", roleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ role_id: roleId, permission_ids: (data ?? []).map((r) => r.permission_id) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "roles.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const roleId = Number(id);
    if (!Number.isFinite(roleId)) return NextResponse.json({ error: "Invalid role id." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const permissionIds = Array.isArray(body.permission_ids) ? body.permission_ids.map((x: any) => Number(x)).filter(Number.isFinite) : [];

    const supabase = getSupabaseAdmin();

    const { error: delErr } = await supabase.from("role_permissions").delete().eq("role_id", roleId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (permissionIds.length > 0) {
      const rows = permissionIds.map((permission_id) => ({ role_id: roleId, permission_id }));
      const { error: insErr } = await supabase.from("role_permissions").insert(rows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ role_id: roleId, permission_ids: permissionIds });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

