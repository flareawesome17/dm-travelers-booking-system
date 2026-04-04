import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Subdomain-based admin isolation is disabled for now.
  // The admin panel is accessible at /admin on the main domain.
  // Admin routes are still fully protected by server-side auth (layout.tsx + RBAC).
  // 
  // To re-enable subdomain routing later:
  // 1. Add admin.dm.erniecodev.win as a custom domain in Firebase App Hosting console
  // 2. Wait for SSL certificate provisioning (can take up to 60 min)
  // 3. Set up DNS CNAME record for admin.dm.erniecodev.win
  // 4. Uncomment the subdomain routing logic below

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
