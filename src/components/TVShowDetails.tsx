import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import EpisodeGuide from "./EpisodeGuide";
import { motion } from "framer-motion";
import {
  Row, Col, Button, Tag, Typography, Descriptions,
  Statistic, Card, Space, Divider, Image, Spin, Collapse, Popconfirm,
} from "antd";
import {
  BookOutlined, BookFilled, StarOutlined, StarFilled, LeftOutlined, EyeOutlined, EyeFilled, PlusOutlined,
  PlayCircleOutlined, MinusOutlined, DeleteOutlined,
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";
import { useEpisodeProgress } from "../hooks/useEpisodeProgress";
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
import type { TMDBTVDetail, TMDBProviderRegion } from "../types";
import { IMG_URL, BACKDROP_URL, NO_IMAGE, RATING_GOLD, WATCHED_GREEN } from "../constants/ui";
import { FONT_SIZE } from "../constants/typography";
import { filterByGenreOverlap } from "../utils/filterByGenreOverlap";

export type TVShowDetailData = TMDBTVDetail & {
  watchProviders?: Record<string, TMDBProviderRegion>;
  external_ids?: { imdb_id?: string };
  last_air_date?: string;
  next_episode_to_air?: { air_date: string };
  aggregate_credits?: TMDBTVDetail["aggregateCredits"];
  similar?: { results: TMDBTVDetail["recommendations"] };
  reviews: Array<{ id: string; author: string; content: string }>;
};

interface Props {
  tvShow: TVShowDetailData;
}

const TVShowDetails = ({ tvShow }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; [key: string]: unknown } | null;
  const from = locationState?.from;
  const { isInWatchlist, toggleWatchlist, getRating, setRating, isWatched, toggleWatched, theme } = useAppContext();
  const { showSuccess, showError } = useToast();
  const { progress: epProgress, update: updateEpProgress, clear: clearEpProgress } = useEpisodeProgress(tvShow?.id ?? 0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showMarkWatchedModal, setShowMarkWatchedModal] = useState(false);
  const [epSeason, setEpSeason] = useState<number>(1);
  const [epEpisode, setEpEpisode] = useState<number>(1);
  const [epEditing, setEpEditing] = useState(false);

  if (!tvShow) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  const inWatchlist = isInWatchlist(tvShow.id, "tv");
  const watched = isWatched(tvShow.id, "tv");
  const myRating = getRating(tvShow.id, "tv");

  const {
    id, name, overview, first_air_date, poster_path, backdrop_path, genres, vote_average,
    number_of_episodes, number_of_seasons, original_language, status,
    last_air_date, next_episode_to_air, networks, external_ids,
    aggregate_credits, similar, recommendations, images, videos, reviews,
  } = tvShow;

  const hasBackdrop = !!backdrop_path;
  const similarFiltered = filterByGenreOverlap(similar?.results ?? [], (genres ?? []).map((g) => g.id));
  const recommendationsFiltered = filterByGenreOverlap(
    (recommendations as unknown as { results?: TMDBTVDetail["recommendations"] })?.results ?? [],
    (genres ?? []).map((g) => g.id),
  );
  const castList = aggregate_credits?.cast ?? [];
  const creators = ((tvShow as any).created_by ?? [])
    .map((c: any) => c.name)
    .join(", ");

  const getMaxEpisodes = (season: number): number => {
    const s = tvShow.seasons?.find((s) => s.season_number === season);
    return s?.episode_count ?? 99;
  };

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
            <img
              src={poster_path ? `${IMG_URL}${poster_path}` : NO_IMAGE}
              alt={name}
              className="detail-poster-img"
            />
          </Col>
          <Col xs={24} sm={16} md={18}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Typography.Title level={2} style={{ margin: 0 }}>{name}</Typography.Title>
                <motion.button
                  onClick={async () => {
                    try {
                      await toggleWatchlist({ id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average });
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
                        await toggleWatched({ id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average });
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
                  aria-label="Rate this show"
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
                <Descriptions.Item label="First Air Date">{first_air_date ? formatDateDMY(first_air_date) : "N/A"}</Descriptions.Item>
                <Descriptions.Item label="Status">{status || "N/A"}</Descriptions.Item>
                <Descriptions.Item label="Language">{original_language?.toUpperCase() || "N/A"}</Descriptions.Item>
                <Descriptions.Item label="Last Air Date">{last_air_date ? formatDateDMY(last_air_date) : "N/A"}</Descriptions.Item>
                {creators && (
                  <Descriptions.Item label="Created By">{creators}</Descriptions.Item>
                )}
                {next_episode_to_air && (
                  <Descriptions.Item label="Next Episode">{formatDateDMY(next_episode_to_air.air_date)}</Descriptions.Item>
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

              {/* Episode progress tracker */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <PlayCircleOutlined style={{ color: WATCHED_GREEN, fontSize: 16 }} />
                {epProgress && !epEditing ? (
                  <>
                    <Typography.Text>
                      Currently on{" "}
                      <Typography.Text strong>
                        S{String(epProgress.season).padStart(2, "0")}E{String(epProgress.episode).padStart(2, "0")}
                      </Typography.Text>
                    </Typography.Text>
                    <Button size="small" type="link" style={{ padding: 0 }} onClick={() => {
                      setEpSeason(epProgress.season);
                      setEpEpisode(epProgress.episode);
                      setEpEditing(true);
                    }}>
                      Edit
                    </Button>
                    <Popconfirm
                      title="Remove episode progress?"
                      onConfirm={async () => {
                        await clearEpProgress();
                        showSuccess("Episode progress removed.");
                      }}
                      okText="Remove"
                      okType="danger"
                      cancelText="Cancel"
                    >
                      <Button size="small" type="link" danger style={{ padding: 0 }} icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </>
                ) : epEditing ? (
                  <>
                    <Typography.Text style={{ fontSize: FONT_SIZE.caption }}>S</Typography.Text>
                    <Button size="small" icon={<MinusOutlined />} onClick={() => { setEpSeason((s) => Math.max(1, s - 1)); setEpEpisode(1); }} />
                    <Typography.Text style={{ minWidth: 20, textAlign: "center" }}>{epSeason}</Typography.Text>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => { setEpSeason((s) => Math.min(s + 1, number_of_seasons ?? 99)); setEpEpisode(1); }} />
                    <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption }}>/{number_of_seasons ?? "?"}</Typography.Text>
                    <Typography.Text style={{ fontSize: FONT_SIZE.caption, marginLeft: 4 }}>E</Typography.Text>
                    <Button size="small" icon={<MinusOutlined />} onClick={() => setEpEpisode((e) => Math.max(1, e - 1))} />
                    <Typography.Text style={{ minWidth: 20, textAlign: "center" }}>{epEpisode}</Typography.Text>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => setEpEpisode((e) => Math.min(e + 1, getMaxEpisodes(epSeason)))} />
                    <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption }}>/{getMaxEpisodes(epSeason)}</Typography.Text>
                    <Button
                      size="small"
                      type="primary"
                      onClick={async () => {
                        await updateEpProgress(epSeason, epEpisode);
                        setEpEditing(false);
                        showSuccess(`Progress saved: S${String(epSeason).padStart(2, "0")}E${String(epEpisode).padStart(2, "0")}`);
                      }}
                    >
                      Save
                    </Button>
                    <Button size="small" onClick={() => setEpEditing(false)}>Cancel</Button>
                  </>
                ) : (
                  <Button
                    size="small"
                    type="dashed"
                    onClick={() => {
                      setEpSeason(1);
                      setEpEpisode(1);
                      setEpEditing(true);
                    }}
                  >
                    Track episode progress
                  </Button>
                )}
              </div>
            </Space>
          </Col>
        </Row>
      </div>

      {showRatingModal && (
        <RatingModal
          title={name}
          existing={myRating}
          onSave={async (r, rev) => {
            try {
              await setRating(id, "tv", name, r, rev);
              showSuccess(`Rated ${name} ${r}/10`);
            } catch (err) {
              showError(getApiError(err, "Failed to save rating."));
            }
          }}
          onClose={() => setShowRatingModal(false)}
        />
      )}

      <AddToListModal
        open={showListModal}
        onClose={() => setShowListModal(false)}
        mediaId={id}
        mediaType="tv"
        title={name}
        posterPath={poster_path}
        voteAverage={vote_average}
      />

      <MarkWatchedModal
        open={showMarkWatchedModal}
        mediaId={id}
        mediaType="tv"
        onCancel={() => setShowMarkWatchedModal(false)}
        onConfirm={async (details) => {
          try {
            await toggleWatched({ id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average, ...details });
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
        {tvShow.watchProviders && (
          <>
            <SectionHeader title="Where to Watch" />
            <WatchProviders providers={tvShow.watchProviders} title={tvShow.name} />
          </>
        )}

        {/* Cast - horizontal scroll */}
        {castList.length > 0 && (
          <>
            <SectionHeader title="Cast" />
            <div className="cast-scroll-container">
              {castList.slice(0, 15).map((actor) => (
                <div key={actor.id} className="cast-scroll-item">
                  <Card
                    hoverable
                    size="small"
                    onClick={() => navigate(`/person/${actor.id}`)}
                    cover={
                      <img
                        src={actor.profile_path ? `${IMG_URL}${actor.profile_path}` : NO_IMAGE}
                        alt={actor.name}
                        className="cast-card-img-lg"
                        loading="lazy"
                      />
                    }
                    styles={{ body: { padding: "6px 8px" } }}
                    aria-label={`View details for ${actor.name}`}
                  >
                    <Typography.Text strong style={{ fontSize: FONT_SIZE.caption, display: "block" }}>{actor.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.caption }}>
                      {actor.roles?.[0]?.character || ""}
                    </Typography.Text>
                  </Card>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Episode Guide */}
        {tvShow.seasons?.length > 0 && (
          <>
            <Divider />
            <Collapse
              ghost
              defaultActiveKey={["episode-guide"]}
              items={[{
                key: "episode-guide",
                label: <Typography.Title level={4} style={{ margin: 0 }}>Episode Guide</Typography.Title>,
                children: <EpisodeGuide tvId={tvShow.id} seasons={tvShow.seasons} />,
              }]}
            />
          </>
        )}

        <MediaCardGrid
          title="Recommendations"
          items={recommendationsFiltered.map((show) => ({
            id: show.id,
            posterPath: show.poster_path,
            name: "name" in show ? show.name : "",
          }))}
          mediaType="tv"
        />

        <MediaCardGrid
          title="Similar TV Shows"
          items={similarFiltered.map((show) => ({
            id: show.id,
            posterPath: show.poster_path,
            name: "name" in show ? show.name : "",
          }))}
          mediaType="tv"
        />

        {/* Videos — trailers only */}
        {videos?.results?.filter((v) => v.type === "Trailer").length > 0 && (
          <>
            <SectionHeader title="Trailers" />
            <Row gutter={[16, 16]}>
              {videos!.results.filter((v) => v.type === "Trailer").map((video) => (
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

export default TVShowDetails;
