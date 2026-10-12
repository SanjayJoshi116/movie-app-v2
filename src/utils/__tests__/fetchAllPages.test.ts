import axios, { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { fetchAllPages, LIBRARY_PAGE_SIZE } from "../fetchAllPages";

type Page = { results: { id: number }[]; next: number | null } | { id: number }[];

function client(pages: Page[]) {
  const params: Record<string, unknown>[] = [];
  const api = axios.create();
  api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    params.push(config.params);
    const body = pages[params.length - 1];
    return Promise.resolve({ data: body, status: 200, statusText: "OK", headers: {}, config } as AxiosResponse);
  };
  return { api, params };
}

const rows = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i }));

test("follows `next` past page 1 and returns every row once", async () => {
  const { api, params } = client([
    { results: rows(1, 3), next: 2 },
    { results: rows(4, 6), next: 3 },
    { results: rows(7, 7), next: null },
  ]);
  const all = await fetchAllPages<{ id: number }>(api, "/watched/");
  expect(all.map((r) => r.id)).toEqual(rows(1, 7).map((r) => r.id));
  expect(params).toEqual([{ page: 1 }, { page: 2 }, { page: 3 }]);
});

test("sends the requested page size with every page", async () => {
  const { api, params } = client([{ results: rows(1, 2), next: 2 }, { results: rows(3, 3), next: null }]);
  await fetchAllPages(api, "/watched/", { pageSize: LIBRARY_PAGE_SIZE });
  expect(params).toEqual([{ page: 1, page_size: 500 }, { page: 2, page_size: 500 }]);
});

test("accepts a bare array response", async () => {
  const { api, params } = client([rows(1, 2)]);
  expect(await fetchAllPages(api, "/x/")).toEqual(rows(1, 2));
  expect(params).toHaveLength(1);
});
