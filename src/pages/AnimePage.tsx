import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Space, Button, Alert, Radio } from "antd";
import { useAppContext } from "../context/useAppContext";
import Movies from "../components/Movies";
import TVShows from "../components/TVShows";
import HeroBanner from "../components/HeroBanner";
import SkeletonCard from "../components/SkeletonCard";
import { LoadError } from "../components/LoadError";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import {
  discoverMovies,
  discoverTV,
  searchMovies,
  searchTV,
  filtersToTMDBParams,
} from "../api/tmdb";
import type { TMDBMovieSummary, TMDBTVSummary, FilterValues, SortOption } from "../types";
import { pageVariants } from "../constants/ui";

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

const SORT_MAP: Record<string, string> = {
  "anime-tv-popular":       "popularity.desc",
  "anime-tv-top-rated":     "vote_average.desc",
  "anime-tv-airing":        "first_air_date.desc",
  "anime-movies-popular":   "popularity.desc",
  "anime-movies-top-rated": "vote_average.desc",
};

interface Props {
  externalFilters: FilterValues | null;
  externalSortBy: SortOption;
  onMediaTypeChange: (type: "tv" | "movies") => void;
}

function AnimePage({ externalFilters, externalSortBy, onMediaTypeChange }: Props) {
  const { searchTerm, setSearchTerm, selectedGenres, clearGenres, isWatched, includeAdult } = useAppContext();
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

  const isRestoringRef = useRef(isReturning);

  useEffect(() => {
    if (!isReturning) {
      setSearchTerm("");
      clearGenres();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRestoringRef.current) {
      // User manually switched tab — reset category and clear results
      setActiveCategory(animeTab === "tv" ? "anime-tv-popular" : "anime-movies-popular");
      setAllItems([]);
    }
    onMediaTypeChange(animeTab);
  }, [animeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPage = useCallback(
    async (page: number): Promise<{ results: (TMDBMovieSummary | TMDBTVSummary)[]; totalPages: number }> => {
      const isTV = animeTab === "tv";
      const genreString = selectedGenres.join(",");
      const baseParams: Record<string, string | number> = {
        page,
        with_keywords: ANIME_KEYWORD,
        ...(genreString && { with_genres: genreString }),
      };

      const hasFilters =
        externalFilters !== null &&
        Object.values(externalFilters).some((v) => v !== "");

      let response;

      if (searchTerm) {
        response = isTV
          ? await searchTV(searchTerm, page, includeAdult)
          : await searchMovies(searchTerm, page, includeAdult);
      } else if (hasFilters && externalFilters) {
        const filterParams = filtersToTMDBParams(externalFilters, externalSortBy, animeTab === "tv" ? "tv" : "movie");
        const params = { ...baseParams, ...filterParams };
        response = isTV ? await discoverTV(params) : await discoverMovies(params);
      } else {
        const extraParams: Record<string, string | number> = activeCategory.includes("top-rated")
          ? { "vote_count.gte": 50 }
          : {};
        const params = {
          ...baseParams,
          sort_by: SORT_MAP[activeCategory] ?? "popularity.desc",
          ...extraParams,
        };
        response = isTV ? await discoverTV(params) : await discoverMovies(params);
      }

      return {
        results: response.data.results as (TMDBMovieSummary | TMDBTVSummary)[],
        totalPages: response.data.total_pages,
      };
    },
    [animeTab, activeCategory, searchTerm, selectedGenres, externalFilters, externalSortBy, includeAdult]
  );

  const { items: allItems, setItems: setAllItems, currentPage, hasMore, loading, loadingMore, loadMore, error, retry } =
    usePaginatedFetch<TMDBMovieSummary | TMDBTVSummary>({
      fetchPage,
      restore: { isReturning, savedLoadedPages, savedScrollY },
    });

  // Once the first load (including any restore) finishes, treat later tab
  // switches as user-initiated rather than part of a restore.
  const prevLoadingRef = useRef(loading);
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      isRestoringRef.current = false;
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading);

  const handleKnowMore = (id: number) => {
    navigate(animeTab === "movies" ? `/movie/${id}` : `/tv/${id}`, {
      state: { from: location.pathname, scrollY: window.scrollY, loadedPages: currentPage, isReturn: false, activeCategory },
    });
  };

  const hasFilters = externalFilters !== null && Object.values(externalFilters).some((v) => v !== "");
  const categories = animeTab === "tv" ? ANIME_TV_CATEGORIES : ANIME_MOVIE_CATEGORIES;
  const animeMediaType = animeTab === "tv" ? "tv" : "movie";
  const visibleItems = searchTerm
    ? allItems
    : allItems.filter((item) => !isWatched(item.id, animeMediaType));

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <HeroBanner mediaType={animeTab === "tv" ? "tv" : "movie"} requireGenreId={16} />

      <Radio.Group
        value={animeTab}
        onChange={(e) => setAnimeTab(e.target.value)}
        style={{ marginBottom: 16 }}
      >
        <Radio.Button value="tv">TV Anime</Radio.Button>
        <Radio.Button value="movies">Anime Movies</Radio.Button>
      </Radio.Group>

      {searchTerm && (
        <Alert
          message="Search shows all results — anime keyword filter cannot be applied during search. Clear search to browse anime only."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Space wrap style={{ marginBottom: 12 }}>
        {categories.map((cat) => (
          <Button
            key={cat.key}
            type={activeCategory === cat.key ? "primary" : "default"}
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
          searchTerm={searchTerm}
          hasFilters={hasFilters}
        />
      ) : (
        <Movies
          movies={visibleItems as TMDBMovieSummary[]}
          onKnowMore={handleKnowMore}
          searchTerm={searchTerm}
          hasFilters={hasFilters}
        />
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* Loading more indicator */}
      {loadingMore && <SkeletonCard count={6} />}
    </motion.div>
  );
}

export default AnimePage;
