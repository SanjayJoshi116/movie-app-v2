/** Stable key for one library title: a movie and a show can share a TMDB id. */
export function titleKey(id: number, type: string): string {
  return `${type}-${id}`;
}
