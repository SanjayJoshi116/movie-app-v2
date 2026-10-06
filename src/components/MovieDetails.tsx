import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Button, Tag, Typography, Descriptions,
  Statistic, Card, Space, Image,
} from "antd";
import {
  BookOutlined, BookFilled, StarOutlined, StarFilled, LeftOutlined, EyeOutlined, EyeFilled, PlusOutlined,
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";
import { RatingModal } from "./watchlist/RatingModal";
import { AddToListModal } from "./AddToListModal";
import { MarkWatchedModal } from "./MarkWatchedModal";
import { getApiError } from "../utils/apiError";
import { formatDateDMY } from "../utils/formatDate";
import { InfoTooltip } from "./InfoTooltip";
import { SectionHeader } from "./SectionHeader";
import { WatchProviders } from "./WatchProviders";
import { MediaCardGrid } from "./MediaCardGrid";
import { ReviewsSection } from "./ReviewsSection";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { FONT_SIZE } from "../constants/typography";
import type { TMDBMovieDetail, TMDBProviderRegion } from "../types";
import { IMG_URL, BACKDROP_URL, RATING_GOLD, WATCHED_GREEN } from "../constants/ui";
import { filterByGenreOverlap } from "../utils/filterByGenreOverlap";

interface ReleaseDateEntry {
  iso_3166_1: string;
  release_dates: Array<{ certification: string; type: number }>;
}

type RecommendationItem = { id: number; poster_path: string | null; title: string; genre_ids: number[] };
type SimilarMovieItem = RecommendationItem;

export type MovieDetailData = Omit<
  TMDBMovieDetail,
  "recommendations" | "reviews" | "similarMovies" | "watchProviders" | "certifications"
> & {
  reviews: Array<{ id: string; author: string; content: string }>;
  recommendations: RecommendationItem[];
  similarMovies: SimilarMovieItem[];
  watchProviders: Record<string, TMDBProviderRegion>;
  certifications: ReleaseDateEntry[] | string;
};

interface Props {
  movie: MovieDetailData;
}

function renderCertifications(certs: ReleaseDateEntry[] | string): string {
  if (!certs || typeof certs === "string") return certs || "N/A";
  const us = certs.find((c) => c.iso_3166_1 === "US");
  if (!us) return "Not Rated";
  const cert = us.release_dates.find((r) => r.certification);
  return cert?.certification || "Not Rated";
}

const MovieDetails = ({ movie }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; [key: string]: unknown } | null;
  const from = locationState?.from;
  const { isInWatchlist, toggleWatchlist, getRating, setRating, removeRating } = useAppContext();
  const { showSuccess, showError } = useToast();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showMarkWatchedModal, setShowMarkWatchedModal] = useState(false);

  const {
    id, title, overview, release_date, poster_path, backdrop_path, genres, runtime,
    budget, revenue, status, original_language, credits, images, videos,
    recommendations, reviews, similarMovies, watchProviders, certifications,
    vote_average,
  } = movie;

  const similarFiltered = filterByGenreOverlap(similarMovies ?? [], (genres ?? []).map((g) => g.id));
  const recommendationsFiltered = filterByGenreOverlap(recommendations ?? [], (genres ?? []).map((g) => g.id));
  const cast = credits?.cast ?? [];
  const directors = (credits?.crew ?? [])
    .filter((c: any) => c.job === "Director")
    .map((c: any) => c.name)
    .join(", ");
  const { isWatched, toggleWatched, theme } = useAppContext();
  const inWatchlist = isInWatchlist(id, "movie");
  const watched = isWatched(id, "movie");
  const myRating = getRating(id, "movie");
  const hasBackdrop = !!backdrop_path;

  return (
    <div>
      {/* Backdrop hero */}
      {hasBackdrop && (
        <div className="detail-backdrop-hero">
          <img
            className="detail-backdrop-img"
            src={`${BACKDROP_URL}${backdrop_path}`}
            alt={`${title} backdrop`}
          />
          <div className="detail-backdrop-gradient" />
        </div>
      )}

      {/* Glass info card */}
      <div
        className={hasBackdrop ? "detail-glass-card glass-overlay-card" : "detail-container"}
        style={!hasBackdrop ? { paddingBottom: 16 } : undefined}
      >
        <Button
          icon={<LeftOutlined />}
          onClick={() => from ? navigate(from, { state: { ...locationState, isReturn: true } }) : navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>

        <Row gutter={[24, 24]}>
          <Col xs={24} sm={8} md={6}>
            {poster_path ? (
              <img
                src={`${IMG_URL}${poster_path}`}
                alt={title}
                className="detail-poster-img"
              />
            ) : (
              <PosterPlaceholder className="detail-poster-img" />
            )}
          </Col>
          <Col xs={24} sm={16} md={18}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Typography.Title level={2} style={{ margin: 0 }}>{title}</Typography.Title>
                <motion.button
                  onClick={async () => {
                    try {
                      await toggleWatchlist({ id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                      showSuccess(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
                    } catch (err) {
                      showError(getApiError(err, "Failed to update watchlist."));
                    }
                  }}
                  whileTap={{ scale: 0.85 }}
                  animate={{ scale: inWatchlist ? 1.1 : 1 }}
                  aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: RATING_GOLD, fontSize: "1.5rem" }}
                >
                  {inWatchlist ? <BookFilled /> : <BookOutlined />}
                </motion.button>
                <motion.button
                  onClick={async () => {
                    if (watched) {
                      try {
                        await toggleWatched({ id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                        showSuccess("Removed from watched");
                      } catch (err) {
                        showError(getApiError(err, "Failed to update watched status."));
                      }
                    } else {
                      setShowMarkWatchedModal(true);
                    }
                  }}
                  whileTap={{ scale: 0.85 }}
                  animate={{ scale: watched ? 1.1 : 1 }}
                  aria-label={watched ? "Unmark as watched" : "Mark as watched"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: watched ? WATCHED_GREEN : theme === "dark" ? RATING_GOLD : "#000000", fontSize: "1.5rem" }}
                >
                  {watched ? <EyeFilled /> : <EyeOutlined />}
                </motion.button>
                <Button
                  icon={myRating ? <StarFilled style={{ color: RATING_GOLD }} /> : <StarOutlined />}
                  onClick={() => setShowRatingModal(true)}
                  aria-label="Rate this movie"
                >
                  {myRating ? `${myRating.userRating}/10` : "Rate"}
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => setShowListModal(true)}>
                  Add to List
                </Button>
              </div>

              <Typography.Paragraph style={{ fontSize: FONT_SIZE.body, lineHeight: 1.7 }}>{overview}</Typography.Paragraph>

              <Row gutter={[16, 8]}>
                <Col>
                  <Statistic
                    title={<>TMDB Rating<InfoTooltip title="Score from The Movie Database (TMDB) community, not a critic score." /></>}
                    value={vote_average?.toFixed(1)}
                    prefix={<StarFilled style={{ color: RATING_GOLD }} />}
                  />
                </Col>
                {runtime && (
                  <Col>
                    <Statistic title="Runtime" value={`${runtime} min`} />
                  </Col>
                )}
                {budget ? (
                  <Col>
                    <Statistic title="Budget (USD)" value={budget} prefix="$" formatter={(v) => Number(v).toLocaleString()} />
                  </Col>
                ) : null}
              </Row>

              <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                <Descriptions.Item label="Release Date">{release_date ? formatDateDMY(release_date) : "-"}</Descriptions.Item>
                <Descriptions.Item label="Status">{status}</Descriptions.Item>
                <Descriptions.Item label="Language">{original_language?.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label={<>Certification<InfoTooltip title="US content rating (MPAA-style); may not reflect ratings in other regions." /></>}>{renderCertifications(certifications)}</Descriptions.Item>
                {directors && <Descriptions.Item label="Director">{directors}</Descriptions.Item>}
                {revenue ? <Descriptions.Item label="Revenue (USD)">${revenue.toLocaleString()}</Descriptions.Item> : null}
              </Descriptions>

              {genres && genres.length > 0 && (
                <Space wrap>
                  {genres.map((g) => (
                    <Tag key={g.id} color="gold">{g.name}</Tag>
                  ))}
                </Space>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {showRatingModal && (
        <RatingModal
          title={title}
          existing={myRating}
          onSave={async (r, rev) => {
            try {
              await setRating(id, "movie", title, r, rev);
              showSuccess(`Rated ${title} ${r}/10`);
            } catch (err) {
              showError(getApiError(err, "Failed to save rating."));
              throw err;
            }
          }}
          onRemove={async () => {
            try {
              await removeRating(id, "movie");
              showSuccess("Rating removed");
            } catch (err) {
              showError(getApiError(err, "Failed to remove rating."));
              throw err;
            }
          }}
          onClose={() => setShowRatingModal(false)}
        />
      )}

      <AddToListModal
        open={showListModal}
        onClose={() => setShowListModal(false)}
        mediaId={id}
        mediaType="movie"
        title={title}
        posterPath={poster_path}
        voteAverage={vote_average}
      />

      <MarkWatchedModal
        open={showMarkWatchedModal}
        mediaId={id}
        mediaType="movie"
        onCancel={() => setShowMarkWatchedModal(false)}
        onConfirm={async (details) => {
          try {
            await toggleWatched({ id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average, ...details });
            showSuccess("Marked as watched");
          } catch (err) {
            showError(getApiError(err, "Failed to mark as watched."));
          }
          setShowMarkWatchedModal(false);
        }}
      />

      {/* Sections below the glass card */}
      <div className="detail-container">
        {/* Watch Providers */}
        {watchProviders && (
          <>
            <SectionHeader title="Where to Watch" />
            <WatchProviders providers={watchProviders} title={title} />
          </>
        )}

        {/* Cast - horizontal scroll */}
        {cast.length > 0 && (
          <>
            <SectionHeader title="Cast" />
            <div className="cast-scroll-container">
              {cast.slice(0, 15).map((actor) => (
                <div key={actor.id} className="cast-scroll-item">
                  <Card
                    hoverable
                    size="small"
                    onClick={() => navigate(`/person/${actor.id}`)}
                    cover={
                      actor.profile_path ? (
                        <img
                          src={`${IMG_URL}${actor.profile_path}`}
                          alt={actor.name}
                          className="cast-card-img-lg"
                          loading="lazy"
                        />
                      ) : (
                        <PosterPlaceholder className="cast-card-img-lg" />
                      )
                    }
                    styles={{ body: { padding: "6px 8px" } }}
                    aria-label={`View details for ${actor.name}`}
                  >
                    <Typography.Text strong style={{ fontSize: FONT_SIZE.caption, display: "block" }}>{actor.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption }}>{actor.character}</Typography.Text>
                  </Card>
                </div>
              ))}
            </div>
          </>
        )}

        <MediaCardGrid
          title="Recommendations"
          items={recommendationsFiltered.map((rec) => ({ id: rec.id, posterPath: rec.poster_path, name: rec.title }))}
          mediaType="movie"
        />

        <MediaCardGrid
          title="Similar Movies"
          items={similarFiltered.map((m) => ({ id: m.id, posterPath: m.poster_path, name: m.title }))}
          mediaType="movie"
        />

        {/* Videos — trailers only */}
        {videos?.results?.filter((v) => v.type === "Trailer").length > 0 && (
          <>
            <SectionHeader title="Trailers" />
            <Row gutter={[16, 16]}>
              {videos.results.filter((v) => v.type === "Trailer").map((video) => (
                <Col key={video.id} xs={24} md={12}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.key}`}
                    title={video.name}
                    className="embed-frame"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <Typography.Text style={{ display: "block", marginTop: 4, fontSize: FONT_SIZE.caption }}>{video.name}</Typography.Text>
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* Backdrops */}
        {images?.backdrops?.length > 0 && (
          <>
            <SectionHeader title="Images" />
            <Image.PreviewGroup>
              <Row gutter={[12, 12]}>
                {images.backdrops.slice(0, 10).map((image) => (
                  <Col key={image.file_path} xs={12} sm={8} md={6}>
                    <Image
                      src={`${IMG_URL}${image.file_path}`}
                      preview={{ src: `${BACKDROP_URL}${image.file_path}` }}
                      alt="Backdrop"
                      className="backdrop-img"
                      style={{ borderRadius: 8 }}
                    />
                  </Col>
                ))}
              </Row>
            </Image.PreviewGroup>
          </>
        )}

        {/* Reviews */}
        <ReviewsSection reviews={reviews} />
      </div>
    </div>
  );
};

export default MovieDetails;
