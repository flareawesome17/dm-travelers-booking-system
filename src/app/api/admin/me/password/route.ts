import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: "New password must be different from current password" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error: uErr } = await supabase
      .from("admin_users")
      .select("id, password_hash, is_active")
      .eq("id", adminId)
      .single();
    if (uErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.is_active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { error: upErr } = await supabase
      .from("admin_users")
      .update({ password_hash: passwordHash })
      .eq("id", adminId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

