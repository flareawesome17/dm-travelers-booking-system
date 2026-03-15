import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminPermissions } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const res = await getCurrentAdminPermissions(req);
  if ("error" in res) return res.error;
  return NextResponse.json({
    role_id: res.payload.role_id,
    permissions: res.permissions,
  });
}

