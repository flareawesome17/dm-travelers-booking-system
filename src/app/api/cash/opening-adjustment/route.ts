import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { createCashOpeningAdjustmentSchema } from "@/lib/validation-schemas";

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "cash.adjust");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createCashOpeningAdjustmentSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const input = parsed.data;
    const amount = Math.abs(Number(input.amount.toFixed(2)));
    const direction = input.amount > 0 ? "credit" : "debit";
    const effectiveAt = input.effective_at ? new Date(input.effective_at).toISOString() : new Date().toISOString();

    const { data: existingOpening } = await supabase
      .from("cash_ledger_entries")
      .select("id")
      .eq("entry_type", "opening_adjustment")
      .maybeSingle();

    if (existingOpening) {
      return apiError("opening_adjustment_exists", "Opening adjustment has already been posted.", 409);
    }

    const { data: entry, error } = await supabase
      .from("cash_ledger_entries")
      .insert({
        direction,
        entry_type: "opening_adjustment",
        amount,
        currency: "PHP",
        effective_at: effectiveAt,
        description: "Opening cash adjustment",
        note: input.note || null,
        performed_by_admin_id: adminId,
        meta: {
          source: "cash_module",
          opening_amount: Number(input.amount.toFixed(2)),
        },
      })
      .select("id, direction, amount, effective_at, note")
      .single();

    if (error || !entry) return dbError(error, "Failed to post opening cash adjustment.");

    await supabase.from("audit_log").insert({
      entity_type: "cash_ledger_entry",
      entity_id: entry.id,
      action: "cash_opening_adjustment_posted",
      changes: {
        direction: entry.direction,
        amount: entry.amount,
        effective_at: entry.effective_at,
        note: entry.note,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error) {
    return dbError(error, "Failed to post opening cash adjustment.");
  }
}
