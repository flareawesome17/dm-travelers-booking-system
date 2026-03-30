import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createMenuItemSchema } from "@/lib/validation-schemas";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("restaurant_menu").select("*").order("name");
    if (error) return dbError(error, "Failed to load menu");
    return NextResponse.json(data ?? []);
  } catch { return internalError(); }
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createMenuItemSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("restaurant_menu").insert(parsed.data).select().single();
    if (error) return dbError(error, "Failed to create menu item");
    return NextResponse.json(data, { status: 201 });
  } catch { return internalError(); }
}
