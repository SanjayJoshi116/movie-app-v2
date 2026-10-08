import { useParams } from "react-router-dom";

const INT32_MAX = 2_147_483_647;

/** A route id as a TMDB id (positive integer, no sign/leading zeros, ≤ INT32_MAX), else null. */
export function parseTmdbId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= INT32_MAX ? n : null;
}

/**
 * The `:id` route param, validated before it reaches a TMDB proxy path.
 * React Router decodes params, so `/movie/..%2F..%2Fwatchlist` arrives as
 * `../../watchlist`; built into `/movie/${id}`, that would resolve to another
 * app endpoint (sent with the user's token). Callers render the not-found page
 * and fetch nothing when this is null.
 */
export function useValidId(): number | null {
  const { id } = useParams<{ id: string }>();
  return parseTmdbId(id);
}
