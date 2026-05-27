import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Space, Button, Alert, Typography } from "antd";
import { useAppContext } from "../context/useAppContext";
import Movies from "../components/Movies";
import TVShows from "../components/TVShows";
import HeroBanner from "../components/HeroBanner";
import SkeletonCard from "../components/SkeletonCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
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

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

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

  const [allItems, setAllItems] = useState<TMDBMovieSummary[] | TMDBTVSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const defaultCategory = isMovie ? "discover" : "tv-popular";
  const [activeCategory, setActiveCategory] = useState(
    (isReturning && savedActiveCategory) ? savedActiveCategory : defaultCategory
  );

  const didRestoreRef = useRef(false);
  const isRestoringRef = useRef(isReturning);

  useEffect(() => {
    if (!isReturning) {
      setSearchTerm("");
      clearGenres();
      setActiveCategory(defaultCategory);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPage = useCallback(
    async (page: number): Promise<{ results: TMDBMovieSummary[] | TMDBTVSummary[]; totalPages: number }> => {
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
        results: response.data.results as TMDBMovieSummary[] | TMDBTVSummary[],
        totalPages: response.data.total_pages,
      };
    },
    [isMovie, searchTerm, selectedGenres, activeCategory, externalFilters, externalSortBy, includeAdult]
  );

  // Initial load — also handles scroll restoration
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isRestoringRef.current && savedLoadedPages > 1) {
        // Restore: pre-fetch all saved pages in sequence
        setLoading(true);
        try {
          const pages = Array.from({ length: savedLoadedPages }, (_, i) => i + 1);
          const results: (TMDBMovieSummary | TMDBTVSummary)[] = [];
          let totalPages = 1;
          for (const p of pages) {
            const { results: r, totalPages: tp } = await fetchPage(p);
            results.push(...r);
            totalPages = tp;
          }
          if (!cancelled) {
            setAllItems(results as TMDBMovieSummary[] | TMDBTVSummary[]);
            setCurrentPage(savedLoadedPages);
            setHasMore(savedLoadedPages < totalPages);
          }
        } catch (err) {
          console.error("Error restoring pages:", err);
        } finally {
          if (!cancelled) setLoading(false);
          isRestoringRef.current = false;
        }
      } else {
        // Normal first load
        setLoading(true);
        try {
          const { results, totalPages } = await fetchPage(1);
          if (!cancelled) {
            setAllItems(results as TMDBMovieSummary[] | TMDBTVSummary[]);
            setCurrentPage(1);
            setHasMore(1 < totalPages);
          }
        } catch (err) {
          console.error("Error fetching data:", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll restoration after items are painted
  useLayoutEffect(() => {
    if (isReturning && savedScrollY > 0 && !didRestoreRef.current && allItems.length > 0) {
      didRestoreRef.current = true;
      window.scrollTo(0, savedScrollY);
    }
  }, [allItems, isReturning, savedScrollY]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const { results, totalPages } = await fetchPage(nextPage);
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const deduped = results.filter((item) => !existingIds.has(item.id));
        return [...prev, ...deduped] as TMDBMovieSummary[] | TMDBTVSummary[];
      });
      setCurrentPage(nextPage);
      setHasMore(nextPage < totalPages);
    } catch (err) {
      console.error("Error loading more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, currentPage, hasMore, loadingMore]);

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
          <Typography.Text strong style={{ fontSize: 13, display: "block", marginBottom: 8, opacity: 0.7 }}>
            Recently Watched
          </Typography.Text>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
            {recentWatched.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`)}
                style={{ flexShrink: 0, width: 72, cursor: "pointer" }}
              >
                <img
                  src={
                    item.posterPath
                      ? `https://image.tmdb.org/t/p/w185${item.posterPath}`
                      : "https://placehold.co/72x108?text=?"
                  }
                  alt={item.title}
                  title={item.title}
                  style={{ width: 72, height: 108, objectFit: "cover", borderRadius: 6, display: "block" }}
                />
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
