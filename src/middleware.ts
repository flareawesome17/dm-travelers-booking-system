import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  let hostname = request.headers.get("host") || "";
  hostname = hostname.split(":")[0]; // Strip port to ensure exact match

  // Fallback to hardcoded domains if env vars are missing in Edge runtime
  const adminDomain = process.env.ADMIN_SUBDOMAIN || "admindm.erniecodev.win";
  const publicDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "dm.erniecodev.win";

  // Ignore localhost and development hostnames so dev server is unaffected
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1") || hostname.includes("ts.net")) {
    return NextResponse.next();
  }

  // Admin Domain Logic
  // Any hit on the root of the admin domain immediately redirects strictly to the /admin route.
  if (hostname === adminDomain) {
    if (url.pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Public Domain Logic
  // Any hit accessing /admin on the public domain gets physically redirected to the exact same path on the Admin Domain.
  if (hostname === publicDomain) {
    if (url.pathname.startsWith("/admin")) {
      return NextResponse.redirect(`https://${adminDomain}${url.pathname}`);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
