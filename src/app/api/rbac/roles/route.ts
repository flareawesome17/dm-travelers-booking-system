import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "roles.manage");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: roles, error: rErr }, { data: permissions, error: pErr }, { data: rolePermissions, error: rpErr }] =
      await Promise.all([
        supabase.from("roles").select("id, name, description").order("id", { ascending: true }),
        supabase.from("permissions").select("id, name").order("name", { ascending: true }),
        supabase.from("role_permissions").select("role_id, permission_id"),
      ]);

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (rpErr) return NextResponse.json({ error: rpErr.message }, { status: 500 });

    return NextResponse.json({
      roles: roles ?? [],
      permissions: permissions ?? [],
      role_permissions: rolePermissions ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "roles.manage");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    if (!name) return NextResponse.json({ error: "Role name is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("roles")
      .insert({ name, description })
      .select("id, name, description")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

