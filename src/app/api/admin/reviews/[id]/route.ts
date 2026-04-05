import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { apiError, dbError, parseAndValidate } from "@/lib/api-security";
import { z } from "zod";

const patchSchema = z.object({
  is_approved: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(req, "reviews.approve");
  if ("error" in auth) return auth.error;

  const validated = await parseAndValidate(req, patchSchema);
  if (!validated.success) return (validated as any).error;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reviews")
    .update({ is_approved: validated.data.is_approved })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return dbError(error, "Failed to update review status");

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(req, "reviews.delete");
  if ("error" in auth) return auth.error;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", params.id);

  if (error) return dbError(error, "Failed to delete review");

  return NextResponse.json({ message: "Review deleted successfully" });
}
