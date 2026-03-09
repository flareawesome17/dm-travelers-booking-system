import { Link, useLocation } from "react-router-dom";

const navItems = [
  { label: "Dashboard", path: "/admin/dashboard" },
  { label: "Bookings", path: "/admin/bookings" },
  { label: "Rooms", path: "/admin/rooms" },
  { label: "Housekeeping", path: "/admin/housekeeping" },
  { label: "Restaurant", path: "/admin/restaurant" },
  { label: "Reports", path: "/admin/reports" },
  { label: "Users", path: "/admin/users" },
  { label: "Settings", path: "/admin/settings" },
];

export default function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 bg-[#07008A] text-white p-4 shrink-0">
      <p className="font-bold mb-6">D&M Admin</p>
      <nav className="space-y-2">
        {navItems.map(({ label, path }) => (
          <Link
            key={path}
            to={path}
            className={`block ${location.pathname === path ? "text-[#FED501]" : "hover:text-[#FED501]"}`}
          >
            {label}
          </Link>
        ))}
        <Link to="/" className="block text-sm opacity-80 mt-4 hover:opacity-100">
          ← Back to site
        </Link>
      </nav>
    </aside>
  );
}
