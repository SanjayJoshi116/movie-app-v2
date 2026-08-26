import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Space, Button, Alert, Typography } from "antd";
import { useAppContext } from "../context/useAppContext";
import Movies from "../components/Movies";
import TVShows from "../components/TVShows";
import HeroBanner from "../components/HeroBanner";
import SkeletonCard from "../components/SkeletonCard";
import { PosterPlaceholder } from "../components/PosterPlaceholder";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import {
  discoverMovies,
  fetchMoviesByCategory,
  searchMovies,
  fetchTVByCategory,
  discoverTV,
  searchTV,
  filtersToTMDBParams,
} from "../api/tmdb";
import type { TMDBMovieSummary, TMDBTVSummary, FilterValues, SortOption } from "../types";
import { pageVariants, POSTER_THUMB_URL } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";

const MOVIE_CATEGORIES = [
  { key: "discover", label: "Discover" },
  { key: "now-playing", label: "Now Playing" },
  { key: "top-rated", label: "Top Rated" },
  { key: "upcoming", label: "Upcoming" },
  { key: "popular", label: "Popular" },
];

const TV_CATEGORIES = [
  { key: "tv-popular", label: "Popular" },
  { key: "tv-top-rated", label: "Top Rated" },
  { key: "tv-on-the-air", label: "On The Air" },
  { key: "tv-airing-today", label: "Airing Today" },
];

interface Props {
  tab: "movies" | "tv";
  externalFilters: FilterValues | null;
  externalSortBy: SortOption;
}

function HomePage({ tab, externalFilters, externalSortBy }: Props) {
  const { searchTerm, setSearchTerm, selectedGenres, clearGenres, includeAdult, isWatched, watchedList } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isMovie = tab === "movies";

  const locationState = location.state as { scrollY?: number; loadedPages?: number; isReturn?: boolean; activeCategory?: string } | null;
  const isReturning = locationState?.isReturn ?? false;
  const savedScrollY = locationState?.scrollY ?? 0;
  const savedLoadedPages = locationState?.loadedPages ?? 1;
  const savedActiveCategory = locationState?.activeCategory;

  const defaultCategory = isMovie ? "discover" : "tv-popular";
  const [activeCategory, setActiveCategory] = useState(
    (isReturning && savedActiveCategory) ? savedActiveCategory : defaultCategory
  );

  useEffect(() => {
    if (!isReturning) {
      setSearchTerm("");
      clearGenres();
      setActiveCategory(defaultCategory);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPage = useCallback(
    async (page: number): Promise<{ results: (TMDBMovieSummary | TMDBTVSummary)[]; totalPages: number }> => {
      const genreString = selectedGenres.join(",");
      const baseParams: Record<string, string | number> = {
        page,
        ...(genreString && { with_genres: genreString }),
      };

      const hasFilters =
        externalFilters !== null &&
        Object.values(externalFilters).some((v) => v !== "");

      let response;

      if (searchTerm) {
        response = isMovie
          ? await searchMovies(searchTerm, page, includeAdult)
          : await searchTV(searchTerm, page, includeAdult);
      } else if (hasFilters && externalFilters) {
        const filterParams = filtersToTMDBParams(externalFilters, externalSortBy, isMovie ? "movie" : "tv");
        const params = { ...baseParams, ...filterParams };
        response = isMovie ? await discoverMovies(params) : await discoverTV(params);
      } else if (isMovie) {
        switch (activeCategory) {
          case "now-playing":
            response = await fetchMoviesByCategory("now_playing", baseParams);
            break;
          case "top-rated":
            response = await fetchMoviesByCategory("top_rated", baseParams);
            break;
          case "upcoming":
            response = await fetchMoviesByCategory("upcoming", baseParams);
            break;
          case "popular":
            response = await fetchMoviesByCategory("popular", baseParams);
            break;
          default:
            response = await discoverMovies({ ...baseParams, sort_by: externalSortBy });
        }
      } else {
        switch (activeCategory) {
          case "tv-top-rated":
            response = await fetchTVByCategory("top_rated", baseParams);
            break;
          case "tv-on-the-air":
            response = await fetchTVByCategory("on_the_air", baseParams);
            break;
          case "tv-airing-today":
            response = await fetchTVByCategory("airing_today", baseParams);
            break;
          default:
            response = await fetchTVByCategory("popular", baseParams);
        }
      }

      return {
        results: response.data.results as (TMDBMovieSummary | TMDBTVSummary)[],
        totalPages: response.data.total_pages,
      };
    },
    [isMovie, searchTerm, selectedGenres, activeCategory, externalFilters, externalSortBy, includeAdult]
  );

  const { items: allItems, currentPage, hasMore, loading, loadingMore, loadMore } = usePaginatedFetch<TMDBMovieSummary | TMDBTVSummary>({
    fetchPage,
    restore: { isReturning, savedLoadedPages, savedScrollY },
  });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading);

  const handleKnowMore = (id: number) => {
    navigate(isMovie ? `/movie/${id}` : `/tv/${id}`, {
      state: { from: location.pathname, scrollY: window.scrollY, loadedPages: currentPage, isReturn: false, activeCategory },
    });
  };

  const hasFilters = externalFilters !== null && Object.values(externalFilters).some((v) => v !== "");
  const categories = isMovie ? MOVIE_CATEGORIES : TV_CATEGORIES;
  const mediaType = isMovie ? "movie" : "tv";
  const visibleItems = searchTerm
    ? allItems
    : allItems.filter((item) => !isWatched(item.id, mediaType));

  const recentWatched = watchedList
    .filter((item) => item.type === (tab === "movies" ? "movie" : "tv"))
    .slice(0, 8);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <HeroBanner mediaType={tab === "tv" ? "tv" : "movie"} excludeGenreId={tab === "tv" ? 16 : undefined} />

      {recentWatched.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong style={{ fontSize: FONT_SIZE.emphasis, display: "block", marginBottom: 8, opacity: 0.7 }}>
            Recently Watched
          </Typography.Text>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
            {recentWatched.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`)}
                title={item.title}
                style={{ flexShrink: 0, width: 72, cursor: "pointer" }}
              >
                {item.posterPath ? (
                  <img
                    src={`${POSTER_THUMB_URL}${item.posterPath}`}
                    alt={item.title}
                    loading="lazy"
                    style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 6, display: "block" }}
                  />
                ) : (
                  <PosterPlaceholder style={{ width: 72, height: 108, borderRadius: 6 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {searchTerm && (
        <Alert
          message="Filters are disabled during search. Clear the search to use filters."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Category buttons */}
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

      {/* Results */}
      {loading ? (
        <SkeletonCard count={18} />
      ) : isMovie ? (
        <Movies
          movies={visibleItems as TMDBMovieSummary[]}
          onKnowMore={handleKnowMore}
          searchTerm={searchTerm}
          hasFilters={hasFilters}
        />
      ) : (
        <TVShows
          tvShows={visibleItems as TMDBTVSummary[]}
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

export default HomePage;
