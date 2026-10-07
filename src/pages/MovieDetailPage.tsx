import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import MovieDetails from "../components/MovieDetails";
import type { MovieDetailData } from "../components/MovieDetails";
import DetailPageSkeleton from "../components/DetailPageSkeleton";
import {
  fetchMovieDetails,
  fetchMovieReviews,
  fetchSimilarMovies,
  fetchMovieProviders,
  fetchMovieReleaseDates,
} from "../api/tmdb";
import { pageVariants } from "../constants/ui";
import { LoadError } from "../components/LoadError";
import { settledData, isNotFound } from "../utils/settled";

function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<MovieDetailData | null>(null);
  // activeCategory is passed through so Back nav restores the correct tab
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not-found" | "failed" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setMovie(null);
    setLoading(true);
    setError(null);

    let cancelled = false;

    const load = async () => {
      // Only the details call is essential; each secondary section degrades
      // to empty on its own instead of failing the whole page.
      const [detailsRes, reviewsRes, similarRes, providersRes, releasesRes] =
        await Promise.allSettled([
          fetchMovieDetails(id),
          fetchMovieReviews(id),
          fetchSimilarMovies(id),
          fetchMovieProviders(id),
          fetchMovieReleaseDates(id),
        ]);
      if (cancelled) return;

      if (detailsRes.status === "rejected") {
        console.error("Error fetching movie details:", detailsRes.reason);
        setError(isNotFound(detailsRes.reason) ? "not-found" : "failed");
        setLoading(false);
        return;
      }

      const movieData = detailsRes.value.data;
      setMovie({
        ...movieData,
        credits: {
          ...movieData.credits,
          cast: movieData.credits?.cast ?? [],
        },
        recommendations: movieData.recommendations?.results ?? [],
        reviews: settledData(reviewsRes)?.results ?? [],
        similarMovies: settledData(similarRes)?.results ?? [],
        watchProviders: settledData(providersRes)?.results ?? {},
        certifications: settledData(releasesRes)?.results ?? [],
      });
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (loading) return <DetailPageSkeleton />;
  if (error === "not-found") return <LoadError notFound title="Movie not found" />;
  if (error)
    return <LoadError title="Failed to load movie details" onRetry={() => setReloadKey((k) => k + 1)} />;
  if (!movie) return null;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <MovieDetails movie={movie} />
    </motion.div>
  );
}

export default MovieDetailPage;
