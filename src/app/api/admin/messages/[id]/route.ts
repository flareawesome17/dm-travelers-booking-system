import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError, apiError } from "@/lib/api-security";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "activity_hub.write");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const { content } = await req.json();
    const adminId = auth.payload.sub;

    if (!content) return apiError("validation_error", "Content is required", 422);

    const supabase = getSupabaseAdmin();
    
    // Fetch existing message to check ownership
    const { data: existing, error: findError } = await supabase
      .from("admin_messages")
      .select("sender_id, metadata")
      .eq("id", id)
      .single();

    if (findError || !existing) return apiError("not_found", "Message not found", 404);

    const isOwner = existing.sender_id === adminId;
    const isAdmin = [1, 5].includes(Number(auth.payload.role_id));

    if (!isOwner && !isAdmin) {
      return apiError("unauthorized", "You can only edit your own messages", 403);
    }

    // Update message and mark as edited in metadata
    const newMetadata = { 
      ...(existing.metadata || {}), 
      is_edited: true,
      edited_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("admin_messages")
      .update({ 
        content,
        metadata: newMetadata,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return dbError(error, "Failed to update message");
    return NextResponse.json(data);
  } catch (error) {
    console.error("[MESSAGE_PATCH_ERROR]", error);
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "activity_hub.write");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const adminId = auth.payload.sub;
    const supabase = getSupabaseAdmin();

    const { data: existing, error: findError } = await supabase
      .from("admin_messages")
      .select("sender_id")
      .eq("id", id)
      .single();

    if (findError || !existing) return apiError("not_found", "Message not found", 404);

    const isOwner = existing.sender_id === adminId;
    const isAdmin = [1, 5].includes(Number(auth.payload.role_id));

    if (!isOwner && !isAdmin) {
      return apiError("unauthorized", "You can only delete your own messages", 403);
    }

    const { error } = await supabase
      .from("admin_messages")
      .delete()
      .eq("id", id);

    if (error) return dbError(error, "Failed to delete message");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MESSAGE_DELETE_ERROR]", error);
    return internalError();
  }
}
