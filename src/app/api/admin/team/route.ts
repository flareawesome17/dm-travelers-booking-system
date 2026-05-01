import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";

/**
 * GET /api/admin/team — Returns all active admin users with their online status.
 * Used by the Activity Hub to show who's available for chat.
 * Requires `activity_hub.read` permission.
 */

// Cache team response for 60 seconds — all admins see the same list
let cachedTeam: { members: any[]; expiresAt: number } | null = null;

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "activity_hub.read");
  if ("error" in auth) return auth.error;

  const now = Date.now();
  if (cachedTeam && cachedTeam.expiresAt > now) {
    return NextResponse.json({ members: cachedTeam.members });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("admin_users")
      .select("id, name, role_id, last_seen_at, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) return dbError(error, "Failed to load team members");

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const members = (data ?? []).map((u) => ({
      id: u.id,
      name: u.name || "Unnamed",
      role_id: u.role_id,
      is_online: u.last_seen_at ? new Date(u.last_seen_at).getTime() > fiveMinutesAgo : false,
    }));

    // Sort: online users first, then alphabetically
    members.sort((a, b) => {
      if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    cachedTeam = { members, expiresAt: Date.now() + 60_000 };

    return NextResponse.json({ members });
  } catch {
    return internalError();
  }
}

