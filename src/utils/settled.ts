import type { AxiosError } from "axios";

/** The response body of a fulfilled `Promise.allSettled` entry, or undefined if it rejected. */
export function settledData<T>(r: PromiseSettledResult<{ data: T }>): T | undefined {
  return r.status === "fulfilled" ? r.value.data : undefined;
}

/** True when a request failed because the resource doesn't exist (HTTP 404). */
export function isNotFound(err: unknown): boolean {
  return (err as AxiosError | undefined)?.response?.status === 404;
}
