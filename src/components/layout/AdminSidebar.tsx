"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  Sparkles,
  UtensilsCrossed,
  BarChart3,
  KeyRound,
  Users,
  Settings,
  Home,
  ChevronRight,
  LogOut,
  ChevronLeft,
  Building2,
  User,
  X,
  PackageSearch,
  Clock,
  Landmark,
  FileText,
  ShieldCheck,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const operationsItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Bookings", path: "/admin/bookings", icon: CalendarCheck, permission: "bookings.read" },
  { label: "Receivables", path: "/admin/receivables", icon: Building2, permission: "receivables.read" },
  { label: "Rooms", path: "/admin/rooms", icon: BedDouble, permission: "rooms.read" },
  { label: "Housekeeping", path: "/admin/housekeeping", icon: Sparkles, permission: "housekeeping.read" },
  { label: "Restaurant", path: "/admin/restaurant", icon: UtensilsCrossed, permission: "restaurant.read" },
  { label: "Inventory", path: "/admin/inventory", icon: PackageSearch, permission: "inventory.read" },
  { label: "Treasury", path: "/admin/treasury", icon: Landmark, permission: "treasury.read" },
  { label: "LGU Monitoring", path: "/admin/lgu-monitoring", icon: ShieldCheck, permission: "lgu-monitoring.read" },
];

const managementItems = [
  { label: "Reports", path: "/admin/reports", icon: BarChart3, permission: "reports.read" },
  { label: "Shifts", path: "/admin/shifts", icon: Clock, permission: "shifts.read" },
  { label: "Discounts", path: "/admin/discounts", icon: Percent, permission: "discounts.read" },
  { label: "Users", path: "/admin/users", icon: Users, permission: "users.manage" },
  { label: "Roles", path: "/admin/roles", icon: KeyRound, permission: "roles.manage" },
  { label: "Settings", path: "/admin/settings", icon: Settings, permission: "settings.read" },
];

// Keep flat navItems for backwards compat
const navItems = [...operationsItems, ...managementItems];

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (c: string) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

interface NavItemProps {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  isCollapsed: boolean;
  badge?: number;
}

