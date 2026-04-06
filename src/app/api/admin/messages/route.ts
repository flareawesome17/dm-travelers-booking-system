import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError, apiError } from "@/lib/api-security";
import { z } from "zod";

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  recipient_id: z.string().uuid().optional(),
});

/* ------------------------------------------------------------------ */
/*  GET /api/admin/messages                                            */
/*  Query modes:                                                       */
/*    ?mode=broadcast           → All tab (recipient_id IS NULL)       */
/*    ?mode=dm&partner_id=UUID  → DMs between me and partner           */
/*    ?mode=conversations       → DM conversation list (latest per user) */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "activity_hub.read");
  if ("error" in auth) return auth.error;

  const adminId = auth.payload.sub;
  if (!adminId) return apiError("unauthorized", "Missing admin ID", 401);

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "broadcast";
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);
    const before = url.searchParams.get("before");

    /* ── Broadcast messages (All tab) ── */
    if (mode === "broadcast") {
      let query = supabase
        .from("admin_messages")
        .select("*")
        .is("recipient_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) query = query.lt("created_at", before);

      const { data, error } = await query;
      if (error) return dbError(error, "Failed to load messages");

      return NextResponse.json({
        messages: (data ?? []).reverse(),
        hasMore: (data?.length ?? 0) === limit,
      });
    }

    /* ── DM conversation with a specific partner ── */
    if (mode === "dm") {
      const partnerId = url.searchParams.get("partner_id");
      if (!partnerId) return apiError("validation_error", "partner_id is required for dm mode", 422);

      let query = supabase
        .from("admin_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${adminId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${adminId})`
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) query = query.lt("created_at", before);

      const { data, error } = await query;
      if (error) return dbError(error, "Failed to load DM messages");

      return NextResponse.json({
        messages: (data ?? []).reverse(),
        hasMore: (data?.length ?? 0) === limit,
      });
    }

    /* ── Conversation list (Chat tab inbox) ── */
    if (mode === "conversations") {
      // Get all DM messages involving the current user, then
      // deduplicate to get the latest message per conversation partner.
      const { data, error } = await supabase
        .from("admin_messages")
        .select("*")
        .not("recipient_id", "is", null)
        .or(`sender_id.eq.${adminId},recipient_id.eq.${adminId}`)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) return dbError(error, "Failed to load conversations");

      // Deduplicate: latest message per conversation partner
      const seen = new Set<string>();
      const conversations: typeof data = [];
      for (const msg of data ?? []) {
        const partnerId = msg.sender_id === adminId ? msg.recipient_id : msg.sender_id;
        if (!partnerId || seen.has(partnerId)) continue;
        seen.add(partnerId);
        conversations.push(msg);
      }

      return NextResponse.json({ conversations });
    }

    return apiError("validation_error", "Invalid mode. Use: broadcast, dm, conversations", 422);
  } catch {
    return internalError();
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/admin/messages                                           */
/*  Send a message. If recipient_id is provided → DM, otherwise broadcast */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "activity_hub.write");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("validation_error", "Message content is required (max 2000 chars)", 422);
    }

    const adminId = auth.payload.sub;
    const adminName =
      typeof auth.payload.name === "string" ? auth.payload.name : "Admin";

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_messages")
      .insert({
        content: parsed.data.content,
        sender_id: adminId,
        sender_name: adminName,
        type: "user",
        category: "chat",
        recipient_id: parsed.data.recipient_id ?? null,
      })
      .select()
      .single();

    if (error) return dbError(error, "Failed to send message");
    return NextResponse.json(data, { status: 201 });
  } catch {
    return internalError();
  }
}
