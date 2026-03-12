import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const { file } = await req.json();
    if (!file?.data || !file?.name) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    const base64Data = file.data.split(",")[1];
    if (!base64Data) return NextResponse.json({ error: "Invalid file data" }, { status: 400 });
    const buffer = Buffer.from(base64Data, "base64");
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `menu/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage.from("images").upload(filename, buffer, { contentType: file.type || "image/jpeg", upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    const { data: urlData } = supabase.storage.from("images").getPublicUrl(filename);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
