/**
 * Shared HTTP client utilities.
 *
 * Centralises auth headers and response handling so that every service
 * benefits from 401 auto-logout without duplicating the logic.
 */

import { api_base_url } from "@/environment";
import { getAccessToken, clearAuthStorage } from "@/lib/auth-storage";

export { api_base_url };

const isBrowser = typeof window !== "undefined";

export const jsonHeaders = { "Content-Type": "application/json" } as const;

export const withAuthorization = (extra?: Record<string, string>) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Missing session token");
  }
  return {
    ...jsonHeaders,
    ...extra,
    Authorization: `Bearer ${token}`,
  };
};

/** For multipart/form-data uploads — omits Content-Type so the browser sets the boundary. */
export const withAuthorizationMultipart = () => {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Missing session token");
  }
  return { Authorization: `Bearer ${token}` };
};

/**
 * Parses a fetch Response, throws on non-2xx, and handles 401 by clearing
 * auth state and redirecting to the appropriate login page.
 *
 * On login pages, 401 means bad credentials — we let the error propagate
 * naturally so the login form can display the server's message.
 */
export const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 401) {
    const isOnLoginPage =
      isBrowser &&
      (window.location.pathname.endsWith("/login") ||
        window.location.pathname === "/login");

    if (!isOnLoginPage) {
      clearAuthStorage();
      if (isBrowser) {
        // Redirect to the role-appropriate login page
        const { getLoginRouteForPath } = await import("@/lib/routing");
        window.location.href = getLoginRouteForPath(window.location.pathname);
      }
      throw new Error("Session expired. Please log in again.");
    }
    // On a login page: fall through so the actual error message is parsed below
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload && (payload.message || payload.error)) ||
      "Something went wrong. Please try again.";
    throw new Error(message as string);
  }
  return payload as T;
};
