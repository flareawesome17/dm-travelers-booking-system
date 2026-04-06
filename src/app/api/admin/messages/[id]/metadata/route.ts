import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { internalError, apiError } from "@/lib/api-security";

// Safe helper
function getMetadataItem(metadata: any, key: string, fallback: any) {
  if (typeof metadata !== "object" || metadata === null) return fallback;
  return metadata[key] !== undefined ? metadata[key] : fallback;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "activity_hub.write");
  if ("error" in auth) return auth.error;

  const adminId = auth.payload.sub;
  if (!adminId) return apiError("unauthorized", "Missing admin ID", 401);

  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action;

    if (!["mark_read", "react"].includes(action)) {
      return apiError("validation_error", "Invalid action", 422);
    }

    const supabase = getSupabaseAdmin();
    
    // 1. Fetch current metadata
    const { data: msg, error: fetchErr } = await supabase
      .from("admin_messages")
      .select("metadata")
      .eq("id", id)
      .single();

    if (fetchErr || !msg) return apiError("not_found", "Message not found", 404);

    const currentMetadata = (typeof msg.metadata === "object" && msg.metadata !== null) ? msg.metadata : {};
    
    let hasChanges = false;
    const newMetadata = { ...currentMetadata } as any;

    // 2. Apply action
    if (action === "mark_read") {
      const readBy = Array.isArray(currentMetadata.read_by) ? [...currentMetadata.read_by] : [];
      if (!readBy.includes(adminId)) {
        readBy.push(adminId);
        newMetadata.read_by = readBy;
        hasChanges = true;
      }
    } else if (action === "react") {
      const reaction = body.reaction; // e.g. "👍" or "" (to remove)
      const reactions = { ...(currentMetadata.reactions || {}) };
      
      if (reaction) {
        if (reactions[adminId] !== reaction) {
          reactions[adminId] = reaction;
          hasChanges = true;
        }
      } else {
        if (reactions[adminId]) {
          delete reactions[adminId];
          hasChanges = true;
        }
      }
      newMetadata.reactions = reactions;
    }

    // 3. Save if changed
    if (hasChanges) {
      const { data: updatedMsg, error: updateErr } = await supabase
        .from("admin_messages")
        .update({ metadata: newMetadata })
        .eq("id", id)
        .select()
        .single();
        
      if (updateErr) return internalError();
      return NextResponse.json(updatedMsg);
    }

    return NextResponse.json({ success: true, message: "No change needed" });

  } catch (err) {
    console.error(err);
    return internalError();
  }
}
