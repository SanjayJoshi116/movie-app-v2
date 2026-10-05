import { ReactNode, useEffect } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import { publicApi, saveSessionCache } from "../../api/userApi";
import { useRecentSearches } from "../../hooks/useRecentSearches";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const USER = { id: 1, username: "a", email: "a@x.test", first_name: "", last_name: "", is_staff: false, avatar_url: null };

let realAdapter: typeof publicApi.defaults.adapter;
let logoutBodies: unknown[];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("cinedb_access", "access-a");
  localStorage.setItem("cinedb_refresh", "refresh-a");
  localStorage.setItem("cinedb_user", JSON.stringify(USER));
  localStorage.setItem("cinedb_recent_searches", JSON.stringify(["user A query"]));
  localStorage.setItem("cinedb_theme", JSON.stringify("light"));
  sessionStorage.setItem("cinedb_recommendations", "[{\"cached\":\"A\"}]");
  sessionStorage.setItem("search-cache:dune", "[]");

  logoutBodies = [];
  realAdapter = publicApi.defaults.adapter;
  // Server unreachable: the logout call fails, local logout must still complete.
  publicApi.defaults.adapter = async (config) => {
    logoutBodies.push(JSON.parse(config.data));
    throw new Error("Network Error");
  };
});

afterEach(() => {
  publicApi.defaults.adapter = realAdapter;
});

function renderSession() {
  return renderHook(() => ({ auth: useAuth(), recent: useRecentSearches() }), { wrapper });
}

describe("logout teardown", () => {
  it("clears account data, keeps device prefs, and survives a failed logout call", async () => {
    const { result } = renderSession();
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));

    await act(async () => {
      result.current.auth.logout();
    });

    expect(result.current.auth.user).toBeNull();
    expect(logoutBodies).toEqual([{ refresh: "refresh-a" }]);
    for (const key of ["cinedb_access", "cinedb_refresh", "cinedb_user"]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem("cinedb_theme")).toBe(JSON.stringify("light"));
  });

  it("drops the in-memory recent searches so the next account doesn't see them", async () => {
    const { result } = renderSession();
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));
    expect(result.current.recent.recents).toEqual(["user A query"]);

    await act(async () => {
      result.current.auth.logout();
    });

    expect(result.current.recent.recents).toEqual([]);
  });

  it("a page that caches on unmount can't write data back during logout", async () => {
    // Mirrors RecommendationsPage/SearchPage: save a cache in the unmount cleanup,
    // rendered only while signed in (ProtectedRoute), so logout unmounts it.
    let mounted = false;
    function CachingPage() {
      useEffect(() => {
        mounted = true;
        return () => saveSessionCache("cinedb_recommendations", "user A recs");
      }, []);
      return null;
    }
    function Gate() {
      return useAuth().isAuthenticated ? <CachingPage /> : null;
    }
    let logout!: () => void;
    function Grab() {
      logout = useAuth().logout;
      return null;
    }
    render(<AuthProvider><Gate /><Grab /></AuthProvider>);
    await waitFor(() => expect(mounted).toBe(true));

    await act(async () => {
      logout();
    });

    expect(sessionStorage.getItem("cinedb_recommendations")).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps recent searches on a normal page load (auth still loading)", async () => {
    const { result } = renderSession();
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true));
    expect(result.current.recent.recents).toEqual(["user A query"]);
  });
});
