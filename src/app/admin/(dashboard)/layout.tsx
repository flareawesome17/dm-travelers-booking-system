"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "@/components/layout/AdminSidebar";

const IDLE_MS = 15 * 60 * 1000;

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    const token = (() => {
      try {
        return localStorage.getItem("admin_token");
      } catch {
        return null;
      }
    })();
    if (!token) router.replace("/admin/login");
  }, [router]);

  useEffect(() => {
    const token = (() => {
      try {
        return localStorage.getItem("admin_token");
      } catch {
        return null;
      }
    })();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rbac/me", { headers: { Authorization: `Bearer ${token}` } });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          try {
            localStorage.removeItem("admin_token");
            localStorage.removeItem("admin_last_activity");
          } catch {
            // ignore
          }
          router.replace("/admin/login");
          return;
        }
        const perms = Array.isArray(payload?.permissions) ? payload.permissions.filter((p: any) => typeof p === "string") : [];
        if (!cancelled) setPermissions(perms);
      } finally {
        if (!cancelled) setPermissionsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!pathname.startsWith("/admin")) return;
    if (pathname === "/admin" || pathname === "/admin/login") return;

    const required: Array<[string, string]> = [
      ["/admin/bookings", "bookings.read"],
      ["/admin/rooms", "rooms.read"],
      ["/admin/housekeeping", "housekeeping.read"],
      ["/admin/restaurant", "restaurant.read"],
      ["/admin/reports", "reports.read"],
      ["/admin/ledger", "ledger.read"],
      ["/admin/users", "users.manage"],
      ["/admin/roles", "roles.manage"],
      ["/admin/settings", "settings.manage"],
    ];

    const permSet = new Set(permissions);
    for (const [prefix, perm] of required) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        if (!permSet.has(perm)) router.replace("/admin");
        return;
      }
    }
  }, [pathname, permissions, permissionsLoaded, router]);

  useEffect(() => {
    const markActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastWriteRef.current < 5000) return;
      lastWriteRef.current = now;
      try {
        localStorage.setItem("admin_last_activity", String(now));
      } catch {
        // ignore
      }
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
      "wheel",
    ];

    for (const e of events) window.addEventListener(e, markActivity, { passive: true });
    markActivity();

    const syncFromStorage = (e: StorageEvent) => {
      if (e.key === "admin_token" && e.newValue == null) {
        router.replace("/admin/login");
      }
      if (e.key === "admin_last_activity" && e.newValue) {
        const v = Number(e.newValue);
        if (Number.isFinite(v)) lastActivityRef.current = v;
      }
    };
    window.addEventListener("storage", syncFromStorage);

    const interval = window.setInterval(() => {
      const now = Date.now();
      let last = lastActivityRef.current;
      try {
        const stored = localStorage.getItem("admin_last_activity");
        if (stored) {
          const v = Number(stored);
          if (Number.isFinite(v)) last = Math.max(last, v);
        }
      } catch {
        // ignore
      }

      if (now - last >= IDLE_MS) {
        try {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_last_activity");
        } catch {
          // ignore
        }
        router.replace("/admin/login");
      }
    }, 30_000);

    return () => {
      for (const e of events) window.removeEventListener(e, markActivity);
      window.removeEventListener("storage", syncFromStorage);
      window.clearInterval(interval);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.03]">
      <AdminSidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} permissions={permissions} />
      <main className={`min-h-screen overflow-auto transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
