import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Button, Tag, Typography, Descriptions,
  Statistic, Card, Space, Divider, Image, Modal, Checkbox,
} from "antd";
import {
  BookOutlined, BookFilled, StarOutlined, StarFilled, LeftOutlined, EyeOutlined, EyeFilled, PlusOutlined,
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useListsContext } from "../context/useListsContext";
import { useToast } from "../hooks/useToast";
import { RatingModal } from "./watchlist/RatingModal";
import type { TMDBMovieDetail, TMDBProvider, TMDBProviderRegion } from "../types";

const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/original";

interface ReleaseDateEntry {
  iso_3166_1: string;
  release_dates: Array<{ certification: string; type: number }>;
}

type RecommendationItem = { id: number; poster_path: string | null; title: string };

interface Props {
  movie: Omit<TMDBMovieDetail, "recommendations"> & {
    reviews: Array<{ id: string; author: string; content: string }>;
    recommendations: RecommendationItem[];
    similarMovies: RecommendationItem[];
    watchProviders: Record<string, TMDBProviderRegion>;
    certifications: ReleaseDateEntry[] | string;
  };
}

function renderCertifications(certs: ReleaseDateEntry[] | string): string {
  if (!certs || typeof certs === "string") return certs || "N/A";
  const us = certs.find((c) => c.iso_3166_1 === "US");
  if (!us) return "Not Rated";
  const cert = us.release_dates.find((r) => r.certification);
  return cert?.certification || "Not Rated";
}

const PROVIDER_SEARCH_URLS: Record<number, (title: string) => string> = {
  8:    (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
  9:    (t) => `https://www.amazon.com/s?k=${encodeURIComponent(t)}&i=instant-video`,
  119:  (t) => `https://www.amazon.com/s?k=${encodeURIComponent(t)}&i=instant-video`,
  337:  (t) => `https://www.disneyplus.com/search/${encodeURIComponent(t)}`,
  384:  (t) => `https://www.max.com/search?q=${encodeURIComponent(t)}`,
  1899: (t) => `https://www.max.com/search?q=${encodeURIComponent(t)}`,
  350:  (t) => `https://tv.apple.com/search?term=${encodeURIComponent(t)}`,
  15:   (t) => `https://www.hulu.com/search?q=${encodeURIComponent(t)}`,
  386:  (t) => `https://www.peacocktv.com/search?q=${encodeURIComponent(t)}`,
  531:  (t) => `https://www.paramountplus.com/search/${encodeURIComponent(t)}/`,
  283:  (t) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(t)}`,
};

function WatchProviders({ providers, title }: { providers: Record<string, TMDBProviderRegion>; title: string }) {
  const us = providers["US"];
  if (!us) return <Typography.Text type="secondary">No watch provider info available for your region.</Typography.Text>;

  const getProviderUrl = (p: TMDBProvider) =>
    PROVIDER_SEARCH_URLS[p.provider_id]?.(title) ?? us.link ?? "#";

  const renderSection = (sectionTitle: string, list: TMDBProvider[]) => (
    <div key={sectionTitle} style={{ marginBottom: 12 }}>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>{sectionTitle}</Typography.Text>
      <Space wrap>
        {list.map((p) => (
          <a
            key={p.provider_id}
            href={getProviderUrl(p)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Watch on ${p.provider_name}`}
          >
            <img
              src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
              alt={p.provider_name}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", display: "block" }}
            />
          </a>
        ))}
      </Space>
    </div>
  );

  return (
    <>
      {us.flatrate && renderSection("Streaming", us.flatrate)}
      {us.rent && renderSection("Rent", us.rent)}
    </>
  );
}

