import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { createTreasuryDestinationSchema } from "@/lib/validation-schemas";
import {
  encryptTreasuryAccountNumber,
  listTreasuryDestinations,
  maskAccountNumber,
} from "@/lib/treasury";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "treasury.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const destinations = await listTreasuryDestinations(supabase);
    return NextResponse.json({ destinations });
  } catch (error) {
    return dbError(error, "Failed to load treasury destinations.");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "treasury.withdraw");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createTreasuryDestinationSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const payload = parsed.data;
    const accountNumberMasked = maskAccountNumber(payload.account_number);
    const accountNumberEncrypted = encryptTreasuryAccountNumber(payload.account_number);

    const { data: existing } = await supabase
      .from("treasury_destinations")
      .select("id")
      .eq("label", payload.label)
      .maybeSingle();

    if (existing) {
      return apiError("destination_exists", "A treasury destination with this label already exists.", 409);
    }

    const nowIso = new Date().toISOString();
    const { data: destination, error } = await supabase
      .from("treasury_destinations")
      .insert({
        label: payload.label,
        provider: payload.provider,
        institution_name: payload.institution_name,
        institution_code: payload.institution_code,
        account_name: payload.account_name,
        account_number_masked: accountNumberMasked,
        account_number_encrypted: accountNumberEncrypted,
        is_active: true,
        created_by_admin_id: adminId,
        updated_at: nowIso,
      })
      .select("id, label, provider, institution_name, institution_code, account_name, account_number_masked, is_active, created_at, updated_at")
      .single();

    if (error || !destination) return dbError(error, "Failed to save treasury destination.");

    await supabase.from("audit_log").insert({
      entity_type: "treasury_destination",
      entity_id: destination.id,
      action: "treasury_destination_created",
      changes: {
        label: destination.label,
        provider: destination.provider,
        institution_name: destination.institution_name,
        institution_code: destination.institution_code,
        account_name: destination.account_name,
        account_number_masked: destination.account_number_masked,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true, destination });
  } catch (error) {
    return dbError(error, "Failed to save treasury destination.");
  }
}
