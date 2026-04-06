import { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboardShell from "@/components/layout/AdminDashboardShell";
import { ADMIN_AUTH_COOKIE, verifyAdminTokenValue } from "@/lib/auth";


export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get(ADMIN_AUTH_COOKIE)?.value;
  if (!token) {
    redirect("/admin/login");
  }

  const auth = verifyAdminTokenValue(token);
  if ("error" in auth) {
    redirect("/admin/login");
  }

  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
