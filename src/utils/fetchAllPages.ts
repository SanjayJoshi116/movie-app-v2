import type { AxiosInstance } from "axios";
import type { Paginated } from "../types";

/** Page size the large library lists (watched, watchlist, ratings) ask for;
 *  the API caps client page sizes at this value. */
export const LIBRARY_PAGE_SIZE = 500;

export async function fetchAllPages<T>(
  api: AxiosInstance,
  url: string,
  { pageSize }: { pageSize?: number } = {},
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  for (;;) {
    const params = pageSize ? { page, page_size: pageSize } : { page };
    const { data } = await api.get<Paginated<T> | T[]>(url, { params });
    if (Array.isArray(data)) {
      results.push(...data);
      break;
    }
    results.push(...data.results);
    if (!data.next) break;
    page += 1;
  }
  return results;
}
