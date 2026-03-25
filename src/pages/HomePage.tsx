import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Spin, Space, Button, Alert } from "antd";
import { useAppContext } from "../context/useAppContext";
import Movies from "../components/Movies";
import TVShows from "../components/TVShows";
import HeroBanner from "../components/HeroBanner";
import Pagination from "../components/Pagination";
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
  const { searchTerm, setSearchTerm, selectedGenres, clearGenres } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isMovie = tab === "movies";

  const locationState = location.state as { page?: number; isReturn?: boolean } | null;
  const restoredPage = locationState?.page ?? 1;
  const isReturning  = locationState?.isReturn ?? false;
  const firstFetchPage = useRef(restoredPage);

  const [items, setItems] = useState<TMDBMovieSummary[] | TMDBTVSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(restoredPage);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(
    isMovie ? "discover" : "tv-popular"
  );

  useEffect(() => {
    if (!isReturning) {
      setSearchTerm("");
      clearGenres();
    }
    setActiveCategory(isMovie ? "discover" : "tv-popular");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
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
            ? await searchMovies(searchTerm, page)
            : await searchTV(searchTerm, page);
        } else if (hasFilters && externalFilters) {
          const filterParams = filtersToTMDBParams(externalFilters, externalSortBy);
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

        setItems((response.data.results as TMDBMovieSummary[] | TMDBTVSummary[]).slice(0, 18));
        setCurrentPage(response.data.page);
        setTotalPages(response.data.total_pages);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    },
    [isMovie, searchTerm, selectedGenres, activeCategory, externalFilters, externalSortBy]
  );

  useEffect(() => {
    const page = firstFetchPage.current;
    firstFetchPage.current = 1;
    fetchData(page);
  }, [fetchData]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) fetchData(page);
  };

  const handleKnowMore = (id: number) => {
    navigate(isMovie ? `/movie/${id}` : `/tv/${id}`, { state: { from: location.pathname, page: currentPage } });
  };

  const categories = isMovie ? MOVIE_CATEGORIES : TV_CATEGORIES;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <HeroBanner mediaType={tab === "tv" ? "tv" : "movie"} excludeGenreId={tab === "tv" ? 16 : undefined} />

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
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spin size="large" />
        </div>
      ) : isMovie ? (
        <Movies
          movies={items as TMDBMovieSummary[]}
          onKnowMore={handleKnowMore}
        />
      ) : (
        <TVShows
          tvShows={items as TMDBTVSummary[]}
          onKnowMore={handleKnowMore}
        />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </motion.div>
  );
}

export default HomePage;
