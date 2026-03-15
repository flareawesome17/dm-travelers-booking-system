import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "roles.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Invalid admin id." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("admin_user_permissions").select("permission_id").eq("admin_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ admin_id: id, permission_ids: (data ?? []).map((r) => r.permission_id) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "roles.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Invalid admin id." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const permissionIds = Array.isArray(body.permission_ids) ? body.permission_ids.map((x: any) => Number(x)).filter(Number.isFinite) : [];

    const supabase = getSupabaseAdmin();

    const { error: delErr } = await supabase.from("admin_user_permissions").delete().eq("admin_id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    if (permissionIds.length > 0) {
      const rows = permissionIds.map((permission_id) => ({ admin_id: id, permission_id }));
      const { error: insErr } = await supabase.from("admin_user_permissions").insert(rows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ admin_id: id, permission_ids: permissionIds });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

