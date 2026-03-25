import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Spin, Result, Button } from "antd";
import axios from "axios";
import MovieDetails from "../components/MovieDetails";
import {
  fetchMovieDetails,
  fetchMovieReviews,
  fetchSimilarMovies,
  fetchMovieProviders,
  fetchMovieReleaseDates,
} from "../api/tmdb";
import type { TMDBPerson } from "../types";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const PROXY_BASE = "http://localhost:3001/api/tmdb";

function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setMovie(null);
    setLoading(true);
    setError(null);

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

        const movieData = detailsRes.data;
        const castTop10 = (movieData.credits?.cast ?? []).slice(0, 10);
        const castDetails = await Promise.all(
          castTop10.map((actor) =>
            axios
              .get<TMDBPerson>(`${PROXY_BASE}/person/${actor.id}`)
              .then((res) => ({ ...res.data, character: actor.character }))
              .catch(() => ({ ...actor }))
          )
        );

        const rawRecs = (movieData as any).recommendations;
        setMovie({
          ...movieData,
          credits: {
            ...movieData.credits,
            cast: movieData.credits?.cast ?? [],
            detailedCast: castDetails,
          },
          recommendations: rawRecs?.results ?? [],
          reviews: reviewsRes.data.results,
          similarMovies: similarRes.data.results,
          watchProviders: providersRes.data.results,
          certifications: releasesRes.data.results,
        });
      } catch (err) {
        console.error("Error fetching movie details:", err);
        setError("Failed to load movie details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <Spin size="large" />
      </div>
    );
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
