import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // Use x-forwarded-host for proxies (like Firebase/Vercel), fallback to host header, fallback to nextUrl.hostname
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  let rawHostname = forwardedHost || hostHeader || url.hostname || "";
  
  // Strip port
  let hostname = rawHostname.split(":")[0]; 

  // Hardcode defaults to ensure edge runtimes don't fail if env is missing
  const adminDomain = process.env.ADMIN_SUBDOMAIN || "admindm.erniecodev.win";
  const publicDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "dm.erniecodev.win";

  // Prevent routing interception on direct localhost testing
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes("ts.net")) {
    return NextResponse.next();
  }

  // Admin Domain Logic
  if (hostname === adminDomain || hostname.endsWith(`.${adminDomain}`)) {
    if (url.pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Public Domain Logic
  if (hostname === publicDomain || hostname.endsWith(`.${publicDomain}`)) {
    if (url.pathname.startsWith("/admin")) {
      // Force rewrite to 404 so the admin panel is completely invisible and inaccessible directly on the public domain
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
