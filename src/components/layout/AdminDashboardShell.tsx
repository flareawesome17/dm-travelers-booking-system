"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import AdminSidebar from "@/components/layout/AdminSidebar";
import ActivityHub from "@/components/admin/ActivityHub";
import { cn } from "@/lib/utils";
import { PermissionsProvider } from "@/context/PermissionsContext";

export default function AdminDashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | undefined>();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 640) {
        setIsCollapsed(true);
      } else if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = (() => {
      try {
        return localStorage.getItem("admin_token");
      } catch {
        return null;
      }
    })();

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rbac/me", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          router.replace("/admin/login");
          router.refresh();
          return;
        }
        const perms = Array.isArray(payload?.permissions)
          ? payload.permissions.filter((p: unknown) => typeof p === "string")
          : [];
        if (!cancelled) {
          setPermissions(perms);
          if (typeof payload?.admin_id === "string") setCurrentAdminId(payload.admin_id);
        }
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

    // Protection mapping for all 16 modules
    const required: Array<[string, string]> = [
      ["/admin/bookings", "bookings.read"],
      ["/admin/rooms", "rooms.read"],
      ["/admin/housekeeping", "housekeeping.read"],
      ["/admin/restaurant", "restaurant.read"],
      ["/admin/inventory", "inventory.read"],
      ["/admin/treasury", "treasury.read"],
      ["/admin/reports", "reports.read"],
      ["/admin/shifts", "shifts.read"],
      ["/admin/receivables", "receivables.read"],
      ["/admin/lgu-monitoring", "lgu-monitoring.read"],
      ["/admin/users", "users.manage"],
      ["/admin/roles", "roles.manage"],
      ["/admin/settings", "settings.read"],
      ["/admin/reviews", "reviews.read"],
      ["/admin/calendar", "bookings.calendar"],
    ];

    const permSet = new Set(permissions);
    for (const [prefix, perm] of required) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        if (!permSet.has(perm)) router.replace("/admin");
        return;
      }
    }
  }, [pathname, permissions, permissionsLoaded, router]);

  // Heartbeat to track online status
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem("admin_token") : null;
    if (!token) return;

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/admin/heartbeat", { 
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // silent
      }
    };

    // Send immediately on mount
    sendHeartbeat();

    // Then every 60 seconds
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [pathname]); // Re-run or stay alive across navigation

  // Fetch and cache global timezone settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/public/settings");
        if (res.ok) {
          const settings = await res.json();
          // The API now returns a Record<string, string>
          const tz = settings.timezone || "Asia/Manila";
          const offset = settings.timezone_offset || "+08:00";
          
          localStorage.setItem("app_timezone", tz);
          localStorage.setItem("app_timezone_offset", offset);
        }
      } catch (error) {
        console.error("Failed to fetch global settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleMobileClose = useCallback(() => setIsMobileOpen(false), []);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only detect when sidebar is NOT open to trigger an 'open' swipe
    // And only on mobile/tablet viewports (where the sidebar is a drawer)
    if (isMobileOpen || window.innerWidth >= 1024) return;
    const startX = e.touches[0].clientX;
    // Edge detection: only if triggered within 30px of the screen edge
    if (startX < 30) {
      setTouchStart(startX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStart;
    // Open the sidebar if the user swipes right by 70px
    if (diff > 70) {
      setIsMobileOpen(true);
      setTouchStart(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#07008A]/[0.02] overflow-x-hidden relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
        permissions={permissions}
        isMobileOpen={isMobileOpen}
        onMobileClose={handleMobileClose}
      />

      <div className={cn(
        "fixed top-0 right-0 left-0 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200/60 z-30 flex items-center px-4 tablet:hidden",
        "shadow-xs"
      )}>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 -ml-1 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm font-bold text-[#07008A] tracking-tight">D&M Admin</span>
        </div>
        <div className="w-9" />
      </div>

      <main className={cn(
        "min-h-screen transition-all duration-300 ease-in-out overflow-x-hidden",
        "pt-14 tablet:pt-0",
        isCollapsed ? "tablet:ml-[72px]" : "tablet:ml-[260px]"
      )}>
        <div className="admin-container py-5 tablet:py-6 laptop:py-8">
          <div className="page-enter">
            <PermissionsProvider permissions={permissions} isLoading={!permissionsLoaded}>
              {children}
            </PermissionsProvider>
          </div>
        </div>
      </main>

      {/* Activity Hub – global chat & notification drawer */}
      <ActivityHub currentAdminId={currentAdminId} permissions={permissions} />
    </div>
  );
}
