import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Space, Button, Radio } from "antd";
import { useAppContext } from "../context/useAppContext";
import Movies from "../components/Movies";
import TVShows from "../components/TVShows";
import HeroBanner from "../components/HeroBanner";
import SkeletonCard from "../components/SkeletonCard";
import { LoadMoreError } from "../components/LoadMoreError";
import { LoadError } from "../components/LoadError";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import {
  discoverMovies,
  discoverTV,
  filtersToTMDBParams,
} from "../api/tmdb";
import { genresFor, hasActiveFilters, todayLocalISO } from "../utils/browseFilters";
import { stashReturnState } from "../utils/browseReturnState";
import type { TMDBMovieSummary, TMDBTVSummary, FilterValues, SortOption } from "../types";
import { pageVariants } from "../constants/ui";
import { pageableTotal } from "../utils/tmdbPages";

const ANIME_KEYWORD = 210024;

const ANIME_TV_CATEGORIES = [
  { key: "anime-tv-popular",   label: "Popular" },
  { key: "anime-tv-top-rated", label: "Top Rated" },
  { key: "anime-tv-airing",    label: "Airing Today" },
];

const ANIME_MOVIE_CATEGORIES = [
  { key: "anime-movies-popular",   label: "Popular" },
  { key: "anime-movies-top-rated", label: "Top Rated" },
];

const defaultAnimeCategory = (tab: "tv" | "movies") => (tab === "tv" ? "anime-tv-popular" : "anime-movies-popular");

// Discover params per category. "Airing Today" filters by today's episode air
// date (TMDB's /tv/airing_today ignores with_keywords, so it can't be used);
// sorting by first_air_date.desc used to surface not-yet-aired shows instead.

function categoryParams(category: string): Record<string, string | number> {
  switch (category) {
    case "anime-tv-top-rated":
    case "anime-movies-top-rated":
      return { sort_by: "vote_average.desc", "vote_count.gte": 50 };
    case "anime-tv-airing": {
      const today = todayLocalISO();
      return { sort_by: "popularity.desc", "air_date.gte": today, "air_date.lte": today };
    }
    default:
      return { sort_by: "popularity.desc" };
  }
}

interface Props {
  externalFilters: FilterValues | null;
  externalSortBy: SortOption;
  onMediaTypeChange: (type: "tv" | "movies") => void;
}

