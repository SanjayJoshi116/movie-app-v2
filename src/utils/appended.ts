// Shape guards for the parts of a TMDB `append_to_response` detail response.
// Any part can be missing or malformed; each section then renders empty
// instead of the page failing (load-states: "Detail pages degrade per section").

/** `value` if it's an array, otherwise []. */
export function arrayOr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** A part's `results` array (paginated lists, videos, release dates), or []. */
export function resultsOf<T>(part: unknown): T[] {
  return arrayOr<T>((part as { results?: unknown } | null | undefined)?.results);
}

/** Whether `value` is a plain object (not null, not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** `value` if it's a plain object, otherwise `fallback`. */
export function objectOr<T extends object>(value: unknown, fallback: T): T {
  return isRecord(value) ? (value as T) : fallback;
}
