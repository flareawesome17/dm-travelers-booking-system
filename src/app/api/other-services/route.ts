import { NextRequest, NextResponse } from "next/server";
import { addShiftTransaction } from "@/lib/shiftUtils";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError, internalError, parseAndValidate } from "@/lib/api-security";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { createOtherServiceRecordSchema } from "@/lib/validation-schemas";
import {
  buildOtherServicesSummary,
  calculateOtherServiceTotal,
  listOtherServiceRecords,
  listOtherServiceTypes,
} from "@/lib/otherServices";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "other_services.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const [serviceTypes, records] = await Promise.all([
      listOtherServiceTypes(supabase),
      listOtherServiceRecords(supabase, { limit: 200 }),
    ]);

    return NextResponse.json({
      service_types: serviceTypes,
      records,
      summary: buildOtherServicesSummary(records),
    });
  } catch (error) {
    return dbError(error, "Failed to load other services.");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "other_services.create");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createOtherServiceRecordSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const input = parsed.data;

    const { data: serviceType, error: serviceTypeError } = await supabase
      .from("other_service_types")
      .select("id, code, name, rate_amount, unit_label, unit_description, is_active")
      .eq("id", input.service_type_id)
      .single();

    if (serviceTypeError || !serviceType) {
      return apiError("service_type_not_found", "Service type not found.", 404);
    }
    if (!serviceType.is_active) {
      return apiError("service_type_inactive", "This service type is inactive.", 400);
    }

    const today = await manilaDateString();
    let accountingDate = input.accounting_date || today;

    const { data: ledger, error: ledgerError } = await supabase
      .from("daily_ledgers")
      .select("status")
      .eq("date", accountingDate)
      .maybeSingle();

    if (ledgerError) return dbError(ledgerError, "Failed to check ledger status.");
    if (ledger?.status === "closed") {
      if (accountingDate === today) {
        accountingDate = await findNextOpenLedgerDate(supabase, today);
      } else {
        return apiError("ledger_closed", "Selected date is closed. Choose an open day.", 400);
      }
    }

    const quantity = Number(input.quantity.toFixed(2));
    const unitRate = Number(Number(serviceType.rate_amount || 0).toFixed(2));
    const totalAmount = calculateOtherServiceTotal(unitRate, quantity);

    const { data: record, error: insertError } = await supabase
      .from("other_service_records")
      .insert({
        service_type_id: serviceType.id,
        service_code: serviceType.code,
        service_name: serviceType.name,
        unit_label: serviceType.unit_label,
        unit_rate: unitRate,
        quantity,
        total_amount: totalAmount,
        payment_method: input.payment_method,
        payment_reference: input.payment_method === "Cash" ? null : input.payment_reference?.trim() || null,
        customer_name: input.customer_name || null,
        room_number: input.room_number || null,
        note: input.note || null,
        accounting_date: accountingDate,
        recorded_by_admin_id: adminId,
      })
      .select("*")
      .single();

    if (insertError || !record) return dbError(insertError, "Failed to record service.");

    try {
      const shiftTransaction = await addShiftTransaction({
        source: "other_service",
        referenceId: record.id,
        description: `Other Service: ${record.service_name} (${record.payment_method})`,
        amount: Number(record.total_amount || 0),
        type: "INCOME",
        category: "Other Services",
        performedBy: adminId,
        onFailure: "throw",
      });

      if (!shiftTransaction) {
        throw new Error("Other service shift transaction was not recorded.");
      }
    } catch (shiftError) {
      console.error("[OTHER_SERVICE_SHIFT_SYNC_ERROR]", shiftError);
      const { error: rollbackError } = await supabase.from("other_service_records").delete().eq("id", record.id);
      if (rollbackError) {
        console.error("[OTHER_SERVICE_SHIFT_SYNC_ROLLBACK_ERROR]", rollbackError);
      }
      return internalError();
    }

    await supabase.from("audit_log").insert({
      entity_type: "other_service_record",
      entity_id: record.id,
      action: "other_service_recorded",
      changes: {
        service_code: record.service_code,
        service_name: record.service_name,
        unit_rate: record.unit_rate,
        quantity: record.quantity,
        total_amount: record.total_amount,
        payment_method: record.payment_method,
        accounting_date: record.accounting_date,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error) {
    console.error("[OTHER_SERVICE_RECORD_ERROR]", error);
    return internalError();
  }
}
