import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import TVShowDetails from "../components/TVShowDetails";
import type { TVShowDetailData } from "../components/TVShowDetails";
import DetailPageSkeleton from "../components/DetailPageSkeleton";
import { fetchTVDetails } from "../api/tmdb";
import { pageVariants } from "../constants/ui";
import { LoadError } from "../components/LoadError";
import NotFoundPage from "./NotFoundPage";
import { useValidId } from "../hooks/useValidId";
import { isNotFound } from "../utils/settled";
import { arrayOr, isRecord, objectOr, resultsOf } from "../utils/appended";
import type { TMDBAggregateCreditsFull, TMDBImages, TMDBReview, TMDBTVDetailResponse } from "../types";
import { usePageTitle, detailPageTitle } from "../hooks/usePageTitle";
import type { DetailHeadings } from "../hooks/usePageTitle";

const HEADINGS: DetailHeadings = {
  generic: "TV Show",
  notFound: "TV show not found",
  failed: "Failed to load TV show details",
};

function TVDetailPage() {
  const id = useValidId();
  const [tvShow, setTVShow] = useState<TVShowDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not-found" | "failed" | null>(null);
  usePageTitle(...detailPageTitle({ validId: id !== null, loading, error, name: tvShow?.name }, HEADINGS));
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    setTVShow(null);
    setLoading(true);
    setError(null);

    let cancelled = false;

    const load = async () => {
      // One request carries every section (append_to_response). Only the
      // details are essential: a missing or malformed part leaves just that
      // section empty instead of failing the whole page.
      let show: TMDBTVDetailResponse;
      try {
        show = (await fetchTVDetails(id)).data;
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching TV show details:", err);
        setError(isNotFound(err) ? "not-found" : "failed");
        setLoading(false);
        return;
      }
      if (cancelled) return;

      // A success without a record (an empty body) is a failed load, so the
      // page shows and titles its error state instead of a nameless record.
      if (!isRecord(show)) {
        setError("failed");
        setLoading(false);
        return;
      }

      const images = objectOr<Partial<TMDBImages>>(show.images, {});
      const aggregate = objectOr<Partial<TMDBAggregateCreditsFull>>(show.aggregate_credits, {});
      setTVShow({
        ...show,
        videos: { results: resultsOf(show.videos) },
        images: { backdrops: arrayOr(images.backdrops), posters: arrayOr(images.posters) },
        aggregate_credits: { cast: arrayOr(aggregate.cast), crew: arrayOr(aggregate.crew) },
        recommendations: resultsOf(show.recommendations),
        similar: { results: resultsOf(show.similar) },
        watchProviders: objectOr(show["watch/providers"]?.results, {}),
        reviews: resultsOf<TMDBReview>(show.reviews),
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
