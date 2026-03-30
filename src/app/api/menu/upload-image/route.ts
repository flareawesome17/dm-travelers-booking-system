import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminToken } from "@/lib/auth";
import { validateFileUpload, apiError, internalError } from "@/lib/api-security";

export async function POST(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body) return apiError("invalid_json", "Request body must be valid JSON", 400);

    const { file } = body;
    if (!file) return apiError("no_file", "No file provided", 400);

    const validation = validateFileUpload(file);
    if (validation.valid === false) {
      return apiError("invalid_file", validation.error, 400);
    }

    const filename = `menu/${Date.now()}_${Math.random().toString(36).slice(2)}.${validation.ext}`;
    const supabase = getSupabaseAdmin();

    const { error: uploadError } = await supabase.storage
      .from("room-images")
      .upload(filename, validation.buffer, {
        contentType: `image/${validation.ext === "jpg" ? "jpeg" : validation.ext}`,
        upsert: false,
      });
    if (uploadError) {
      console.error("[MENU_UPLOAD_ERROR]", uploadError);
      return apiError("upload_failed", "Failed to upload image", 400);
    }

    const { data: urlData } = supabase.storage.from("room-images").getPublicUrl(filename);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("[MENU_UPLOAD_ERROR]", err);
    return internalError();
  }
}
