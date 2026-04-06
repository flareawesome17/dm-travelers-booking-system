import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";

export type MessageCategory =
  | "chat"
  | "booking"
  | "housekeeping"
  | "inventory"
  | "treasury"
  | "shift"
  | "receivable"
  | "restaurant"
  | "review"
  | "general";

export interface SystemNotification {
  content: string;
  category: MessageCategory;
  metadata?: Record<string, unknown>;
}

/**
 * Broadcast a system notification into the Activity Hub.
 * This is the primary integration point — call it from any API route to
 * automatically push a notification to every connected admin dashboard.
 *
 * The insert triggers Supabase Realtime, so all connected clients receive
 * the message instantly.
 */
export async function broadcastSystemMessage(
  notification: SystemNotification,
  supabase?: SupabaseClient
): Promise<void> {
  const db = supabase ?? getSupabaseAdmin();

  const { error } = await db.from("admin_messages").insert({
    content: notification.content,
    sender_id: null,
    sender_name: "System",
    type: "system",
    category: notification.category,
    metadata: notification.metadata ?? {},
  });

  if (error) {
    // Non-critical — log but never break the calling operation
    console.error("[ACTIVITY_HUB] Failed to broadcast:", error.message);
  }
}

/**
 * Prune messages older than the given number of days.
 * Call from a cron endpoint or admin action.
 */
export async function pruneOldMessages(
  olderThanDays = 30,
  supabase?: SupabaseClient
): Promise<{ deleted: number }> {
  const db = supabase ?? getSupabaseAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const { data, error } = await db
    .from("admin_messages")
    .delete()
    .lt("created_at", cutoff.toISOString())
    .select("id");

  if (error) {
    console.error("[ACTIVITY_HUB] Prune failed:", error.message);
    return { deleted: 0 };
  }

  return { deleted: data?.length ?? 0 };
}