function AnimePage({ externalFilters, externalSortBy, onMediaTypeChange }: Props) {
  const { selectedGenres, clearGenres, isWatched } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as { scrollY?: number; loadedPages?: number; isReturn?: boolean; activeCategory?: string } | null;
  const isReturning = locationState?.isReturn ?? false;
  const savedScrollY = locationState?.scrollY ?? 0;
  const savedLoadedPages = locationState?.loadedPages ?? 1;
  const savedActiveCategory = locationState?.activeCategory;

  // Derive animeTab from saved activeCategory so we don't need a separate state field
  const restoredTab: "tv" | "movies" =
    savedActiveCategory?.startsWith("anime-movies-") ? "movies" : "tv";

  const [animeTab, setAnimeTab] = useState<"tv" | "movies">(
    isReturning && savedActiveCategory ? restoredTab : "tv"
  );
  const [activeCategory, setActiveCategory] = useState(
    isReturning && savedActiveCategory ? savedActiveCategory : "anime-tv-popular"
  );

  useEffect(() => {
    if (!isReturning) {
      clearGenres();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reports the initial mode (a restore included); the toggle reports changes itself.
  useEffect(() => {
    onMediaTypeChange(animeTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scopeMediaType = animeTab === "tv" ? "tv" : "movie";
  const validGenres = genresFor(scopeMediaType, selectedGenres);
  const genreString = validGenres.join(",");
  const hasFilters = hasActiveFilters(externalFilters, externalSortBy, validGenres);

  const fetchPage = useCallback(
    async (page: number): Promise<{ results: (TMDBMovieSummary | TMDBTVSummary)[]; totalPages: number }> => {
      const isTV = animeTab === "tv";
      const baseParams: Record<string, string | number> = {
        page,
        with_keywords: ANIME_KEYWORD,
      };

      let response;

      // No search mode: the search box always opens the Search page.
      if (hasFilters) {
        const filterParams = filtersToTMDBParams(externalFilters ?? undefined, externalSortBy, scopeMediaType);
        const params = { ...baseParams, ...filterParams, ...(genreString && { with_genres: genreString }) };
        response = isTV ? await discoverTV(params) : await discoverMovies(params);
      } else {
        const params = { ...baseParams, ...categoryParams(activeCategory) };
        response = isTV ? await discoverTV(params) : await discoverMovies(params);
      }

      return {
        results: response.data.results as (TMDBMovieSummary | TMDBTVSummary)[],
        totalPages: pageableTotal(response.data.total_pages),
      };
    },
    [animeTab, scopeMediaType, activeCategory, genreString, hasFilters, externalFilters, externalSortBy]
  );

  const { items: allItems, setItems: setAllItems, currentPage, hasMore, loading, loadingMore, loadMore, error, retry, loadMoreError, retryLoadMore } =
    usePaginatedFetch<TMDBMovieSummary | TMDBTVSummary>({
      fetchPage,
      restore: { isReturning, savedLoadedPages, savedScrollY },
    });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !error && !loadMoreError);

  // Lets browser Back (not just the in-app Back button) restore this page.
  const stashBrowseState = () =>
    stashReturnState({ scrollY: window.scrollY, loadedPages: currentPage, activeCategory, isReturn: true });

  const handleKnowMore = (id: number) => {
    stashBrowseState();
    navigate(animeTab === "movies" ? `/movie/${id}` : `/tv/${id}`, {
      state: { from: location.pathname, scrollY: window.scrollY, loadedPages: currentPage, isReturn: false, activeCategory },
    });
  };

  const categories = animeTab === "tv" ? ANIME_TV_CATEGORIES : ANIME_MOVIE_CATEGORIES;
  const animeMediaType = animeTab === "tv" ? "tv" : "movie";
  const visibleItems = allItems.filter((item) => !isWatched(item.id, animeMediaType));

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <HeroBanner mediaType={animeTab === "tv" ? "tv" : "movie"} discoverParams={{ with_keywords: ANIME_KEYWORD }} onBeforeNavigate={stashBrowseState} />

      <Radio.Group
        value={animeTab}
        onChange={(e) => {
          // One batched render: App resets the applied filters for the new
          // scope and the genre picks are gone before the grid refetches.
          // (Via the effect below alone, one request went out with them.)
          const tab: "tv" | "movies" = e.target.value;
          clearGenres();
          onMediaTypeChange(tab);
          setAnimeTab(tab);
          // The new mode's category in the same render, or the first request
          // pairs the new mode with the old mode's category params.
          setActiveCategory(defaultAnimeCategory(tab));
          setAllItems([]);
        }}
        style={{ marginBottom: 16 }}
      >
        <Radio.Button value="tv">TV Anime</Radio.Button>
        <Radio.Button value="movies">Anime Movies</Radio.Button>
      </Radio.Group>

      <Space wrap style={{ marginBottom: 12 }}>
        {categories.map((cat) => (
          <Button
            key={cat.key}
            type={activeCategory === cat.key ? "primary" : "default"}
            // A filter decides the results; a category can't change them then.
            disabled={hasFilters}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </Button>
        ))}
      </Space>

      {loading ? (
        <SkeletonCard count={18} />
      ) : error ? (
        <LoadError onRetry={retry} />
      ) : animeTab === "tv" ? (
        <TVShows
          tvShows={visibleItems as TMDBTVSummary[]}
          onKnowMore={handleKnowMore}
          hasFilters={hasFilters}
        />
      ) : (
        <Movies
          movies={visibleItems as TMDBMovieSummary[]}
          onKnowMore={handleKnowMore}
          hasFilters={hasFilters}
        />
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* Loading more indicator */}
      {loadingMore && <SkeletonCard count={6} />}
      {loadMoreError != null && !loadingMore && <LoadMoreError error={loadMoreError} onRetry={retryLoadMore} />}
    </motion.div>
  );
}

export default AnimePage;
