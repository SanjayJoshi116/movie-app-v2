import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import userApi from "../api/userApi";

interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
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

  const login = async (username: string, password: string) => {
    const { data } = await userApi.post("/auth/login/", { username, password });
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const { data } = await userApi.post("/auth/register/", { username, email, password });
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("cinedb_access", data.access);
    localStorage.setItem("cinedb_refresh", data.refresh);
    localStorage.setItem("cinedb_user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("cinedb_access");
    localStorage.removeItem("cinedb_refresh");
    localStorage.removeItem("cinedb_user");
    setUser(null);
  };

  const updateProfile = async (data: ProfileUpdateData) => {
    const { data: updated } = await userApi.patch("/auth/profile/", data);
    localStorage.setItem("cinedb_user", JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: user !== null, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
