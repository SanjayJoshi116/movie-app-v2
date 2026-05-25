import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import EpisodeGuide from "./EpisodeGuide";
import { motion } from "framer-motion";
import {
  Row, Col, Button, Tag, Typography, Descriptions,
  Statistic, Card, Space, Divider, Image, Spin, Modal, Checkbox, Collapse, Popconfirm,
} from "antd";
import {
  BookOutlined, BookFilled, StarOutlined, StarFilled, LeftOutlined, EyeOutlined, EyeFilled, PlusOutlined,
  PlayCircleOutlined, MinusOutlined, DeleteOutlined,
} from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useListsContext } from "../context/useListsContext";
import { useToast } from "../hooks/useToast";
import { useEpisodeProgress } from "../hooks/useEpisodeProgress";
import { RatingModal } from "./watchlist/RatingModal";
import type { TMDBTVDetail, TMDBProvider, TMDBProviderRegion } from "../types";

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
  const locationState = location.state as { from?: string; page?: number; scrollY?: number; loadedPages?: number } | null;
  const from = locationState?.from;
  const savedPage = locationState?.page;
  const savedScrollY = locationState?.scrollY;
  const savedLoadedPages = locationState?.loadedPages;
  const { isInWatchlist, toggleWatchlist, getRating, setRating, isWatched, toggleWatched, theme } = useAppContext();
  const { lists, addToList, removeFromList, isInList } = useListsContext();
  const { showSuccess } = useToast();
  const { progress: epProgress, update: updateEpProgress, clear: clearEpProgress } = useEpisodeProgress(tvShow?.id ?? 0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
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
    aggregate_credits, similar, recommendations, images,
  } = tvShow;

  const hasBackdrop = !!backdrop_path;
  const castList = aggregate_credits?.cast ?? [];

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
              alt={name}
              style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
            />
          </Col>
          <Col xs={24} sm={16} md={18}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Typography.Title level={2} style={{ margin: 0 }}>{name}</Typography.Title>
                <motion.button
                  onClick={() => {
                    toggleWatchlist({ id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average });
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
                    toggleWatched({ id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average });
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
                  aria-label="Rate this show"
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

              {/* Episode progress tracker */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <PlayCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />
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
                    <Typography.Text style={{ fontSize: 12 }}>S</Typography.Text>
                    <Button size="small" icon={<MinusOutlined />} onClick={() => { setEpSeason((s) => Math.max(1, s - 1)); setEpEpisode(1); }} />
                    <Typography.Text style={{ minWidth: 20, textAlign: "center" }}>{epSeason}</Typography.Text>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => { setEpSeason((s) => Math.min(s + 1, number_of_seasons ?? 99)); setEpEpisode(1); }} />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>/{number_of_seasons ?? "?"}</Typography.Text>
                    <Typography.Text style={{ fontSize: 12, marginLeft: 4 }}>E</Typography.Text>
                    <Button size="small" icon={<MinusOutlined />} onClick={() => setEpEpisode((e) => Math.max(1, e - 1))} />
                    <Typography.Text style={{ minWidth: 20, textAlign: "center" }}>{epEpisode}</Typography.Text>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => setEpEpisode((e) => Math.min(e + 1, getMaxEpisodes(epSeason)))} />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>/{getMaxEpisodes(epSeason)}</Typography.Text>
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
          onSave={(r, rev) => {
            setRating(id, "tv", name, r, rev);
            showSuccess(`Rated ${name} ${r}/10`);
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
            const inList = isInList(list.id, id, "tv");
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
                    if (inList) {
                      removeFromList(list.id, id, "tv");
                      showSuccess(`Removed from "${list.name}"`);
                    } else {
                      addToList(list.id, { id, type: "tv", title: name, posterPath: poster_path, voteAverage: vote_average });
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
        {tvShow.watchProviders && (
          <>
            <Divider orientation="left"><Typography.Title level={4} style={{ margin: 0 }}>Where to Watch</Typography.Title></Divider>
            <WatchProviders providers={tvShow.watchProviders} title={tvShow.name} />
          </>
        )}

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
                    styles={{ body: { padding: "6px 8px" } }}
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
                      styles={{ body: { padding: "6px 8px" } }}
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
              {((recommendations as { results?: Array<{ id: number; poster_path: string | null; name: string }> })?.results ?? []).map((show) => (
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
                    styles={{ body: { padding: "6px 8px" } }}
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
            <Image.PreviewGroup>
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
            </Image.PreviewGroup>
          </>
        )}
      </div>
    </div>
  );
};

export default TVShowDetails;
