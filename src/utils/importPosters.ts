import { fetchMoviePoster, fetchTVPoster } from "../api/tmdb";
import type { MediaType } from "../types";
import { pacedLookup } from "./pacedLookup";

export interface PosterInfo {
  posterPath: string | null;
  voteAverage: number;
}

/** An imported row, with the poster and score its file gives, if any. */
export interface ImportRow {
  mediaId: number;
  type: MediaType;
  /** Missing, null or "" means unknown: the row is looked up. */
  posterPath?: string | null;
  /** Undefined means unknown and is looked up; any number, 0 included, is given. */
  voteAverage?: number;
}

/** A row's final poster and score: the file's, else the lookup's. */
export interface ImportPoster {
  posterPath: string | null;
  /** Undefined when neither the file nor TMDB gave one. */
  voteAverage?: number;
}

const titleKey = (row: ImportRow) => `${row.type}:${row.mediaId}`;

/**
 * Poster and score for each imported row. Only rows whose file lacks a
 * poster or a score are looked up, each title (type and id) once however
 * many rows or backup sections carry it, paced to the TMDB proxy's rate
 * limit (pacedLookup). The file's values beat the lookup's, so re-importing
 * the app's own export makes no lookups. `found[i]` is row i's final values;
 * `missing` counts titles left without a poster, each once.
 */
export async function lookupImportPosters(
  rows: ImportRow[],
  onProgress?: (done: number, total: number) => void,
  shouldStop?: () => boolean,
): Promise<{ found: ImportPoster[]; missing: number }> {
  const toLookUp = new Map<string, ImportRow>();
  for (const row of rows) {
    if ((!row.posterPath || row.voteAverage === undefined) && !toLookUp.has(titleKey(row))) {
      toLookUp.set(titleKey(row), row);
    }
  }
  const looked = new Map<string, PosterInfo | undefined>();
  if (toLookUp.size > 0) {
    const keys = [...toLookUp.keys()];
    const { results } = await pacedLookup(
      [...toLookUp.values()],
      async (row) => {
        const { data } = await (row.type === "tv" ? fetchTVPoster(row.mediaId) : fetchMoviePoster(row.mediaId));
        return { posterPath: data.poster_path ?? null, voteAverage: data.vote_average };
      },
      { onProgress, shouldStop },
    );
    keys.forEach((key, j) => { looked.set(key, results[j]); });
  }
  const found = rows.map((row) => {
    const lookup = looked.get(titleKey(row));
    return {
      posterPath: row.posterPath || lookup?.posterPath || null,
      voteAverage: row.voteAverage ?? lookup?.voteAverage,
    };
  });
  const missing = new Set(rows.filter((_, i) => !found[i]!.posterPath).map(titleKey)).size;
  return { found, missing };
}

/** The result-message suffix for titles saved without a poster ("" when none). */
export function missingPostersNote(missing: number): string {
  if (missing === 0) return "";
  return ` ${missing} saved without a poster.`;
}
