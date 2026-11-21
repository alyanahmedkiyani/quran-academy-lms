export const base_path = "/";
export const img_path = "/";
export const api_base_url = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";
// Base URL for media/static files — strips trailing /api safely (anchored to end only)
export const media_base_url = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? api_base_url.replace(/\/api$/, "");
export const socket_url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:8080";
export const meeting_url = process.env.NEXT_PUBLIC_MEETING_URL ?? "http://localhost:8080/join";
// Calling-app (MiroTalk SFU) — used for iframe src
export const calling_app_url = process.env.NEXT_PUBLIC_CALLING_APP_URL ?? "http://localhost:3010";

// Resolves a profile/media image path from the API: passes absolute URLs
// (e.g. seeded randomuser.me portraits) through unchanged, and prefixes
// server-relative paths (e.g. "resources/profiles/x.jpg") with api_base_url.
export const resolveImageUrl = (path?: string | null): string => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${api_base_url}/${path}`;
};