const MovieDetails = ({ movie }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; page?: number; scrollY?: number; loadedPages?: number } | null;
  const from = locationState?.from;
  const savedPage = locationState?.page;
  const savedScrollY = locationState?.scrollY;
  const savedLoadedPages = locationState?.loadedPages;
  const { isInWatchlist, toggleWatchlist, getRating, setRating } = useAppContext();
  const { lists, addToList, isInList } = useListsContext();
  const { showSuccess } = useToast();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);

  const {
    id, title, overview, release_date, poster_path, backdrop_path, genres, runtime,
    budget, revenue, status, original_language, credits, images, videos,
    recommendations, reviews, similarMovies, watchProviders, certifications,
    vote_average,
  } = movie;

  const cast = credits?.cast ?? [];
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
        className={hasBackdrop ? "detail-glass-card glass-overlay-card" : ""}
        style={!hasBackdrop ? { maxWidth: 1200, margin: "0 auto", paddingBottom: 16 } : undefined}
      >
        <Button
          icon={<LeftOutlined />}
          onClick={() => from ? navigate(from, { state: { page: savedPage, scrollY: savedScrollY, loadedPages: savedLoadedPages, isReturn: true } }) : navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>

        <Row gutter={[24, 24]}>
          <Col xs={24} sm={8} md={6}>
            <img
              src={poster_path ? `${IMG_URL}${poster_path}` : "https://placehold.co/500x750?text=No+Image"}
              alt={title}
              className="person-profile-img"
              style={{ width: "100%", maxWidth: "100%", borderRadius: 12 }}
            />
          </Col>
          <Col xs={24} sm={16} md={18}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Typography.Title level={2} style={{ margin: 0 }}>{title}</Typography.Title>
                <motion.button
                  onClick={() => {
                    toggleWatchlist({ id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                    showSuccess(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
                  }}
                  whileTap={{ scale: 0.85 }}
                  animate={{ scale: inWatchlist ? 1.1 : 1 }}
                  aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#f5c518", fontSize: "1.5rem" }}
                >
                  {inWatchlist ? <BookFilled /> : <BookOutlined />}
                </motion.button>
                <motion.button
                  onClick={() => {
                    toggleWatched({ id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                    showSuccess(watched ? "Removed from watched" : "Marked as watched");
                  }}
                  whileTap={{ scale: 0.85 }}
                  animate={{ scale: watched ? 1.1 : 1 }}
                  aria-label={watched ? "Unmark as watched" : "Mark as watched"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: watched ? "#52c41a" : theme === "dark" ? "#f5c518" : "#000000", fontSize: "1.5rem" }}
                >
                  {watched ? <EyeFilled /> : <EyeOutlined />}
                </motion.button>
                <Button
                  icon={myRating ? <StarFilled style={{ color: "#f5c518" }} /> : <StarOutlined />}
                  onClick={() => setShowRatingModal(true)}
                  aria-label="Rate this movie"
                >
                  {myRating ? `${myRating.userRating}/10` : "Rate"}
                </Button>
                {lists.length > 0 && (
                  <Button icon={<PlusOutlined />} onClick={() => setShowListModal(true)}>
                    Add to List
                  </Button>
                )}
              </div>

              <Typography.Paragraph style={{ fontSize: 15, lineHeight: 1.7 }}>{overview}</Typography.Paragraph>

              <Row gutter={[16, 8]}>
                <Col>
                  <Statistic
                    title="TMDB Rating"
                    value={vote_average?.toFixed(1)}
                    prefix={<StarFilled style={{ color: "#f5c518" }} />}
                  />
                </Col>
                {runtime && (
                  <Col>
                    <Statistic title="Runtime" value={`${runtime} min`} />
                  </Col>
                )}
                {budget ? (
                  <Col>
                    <Statistic title="Budget" value={budget} prefix="$" formatter={(v) => Number(v).toLocaleString()} />
                  </Col>
                ) : null}
              </Row>

              <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                <Descriptions.Item label="Release Date">{release_date}</Descriptions.Item>
                <Descriptions.Item label="Status">{status}</Descriptions.Item>
                <Descriptions.Item label="Language">{original_language?.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="Certification">{renderCertifications(certifications)}</Descriptions.Item>
                {revenue ? <Descriptions.Item label="Revenue">${revenue.toLocaleString()}</Descriptions.Item> : null}
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
          onSave={(r, rev) => {
            setRating(id, "movie", title, r, rev);
            showSuccess(`Rated ${title} ${r}/10`);
          }}
          onClose={() => setShowRatingModal(false)}
        />
      )}

      <Modal
        title="Add to List"
        open={showListModal}
        onCancel={() => setShowListModal(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
          {lists.map((list) => {
            const inList = isInList(list.id, id, "movie");
            return (
              <div
                key={list.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}
              >
                <div>
                  <Typography.Text strong>{list.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {list.items.length} item{list.items.length !== 1 ? "s" : ""}
                  </Typography.Text>
                </div>
                <Checkbox
                  checked={inList}
                  onChange={() => {
                    if (!inList) {
                      addToList(list.id, { id, type: "movie", title, posterPath: poster_path, voteAverage: vote_average });
                      showSuccess(`Added to "${list.name}"`);
                    }
                  }}
                />
              </div>
            );
          })}
        </Space>
      </Modal>

      {/* Sections below the glass card */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Watch Providers */}
        {watchProviders && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Where to Watch</Typography.Title></Divider>
            <WatchProviders providers={watchProviders} title={title} />
          </>
        )}

        {/* Cast - horizontal scroll */}
        {cast.length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Cast</Typography.Title></Divider>
            <div className="cast-scroll-container">
              {cast.slice(0, 15).map((actor) => (
                <div key={actor.id} className="cast-scroll-item">
                  <Card
                    hoverable
                    size="small"
                    onClick={() => navigate(`/person/${actor.id}`)}
                    cover={
                      <img
                        src={actor.profile_path ? `${IMG_URL}${actor.profile_path}` : "https://placehold.co/150x225?text=?"}
                        alt={actor.name}
                        className="cast-card-img-lg"
                      />
                    }
                    bodyStyle={{ padding: "6px 8px" }}
                    aria-label={`View details for ${actor.name}`}
                  >
                    <Typography.Text strong style={{ fontSize: 11, display: "block" }}>{actor.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 10 }}>{actor.character}</Typography.Text>
                  </Card>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Recommendations */}
        {recommendations?.length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Recommendations</Typography.Title></Divider>
            <Row gutter={[12, 16]}>
              {recommendations.slice(0, 10).map((rec) => (
                <Col key={rec.id} xs={8} sm={6} md={4} lg={3}>
                  <Card
                    hoverable
                    size="small"
                    onClick={() => navigate(`/movie/${rec.id}`)}
                    cover={
                      <img
                        src={rec.poster_path ? `${IMG_URL}${rec.poster_path}` : "https://placehold.co/150x225?text=?"}
                        alt={rec.title}
                        className="rec-card-img"
                      />
                    }
                    bodyStyle={{ padding: "6px 8px" }}
                  >
                    <Typography.Text style={{ fontSize: 11 }}>{rec.title}</Typography.Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* Similar Movies */}
        {similarMovies?.length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Similar Movies</Typography.Title></Divider>
            <Row gutter={[12, 16]}>
              {similarMovies.slice(0, 10).map((m) => (
                <Col key={m.id} xs={8} sm={6} md={4} lg={3}>
                  <Card
                    hoverable
                    size="small"
                    onClick={() => navigate(`/movie/${m.id}`)}
                    cover={
                      <img
                        src={m.poster_path ? `${IMG_URL}${m.poster_path}` : "https://placehold.co/150x225?text=?"}
                        alt={m.title}
                        className="rec-card-img"
                      />
                    }
                    bodyStyle={{ padding: "6px 8px" }}
                  >
                    <Typography.Text style={{ fontSize: 11 }}>{m.title}</Typography.Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* Videos — trailers only */}
        {videos?.results?.filter((v) => v.type === "Trailer").length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Trailers</Typography.Title></Divider>
            <Row gutter={[16, 16]}>
              {videos.results.filter((v) => v.type === "Trailer").map((video) => (
                <Col key={video.id} xs={24} md={12}>
                  <iframe
                    src={`https://www.youtube.com/embed/${video.key}`}
                    title={video.name}
                    className="embed-frame"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <Typography.Text style={{ display: "block", marginTop: 4, fontSize: 12 }}>{video.name}</Typography.Text>
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* Backdrops */}
        {images?.backdrops?.length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Images</Typography.Title></Divider>
            <Image.PreviewGroup>
              <Row gutter={[12, 12]}>
                {images.backdrops.slice(0, 10).map((image, index) => (
                  <Col key={index} xs={12} sm={8} md={6}>
                    <Image
                      src={`${IMG_URL}${image.file_path}`}
                      alt={`Backdrop ${index + 1}`}
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
        {reviews?.length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Reviews</Typography.Title></Divider>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {reviews.map((review) => (
                <Card key={review.id} size="small">
                  <Typography.Text strong>{review.author}</Typography.Text>
                  <Typography.Paragraph
                    style={{ marginTop: 8, marginBottom: 0 }}
                    ellipsis={{ rows: 4, expandable: true, symbol: "more" }}
                  >
                    {review.content}
                  </Typography.Paragraph>
                </Card>
              ))}
            </Space>
          </>
        )}

      </div>
    </div>
  );
};

export default MovieDetails;
