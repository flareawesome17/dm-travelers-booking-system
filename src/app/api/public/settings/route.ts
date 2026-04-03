import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";


// Public-safe settings keys — no auth required
const PUBLIC_KEYS = [
  "hotel_logo",
  "hotel_name",
  "hotel_address",
  "hotel_phone",
  "hotel_email",
  "hotel_website",
  "facebook_url",
  "instagram_url",
  "cancellation_policy",
];

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", PUBLIC_KEYS);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load settings" },
        { status: 500 }
      );
    }

    const settings: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.key) settings[row.key] = row.value ?? "";
    }
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}
