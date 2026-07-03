import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "housekeeping.read");
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("rooms")
      .select("id, room_number, room_type, status")
      .eq("is_active", true)
      .order("room_number");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? [], { headers: NO_STORE_HEADERS });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
