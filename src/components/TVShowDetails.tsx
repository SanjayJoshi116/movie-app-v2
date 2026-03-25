import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Button, Tag, Typography, Descriptions,
  Statistic, Card, Space, Divider, Image, Spin,
} from "antd";
import {
  BookOutlined, BookFilled, StarOutlined, StarFilled, LeftOutlined, EyeOutlined, EyeFilled,
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { RatingModal } from "./watchlist/RatingModal";
import type { TMDBTVDetail, TMDBProviderRegion } from "../types";

const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/original";

interface Props {
  tvShow: TMDBTVDetail & {
    watchProviders?: Record<string, TMDBProviderRegion>;
    external_ids?: { imdb_id?: string };
    last_air_date?: string;
    next_episode_to_air?: { air_date: string };
    aggregate_credits?: TMDBTVDetail["aggregateCredits"];
    similar?: { results: TMDBTVDetail["recommendations"] };
  };
}

const TVShowDetails = ({ tvShow }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; page?: number } | null;
  const from = locationState?.from;
  const savedPage = locationState?.page;
  const { isInWatchlist, toggleWatchlist, getRating, setRating, isWatched, toggleWatched } = useAppContext();
  const [showRatingModal, setShowRatingModal] = useState(false);

  if (!tvShow) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  const inWatchlist = isInWatchlist(tvShow.id, "tv");
  const watched = isWatched(tvShow.id, "tv");
  const myRating = getRating(tvShow.id, "tv");

  const {
    id, name, overview, first_air_date, poster_path, backdrop_path, genres, vote_average,
    number_of_episodes, number_of_seasons, original_language, status,
    last_air_date, next_episode_to_air, networks, external_ids,
    aggregate_credits, similar, recommendations, images,
  } = tvShow;

  const hasBackdrop = !!backdrop_path;
  const castList = aggregate_credits?.cast ?? [];

  return (
    <div>
      {/* Backdrop hero */}
      {hasBackdrop && (
        <div className="detail-backdrop-hero">
          <img
            className="detail-backdrop-img"
            src={`${BACKDROP_URL}${backdrop_path}`}
            alt={`${name} backdrop`}
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
          onClick={() => from ? navigate(from, { state: { page: savedPage, isReturn: true } }) : navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>

        <Row gutter={[24, 24]}>
          <Col xs={24} sm={8} md={6}>
            <img
              src={poster_path ? `${IMG_URL}${poster_path}` : "https://placehold.co/500x750?text=No+Image"}
              alt={name}
              style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
            />
          </Col>
          <Col xs={24} sm={16} md={18}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Typography.Title level={2} style={{ margin: 0 }}>{name}</Typography.Title>
                <motion.button
                  onClick={() => toggleWatchlist({ id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average })}
                  whileTap={{ scale: 0.85 }}
                  animate={{ scale: inWatchlist ? 1.1 : 1 }}
                  aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#f5c518", fontSize: "1.5rem" }}
                >
                  {inWatchlist ? <BookFilled /> : <BookOutlined />}
                </motion.button>
                <motion.button
                  onClick={() => toggleWatched({ id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average })}
                  whileTap={{ scale: 0.85 }}
                  animate={{ scale: watched ? 1.1 : 1 }}
                  aria-label={watched ? "Unmark as watched" : "Mark as watched"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: watched ? "#f5c518" : undefined, fontSize: "1.5rem" }}
                >
                  {watched ? <EyeFilled /> : <EyeOutlined />}
                </motion.button>
                <Button
                  icon={myRating ? <StarFilled style={{ color: "#f5c518" }} /> : <StarOutlined />}
                  onClick={() => setShowRatingModal(true)}
                  aria-label="Rate this show"
                >
                  {myRating ? `${myRating.userRating}/10` : "Rate"}
                </Button>
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
                {number_of_seasons && (
                  <Col>
                    <Statistic title="Seasons" value={number_of_seasons} />
                  </Col>
                )}
                {number_of_episodes && (
                  <Col>
                    <Statistic title="Episodes" value={number_of_episodes} />
                  </Col>
                )}
              </Row>

              <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                <Descriptions.Item label="First Air Date">{first_air_date || "N/A"}</Descriptions.Item>
                <Descriptions.Item label="Status">{status || "N/A"}</Descriptions.Item>
                <Descriptions.Item label="Language">{original_language?.toUpperCase() || "N/A"}</Descriptions.Item>
                <Descriptions.Item label="Last Air Date">{last_air_date || "N/A"}</Descriptions.Item>
                {next_episode_to_air && (
                  <Descriptions.Item label="Next Episode">{next_episode_to_air.air_date}</Descriptions.Item>
                )}
                {networks && networks.length > 0 && (
                  <Descriptions.Item label="Network">{networks.map((n) => n.name).join(", ")}</Descriptions.Item>
                )}
                {external_ids?.imdb_id && (
                  <Descriptions.Item label="IMDb">
                    <a href={`https://www.imdb.com/title/${external_ids.imdb_id}`} target="_blank" rel="noopener noreferrer">
                      View on IMDb
                    </a>
                  </Descriptions.Item>
                )}
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
          title={name}
          existing={myRating}
          onSave={(r, rev) => setRating(id, "tv", name, r, rev)}
          onClose={() => setShowRatingModal(false)}
        />
      )}

      {/* Sections below the glass card */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Cast - horizontal scroll */}
        {castList.length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Cast</Typography.Title></Divider>
            <div className="cast-scroll-container">
              {castList.slice(0, 15).map((actor) => (
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
                    <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                      {actor.roles?.[0]?.character || ""}
                    </Typography.Text>
                  </Card>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Similar Shows */}
        {(similar?.results?.length ?? 0) > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Similar TV Shows</Typography.Title></Divider>
            <Row gutter={[12, 16]}>
              {similar!.results.map((show) => {
                const showName = "name" in show ? show.name : "";
                return (
                  <Col key={show.id} xs={8} sm={6} md={4} lg={3}>
                    <Card
                      hoverable
                      size="small"
                      onClick={() => navigate(`/tv/${show.id}`)}
                      cover={
                        <img
                          src={show.poster_path ? `${IMG_URL}${show.poster_path}` : "https://placehold.co/150x225?text=?"}
                          alt={showName}
                          className="rec-card-img"
                        />
                      }
                      bodyStyle={{ padding: "6px 8px" }}
                    >
                      <Typography.Text style={{ fontSize: 11 }}>{showName}</Typography.Text>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </>
        )}

        {/* Recommendations */}
        {(recommendations as { results?: unknown[] } | undefined)?.results?.length && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Recommendations</Typography.Title></Divider>
            <Row gutter={[12, 16]}>
              {(recommendations as Array<{ id: number; poster_path: string | null; name: string }>).map((show) => (
                <Col key={show.id} xs={8} sm={6} md={4} lg={3}>
                  <Card
                    hoverable
                    size="small"
                    onClick={() => navigate(`/tv/${show.id}`)}
                    cover={
                      <img
                        src={show.poster_path ? `${IMG_URL}${show.poster_path}` : "https://placehold.co/150x225?text=?"}
                        alt={show.name}
                        className="rec-card-img"
                      />
                    }
                    bodyStyle={{ padding: "6px 8px" }}
                  >
                    <Typography.Text style={{ fontSize: 11 }}>{show.name}</Typography.Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* Backdrops */}
        {images?.backdrops?.length > 0 && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Images</Typography.Title></Divider>
            <Row gutter={[12, 12]}>
              {images.backdrops.slice(0, 10).map((image, index) => (
                <Col key={index} xs={12} sm={8} md={6}>
                  <Image
                    src={`${BACKDROP_URL}${image.file_path}`}
                    alt={`Backdrop ${index + 1}`}
                    className="backdrop-img"
                    style={{ borderRadius: 8 }}
                  />
                </Col>
              ))}
            </Row>
          </>
        )}
      </div>
    </div>
  );
};

export default TVShowDetails;
