import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("admin_users").select("id, email, role_id, is_active, created_at").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const { email, password, role_id, is_active } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 12);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("admin_users").insert({ email: email.toLowerCase().trim(), password_hash: passwordHash, role_id: role_id ?? 3, is_active: is_active ?? true }).select("id, email, role_id, is_active, created_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
