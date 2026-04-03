import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError } from "@/lib/api-security";
import { getTreasurySummary } from "@/lib/treasury";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "treasury.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const summary = await getTreasurySummary(supabase);
    return NextResponse.json(summary);
  } catch (error) {
    return dbError(error, "Failed to load treasury summary.");
  }
}
