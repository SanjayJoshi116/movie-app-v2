import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import TVShowDetails from "../components/TVShowDetails";
import type { TVShowDetailData } from "../components/TVShowDetails";
import DetailPageSkeleton from "../components/DetailPageSkeleton";
import {
  fetchTVDetails,
  fetchTVCredits,
  fetchTVAggregateCredits,
  fetchTVImages,
  fetchTVWatchProviders,
  fetchTVReviews,
} from "../api/tmdb";
import { pageVariants } from "../constants/ui";
import { LoadError } from "../components/LoadError";
import NotFoundPage from "./NotFoundPage";
import { useValidId } from "../hooks/useValidId";
import { settledData, isNotFound } from "../utils/settled";

function TVDetailPage() {
  const id = useValidId();
  const [tvShow, setTVShow] = useState<TVShowDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not-found" | "failed" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setTVShow(null);
    setLoading(true);
    setError(null);

    let cancelled = false;

    const load = async () => {
      // Only the details call is essential; each secondary section degrades
      // to empty on its own instead of failing the whole page.
      const [detailsRes, creditsRes, aggregateCreditsRes, imagesRes, providersRes, reviewsRes] =
        await Promise.allSettled([
          fetchTVDetails(id),
          fetchTVCredits(id),
          fetchTVAggregateCredits(id),
          fetchTVImages(id),
          fetchTVWatchProviders(id),
          fetchTVReviews(id),
        ]);
      if (cancelled) return;

      if (detailsRes.status === "rejected") {
        console.error("Error fetching TV show details:", detailsRes.reason);
        setError(isNotFound(detailsRes.reason) ? "not-found" : "failed");
        setLoading(false);
        return;
      }

      setTVShow({
        ...detailsRes.value.data,
        credits: settledData(creditsRes) ?? { cast: [], crew: [] },
        aggregate_credits: settledData(aggregateCreditsRes),
        images: settledData(imagesRes) ?? { backdrops: [], posters: [] },
        watchProviders: settledData(providersRes)?.results ?? {},
        reviews: settledData(reviewsRes)?.results ?? [],
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
  if (error === "not-found") return <LoadError notFound title="TV show not found" />;
  if (error)
    return <LoadError title="Failed to load TV show details" onRetry={() => setReloadKey((k) => k + 1)} />;
  if (!tvShow) return null;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <TVShowDetails tvShow={tvShow} />
    </motion.div>
  );
}

export default TVDetailPage;
