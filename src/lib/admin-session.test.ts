import { describe, expect, it } from "vitest";
import {
  createAdminSessionSnapshot,
  getAdminRoleLabel,
  isAdminSessionSyncEvent,
} from "@/lib/admin-session";

describe("admin-session", () => {
  it("builds a safe session snapshot from jwt payload fields", () => {
    expect(
      createAdminSessionSnapshot({
        sub: "admin-1",
        name: "Front Desk Manager",
        email: "frontdesk@example.com",
        role_id: "2",
        exp: 1_700_000_000,
      }),
    ).toEqual({
      user: {
        id: "admin-1",
        name: "Front Desk Manager",
        email: "frontdesk@example.com",
        role_id: 2,
        role_label: "Manager",
      },
      expires_at: "2023-11-14T22:13:20.000Z",
    });
  });

  it("rejects malformed sync events", () => {
    expect(isAdminSessionSyncEvent({ type: "activity", at: Date.now(), source: "tab-a" })).toBe(true);
    expect(isAdminSessionSyncEvent({ type: "logout", at: Date.now(), source: "tab-b" })).toBe(true);
    expect(isAdminSessionSyncEvent({ type: "logout", at: "now", source: "tab-b" })).toBe(false);
    expect(isAdminSessionSyncEvent({ type: "token", at: Date.now(), source: "tab-c" })).toBe(false);
  });

  it("maps known admin roles", () => {
    expect(getAdminRoleLabel(1)).toBe("Super Admin");
    expect(getAdminRoleLabel(4)).toBe("Housekeeping");
    expect(getAdminRoleLabel(99)).toBeNull();
  });
});
