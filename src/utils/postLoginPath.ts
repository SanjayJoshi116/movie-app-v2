/** Pages meant for signed-out users; a signed-in user is sent on from them. */
export const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

const DEFAULT_PATH = "/movies";

/**
 * Where to go after signing in (or when a signed-in user opens an auth page):
 * the location the auth guard redirected from — path, query string and hash,
 * e.g. /search?tab=people — or Movies. An auth page as `from` would loop, so it
 * falls back to Movies too.
 */
export function postLoginPath(state: unknown): string {
  const from = (state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  if (!from?.pathname || AUTH_ONLY_PATHS.includes(from.pathname)) return DEFAULT_PATH;
  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
}
