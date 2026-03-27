import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Space, Button, Alert, Radio } from "antd";
import { useAppContext } from "../context/useAppContext";
import Movies from "../components/Movies";
import TVShows from "../components/TVShows";
import HeroBanner from "../components/HeroBanner";
import SkeletonCard from "../components/SkeletonCard";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import {
  discoverMovies,
  discoverTV,
  searchMovies,
  searchTV,
  filtersToTMDBParams,
} from "../api/tmdb";
import type { TMDBMovieSummary, TMDBTVSummary, FilterValues, SortOption } from "../types";

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

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -16 },
};

interface Props {
  externalFilters: FilterValues | null;
  externalSortBy: SortOption;
  onMediaTypeChange: (type: "tv" | "movies") => void;
}

function AnimePage({ externalFilters, externalSortBy, onMediaTypeChange }: Props) {
  const { searchTerm, setSearchTerm, selectedGenres, clearGenres } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as { scrollY?: number; loadedPages?: number; isReturn?: boolean } | null;
  const isReturning = locationState?.isReturn ?? false;
  const savedScrollY = locationState?.scrollY ?? 0;
  const savedLoadedPages = locationState?.loadedPages ?? 1;

  const [animeTab, setAnimeTab] = useState<"tv" | "movies">("tv");
  const [activeCategory, setActiveCategory] = useState("anime-tv-popular");
  const [allItems, setAllItems] = useState<TMDBMovieSummary[] | TMDBTVSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const didRestoreRef = useRef(false);
  const isRestoringRef = useRef(isReturning);

  useEffect(() => {
    if (!isReturning) {
      setSearchTerm("");
      clearGenres();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveCategory(animeTab === "tv" ? "anime-tv-popular" : "anime-movies-popular");
    if (!isRestoringRef.current) {
      setAllItems([]);
      setCurrentPage(1);
      setHasMore(true);
    }
    isRestoringRef.current = false;
    onMediaTypeChange(animeTab);
  }, [animeTab, onMediaTypeChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPage = useCallback(
    async (page: number): Promise<{ results: TMDBMovieSummary[] | TMDBTVSummary[]; totalPages: number }> => {
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
          ? await searchTV(searchTerm, page)
          : await searchMovies(searchTerm, page);
      } else if (hasFilters && externalFilters) {
        const filterParams = filtersToTMDBParams(externalFilters, externalSortBy);
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
        results: response.data.results as TMDBMovieSummary[] | TMDBTVSummary[],
        totalPages: response.data.total_pages,
      };
    },
    [animeTab, activeCategory, searchTerm, selectedGenres, externalFilters, externalSortBy]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isRestoringRef.current && savedLoadedPages > 1) {
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
          console.error("Error restoring anime pages:", err);
        } finally {
          if (!cancelled) setLoading(false);
          isRestoringRef.current = false;
        }
      } else {
        setLoading(true);
        try {
          const { results, totalPages } = await fetchPage(1);
          if (!cancelled) {
            setAllItems(results as TMDBMovieSummary[] | TMDBTVSummary[]);
            setCurrentPage(1);
            setHasMore(1 < totalPages);
          }
        } catch (err) {
          console.error("Error fetching anime data:", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setAllItems((prev) => [...prev, ...results] as TMDBMovieSummary[] | TMDBTVSummary[]);
      setCurrentPage(nextPage);
      setHasMore(nextPage < totalPages);
    } catch (err) {
      console.error("Error loading more anime:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, currentPage, hasMore, loadingMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading);

  const handleKnowMore = (id: number) => {
    navigate(animeTab === "movies" ? `/movie/${id}` : `/tv/${id}`, {
      state: { from: location.pathname, scrollY: window.scrollY, loadedPages: currentPage, isReturn: false },
    });
  };

  const hasFilters = externalFilters !== null && Object.values(externalFilters).some((v) => v !== "");
  const categories = animeTab === "tv" ? ANIME_TV_CATEGORIES : ANIME_MOVIE_CATEGORIES;

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
          message="Filters are disabled during search. Clear the search to use filters."
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
      ) : animeTab === "tv" ? (
        <TVShows
          tvShows={allItems as TMDBTVSummary[]}
          onKnowMore={handleKnowMore}
          searchTerm={searchTerm}
          hasFilters={hasFilters}
        />
      ) : (
        <Movies
          movies={allItems as TMDBMovieSummary[]}
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
