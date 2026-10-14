import { fetchMoviePoster, fetchTVPoster } from "../api/tmdb";
import type { MediaType } from "../types";
import { pacedLookup } from "./pacedLookup";

export interface PosterInfo {
  posterPath: string | null;
  voteAverage: number;
}

/**
 * Poster and score for each imported row, paced to the TMDB proxy's rate
 * limit (pacedLookup). `found[i]` is undefined when TMDB had nothing for row i
 * or the lookup kept failing; `missing` counts those rows.
 */
export async function lookupImportPosters(
  rows: { mediaId: number; type: MediaType }[],
  onProgress?: (done: number, total: number) => void,
  shouldStop?: () => boolean,
): Promise<{ found: (PosterInfo | undefined)[]; missing: number }> {
  const { results, missing } = await pacedLookup(
    rows,
    async (row) => {
      const { data } = await (row.type === "tv" ? fetchTVPoster(row.mediaId) : fetchMoviePoster(row.mediaId));
      return { posterPath: data.poster_path ?? null, voteAverage: data.vote_average };
    },
    { onProgress, shouldStop },
  );
  return { found: results, missing };
}

/** The result-message suffix for rows saved without a poster ("" when none). */
export function missingPostersNote(missing: number): string {
  if (missing === 0) return "";
  return ` ${missing} saved without a poster.`;
}
