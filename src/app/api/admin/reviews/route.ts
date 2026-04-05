import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError } from "@/lib/api-security";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "reviews.read");
  if ("error" in auth) return auth.error;

  const supabase = getSupabaseAdmin();

  // Fetch all reviews with booking reference for context
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      *,
      bookings(reference_number)
    `)
    .order("created_at", { ascending: false });

  if (error) return dbError(error, "Failed to fetch all reviews");

  return NextResponse.json(data);
}
