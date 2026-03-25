import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Spin, Result, Button } from "antd";
import TVShowDetails from "../components/TVShowDetails";
import {
  fetchTVDetails,
  fetchTVCredits,
  fetchTVAggregateCredits,
  fetchTVImages,
  fetchTVRecommendations,
} from "../api/tmdb";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

function TVDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tvShow, setTVShow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setTVShow(null);
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const [detailsRes, creditsRes, aggregateCreditsRes, imagesRes, recommendationsRes] =
          await Promise.all([
            fetchTVDetails(id),
            fetchTVCredits(id),
            fetchTVAggregateCredits(id),
            fetchTVImages(id),
            fetchTVRecommendations(id),
          ]);

        setTVShow({
          ...detailsRes.data,
          credits: creditsRes.data,
          aggregate_credits: aggregateCreditsRes.data,
          images: imagesRes.data,
          recommendations: recommendationsRes.data.results,
        });
      } catch (err) {
        console.error("Error fetching TV show details:", err);
        setError("Failed to load TV show details.");
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
