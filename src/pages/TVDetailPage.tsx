import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Result, Button } from "antd";
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

function TVDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tvShow, setTVShow] = useState<TVShowDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setTVShow(null);
    setLoading(true);
    setError(null);

    let cancelled = false;

    const load = async () => {
      try {
        const [detailsRes, creditsRes, aggregateCreditsRes, imagesRes, providersRes, reviewsRes] =
          await Promise.all([
            fetchTVDetails(id),
            fetchTVCredits(id),
            fetchTVAggregateCredits(id),
            fetchTVImages(id),
            fetchTVWatchProviders(id),
            fetchTVReviews(id),
          ]);
        if (cancelled) return;

        setTVShow({
          ...detailsRes.data,
          credits: creditsRes.data,
          aggregate_credits: aggregateCreditsRes.data,
          images: imagesRes.data,
          watchProviders: providersRes.data.results,
          reviews: reviewsRes.data.results,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching TV show details:", err);
        setError("Failed to load TV show details.");
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
