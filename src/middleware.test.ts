import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const ADMIN_DOMAIN = "admin-dm.erniecodev.win";
const PUBLIC_DOMAIN = "public-dm.erniecodev.win";

function request(pathname: string, host: string, forwardedHost = host) {
  return new NextRequest(`http://origin.internal${pathname}`, {
    headers: {
      host,
      "x-forwarded-host": forwardedHost,
    },
  });
}

function expectAllowed(response: Response) {
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("x-middleware-rewrite")).toBeNull();
}

function expectNotFound(response: Response) {
  expect(response.headers.get("x-middleware-rewrite")).toBe(
    "http://origin.internal/404",
  );
}

describe("hostname routing middleware", () => {
  beforeEach(() => {
    process.env.ADMIN_SUBDOMAIN = ADMIN_DOMAIN;
    process.env.NEXT_PUBLIC_APP_DOMAIN = PUBLIC_DOMAIN;
  });

  it("redirects the admin hostname root to the admin application", () => {
    const response = middleware(request("/", ADMIN_DOMAIN));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://origin.internal/admin");
  });

  it("allows admin pages and internal APIs only on the admin hostname", () => {
    expectAllowed(middleware(request("/admin/login", ADMIN_DOMAIN)));
    expectAllowed(middleware(request("/api/admin/session", ADMIN_DOMAIN)));
    expectAllowed(middleware(request("/api/bookings", ADMIN_DOMAIN)));
  });

  it("blocks public pages and non-required public APIs on the admin hostname", () => {
    expectNotFound(middleware(request("/rooms", ADMIN_DOMAIN)));
    expectNotFound(middleware(request("/booking", ADMIN_DOMAIN)));
    expectNotFound(middleware(request("/api/public/room-types", ADMIN_DOMAIN)));
  });

  it("keeps the public settings and discounts reads used by admin screens", () => {
    expectAllowed(middleware(request("/api/public/settings", ADMIN_DOMAIN)));
    expectAllowed(middleware(request("/api/public/discounts", ADMIN_DOMAIN)));
  });

  it("allows public pages and public APIs on the public hostname", () => {
    expectAllowed(middleware(request("/", PUBLIC_DOMAIN)));
    expectAllowed(middleware(request("/booking", PUBLIC_DOMAIN)));
    expectAllowed(middleware(request("/api/public/settings", PUBLIC_DOMAIN)));
  });

  it("blocks admin and internal APIs on the public hostname", () => {
    expectNotFound(middleware(request("/admin", PUBLIC_DOMAIN)));
    expectNotFound(middleware(request("/admin/login", PUBLIC_DOMAIN)));
    expectNotFound(middleware(request("/api/admin/session", PUBLIC_DOMAIN)));
    expectNotFound(middleware(request("/api/bookings", PUBLIC_DOMAIN)));
  });

  it("blocks unknown, legacy, subdomain, and direct LAN hosts", () => {
    expectNotFound(middleware(request("/", "unknown.erniecodev.win")));
    expectNotFound(middleware(request("/", "admindm.erniecodev.win")));
    expectNotFound(middleware(request("/", `extra.${ADMIN_DOMAIN}`)));
    expectNotFound(middleware(request("/", "192.168.1.50:3000")));
  });

  it("allows framework assets needed by Next.js image optimization", () => {
    expectAllowed(
      middleware(
        request(
          "/_next/static/media/hero.jpg",
          "unknown.erniecodev.win",
        ),
      ),
    );
    expectAllowed(
      middleware(
        request(
          "/_next/image?url=%2Fhero.jpg&w=1920&q=75",
          PUBLIC_DOMAIN,
        ),
      ),
    );
  });

  it("preserves localhost, IPv6 localhost, and Tailscale testing", () => {
    expectAllowed(middleware(request("/admin", "localhost:3000")));
    expectAllowed(middleware(request("/rooms", "[::1]:3000")));
    expectAllowed(middleware(request("/admin", "dm-server.tail123.ts.net")));
  });

  it("uses the first normalized forwarded hostname", () => {
    expectAllowed(
      middleware(
        request(
          "/admin",
          "origin.internal",
          ` ${ADMIN_DOMAIN.toUpperCase()}:443, proxy.internal`,
        ),
      ),
    );
  });
});
