import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  Sparkles,
  UtensilsCrossed,
  BarChart3,
  Users,
  Settings,
  Home,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Bookings", path: "/admin/bookings", icon: CalendarCheck },
  { label: "Rooms", path: "/admin/rooms", icon: BedDouble },
  { label: "Housekeeping", path: "/admin/housekeeping", icon: Sparkles },
  { label: "Restaurant", path: "/admin/restaurant", icon: UtensilsCrossed },
  { label: "Reports", path: "/admin/reports", icon: BarChart3 },
  { label: "Users", path: "/admin/users", icon: Users },
  { label: "Settings", path: "/admin/settings", icon: Settings },
];

export default function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-[#07008A] text-white shadow-xl">
      {/* Brand header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FED501] text-[#07008A] shadow-lg">
            <span className="font-bold text-lg">D&M</span>
          </div>
          <div>
            <p className="font-bold text-white tracking-tight">Admin</p>
            <p className="text-xs text-white/70">Travelers Inn</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ label, path, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#FED501] text-[#07008A] shadow-md"
                  : "text-white/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Back to site */}
      <div className="p-4 border-t border-white/10">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all"
        >
          <Home className="h-5 w-5 shrink-0" />
          Back to site
        </Link>
      </div>
    </aside>
  );
}
