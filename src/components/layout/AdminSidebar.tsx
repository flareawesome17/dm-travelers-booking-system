"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  Sparkles,
  UtensilsCrossed,
  BarChart3,
  ClipboardCheck,
  KeyRound,
  Users,
  Settings,
  Home,
  ChevronRight,
  LogOut,
  Menu,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Bookings", path: "/admin/bookings", icon: CalendarCheck, permission: "bookings.read" },
  { label: "Rooms", path: "/admin/rooms", icon: BedDouble, permission: "rooms.read" },
  { label: "Housekeeping", path: "/admin/housekeeping", icon: Sparkles, permission: "housekeeping.read" },
  { label: "Restaurant", path: "/admin/restaurant", icon: UtensilsCrossed, permission: "restaurant.read" },
  { label: "Reports", path: "/admin/reports", icon: BarChart3, permission: "reports.read" },
  { label: "Daily Closing", path: "/admin/ledger", icon: ClipboardCheck, permission: "ledger.read" },
  { label: "Users", path: "/admin/users", icon: Users, permission: "users.manage" },
  { label: "Roles", path: "/admin/roles", icon: KeyRound, permission: "roles.manage" },
  { label: "Settings", path: "/admin/settings", icon: Settings, permission: "settings.manage" },
];

export default function AdminSidebar({
  isCollapsed = false,
  onToggle,
  permissions = [],
}: {
  isCollapsed?: boolean;
  onToggle?: () => void;
  permissions?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const permSet = new Set(permissions);

  const handleLogout = () => {
    try {
      localStorage.removeItem("admin_token");
    } catch {
      // ignore
    }
    router.push("/admin/login");
  };

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 flex flex-col bg-[#07008A] text-white shadow-xl z-30 transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Brand header */}
      <div className={cn(
        "p-6 border-b border-white/10 flex items-center h-[88px]",
        isCollapsed ? "justify-center px-4" : "justify-between"
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <Image src="/logo.png" alt="D&M Logo" width={40} height={40} className="shrink-0 object-contain" />
          {!isCollapsed && (
            <div className="whitespace-nowrap flex-1">
              <p className="font-bold text-white tracking-tight leading-tight">Admin</p>
              <p className="text-xs text-white/70 leading-tight">D&M Travelers Inn</p>
            </div>
          )}
        </div>

        {/* Toggle Button Details inside Header for expanded view or floating for collapsed */}
        {!isCollapsed && onToggle && (
          <button onClick={onToggle} className="p-1.5 hover:bg-white/10 rounded-md transition-colors shrink-0">
            <ChevronLeft className="h-5 w-5 text-white/70" />
          </button>
        )}
      </div>

      {/* Floating Toggle Button when Collapsed */}
      {isCollapsed && onToggle && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-8 bg-[#FED501] text-[#07008A] p-1 rounded-full shadow-md z-40 hover:scale-110 transition-transform"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems
          .filter((i) => !i.permission || permSet.has(i.permission))
          .map(({ label, path, icon: Icon }) => {
          const isActive = pathname === path || (path !== "/admin" && pathname.startsWith(path));
          return (
            <Link
              key={path}
              href={path}
              title={isCollapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
                isCollapsed ? "justify-center px-0" : "px-3 gap-3",
                isActive
                  ? "bg-[#FED501] text-[#07008A] shadow-md"
                  : "text-white/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="flex-1 whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          type="button"
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
          className={cn(
            "w-full flex items-center rounded-lg py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-all",
            isCollapsed ? "justify-center px-0" : "px-3 gap-3"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>
        <Link
          href="/"
          title={isCollapsed ? "Back to site" : undefined}
          className={cn(
            "flex items-center rounded-lg py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all",
            isCollapsed ? "justify-center px-0" : "px-3 gap-3"
          )}
        >
          <Home className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Back to site</span>}
        </Link>
      </div>
    </aside>
  );
}
