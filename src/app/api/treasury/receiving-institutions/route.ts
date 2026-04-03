import { NextRequest, NextResponse } from "next/server";
import { apiError, dbError } from "@/lib/api-security";
import { requirePermission } from "@/lib/rbac";
import { extractReceivingInstitutions, listReceivingInstitutions } from "@/lib/paymongo";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "treasury.read");
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const provider = String(url.searchParams.get("provider") || "").trim().toLowerCase();

    if (provider !== "instapay" && provider !== "pesonet") {
      return apiError("invalid_provider", "Provider must be instapay or pesonet.", 400);
    }

    const payload = await listReceivingInstitutions(provider as "instapay" | "pesonet");
    const institutions = extractReceivingInstitutions(payload);
    return NextResponse.json({ institutions });
  } catch (error) {
    return dbError(error, "Failed to load receiving institutions.");
  }
}
