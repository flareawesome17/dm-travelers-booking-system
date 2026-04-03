import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type AdminFetchInput = RequestInfo | URL;

export function redirectToAdminLogin(router?: AppRouterInstance) {
  if (!router) {
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
    return;
  }

  router.replace("/admin/login");
  router.refresh();
}

export function adminFetch(input: AdminFetchInput, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const hasBody = init.body != null && !(init.body instanceof FormData);

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });
}

export async function adminFetchOrRedirect(
  router: AppRouterInstance,
  input: AdminFetchInput,
  init: RequestInit = {},
) {
  const res = await adminFetch(input, init);
  if (res.status === 401) {
    redirectToAdminLogin(router);
  }
  return res;
}

export async function requireAdminSession(router: AppRouterInstance) {
  try {
    const res = await adminFetch("/api/admin/session", { cache: "no-store" });
    if (res.ok) {
      return true;
    }
  } catch {
    // fall through to redirect
  }

  redirectToAdminLogin(router);
  return false;
}
