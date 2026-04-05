import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError, parseAndValidate } from "@/lib/api-security";
import { updateDiscountSchema } from "@/lib/validation-schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "discounts.update");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = await parseAndValidate(req, updateDiscountSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("discounts")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return dbError(error, "Failed to update discount");
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[DISCOUNT_PATCH_${id}]`, error);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "discounts.delete");
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("discounts")
      .delete()
      .eq("id", id);

    if (error) return dbError(error, "Failed to delete discount");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DISCOUNT_DELETE_${id}]`, error);
    return internalError();
  }
}
