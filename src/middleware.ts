import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Pass through if we're in development mode so localhost:3000 still works for everything
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const host = request.headers.get("host") || "";
  const adminDomain = process.env.ADMIN_SUBDOMAIN || "admin.localhost";
  // The public app domain, useful for redirecting back if needed. 
  // We match host directly rather than assuming what the public domain is, 
  // to support any public domain/alias seamlessly, but check against the explicit admin domain.

  const isAdminDomain = host === adminDomain;
  const isPublicDomain = !isAdminDomain;

  const url = request.nextUrl;
  const pathname = url.pathname;

  // Define which paths are strictly for the admin interface or admin API operations
  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/bookings/") ||      // Protects general admin booking APIs (note: public QR booking routes are /api/public/bookings)
    pathname.startsWith("/api/housekeeping/") ||  // Protects housekeeping routes
    pathname.startsWith("/api/payments/") ||      // Protects payment routes
    pathname.startsWith("/api/rbac/") ||          // Protects RBAC APIs
    pathname.startsWith("/api/receivables/") ||   // Protects receivables APIs
    pathname.startsWith("/api/reports/") ||       // Protects reports APIs
    pathname.startsWith("/api/restaurant/") ||    // Protects restaurant APIs
    pathname.startsWith("/api/rooms/") ||         // Protects room APIs
    pathname.startsWith("/api/settings/") ||      // Protects settings APIs
    pathname.startsWith("/api/shifts/") ||        // Protects shift APIs
    pathname.startsWith("/api/treasury/");        // Protects treasury APIs

  // Exclude some explicit public API routes that might otherwise match generic prefixes above
  const isPublicApiRoute = pathname.startsWith("/api/public/");

  if (isAdminRoute && !isPublicApiRoute) {
    // If it's an admin route but accessed via the public domain -> BLOCK
    if (isPublicDomain) {
      // Return 404 so they don't even know it exists
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  } else {
    // If it's a public route (frontend page, public assets) but accessed via the admin domain -> REDIRECT TO ADMIN DASHBOARD
    // Avoid redirecting Next.js internal paths or static assets, favicon etc.
    const isAsset = 
      pathname.startsWith("/_next") || 
      pathname.startsWith("/static") || 
      pathname.includes(".") || 
      isPublicApiRoute; // Optional: depending on if public APIs need to work on admin domain too

    if (isAdminDomain && !isAsset) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

// Config to ensure middleware only runs on relevant paths, improving performance
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
