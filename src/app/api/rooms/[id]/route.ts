import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { updateRoomSchema } from "@/lib/validation-schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "rooms.update");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, updateRoomSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("rooms").update(parsed.data).eq("id", id).select().single();
    if (error) return dbError(error, "Failed to update room");
    return NextResponse.json(data);
  } catch { return internalError(); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "rooms.delete");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) return dbError(error, "Failed to delete room");
    return NextResponse.json({ success: true });
  } catch { return internalError(); }
}
