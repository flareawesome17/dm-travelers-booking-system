import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import bcrypt from "bcryptjs";
import { dbError, internalError, apiError } from "@/lib/api-security";
import { z } from "zod";

const updateAdminUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().transform((v) => v.toLowerCase().trim()).optional(),
  password: z.string().min(8).max(128).optional(),
  role_id: z.number().int().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
}).strict();

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const result = updateAdminUserSchema.safeParse(body);
    if (!result.success) {
      return apiError("validation_error", "Invalid input", 422);
    }

    const { name, email, password, role_id, is_active } = result.data;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined) {
      updateData.password_hash = await bcrypt.hash(password, 12);
    }
    if (role_id !== undefined) updateData.role_id = role_id;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("admin_users")
      .update(updateData)
      .eq("id", id)
      .select("id, name, email, role_id, is_active, created_at")
      .single();
    
    if (error) return dbError(error, "Failed to update user");
    return NextResponse.json(data);
  } catch {
    return internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requirePermission(req, "users.manage");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("admin_users").delete().eq("id", id);
    
    if (error) return dbError(error, "Failed to delete user");
    return NextResponse.json({ success: true });
  } catch {
    return internalError();
  }
}
