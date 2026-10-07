import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import userApi, { clearSession, saveSessionCache } from "../userApi";

// A tiny fake Django: rotating refresh tokens (old one dies on use, like
// ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION), Bearer-checked endpoints,
// and optional gates to hold a response back until the test releases it.
type Server = {
  access: string;
  refreshTokens: Set<string>;
  refreshCalls: number;
  hits: Record<string, number>;
  gates: Record<string, Promise<void>>;
  failFirst: Record<string, number>; // path -> status to return on its first hit
  onRefresh?: () => void; // runs when a refresh request reaches the server (simulate other tabs)
};

let server: Server;
let seq = 0;

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown = {}): Promise<AxiosResponse> {
  const response = { data, status, statusText: String(status), headers: {}, config } as AxiosResponse;
  if (status >= 400) {
    return Promise.reject(new AxiosError(`HTTP ${status}`, undefined, config, null, response));
  }
  return Promise.resolve(response);
}

async function fakeAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const path = new URL(config.url!, "http://test").pathname.replace(/^\/api/, "");
  server.hits[path] = (server.hits[path] ?? 0) + 1;

  if (path === "/auth/token/refresh/") {
    server.refreshCalls += 1;
    server.onRefresh?.();
    const { refresh } = JSON.parse(config.data);
    if (!server.refreshTokens.delete(refresh)) return reply(config, 401);
    const next = `refresh-${++seq}`;
    server.refreshTokens.add(next);
    server.access = `access-${++seq}`;
    return reply(config, 200, { access: server.access, refresh: next });
  }

  if (server.gates[path]) await server.gates[path];
  if (server.failFirst[path] && server.hits[path] === 1) return reply(config, server.failFirst[path]);
  if (String(config.headers?.Authorization ?? "") !== `Bearer ${server.access}`) return reply(config, 401);
  return reply(config, 200, { ok: true, path });
}

function expireAccess() {
  server.access = `access-${++seq}`; // client's stored token no longer matches
}

const realLocation = window.location;
let realUserAdapter: typeof userApi.defaults.adapter;
let realGlobalAdapter: typeof axios.defaults.adapter;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  server = { access: "access-0", refreshTokens: new Set(["refresh-0"]), refreshCalls: 0, hits: {}, gates: {}, failFirst: {} };
  localStorage.setItem("cinedb_access", "access-0");
  localStorage.setItem("cinedb_refresh", "refresh-0");
  realUserAdapter = userApi.defaults.adapter;
  realGlobalAdapter = axios.defaults.adapter;
  userApi.defaults.adapter = fakeAdapter;
  axios.defaults.adapter = fakeAdapter; // the interceptor refreshes via bare axios.post
  // jsdom can't navigate; capture the forced-logout redirect instead.
  Object.defineProperty(window, "location", { configurable: true, value: { href: "http://localhost/movies" } });
});

afterEach(() => {
  userApi.defaults.adapter = realUserAdapter;
  axios.defaults.adapter = realGlobalAdapter;
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
  jest.restoreAllMocks();
});

