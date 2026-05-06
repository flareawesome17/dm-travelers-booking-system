import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getSupabaseAdmin } from "@/lib/supabase";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { updateOtherServiceTypeSchema } from "@/lib/validation-schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "other_services.manage");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, updateOtherServiceTypeSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const adminId = typeof auth.payload.sub === "string" ? auth.payload.sub : null;
    const input = parsed.data;

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) update.name = input.name;
    if (input.rate_amount !== undefined) update.rate_amount = Number(input.rate_amount.toFixed(2));
    if (input.unit_label !== undefined) update.unit_label = input.unit_label;
    if (input.unit_description !== undefined) update.unit_description = input.unit_description || null;
    if (input.is_active !== undefined) update.is_active = input.is_active;

    const { data: serviceType, error } = await supabase
      .from("other_service_types")
      .update(update)
      .eq("id", id)
      .select("id, code, name, rate_amount, unit_label, unit_description, is_active, sort_order")
      .single();

    if (error || !serviceType) {
      if ((error as { code?: string } | null)?.code === "PGRST116") {
        return apiError("service_type_not_found", "Service type not found.", 404);
      }
      return dbError(error, "Failed to update service type.");
    }

    await supabase.from("audit_log").insert({
      entity_type: "other_service_type",
      entity_id: serviceType.id,
      action: "other_service_type_updated",
      changes: {
        name: serviceType.name,
        rate_amount: serviceType.rate_amount,
        unit_label: serviceType.unit_label,
        unit_description: serviceType.unit_description,
        is_active: serviceType.is_active,
      },
      performed_by_admin_id: adminId,
    });

    return NextResponse.json({ success: true, service_type: serviceType });
  } catch (error) {
    return dbError(error, "Failed to update service type.");
  }
}
