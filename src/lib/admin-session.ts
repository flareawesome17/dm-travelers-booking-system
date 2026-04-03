export const ADMIN_SESSION_SYNC_KEY = "admin_session_sync";
export const ADMIN_SESSION_SYNC_CHANNEL = "admin-session";

export type AdminSessionSyncEvent =
  | {
      type: "activity";
      at: number;
      source: string;
    }
  | {
      type: "logout";
      at: number;
      source: string;
    };

export interface AdminSessionSnapshot {
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    role_id: number | null;
    role_label: string | null;
  };
  expires_at: string | null;
}

export function getAdminRoleLabel(roleId: number | null): string | null {
  if (roleId === 1) return "Super Admin";
  if (roleId === 2) return "Manager";
  if (roleId === 3) return "Staff";
  if (roleId === 4) return "Housekeeping";
  return null;
}

export function createAdminSessionSnapshot(payload: {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
  role_id?: unknown;
  exp?: unknown;
}): AdminSessionSnapshot {
  const roleId =
    typeof payload.role_id === "number"
      ? payload.role_id
      : Number(payload.role_id);

  const expiresAt =
    typeof payload.exp === "number"
      ? new Date(payload.exp * 1000).toISOString()
      : null;

  return {
    user: {
      id: typeof payload.sub === "string" ? payload.sub : null,
      name: typeof payload.name === "string" ? payload.name : null,
      email: typeof payload.email === "string" ? payload.email : null,
      role_id: Number.isFinite(roleId) ? roleId : null,
      role_label: getAdminRoleLabel(Number.isFinite(roleId) ? roleId : null),
    },
    expires_at: expiresAt,
  };
}

export function isAdminSessionSyncEvent(value: unknown): value is AdminSessionSyncEvent {
  if (!value || typeof value !== "object") return false;

  const event = value as Partial<AdminSessionSyncEvent>;
  return (
    (event.type === "activity" || event.type === "logout") &&
    typeof event.at === "number" &&
    Number.isFinite(event.at) &&
    typeof event.source === "string" &&
    event.source.length > 0
  );
}
