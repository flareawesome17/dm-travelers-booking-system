import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLoginPage from "@/components/admin/AdminLoginPage";
import { ADMIN_AUTH_COOKIE, verifyAdminTokenValue } from "@/lib/auth";

export default function AdminLogin() {
  const token = cookies().get(ADMIN_AUTH_COOKIE)?.value;
  if (token) {
    const auth = verifyAdminTokenValue(token);
    if (!("error" in auth)) {
      redirect("/admin");
    }
  }

  return <AdminLoginPage />;
}
