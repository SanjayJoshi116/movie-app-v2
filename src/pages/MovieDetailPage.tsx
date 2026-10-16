import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import MovieDetails from "../components/MovieDetails";
import type { MovieDetailData } from "../components/MovieDetails";
import DetailPageSkeleton from "../components/DetailPageSkeleton";
import { fetchMovieDetails } from "../api/tmdb";
import { pageVariants } from "../constants/ui";
import { LoadError } from "../components/LoadError";
import NotFoundPage from "./NotFoundPage";
import { useValidId } from "../hooks/useValidId";
import { isNotFound } from "../utils/settled";
import { arrayOr, isRecord, objectOr, resultsOf } from "../utils/appended";
import type { TMDBCredits, TMDBImages, TMDBMovieDetailResponse } from "../types";
import { usePageTitle, detailPageTitle } from "../hooks/usePageTitle";
import type { DetailHeadings } from "../hooks/usePageTitle";

const HEADINGS: DetailHeadings = {
  generic: "Movie",
  notFound: "Movie not found",
  failed: "Failed to load movie details",
};

function MovieDetailPage() {
  const id = useValidId();
  const [movie, setMovie] = useState<MovieDetailData | null>(null);
  // activeCategory is passed through so Back nav restores the correct tab
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not-found" | "failed" | null>(null);
  usePageTitle(...detailPageTitle({ validId: id !== null, loading, error, name: movie?.title }, HEADINGS));
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setMovie(null);
    setLoading(true);
    setError(null);

    let cancelled = false;

    const load = async () => {
      // One request carries every section (append_to_response). Only the
      // details are essential: a missing or malformed part leaves just that
      // section empty instead of failing the whole page.
      let movieData: TMDBMovieDetailResponse;
      try {
        movieData = (await fetchMovieDetails(id)).data;
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching movie details:", err);
        setError(isNotFound(err) ? "not-found" : "failed");
        setLoading(false);
        return;
      }
      if (cancelled) return;

      // A success without a record (an empty body) is a failed load, so the
      // page shows and titles its error state instead of a nameless record.
      if (!isRecord(movieData)) {
        setError("failed");
        setLoading(false);
        return;
      }

      const credits = objectOr<Partial<TMDBCredits>>(movieData.credits, {});
      const images = objectOr<Partial<TMDBImages>>(movieData.images, {});
      setMovie({
        ...movieData,
        credits: { ...credits, cast: arrayOr(credits.cast), crew: arrayOr(credits.crew) },
        videos: { results: resultsOf(movieData.videos) },
        images: { backdrops: arrayOr(images.backdrops), posters: arrayOr(images.posters) },
        recommendations: resultsOf(movieData.recommendations),
        reviews: resultsOf(movieData.reviews),
        similarMovies: resultsOf(movieData.similar),
        watchProviders: objectOr(movieData["watch/providers"]?.results, {}),
        certifications: resultsOf(movieData.release_dates),
      });
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (id === null) return <NotFoundPage />;
  if (loading) return <DetailPageSkeleton />;
  if (error === "not-found") return <LoadError notFound title={HEADINGS.notFound} />;
  if (error)
    return <LoadError title={HEADINGS.failed} onRetry={() => setReloadKey((k) => k + 1)} />;
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
