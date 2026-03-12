import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signAdminToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("is_active", true)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = signAdminToken({
      sub: user.id,
      email: user.email,
      role_id: user.role_id,
    });

    return NextResponse.json({ token, user: { id: user.id, email: user.email, role_id: user.role_id } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
