import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import { createAdminSessionSnapshot } from "@/lib/admin-session";

export async function GET(req: NextRequest) {
  const auth = verifyAdminToken(req);
  if ("error" in auth) return auth.error;

  return NextResponse.json(createAdminSessionSnapshot(auth.payload), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
