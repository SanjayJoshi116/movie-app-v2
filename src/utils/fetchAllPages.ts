import type { AxiosInstance } from "axios";
import type { Paginated } from "../types";

export async function fetchAllPages<T>(api: AxiosInstance, url: string): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  for (;;) {
    const { data } = await api.get<Paginated<T> | T[]>(url, { params: { page } });
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