describe("token refresh", () => {
  it("stores the rotated refresh token", async () => {
    expireAccess();
    await userApi.get("/thing/");
    expect(server.refreshCalls).toBe(1);
    expect(localStorage.getItem("cinedb_refresh")).toBe([...server.refreshTokens][0]);
    expect(localStorage.getItem("cinedb_refresh")).not.toBe("refresh-0");
    expect(localStorage.getItem("cinedb_access")).toBe(server.access);
  });

  it("survives three consecutive access-token expiries without a logout", async () => {
    for (let i = 0; i < 3; i++) {
      expireAccess();
      await expect(userApi.get("/thing/")).resolves.toMatchObject({ status: 200 });
    }
    expect(server.refreshCalls).toBe(3);
    expect(window.location.href).not.toContain("/login");
  });

  it("forces logout and clears the session when the refresh itself is rejected", async () => {
    localStorage.setItem("cinedb_user", "{}");
    sessionStorage.setItem("cinedb_recommendations", "[]");
    server.refreshTokens.clear(); // stored refresh token is revoked
    expireAccess();
    await expect(userApi.get("/thing/")).rejects.toBeTruthy();
    expect(window.location.href).toBe("/login");
    expect(localStorage.getItem("cinedb_access")).toBeNull();
    expect(localStorage.getItem("cinedb_user")).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

describe("concurrent 401s", () => {
  it("a burst of five expired requests triggers exactly one refresh", async () => {
    expireAccess();
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => userApi.get(`/thing/${n}/`)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(server.refreshCalls).toBe(1);
  });

  it("a late 401 for a stale token is replayed without a second refresh", async () => {
    expireAccess();
    let release!: () => void;
    server.gates["/slow/"] = new Promise<void>((r) => (release = r));
    const slow = userApi.get("/slow/"); // goes out with the old token, held at the server

    await userApi.get("/thing/"); // 401 -> refresh -> new token stored
    expect(server.refreshCalls).toBe(1);

    delete server.gates["/slow/"];
    release(); // old-token response now arrives: 401, after the refresh finished
    await expect(slow).resolves.toMatchObject({ status: 200 });
    expect(server.refreshCalls).toBe(1);
    expect(window.location.href).not.toContain("/login");
  });
});

// A second browser tab: same localStorage, but its own module instance (and so
// its own in-tab isRefreshing/failedQueue), like a real separate page.
function openSecondTab(): typeof userApi {
  let tab!: typeof userApi;
  jest.isolateModules(() => {
    require("axios").default.defaults.adapter = fakeAdapter;
    tab = require("../userApi").default;
  });
  tab.defaults.adapter = fakeAdapter;
  return tab;
}

describe("refresh across tabs", () => {
  afterEach(() => {
    delete (navigator as { locks?: unknown }).locks;
  });

  it("two tabs expiring at once share one refresh when Web Locks exist", async () => {
    let tail = Promise.resolve();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (_name: string, fn: () => Promise<unknown>) => {
          const run = tail.then(() => fn());
          tail = run.then(() => undefined, () => undefined);
          return run;
        },
      },
    });
    const tabB = openSecondTab();
    expireAccess();
    const [a, b] = await Promise.all([userApi.get("/a/"), tabB.get("/b/")]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(server.refreshCalls).toBe(1);
    expect(window.location.href).not.toContain("/login");
  });

  it("without Web Locks, a rejected refresh adopts tokens another tab just rotated", async () => {
    expireAccess();
    server.onRefresh = () => {
      // The other tab won the race: our refresh-0 is now dead, its pair is stored.
      server.refreshTokens.delete("refresh-0");
      server.access = "access-other";
      localStorage.setItem("cinedb_access", "access-other");
      localStorage.setItem("cinedb_refresh", "refresh-other");
    };
    await expect(userApi.get("/thing/")).resolves.toMatchObject({ status: 200 });
    expect(window.location.href).not.toContain("/login");
    expect(localStorage.getItem("cinedb_refresh")).toBe("refresh-other");
  });

  it("waits for another tab's rotation that reaches this tab after the 401", async () => {
    // Chromium syncs localStorage across tabs asynchronously: the other tab's
    // rotation becomes visible here (with a storage event) after our 401.
    expireAccess();
    server.onRefresh = () => {
      server.refreshTokens.delete("refresh-0");
      server.access = "access-other";
      setTimeout(() => {
        localStorage.setItem("cinedb_access", "access-other");
        localStorage.setItem("cinedb_refresh", "refresh-other");
        window.dispatchEvent(new StorageEvent("storage", { key: "cinedb_refresh", newValue: "refresh-other" }));
      }, 200);
    };
    await expect(userApi.get("/thing/")).resolves.toMatchObject({ status: 200 });
    expect(window.location.href).not.toContain("/login");
  });

  it("does not adopt tokens that belong to a different user", async () => {
    localStorage.setItem("cinedb_user", JSON.stringify({ id: 1 }));
    expireAccess();
    server.onRefresh = () => {
      server.refreshTokens.delete("refresh-0");
      localStorage.setItem("cinedb_access", "access-user2");
      localStorage.setItem("cinedb_refresh", "refresh-user2");
      localStorage.setItem("cinedb_user", JSON.stringify({ id: 2 }));
    };
    await expect(userApi.get("/thing/")).rejects.toBeTruthy();
    expect(server.hits["/thing/"]).toBe(1); // never replayed with user 2's token
    expect(localStorage.getItem("cinedb_refresh")).toBe("refresh-user2"); // their session untouched
    expect(window.location.href).not.toContain("/login");
  });
});

describe("logout during an in-flight refresh", () => {
  it("drops the refresh result instead of signing the user back in", async () => {
    expireAccess();
    server.onRefresh = () => clearSession(); // user clicks Sign Out mid-refresh
    await expect(userApi.get("/thing/")).rejects.toBeTruthy();
    expect(server.refreshCalls).toBe(1);
    expect(localStorage.getItem("cinedb_access")).toBeNull();
    expect(localStorage.getItem("cinedb_refresh")).toBeNull();
    expect(window.location.href).not.toContain("/login"); // already logged out locally
  });
});

describe("saveSessionCache", () => {
  it("writes while signed in and is a no-op after teardown", () => {
    saveSessionCache("cinedb_recommendations", "A");
    expect(sessionStorage.getItem("cinedb_recommendations")).toBe("A");
    clearSession();
    saveSessionCache("cinedb_recommendations", "A again");
    expect(sessionStorage.getItem("cinedb_recommendations")).toBeNull();
  });
});

describe("retry on 500", () => {
  beforeEach(() => {
    // Skip the 2s back-off.
    jest.spyOn(global, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as unknown as typeof setTimeout);
  });

  it("retries a GET once", async () => {
    server.failFirst["/flaky/"] = 500;
    await expect(userApi.get("/flaky/")).resolves.toMatchObject({ status: 200 });
    expect(server.hits["/flaky/"]).toBe(2);
  });

  it("never retries a POST", async () => {
    server.failFirst["/lists/"] = 500;
    await expect(userApi.post("/lists/", { name: "x" })).rejects.toMatchObject({ response: { status: 500 } });
    expect(server.hits["/lists/"]).toBe(1);
  });
});

describe("device time zone header", () => {
  function captureHeaders() {
    const seen: Record<string, unknown>[] = [];
    userApi.defaults.adapter = (config) => {
      seen.push({ ...config.headers });
      return reply(config, 200, {});
    };
    return seen;
  }

  it("sends the device's IANA zone as X-Timezone", async () => {
    jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      ...new Intl.DateTimeFormat().resolvedOptions(),
      timeZone: "Asia/Kolkata",
    });
    const seen = captureHeaders();
    await userApi.get("/thing/");
    expect(seen[0]?.["X-Timezone"]).toBe("Asia/Kolkata");
  });

  it("omits the header when the zone can't be read", async () => {
    jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => {
      throw new Error("no Intl");
    });
    const seen = captureHeaders();
    await userApi.get("/thing/");
    expect(seen[0]).not.toHaveProperty("X-Timezone");
  });
});
