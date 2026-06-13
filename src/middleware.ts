import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_ADMIN_DOMAIN = "admin-dm.erniecodev.win";
const DEFAULT_PUBLIC_DOMAIN = "public-dm.erniecodev.win";
const ADMIN_PUBLIC_API_EXCEPTIONS = new Set([
  "/api/public/settings",
  "/api/public/discounts",
]);

function normalizeHostname(rawHost: string | null, fallback: string): string {
  const firstHost = (rawHost?.split(",")[0] || fallback).trim().toLowerCase();

  if (firstHost.startsWith("[")) {
    const closingBracket = firstHost.indexOf("]");
    return closingBracket > 0 ? firstHost.slice(1, closingBracket) : firstHost;
  }

  return firstHost.split(":")[0].replace(/\.$/, "");
}

function isLocalTestingHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "ts.net" ||
    hostname.endsWith(".ts.net")
  );
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isSharedAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png" ||
    pathname === "/placeholder.svg"
  );
}

function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/404", request.url));
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = normalizeHostname(
    request.headers.get("x-forwarded-host") || request.headers.get("host"),
    url.hostname,
  );
  const adminDomain = (process.env.ADMIN_SUBDOMAIN || DEFAULT_ADMIN_DOMAIN).toLowerCase();
  const publicDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN || DEFAULT_PUBLIC_DOMAIN).toLowerCase();

  if (isLocalTestingHost(hostname)) {
    return NextResponse.next();
  }

  // Next.js image optimization performs internal requests for framework assets.
  // These files contain no application routes or APIs and must remain host-agnostic.
  if (isSharedAssetPath(url.pathname)) {
    return NextResponse.next();
  }

  if (hostname === adminDomain) {
    if (url.pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (isAdminPath(url.pathname)) {
      return NextResponse.next();
    }

    if (url.pathname.startsWith("/api/")) {
      return url.pathname.startsWith("/api/public/") &&
        !ADMIN_PUBLIC_API_EXCEPTIONS.has(url.pathname)
        ? notFound(request)
        : NextResponse.next();
    }

    return notFound(request);
  }

  if (hostname === publicDomain) {
    if (isAdminPath(url.pathname)) {
      return notFound(request);
    }

    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/public/")) {
      return notFound(request);
    }

    return NextResponse.next();
  }

  return notFound(request);
}

export const config = {
  matcher: "/:path*",
};
