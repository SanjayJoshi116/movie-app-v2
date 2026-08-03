import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Result, Button } from "antd";
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

function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<MovieDetailData | null>(null);
  // activeCategory is passed through so Back nav restores the correct tab
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setMovie(null);
    setLoading(true);
    setError(null);

    let cancelled = false;

    const load = async () => {
      try {
        const [detailsRes, reviewsRes, similarRes, providersRes, releasesRes] =
          await Promise.all([
            fetchMovieDetails(id),
            fetchMovieReviews(id),
            fetchSimilarMovies(id),
            fetchMovieProviders(id),
            fetchMovieReleaseDates(id),
          ]);
        if (cancelled) return;

        const movieData = detailsRes.data;

        const rawRecs = (movieData as any).recommendations;
        setMovie({
          ...movieData,
          credits: {
            ...movieData.credits,
            cast: movieData.credits?.cast ?? [],
          },
          recommendations: rawRecs?.results ?? [],
          reviews: reviewsRes.data.results,
          similarMovies: similarRes.data.results,
          watchProviders: providersRes.data.results,
          certifications: releasesRes.data.results,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching movie details:", err);
        setError("Failed to load movie details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <DetailPageSkeleton />;
  if (error)
    return (
      <Result
        status="error"
        title="Failed to load"
        subTitle={error}
        extra={<Button onClick={() => window.location.reload()}>Retry</Button>}
      />
    );
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
