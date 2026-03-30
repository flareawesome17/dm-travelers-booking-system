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

    const { files, file } = body;
    const filesToUpload = files || (file ? [file] : []);

    if (!filesToUpload || filesToUpload.length === 0) {
      return apiError("no_files", "No files provided", 400);
    }

    if (filesToUpload.length > 10) {
      return apiError("too_many_files", "Maximum 10 files per upload", 400);
    }

    const supabase = getSupabaseAdmin();
    const urls: string[] = [];

    for (const f of filesToUpload) {
      const validation = validateFileUpload(f);
      if (validation.valid === false) {
        return apiError("invalid_file", validation.error, 400);
      }

      const filename = `rooms/${Date.now()}_${Math.random().toString(36).slice(2)}.${validation.ext}`;

      const { error: uploadError } = await supabase.storage
        .from("room-images")
        .upload(filename, validation.buffer, {
          contentType: `image/${validation.ext === "jpg" ? "jpeg" : validation.ext}`,
          upsert: false,
        });
      if (uploadError) {
        console.error("[UPLOAD_ERROR]", uploadError);
        return apiError("upload_failed", "Failed to upload image", 400);
      }

      const { data: urlData } = supabase.storage.from("room-images").getPublicUrl(filename);
      urls.push(urlData.publicUrl);
    }

    return NextResponse.json({ urls, url: urls[0] });
  } catch (err) {
    console.error("[UPLOAD_ERROR]", err);
    return internalError();
  }
}
