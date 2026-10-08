import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { fetchMovieDetails, tmdbApi } from "../tmdb";

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
  beforeEach(() => {
    localStorage.setItem("cinedb_access", "expired");
    localStorage.setItem("cinedb_refresh", "refresh-1");
    localStorage.setItem("cinedb_user", JSON.stringify({ id: 1 }));
  });

  test("is retried once without the token and resolves", async () => {
    statuses = [401, 200];
    const res = await fetchMovieDetails(550);
    expect(res.data).toEqual({ id: 550 });
    expect(calls.map((c) => c.authorization)).toEqual(["Bearer expired", undefined]);
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
    expect(localStorage.getItem("cinedb_access")).toBe("expired");
    expect(localStorage.getItem("cinedb_refresh")).toBe("refresh-1");
    expect(localStorage.getItem("cinedb_user")).not.toBeNull();
    expect(window.location.pathname).toBe(path);
  });
});
