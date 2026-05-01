import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";

// Cache online count for 60 seconds — all admins see the same number
let cachedResult: { count: number; expiresAt: number } | null = null;

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  const now = Date.now();
  if (cachedResult && cachedResult.expiresAt > now) {
    return NextResponse.json({ count: cachedResult.count });
  }

  try {
    const supabase = getSupabaseAdmin();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .gt("last_seen_at", fiveMinutesAgo)
      .eq("is_active", true);

    if (error) return dbError(error, "Failed to fetch online count");

    const value = count ?? 0;
    cachedResult = { count: value, expiresAt: Date.now() + 60_000 };

    return NextResponse.json({ count: value });
  } catch {
    return internalError();
  }
}

