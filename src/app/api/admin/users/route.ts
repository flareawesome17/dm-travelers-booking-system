import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createAdminUserSchema } from "@/lib/validation-schemas";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, name, email, role_id, is_active, created_at, last_seen_at")
      .order("created_at", { ascending: false });
    if (error) return dbError(error, "Failed to load users");
    return NextResponse.json(data ?? []);
  } catch {
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createAdminUserSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { name, email, password, role_id, is_active } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_users")
      .insert({
        name,
        email,
        password_hash: passwordHash,
        role_id,
        is_active,
      })
      .select("id, name, email, role_id, is_active, created_at")
      .single();
    if (error) return dbError(error, "Failed to create user");
    return NextResponse.json(data, { status: 201 });
  } catch {
    return internalError();
  }
}
