export function filterByGenreOverlap<T extends { genre_ids: number[] }>(
  items: T[],
  sourceGenreIds: number[],
): T[] {
  if (sourceGenreIds.length === 0) return items;
  const minOverlap = Math.ceil(sourceGenreIds.length / 2);
  const overlapping = items.filter(
    (item) => item.genre_ids.filter((id) => sourceGenreIds.includes(id)).length >= minOverlap,
  );
  return overlapping.length > 0 ? overlapping : items;
}

