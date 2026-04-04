import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Pass through if we're in development mode so localhost:3000 still works for everything
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // Firebase App Hosting proxies requests through Cloud Run.
  // The original external hostname is passed via x-forwarded-host header.
  // request.nextUrl.hostname will be the internal Cloud Run URL (*.a.run.app), NOT your custom domain.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host") || "";
  const hostname = forwardedHost || host || request.nextUrl.hostname || "";

  // Strip port if present (e.g. "admin.dm.erniecodev.win:443" -> "admin.dm.erniecodev.win")
  const cleanHostname = hostname.split(":")[0].toLowerCase();

  const adminDomain = (process.env.ADMIN_SUBDOMAIN || "admin.dm.erniecodev.win").toLowerCase();

  const isAdminDomain =
    cleanHostname === adminDomain ||
    cleanHostname === "admin.dm.erniecodev.win" ||
    cleanHostname === "admin.localhost";
  const isPublicDomain = !isAdminDomain;

  const pathname = request.nextUrl.pathname;

  // Define which paths are strictly for the admin interface or admin API operations
  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/bookings/") ||
    pathname.startsWith("/api/housekeeping/") ||
    pathname.startsWith("/api/payments/") ||
    pathname.startsWith("/api/rbac/") ||
    pathname.startsWith("/api/receivables/") ||
    pathname.startsWith("/api/reports/") ||
    pathname.startsWith("/api/restaurant/") ||
    pathname.startsWith("/api/rooms/") ||
    pathname.startsWith("/api/settings/") ||
    pathname.startsWith("/api/shifts/") ||
    pathname.startsWith("/api/treasury/");

  // Exclude explicit public API routes that might otherwise match generic prefixes above
  const isPublicApiRoute = pathname.startsWith("/api/public/");

  if (isAdminRoute && !isPublicApiRoute) {
    // If it's an admin route but accessed via the public domain -> BLOCK
    if (isPublicDomain) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  } else {
    // If it's a public route but accessed via the admin domain -> REDIRECT TO ADMIN DASHBOARD
    const isAsset =
      pathname.startsWith("/_next") ||
      pathname.startsWith("/static") ||
      pathname.includes(".") ||
      isPublicApiRoute;

    if (isAdminDomain && !isAsset) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
