import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true })
      .gt("last_seen_at", fiveMinutesAgo)
      .eq("is_active", true);

    if (error) return dbError(error, "Failed to fetch online count");

    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return internalError();
  }
}
