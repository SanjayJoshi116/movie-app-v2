/** Entries whose own sub-pages belong to them (`/lists/3` is a list). Not
 *  `/tv`: `/tv/1396` is a TV detail page, like `/movie/550`, under no entry. */
const SECTIONS_WITH_SUBPAGES = ["/lists"];

/**
 * Which navigation entry a page belongs to: the entry whose path equals the
 * pathname, else a section above whose sub-page it is. Detail and person
 * pages belong to none, so nothing is highlighted there.
 */
export function navSection(pathname: string, paths: readonly string[]): string | null {
  return (
    paths.find((p) => pathname === p) ??
    paths.find((p) => SECTIONS_WITH_SUBPAGES.includes(p) && pathname.startsWith(`${p}/`)) ??
    null
  );
}
