import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("bookings")
      .update(body)
      .eq("id", id)
      .select("*, guests(*), rooms(*)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
