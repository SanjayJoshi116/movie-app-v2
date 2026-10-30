import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import userApi, {
  bindSessionUser, clearSession, currentSessionGeneration, isCurrentSession, logoutSession, publicApi,
  SessionEndedError,
} from "../api/userApi";
import type { AuthUser } from "../types/domain";

export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login(username: string, password: string): Promise<void>;
  register(username: string, email: string, password: string): Promise<void>;
  logout(): void;
  updateProfile(data: ProfileUpdateData): Promise<void>;
  /** Stores the signed-in user's updated profile. Ignored (returns false) when
   *  `updated` isn't the account this tab shows, e.g. a slow avatar upload
   *  answered after a sign-out and someone else's sign-in. */
  setUserData(updated: AuthUser): boolean;
  /** True after this tab went from signed in to signed out (sign-out, account
   *  deletion, or a sign-out in another tab) until the next sign-in. The route
   *  guard then doesn't carry the last page into the next sign-in, which may
   *  be someone else's. A forced logout reloads the tab, so it stays false and
   *  keeps its return path. Optional only so test doubles can leave it out. */
  signedOutInThisTab?: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const OLD_KEYS = ["cinedb_watchlist", "cinedb_watched", "cinedb_ratings", "cinedb_lists"];

/** The signed-in user per localStorage, or null when there's no full session. */
function readStoredUser(): AuthUser | null {
  const stored = localStorage.getItem("cinedb_user");
  if (!stored || !localStorage.getItem("cinedb_access")) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signedOutInThisTab, setSignedOutInThisTab] = useState(false);
  const userRef = useRef<AuthUser | null>(null);

  // Every user change goes through here, so userApi's request guard always
  // knows which account this tab shows before the next request can go out.
  const setUser = useCallback((next: AuthUser | null) => {
    if (next) setSignedOutInThisTab(false);
    else if (userRef.current) setSignedOutInThisTab(true);
    userRef.current = next;
    bindSessionUser(next?.id ?? null);
    setUserState(next);
  }, []);

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, [setUser]);

  // Another tab signed in, signed out or edited the profile. The library
  // hooks only refetch when isAuthenticated flips, so a switch straight from
  // one account to another reloads the tab rather than leaving any of the
  // previous account's state (or history state) behind.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== "cinedb_user" && e.key !== "cinedb_access") return;
      const current = userRef.current;
      const next = readStoredUser();
      if (!next) {
        if (current) {
          sessionStorage.clear(); // this tab's caches are the signed-out account's
          setUser(null);
        }
      } else if (!current) {
        setUser(next);
      } else if (next.id !== current.id) {
        sessionStorage.clear();
        bindSessionUser(-1); // nothing goes out before the reload lands
        window.location.reload();
      } else if (JSON.stringify(next) !== JSON.stringify(current)) {
        setUser(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setUser]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await publicApi.post("/auth/login/", { username, password });
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
    setUser(data.user);
  }, [setUser]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { data } = await publicApi.post("/auth/register/", { username, email, password });
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
    setUser(data.user);
  }, [setUser]);

  const logout = useCallback(() => {
    // Revoke server-side, but never let that block or fail the local logout
    // (offline, expired/invalid token, server down all still sign out here).
    const refresh = localStorage.getItem("cinedb_refresh");
    if (refresh) logoutSession(refresh).catch(() => {});
    clearSession();
    setUser(null);
  }, [setUser]);

  const setUserData = useCallback((updated: AuthUser) => {
    if (updated.id !== userRef.current?.id) return false;
    localStorage.setItem("cinedb_user", JSON.stringify(updated));
    setUser(updated);
    return true;
  }, [setUser]);

  const updateProfile = useCallback(async (data: ProfileUpdateData) => {
    const gen = currentSessionGeneration();
    const { data: body } = await userApi.patch("/auth/profile/", data);
    // Answered after a sign-out (and maybe someone else's sign-in): its tokens
    // and user are the previous account's, so storing them would hand it over.
    // Rejects (SessionEndedError) rather than resolving, so the caller doesn't
    // report a save this tab threw away.
    if (!isCurrentSession(gen) || body.id !== userRef.current?.id) throw new SessionEndedError();
    // A password change revokes every existing refresh token server-side and
    // returns a fresh pair for this session — store it, or the next refresh fails.
    const { access, refresh, ...updated } = body;
    if (access) localStorage.setItem("cinedb_access", access);
    if (refresh) localStorage.setItem("cinedb_refresh", refresh);
    setUserData(updated);
  }, [setUserData]);

  const value = useMemo<AuthContextType>(
    () => ({ user, isLoading, isAuthenticated: user !== null, login, register, logout, updateProfile, setUserData, signedOutInThisTab }),
    [user, isLoading, login, register, logout, updateProfile, setUserData, signedOutInThisTab]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
