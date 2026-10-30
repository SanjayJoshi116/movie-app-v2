import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { fetchMovieDetails, fetchPopularPeople, tmdbApi } from "../tmdb";
import { bindSessionUser } from "../userApi";

type Call = { url?: string; authorization?: string };

let calls: Call[];
let statuses: number[]; // status per call, in order; the last one repeats
const realAdapter = tmdbApi.defaults.adapter;

function adapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const authorization = config.headers?.Authorization as string | undefined;
  calls.push({ url: config.url, authorization });
  const status = statuses[Math.min(calls.length - 1, statuses.length - 1)] ?? 200;
  const response = { data: { id: 550 }, status, statusText: String(status), headers: {}, config } as AxiosResponse;
  if (status >= 400) return Promise.reject(new AxiosError(`HTTP ${status}`, undefined, config, null, response));
  return Promise.resolve(response);
}

beforeEach(() => {
  calls = [];
  statuses = [200];
  localStorage.clear();
  tmdbApi.defaults.adapter = adapter;
});

afterAll(() => {
  tmdbApi.defaults.adapter = realAdapter;
});

test("attaches the stored access token", async () => {
  localStorage.setItem("cinedb_access", "tok-1");
  await fetchMovieDetails(550);
  expect(calls).toEqual([{ url: "/movie/550", authorization: "Bearer tok-1" }]);
});

test("sends no token when signed out", async () => {
  await fetchMovieDetails(550);
  expect(calls).toEqual([{ url: "/movie/550", authorization: undefined }]);
});

describe("a 401 (expired token on a public endpoint)", () => {
  // A fresh token per test: a refused one is remembered for the page's life.
  let expired = "";
  let n = 0;
  beforeEach(() => {
    expired = `expired-${++n}`;
    localStorage.setItem("cinedb_access", expired);
    localStorage.setItem("cinedb_refresh", "refresh-1");
    localStorage.setItem("cinedb_user", JSON.stringify({ id: 1 }));
  });

  test("is retried once without the token and resolves", async () => {
    statuses = [401, 200];
    const res = await fetchMovieDetails(550);
    expect(res.data).toEqual({ id: 550 });
    expect(calls.map((c) => c.authorization)).toEqual([`Bearer ${expired}`, undefined]);
  });

  test("a second 401 rejects without another retry", async () => {
    statuses = [401, 401];
    await expect(fetchMovieDetails(550)).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls).toHaveLength(2);
  });

  test("never ends the session", async () => {
    const path = window.location.pathname;
    statuses = [401, 401];
    await expect(fetchMovieDetails(550)).rejects.toBeTruthy();
    expect(localStorage.getItem("cinedb_access")).toBe(expired);
    expect(localStorage.getItem("cinedb_refresh")).toBe("refresh-1");
    expect(localStorage.getItem("cinedb_user")).not.toBeNull();
    expect(window.location.pathname).toBe(path);
  });
});

describe("identical requests in flight", () => {
  test("share one request and both resolve", async () => {
    const [a, b] = await Promise.all([fetchPopularPeople(1), fetchPopularPeople(1)]);
    expect(calls).toHaveLength(1);
    expect(a.data).toEqual({ id: 550 });
    expect(b).toBe(a);
  });

  test("a request after the first settled is sent again", async () => {
    await fetchPopularPeople(1);
    await fetchPopularPeople(1);
    expect(calls).toHaveLength(2);
  });

  test("different params are separate requests", async () => {
    await Promise.all([fetchPopularPeople(1), fetchPopularPeople(2)]);
    expect(calls).toHaveLength(2);
  });

  test("a failure reaches every waiter and is not kept", async () => {
    statuses = [404, 200];
    const results = await Promise.allSettled([fetchPopularPeople(1), fetchPopularPeople(1)]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(calls).toHaveLength(1);
    await expect(fetchPopularPeople(1)).resolves.toMatchObject({ status: 200 });
    expect(calls).toHaveLength(2);
  });
});

describe("fix-session-sweep-f1: only this tab's token, once per token", () => {
  beforeEach(() => {
    localStorage.setItem("cinedb_refresh", "refresh-1");
    localStorage.setItem("cinedb_user", JSON.stringify({ id: 1 }));
  });

  test("an expired token is sent once; later calls go without it until a new one is stored", async () => {
    localStorage.setItem("cinedb_access", "stale-once");
    statuses = [401, 200];
    await fetchMovieDetails(550);
    await fetchPopularPeople(1);
    await fetchPopularPeople(2);
    expect(calls.map((c) => c.authorization)).toEqual(["Bearer stale-once", undefined, undefined, undefined]);

    localStorage.setItem("cinedb_access", "fresh");
    await fetchPopularPeople(3);
    expect(calls[calls.length - 1]?.authorization).toBe("Bearer fresh");
  });

  test("another account's token is never sent from this tab", async () => {
    localStorage.setItem("cinedb_access", "tok-of-b");
    localStorage.setItem("cinedb_user", JSON.stringify({ id: 2 }));
    bindSessionUser(1); // this tab still shows account 1
    try {
      await fetchPopularPeople(4);
    } finally {
      bindSessionUser(null);
    }
    expect(calls[calls.length - 1]?.authorization).toBeUndefined();
  });
});
