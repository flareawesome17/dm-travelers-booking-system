import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { dbError } from "@/lib/api-security";
import { getGcashSummary } from "@/lib/gcash";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "gcash.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const summary = await getGcashSummary(supabase);
    return NextResponse.json(summary);
  } catch (error) {
    return dbError(error, "Failed to load GCash summary.");
  }
}