function NavItem({ label, path, icon: Icon, isActive, isCollapsed, badge }: NavItemProps) {
  const badgeEl = badge && badge > 0 ? (
    <span className={cn(
      "flex items-center justify-center rounded-full bg-red-500 text-white font-bold leading-none animate-in fade-in zoom-in-75 duration-200",
      isCollapsed
        ? "absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 text-[10px]"
        : "h-5 min-w-5 px-1.5 text-[11px]"
    )}>
      {badge > 99 ? "99+" : badge}
    </span>
  ) : null;

  const linkContent = (
    <Link
      href={path}
      className={cn(
        "group/nav-item relative flex items-center rounded-xl text-sm font-medium transition-all duration-200",
        isCollapsed ? "justify-center w-11 h-11 mx-auto" : "px-3 py-2.5 gap-3",
        isActive
          ? "bg-white/15 text-white shadow-sm"
          : "text-white/70 hover:bg-white/8 hover:text-white"
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#FED501] rounded-r-full" />
      )}
      <Icon className={cn(
        "h-[18px] w-[18px] shrink-0 transition-transform duration-200",
        isActive ? "text-[#FED501]" : "group-hover/nav-item:scale-110"
      )} />
      {!isCollapsed && (
        <>
          <span className="flex-1 whitespace-nowrap truncate">{label}</span>
          {badgeEl}
        </>
      )}
      {isCollapsed && badgeEl}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="bg-slate-900 text-white border-slate-800 text-xs font-medium px-3 py-1.5">
          <span className="flex items-center gap-2">
            {label}
            {badge && badge > 0 ? (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export default function AdminSidebar({
  isCollapsed = false,
  onToggle,
  permissions = [],
  isMobileOpen = false,
  onMobileClose,
}: {
  isCollapsed?: boolean;
  onToggle?: () => void;
  permissions?: string[];
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const permSet = new Set(permissions);
  const [token, setToken] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");
  const [newBookingCount, setNewBookingCount] = useState(0);
  const bookingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LAST_SEEN_KEY = "admin_bookings_last_seen";

  const fetchNewBookingCount = useCallback(async () => {
    try {
      const since = localStorage.getItem(LAST_SEEN_KEY) || new Date(0).toISOString();
      const res = await fetch(`/api/bookings/new-count?since=${encodeURIComponent(since)}`);
      if (res.ok) {
        const data = await res.json();
        setNewBookingCount(typeof data.count === "number" ? data.count : 0);
      }
    } catch {
      // silent
    }
  }, []);

  // Poll for new public bookings every 30 seconds
  useEffect(() => {
    fetchNewBookingCount();
    bookingPollRef.current = setInterval(fetchNewBookingCount, 30_000);
    return () => {
      if (bookingPollRef.current) clearInterval(bookingPollRef.current);
    };
  }, [fetchNewBookingCount]);

  // When the admin navigates to the bookings page, mark as seen
  useEffect(() => {
    if (pathname === "/admin/bookings" || pathname.startsWith("/admin/bookings/")) {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      setNewBookingCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    fetch("/api/public/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.hotel_logo) {
          setLogoUrl(data.hotel_logo);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      setToken(localStorage.getItem("admin_token"));
    } catch {
      setToken(null);
    }
  }, []);

  const currentAdmin = useMemo(() => {
    if (!token) return null;
    const p = decodeJwtPayload(token);
    if (!p) return null;
    const name = typeof p.name === "string" ? p.name : null;
    const email = typeof p.email === "string" ? p.email : null;
    const roleId = typeof p.role_id === "number" ? p.role_id : Number(p.role_id);
    const roleLabel =
      roleId === 1 ? "Super Admin" : roleId === 2 ? "Manager" : roleId === 3 ? "Staff" : roleId === 4 ? "Housekeeping" : null;
    return { name, email, roleLabel };
  }, [token]);

  const handleLogout = () => {
    void (async () => {
      try {
        await fetch("/api/admin/logout", { method: "POST" });
      } catch {
        // ignore
      }
      try {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_last_activity");
      } catch {
        // ignore
      }
      setToken(null);
      router.replace("/admin/login");
      router.refresh();
    })();
  };

  const isItemActive = (path: string) =>
    pathname === path || (path !== "/admin" && pathname.startsWith(path));

  const filterByPermission = (items: typeof navItems) =>
    items.filter((i) => !i.permission || permSet.has(i.permission));

  const filteredOps = filterByPermission(operationsItems);
  const filteredMgmt = filterByPermission(managementItems);

  const initials = (() => {
    const n = currentAdmin?.name?.trim();
    if (!n) return "A";
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "A";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (a + (b || "")).toUpperCase();
  })();

  const sidebarContent = (
    <>
      {/* Brand header */}
      <div className={cn(
        "flex items-center border-b border-white/8 shrink-0",
        (isCollapsed && !isMobileOpen) ? "justify-center px-3 h-[72px]" : "justify-between px-5 h-[72px]"
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <img src={logoUrl} alt="D&M Logo" width={36} height={36} className="shrink-0 object-contain" />
          {(!isCollapsed || isMobileOpen) && (
            <div className="whitespace-nowrap flex-1 min-w-0">
              <p className="font-bold text-white text-sm tracking-tight leading-tight">Admin</p>
              <p className="text-[11px] text-white/50 leading-tight truncate">D&M Travellers Inn</p>
            </div>
          )}
        </div>

        {/* Desktop toggle */}
        {!isCollapsed && onToggle && !isMobileOpen && (
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4 text-white/50" />
          </button>
        )}

        {/* Mobile close */}
        {isMobileOpen && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4 text-white/50" />
          </button>
        )}
      </div>

      {/* Collapsed expand button */}
      {isCollapsed && onToggle && !isMobileOpen && (
        <button
          onClick={onToggle}
          className="hidden tablet:flex items-center justify-center absolute -right-3 top-7 bg-[#FED501] text-[#07008A] p-1 rounded-full shadow-lg z-40 hover:scale-110 transition-transform ring-2 ring-[#07008A]/20"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Navigation */}
      <TooltipProvider>
        <nav className={cn(
          "sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-4",
          (isCollapsed && !isMobileOpen) ? "px-2" : "px-3"
        )}>
          {/* Operations Group */}
          {(!isCollapsed || isMobileOpen) && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
              Operations
            </p>
          )}
          <div className="space-y-0.5">
            {filteredOps.map(({ label, path, icon }) => (
              <NavItem
                key={path}
                label={label}
                path={path}
                icon={icon}
                isActive={isItemActive(path)}
                isCollapsed={isCollapsed && !isMobileOpen}
                badge={path === "/admin/bookings" ? newBookingCount : undefined}
              />
            ))}
          </div>

          {/* Separator */}
          <div className={cn("my-4", (isCollapsed && !isMobileOpen) ? "mx-2" : "mx-3")}>
            <div className="h-px bg-white/8" />
          </div>

          {/* Management Group */}
          {(!isCollapsed || isMobileOpen) && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
              Management
            </p>
          )}
          <div className="space-y-0.5">
            {filteredMgmt.map(({ label, path, icon }) => (
              <NavItem
                key={path}
                label={label}
                path={path}
                icon={icon}
                isActive={isItemActive(path)}
                isCollapsed={isCollapsed && !isMobileOpen}
              />
            ))}
          </div>
        </nav>
      </TooltipProvider>

      {/* Footer */}
      <div className={cn(
        "border-t border-white/8 shrink-0",
        isCollapsed && !isMobileOpen ? "p-2" : "p-3"
      )}>
        {/* User info card */}
        {(!isCollapsed || isMobileOpen) && currentAdmin && (currentAdmin.name || currentAdmin.email) && (
          <div className="mb-3 rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#FED501]/15 text-[#FED501] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-white/40 leading-tight">Signed in as</p>
                <p className="text-xs font-semibold leading-tight truncate text-white/90">{currentAdmin.name || "Admin"}</p>
                <p className="text-[10px] text-white/50 truncate">{currentAdmin.roleLabel || "Staff"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed user avatar */}
        {isCollapsed && !isMobileOpen && currentAdmin && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="mb-2 h-10 w-10 rounded-xl bg-[#FED501]/15 text-[#FED501] flex items-center justify-center mx-auto cursor-default">
                <span className="text-[11px] font-bold">{initials}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="bg-slate-900 text-white border-slate-800">
              <p className="text-xs font-semibold">{currentAdmin.name || "Admin"}</p>
              <p className="text-[10px] text-white/60">{currentAdmin.roleLabel || "Staff"}</p>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="space-y-0.5">
          <NavItem
            label="My Account"
            path="/admin/account"
            icon={User}
            isActive={isItemActive("/admin/account")}
            isCollapsed={isCollapsed && !isMobileOpen}
          />

          {/* Logout button */}
          {isCollapsed && !isMobileOpen ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center w-11 h-11 mx-auto rounded-xl text-white/70 hover:bg-white/8 hover:text-white transition-all"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="bg-slate-900 text-white border-slate-800 text-xs font-medium px-3 py-1.5">
                Logout
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center rounded-xl py-2.5 px-3 gap-3 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-all"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span>Logout</span>
            </button>
          )}

          {/* Back to site */}
          <NavItem
            label="Back to site"
            path={process.env.NEXT_PUBLIC_APP_DOMAIN ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}` : "/"}
            icon={Home}
            isActive={false}
            isCollapsed={isCollapsed && !isMobileOpen}
          />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 tablet:hidden backdrop-blur-sm"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 flex flex-col bg-[#07008A] text-white z-50 transition-all duration-300 ease-in-out",
          // Mobile: slide-in drawer
          "tablet:z-30",
          // Width
          isMobileOpen
            ? "w-[280px] translate-x-0"
            : isCollapsed
              ? "w-[72px] -translate-x-full tablet:translate-x-0"
              : "w-[260px] -translate-x-full tablet:translate-x-0",
        )}
        style={{
          boxShadow: isMobileOpen ? '4px 0 24px rgba(0,0,0,0.3)' : undefined,
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
