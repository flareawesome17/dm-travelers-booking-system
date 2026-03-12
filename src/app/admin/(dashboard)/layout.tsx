"use client";

import AdminSidebar from "@/components/layout/AdminSidebar";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
