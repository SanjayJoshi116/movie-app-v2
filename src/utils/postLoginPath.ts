import { matchPath } from "react-router-dom";

/** Pages meant for signed-out users; a signed-in user is sent on from them. */
const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

const DEFAULT_PATH = "/movies";

/** Whether a pathname opens one of the signed-out-only pages, matched the
 *  way <Routes> matches (case-insensitive, trailing slash ignored): an exact
 *  string check let `/login/` show the sign-in form to a signed-in user. */
export function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PATHS.some((path) => matchPath(path, pathname) !== null);
}

/** Password-reset links, public whether or not anyone is signed in. */
export function isResetPasswordPath(pathname: string): boolean {
  return matchPath("/reset-password/*", pathname) !== null;
}

/**
 * Where to go after signing in (or when a signed-in user opens an auth page):
 * the location the auth guard redirected from — path, query string and hash,
 * e.g. /search?tab=people — or Movies. An auth page as `from` would loop, so it
 * falls back to Movies too.
 */
export function postLoginPath(state: unknown): string {
  const from = (state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  if (!from?.pathname || isAuthOnlyPath(from.pathname)) return DEFAULT_PATH;
  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
}

/**
 * The state the route guard sends to /login. It carries the page to return
 * to, except after a sign-out in this tab: whoever signs in next may be
 * someone else, and the previous account's page (a list id, a search query)
 * isn't theirs. Opening a protected link while signed out still returns there.
 */
export function loginRedirectState(from: unknown, signedOutInThisTab: boolean | undefined): { from: unknown } | null {
  return signedOutInThisTab ? null : { from };
}

