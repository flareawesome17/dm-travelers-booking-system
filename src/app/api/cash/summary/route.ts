import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { dbError } from "@/lib/api-security";
import { getCashSummary } from "@/lib/cash";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "cash.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const summary = await getCashSummary(supabase);
    return NextResponse.json(summary);
  } catch (error) {
    return dbError(error, "Failed to load cash summary.");
  }
}
