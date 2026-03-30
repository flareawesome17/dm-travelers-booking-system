import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("receivables")
      .select("*, bookings(*, guests(*), rooms(*)), receivable_payments(*)")
      .eq("id", id)
      .single();

    if (error) return dbError(error, "Receivable not found");
    return NextResponse.json(data);
  } catch {
    return internalError();
  }
}
