import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { parseAndValidate, dbError, internalError } from "@/lib/api-security";
import { createDiscountSchema } from "@/lib/validation-schemas";

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "discounts.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("discounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return dbError(error, "Failed to load discounts");
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("[DISCOUNTS_GET]", error);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "discounts.create");
  if ("error" in auth) return auth.error;

  const parsed = await parseAndValidate(req, createDiscountSchema);
  if (parsed.success === false) return parsed.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("discounts")
      .insert(parsed.data)
      .select()
      .single();

    if (error) return dbError(error, "Failed to create discount");
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[DISCOUNTS_POST]", error);
    return internalError();
  }
}
