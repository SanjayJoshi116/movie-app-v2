import axios from "axios";

/** Shown whenever the server can't be reached at all (network down, CORS, timeout). */
export const CONNECTION_ERROR = "Can't reach the server. Check your connection and try again.";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A usable message from one error-body value: a non-empty string, or strings joined. */
function asMessage(v: unknown): string | null {
  if (typeof v === "string") return v.trim() ? v : null;
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")) return v.join(" ");
  return null;
}

/**
 * User-facing text for a failed request.
 *
 * - Not an axios error (a bug thrown inside a `try`) → `fallback`: a JS
 *   runtime message is never user text.
 * - No response at all → CONNECTION_ERROR (instead of axios' "Network Error").
 * - A body that isn't a JSON object (an nginx 502 page, Django's HTML 500,
 *   an empty string) → `fallback`. Reading those as objects used to show the
 *   body's first character, e.g. "<".
 * - A DRF object body → its `detail`, `non_field_errors` or first field.
 */
export function getApiError(error: unknown, fallback = "An unexpected error occurred."): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return CONNECTION_ERROR;
  const data: unknown = error.response.data;
  if (!isPlainObject(data)) return fallback;
  return (
    asMessage(data.detail) ??
    asMessage(data.non_field_errors) ??
    asMessage(Object.values(data)[0]) ??
    fallback
  );
}
