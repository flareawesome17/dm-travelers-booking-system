import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { updateMenuItemSchema } from "@/lib/validation-schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, updateMenuItemSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("restaurant_menu").update(parsed.data).eq("id", id).select().single();
    if (error) return dbError(error, "Failed to update menu item");
    return NextResponse.json(data);
  } catch { return internalError(); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("restaurant_menu").delete().eq("id", id);
    if (error) return dbError(error, "Failed to delete menu item");
    return NextResponse.json({ success: true });
  } catch { return internalError(); }
}
