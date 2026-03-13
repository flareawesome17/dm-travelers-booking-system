import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;
  try {
    const { files, file } = await req.json();
    const filesToUpload = files || (file ? [file] : []);
    
    if (!filesToUpload || filesToUpload.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const urls: string[] = [];

    for (const f of filesToUpload) {
      if (!f?.data || !f?.name) continue;
      const base64Data = f.data.split(",")[1];
      if (!base64Data) continue;
      const buffer = Buffer.from(base64Data, "base64");
      const ext = f.name.split(".").pop() || "jpg";
      const filename = `rooms/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage.from("room-images").upload(filename, buffer, { contentType: f.type || "image/jpeg", upsert: false });
      if (uploadError) {
        console.error("Image upload error:", uploadError);
        return NextResponse.json({ error: uploadError.message }, { status: 400 });
      }
      const { data: urlData } = supabase.storage.from("room-images").getPublicUrl(filename);
      urls.push(urlData.publicUrl);
    }

    return NextResponse.json({ urls, url: urls[0] });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
