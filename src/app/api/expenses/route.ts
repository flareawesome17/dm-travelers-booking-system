import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { findNextOpenLedgerDate, manilaDateString } from "@/lib/ledgerDate";
import { addShiftTransaction } from "@/lib/shiftUtils";
import { parseAndValidate, dbError, internalError, apiError } from "@/lib/api-security";
import { createExpenseSchema } from "@/lib/validation-schemas";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "expenses.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expenses")
      .select(`
        *,
        performed_by_user:admin_users!performed_by(name)
      `)
      .order("date", { ascending: false });

    if (error) return dbError(error, "Failed to load expenses");
    return NextResponse.json(data);
  } catch {
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "expenses.create");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createExpenseSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const today = await manilaDateString();
    let expenseDate = parsed.data.date || today;

    const { data: ledger, error: lErr } = await supabase
      .from("daily_ledgers")
      .select("status")
      .eq("date", expenseDate)
      .maybeSingle();
    if (lErr) return dbError(lErr, "Failed to check ledger status");

    if (ledger?.status === "closed") {
      if (expenseDate === today) {
        expenseDate = await findNextOpenLedgerDate(supabase, today);
      } else {
        return apiError("ledger_closed", "Selected date is closed. Choose an open day.", 400);
      }
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...parsed.data, date: expenseDate, performed_by: adminId })
      .select()
      .single();

    if (error) return dbError(error, "Failed to create expense");

    try {
      const shiftTransaction = await addShiftTransaction({
        source: "expense",
        referenceId: data.id,
        description: `Expense: ${data.category} ${data.description}`,
        amount: Number(data.amount || 0),
        type: "EXPENSE",
        category: data.category || undefined,
        performedBy: adminId,
        onFailure: "throw",
      });

      if (!shiftTransaction) {
        throw new Error("Expense shift transaction was not recorded.");
      }

      return NextResponse.json(
        {
          ...data,
          recorded_for_date: expenseDate,
          shift_transaction: shiftTransaction,
        },
        { status: 201 },
      );
    } catch (shiftError) {
      console.error("[EXPENSE_SHIFT_SYNC_ERROR]", shiftError);

      const { error: rollbackError } = await supabase.from("expenses").delete().eq("id", data.id);
      if (rollbackError) {
        console.error("[EXPENSE_SHIFT_SYNC_ROLLBACK_ERROR]", rollbackError);
      }

      return internalError();
    }
  } catch {
    return internalError();
  }
}
