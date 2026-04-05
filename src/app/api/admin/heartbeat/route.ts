import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { dbError, internalError } from "@/lib/api-security";

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  const adminId = auth.payload.sub;
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("admin_users")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", adminId);

    if (error) return dbError(error, "Failed to update heartbeat");

    return NextResponse.json({ success: true });
  } catch {
    return internalError();
  }
}
