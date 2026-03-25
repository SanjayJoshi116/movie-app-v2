import type {
  Theme,
  WatchlistEntry,
  WatchlistInput,
  RatingEntry,
  RatingsMap,
  WatchedEntry,
  WatchedInput,
} from "./domain";

export interface AppContextType {
  // Search
  searchTerm: string;
  setSearchTerm(t: string): void;
  clearSearch(): void;

  // Genre filters
  selectedGenres: number[];
  toggleGenre(id: number): void;
  clearGenres(): void;

  // Theme
  theme: Theme;
  toggleTheme(): void;

  // Watchlist
  watchlist: WatchlistEntry[];
  addToWatchlist(entry: WatchlistInput): void;
  removeFromWatchlist(id: number, type: string): void;
  isInWatchlist(id: number, type: string): boolean;
  toggleWatchlist(entry: WatchlistInput): void;
  markWatched(id: number, type: string, watched: boolean): void;

  // Watched
  watchedList: WatchedEntry[];
  addToWatched(entry: WatchedInput): void;
  removeFromWatched(id: number, type: string): void;
  isWatched(id: number, type: string): boolean;
  toggleWatched(entry: WatchedInput): void;

  // Ratings
  allRatings: RatingsMap;
  setRating(
    id: number,
    type: string,
    title: string,
    rating: number,
    review?: string
  ): void;
  getRating(id: number, type: string): RatingEntry | null;
  removeRating(id: number, type: string): void;
}
