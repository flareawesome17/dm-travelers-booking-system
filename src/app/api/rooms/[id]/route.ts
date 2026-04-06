import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { updateRoomSchema } from "@/lib/validation-schemas";
import { broadcastSystemMessage } from "@/lib/activity-hub";

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

    // Broadcast housekeeping notifications for status changes
    if (parsed.data.status && data) {
      const statusLabels: Record<string, string> = {
        "Dirty": "needs cleaning",
        "In Cleaning": "is being cleaned",
        "Available": "is now clean and available",
        "Maintenance": "has been put under maintenance",
      };
      const label = statusLabels[parsed.data.status as string];
      if (label) {
        broadcastSystemMessage({
          content: `Room ${data.room_number} ${label}.`,
          category: "housekeeping",
          metadata: { room_id: data.id, status: parsed.data.status },
        }, supabase).catch(() => {});
      }
    }

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
