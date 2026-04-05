import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  const adminDomain = process.env.ADMIN_SUBDOMAIN; // e.g. admindm.erniecodev.win
  const publicDomain = process.env.NEXT_PUBLIC_APP_DOMAIN; // e.g. dm.erniecodev.win

  // Ignore localhost and development hostnames so dev server is unaffected
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1") || hostname.includes("ts.net")) {
    return NextResponse.next();
  }

  // Admin Domain Logic
  if (adminDomain && hostname === adminDomain) {
    // If they explicitly type /admin in the URL (e.g. admindm.../admin/bookings),
    // redirect them to the clean root-level URL to enforce strict separation.
    if (url.pathname.startsWith("/admin")) {
      const cleanPath = url.pathname.replace("/admin", "") || "/";
      return NextResponse.redirect(new URL(cleanPath, request.url));
    }

    // Rewrite all remaining traffic internally to the /admin folder
    url.pathname = `/admin${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Public Domain Logic
  if (publicDomain && hostname === publicDomain) {
    // Strictly isolate the admin panel.
    // If anyone tries to access /admin on the public site, act as if it doesn't exist.
    if (url.pathname.startsWith("/admin")) {
      url.pathname = "/404";
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
