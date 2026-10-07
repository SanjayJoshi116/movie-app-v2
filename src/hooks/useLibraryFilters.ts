import { useState, useEffect, useMemo, useCallback } from "react";
import type { MediaType } from "../types";

export type LibraryTypeFilter = "all" | "movie" | "tv";

interface Options<T> {
  keyPrefix: string;
  items: T[];
  sortFns: Record<string, (a: T, b: T) => number>;
  defaultSort: string;
  /** Page-specific extra predicate (e.g. Watchlist's watched-status filter) applied on top of type/search. */
  extraFilter?: (item: T) => boolean;
  /** Defaults to reading `.title` — override for items whose display/search field is named differently (e.g. List.name). */
  getTitle?: (item: T) => string;
  /** Omit entirely for items with no movie/tv distinction (e.g. List, Person) — the type filter then becomes a no-op. */
  getType?: (item: T) => MediaType;
}

/**
 * Shared search/sort/type-filter state + sessionStorage persistence + the
 * filter-then-sort pipeline duplicated across WatchlistPage/WatchedPage.
 * keyPrefix must match each page's existing sessionStorage keys so no one's
 * persisted filters reset on upgrade.
 */
export function useLibraryFilters<T>({
  keyPrefix, items, sortFns, defaultSort, extraFilter, getTitle, getType,
}: Options<T>) {
  const ssSearch = `${keyPrefix}_search`;
  const ssSort = `${keyPrefix}_sort`;
  const ssTypeFilter = `${keyPrefix}_type_filter`;

  const [search, setSearch] = useState(() => sessionStorage.getItem(ssSearch) ?? "");
  const [sortKey, setSortKey] = useState(() => sessionStorage.getItem(ssSort) ?? defaultSort);
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>(
    () => (sessionStorage.getItem(ssTypeFilter) as LibraryTypeFilter) ?? "all"
  );

  useEffect(() => { sessionStorage.setItem(ssSearch, search); }, [ssSearch, search]);
  useEffect(() => { sessionStorage.setItem(ssSort, sortKey); }, [ssSort, sortKey]);
  useEffect(() => { sessionStorage.setItem(ssTypeFilter, typeFilter); }, [ssTypeFilter, typeFilter]);

  const filtered = useMemo(() => {
    const resolveTitle = getTitle ?? ((i: T) => (i as unknown as { title: string }).title);
    let result = [...items];
    if (getType && typeFilter !== "all") {
      result = result.filter((i) => getType(i) === typeFilter);
    }
    if (extraFilter) {
      result = result.filter(extraFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((i) => resolveTitle(i).toLowerCase().includes(q));
    }
    const sortFn = sortFns[sortKey] ?? sortFns[defaultSort];
    result.sort(sortFn);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, sortKey, typeFilter, extraFilter, getTitle, getType, sortFns, defaultSort]);

  const isDefault = search.trim() === "" && sortKey === defaultSort && typeFilter === "all";

  const resetFilters = useCallback(() => {
    setSearch("");
    setSortKey(defaultSort);
    setTypeFilter("all");
  }, [defaultSort]);

  return { search, setSearch, sortKey, setSortKey, typeFilter, setTypeFilter, filtered, isDefault, resetFilters };
}
