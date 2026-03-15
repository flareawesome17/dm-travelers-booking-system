import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "roles.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const roleId = Number(id);
    if (!Number.isFinite(roleId)) return NextResponse.json({ error: "Invalid role id." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const description = typeof body.description === "string" ? body.description.trim() : undefined;

    const update: Record<string, unknown> = {};
    if (name != null && name.length) update.name = name;
    if (description != null) update.description = description.length ? description : null;
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "No changes provided." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("roles").update(update).eq("id", roleId).select("id, name, description").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

