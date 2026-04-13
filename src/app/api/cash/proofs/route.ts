import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAnyPermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, internalError } from "@/lib/api-security";
import { validateCashProofUpload } from "@/lib/cash";

export async function POST(req: NextRequest) {
  const auth = await requireAnyPermission(req, ["cash.deposit.request", "cash.deposit.approve", "cash.adjust"]);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const file = "file" in body ? (body as { file?: { data?: string; name?: string; type?: string } }).file : null;
    if (!file) {
      return apiError("missing_file", "A deposit proof file is required.", 400);
    }

    const validation = validateCashProofUpload(file);
    if (!validation.valid) {
      return apiError("invalid_file", validation.error, 400);
    }

    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : "unknown";
    const safeName = String(file.name || "proof").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${adminId}/${Date.now()}-${randomUUID()}-${safeName}`;
    const contentType = file.type || (validation.ext === "pdf" ? "application/pdf" : `image/${validation.ext === "jpg" ? "jpeg" : validation.ext}`);
    const supabase = getSupabaseAdmin();

    const { error: uploadError } = await supabase.storage
      .from("cash-deposit-proofs")
      .upload(path, validation.buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return apiError("upload_failed", "Failed to upload deposit proof.", 400);
    }

    return NextResponse.json({
      success: true,
      proof: {
        bucket: "cash-deposit-proofs",
        path,
        filename: safeName,
        content_type: contentType,
        size: validation.buffer.length,
      },
    });
  } catch (error) {
    console.error("[CASH_PROOF_UPLOAD_ERROR]", error);
    return internalError();
  }
}
