import { arrayOr, isRecord } from "./appended";

/** The numeric genre ids in `value`, [] when it isn't a list. */
function genreIds(value: unknown): number[] {
  return arrayOr<unknown>(value).filter((id): id is number => typeof id === "number");
}

/**
 * Items sharing at least half of the source title's genres; all items when
 * none do, or when the source has no genres. TMDB data is untrusted here: a
 * non-object item is dropped, and one without a `genre_ids` list shares none.
 */
export function filterByGenreOverlap<T>(
  items: readonly T[] | null | undefined,
  sourceGenreIds: unknown,
): T[] {
  const valid = arrayOr<T>(items).filter((item) => isRecord(item));
  const source = genreIds(sourceGenreIds);
  if (source.length === 0) return valid;
  const minOverlap = Math.ceil(source.length / 2);
  const overlapping = valid.filter(
    (item) => genreIds((item as { genre_ids?: unknown }).genre_ids).filter((id) => source.includes(id)).length >= minOverlap,
  );
  return overlapping.length > 0 ? overlapping : valid;
}

/** A details answer's `genres` as ids; [] when the list is missing or malformed. */
export function genreIdsOf(genres: unknown): number[] {
  return genreIds(arrayOr<unknown>(genres).map((g) => (isRecord(g) ? g.id : undefined)));
}
