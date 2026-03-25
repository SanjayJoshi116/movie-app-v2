import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Spin, Space, Button, Alert, Radio } from "antd";
import { useAppContext } from "../context/useAppContext";
import Movies from "../components/Movies";
import TVShows from "../components/TVShows";
import HeroBanner from "../components/HeroBanner";
import Pagination from "../components/Pagination";
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

  const locationState = location.state as { page?: number; isReturn?: boolean } | null;
  const restoredPage   = locationState?.page ?? 1;
  const isReturning    = locationState?.isReturn ?? false;
  const firstFetchPage = useRef(restoredPage);
  const isReturningRef = useRef(isReturning);

  const [animeTab, setAnimeTab] = useState<"tv" | "movies">("tv");
  const [activeCategory, setActiveCategory] = useState("anime-tv-popular");
  const [items, setItems] = useState<TMDBMovieSummary[] | TMDBTVSummary[]>([]);
  const [currentPage, setCurrentPage] = useState(restoredPage);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReturning) {
      setSearchTerm("");
      clearGenres();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveCategory(animeTab === "tv" ? "anime-tv-popular" : "anime-movies-popular");
    if (!isReturningRef.current) setCurrentPage(1);
    isReturningRef.current = false;
    onMediaTypeChange(animeTab);
  }, [animeTab, onMediaTypeChange]);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
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

        setItems((response.data.results as TMDBMovieSummary[] | TMDBTVSummary[]).slice(0, 18));
        setCurrentPage(response.data.page);
        setTotalPages(response.data.total_pages);
      } catch (err) {
        console.error("Error fetching anime data:", err);
      } finally {
        setLoading(false);
      }
    },
    [animeTab, activeCategory, searchTerm, selectedGenres, externalFilters, externalSortBy]
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
    navigate(animeTab === "movies" ? `/movie/${id}` : `/tv/${id}`, { state: { from: location.pathname, page: currentPage } });
  };

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
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spin size="large" />
        </div>
      ) : animeTab === "tv" ? (
        <TVShows
          tvShows={items as TMDBTVSummary[]}
          onKnowMore={handleKnowMore}
        />
      ) : (
        <Movies
          movies={items as TMDBMovieSummary[]}
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

export default AnimePage;
