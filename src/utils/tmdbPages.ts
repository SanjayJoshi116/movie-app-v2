/** TMDB serves at most this many pages of any list; asking for the next one is a 422, not an empty page. */
export const TMDB_MAX_PAGES = 500;

/** A list's page count as far as it can actually be paged through. */
export const pageableTotal = (totalPages: number): number => Math.min(totalPages, TMDB_MAX_PAGES);
