import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import userApi, { clearSession, logoutSession, publicApi } from "../api/userApi";

interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  avatar_url: string | null;
}

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
  setUserData(updated: AuthUser): void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const OLD_KEYS = ["cinedb_watchlist", "cinedb_watched", "cinedb_ratings", "cinedb_lists"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("cinedb_user");
    const token = localStorage.getItem("cinedb_access");
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await publicApi.post("/auth/login/", { username, password });
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { data } = await publicApi.post("/auth/register/", { username, email, password });
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    // Revoke server-side, but never let that block or fail the local logout
    // (offline, expired/invalid token, server down all still sign out here).
    const refresh = localStorage.getItem("cinedb_refresh");
    if (refresh) logoutSession(refresh).catch(() => {});
    clearSession();
    setUser(null);
  }, []);

  const setUserData = useCallback((updated: AuthUser) => {
    localStorage.setItem("cinedb_user", JSON.stringify(updated));
    setUser(updated);
  }, []);

  const updateProfile = useCallback(async (data: ProfileUpdateData) => {
    const { data: body } = await userApi.patch("/auth/profile/", data);
    // A password change revokes every existing refresh token server-side and
    // returns a fresh pair for this session — store it, or the next refresh fails.
    const { access, refresh, ...updated } = body;
    if (access) localStorage.setItem("cinedb_access", access);
    if (refresh) localStorage.setItem("cinedb_refresh", refresh);
    setUserData(updated);
  }, [setUserData]);

  const value = useMemo<AuthContextType>(
    () => ({ user, isLoading, isAuthenticated: user !== null, login, register, logout, updateProfile, setUserData }),
    [user, isLoading, login, register, logout, updateProfile, setUserData]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
