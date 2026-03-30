import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createRoomSchema } from "@/lib/validation-schemas";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "rooms.read");
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("rooms").select("*").order("room_number", { ascending: true });
    if (error) return dbError(error, "Failed to load rooms");
    return NextResponse.json(data ?? []);
  } catch { return internalError(); }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "rooms.create");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createRoomSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("rooms").insert(parsed.data).select().single();
    if (error) return dbError(error, "Failed to create room");
    return NextResponse.json(data, { status: 201 });
  } catch { return internalError(); }
}
