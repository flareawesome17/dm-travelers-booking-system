import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError } from "@/lib/api-security";
import { createCashProofSignedUrl } from "@/lib/cash";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "cash.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: deposit, error } = await supabase
      .from("cash_deposit_requests")
      .select("proof_bucket, proof_path, proof_filename")
      .eq("id", id)
      .single();

    if (error || !deposit) {
      return apiError("not_found", "Cash deposit request not found.", 404);
    }

    const url = await createCashProofSignedUrl(supabase, deposit.proof_bucket, deposit.proof_path);
    return NextResponse.json({
      url,
      filename: deposit.proof_filename,
    });
  } catch (error) {
    return dbError(error, "Failed to generate cash proof link.");
  }
}
