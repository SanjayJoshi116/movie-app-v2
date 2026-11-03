import type {
  Theme,
  WatchlistEntry,
  WatchlistInput,
  RatingEntry,
  RatingsMap,
  WatchedEntry,
  WatchedInput,
  UserList,
} from "./domain";

export interface UIContextType {
  searchTerm: string;
  setSearchTerm(t: string): void;
  clearSearch(): void;
  includeAdult: boolean;
  setIncludeAdult(v: boolean): void;
  theme: Theme;
  toggleTheme(): void;
  /** Region for where-to-watch data (ISO 3166-1, e.g. "IN"); a device preference. */
  region: string;
  setRegion(code: string): void;
}

/** The back-compat `useAppContext()` shape. Its UI members are UIContext's
 *  own (not restated), so the two can't drift; components that need only
 *  those read `useUIContext()` instead, so library changes don't re-render them. */
export interface AppContextType
  extends Pick<UIContextType, "searchTerm" | "setSearchTerm" | "clearSearch" | "includeAdult" | "setIncludeAdult" | "theme" | "toggleTheme"> {
  // Watchlist
  watchlist: WatchlistEntry[];
  addToWatchlist(entry: WatchlistInput): Promise<void>;
  removeFromWatchlist(id: number, type: string): Promise<void>;
  clearAllWatchlist(): Promise<void>;
  isInWatchlist(id: number, type: string): boolean;
  reloadWatchlist(): Promise<void>;
  watchlistError: unknown;

  // Watched
  watchedList: WatchedEntry[];
  addToWatched(entry: WatchedInput): Promise<void>;
  removeFromWatched(id: number, type: string): Promise<void>;
  clearAllWatched(): Promise<void>;
  reloadWatched(): Promise<void>;
  watchedError: unknown;
  isWatched(id: number, type: string): boolean;
  toggleWatched(entry: WatchedInput): Promise<void>;

  // Ratings
  allRatings: RatingsMap;
  setRating(
    id: number,
    type: string,
    title: string,
    rating: number,
    review?: string
  ): Promise<void>;
  getRating(id: number, type: string): RatingEntry | null;
  removeRating(id: number, type: string): Promise<void>;
  reloadRatings(): Promise<void>;
  ratingsError: unknown;

  // Loading
  isDataLoading: boolean;
}

export interface ListsContextType {
  lists: UserList[];
  isLoading: boolean;
  /** Last load failure, or null. Items already loaded are kept on a failed reload. */
  error: unknown;
  createList(name: string, description: string, createdAt?: string): Promise<UserList | undefined>;
  deleteList(id: number): Promise<void>;
  updateList(id: number, patch: { name?: string; description?: string }): Promise<void>;
  addToList(listId: number, entry: WatchlistInput): Promise<void>;
  removeFromList(listId: number, itemId: number, type: string): Promise<void>;
  clearList(listId: number): Promise<void>;
  isInList(listId: number, id: number, type: string): boolean;
  reloadLists(): Promise<void>;
}
