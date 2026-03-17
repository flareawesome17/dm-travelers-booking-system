import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const { name, email, password, role_id, is_active } = await req.json();
    const updateData: any = {};
    if (typeof name === "string") updateData.name = name.trim() || null;
    if (email) updateData.email = email.toLowerCase().trim();
    if (password) {
      if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      updateData.password_hash = await bcrypt.hash(password, 12);
    }
    if (role_id !== undefined) updateData.role_id = role_id;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_users")
      .update(updateData)
      .eq("id", id)
      .select("id, name, email, role_id, is_active, created_at")
      .single();
    
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("admin_users").delete().eq("id", id);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
