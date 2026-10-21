import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Select, Typography, Skeleton, Tag, Space, Collapse, Switch, Button } from "antd";
import { LoadError } from "./LoadError";
import { PosterPlaceholder } from "./PosterPlaceholder";
import { StarFilled, CalendarOutlined, ClockCircleOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { fetchTVSeason } from "../api/tmdb";
import type { TMDBTVSeason, TMDBSeasonDetail } from "../types";
import { FONT_SIZE } from "../constants/typography";
import { RATING_GOLD, STILL_URL } from "../constants/ui";
import { formatDateDMY } from "../utils/formatDate";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { isEpisodeHidden, type ShieldProgress } from "../utils/spoilerShield";

interface Props {
  tvId: number;
  seasons: TMDBTVSeason[];
  /** The user's episode progress for this show, null when not tracked. */
  progress?: ShieldProgress | null;
  progressLoading?: boolean;
  progressError?: boolean;
  watched?: boolean;
}

const STILL_SIZE = { width: 140, height: 79, borderRadius: 6, flexShrink: 0 } as const;

const EpisodeGuide = ({
  tvId, seasons, progress = null, progressLoading = false, progressError = false, watched = false,
}: Props) => {
  const regularSeasons = seasons.filter((s) => s.season_number > 0);
  const specials = seasons.find((s) => s.season_number === 0);
  const orderedSeasons = specials ? [...regularSeasons, specials] : regularSeasons;
  const firstSeason = regularSeasons[0]?.season_number ?? 0;

  const [selectedSeason, setSelectedSeason] = useState<number>(firstSeason);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<number, TMDBSeasonDetail>>({});
  const [seasonData, setSeasonData] = useState<TMDBSeasonDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const requestedSeason = useRef<number | null>(null);
  // Device preference, like the theme (spoiler-shield).
  const [hideSpoilers, setHideSpoilers] = useLocalStorage("cinedb_spoiler_shield", true);
  // TMDB episode ids revealed on this page visit; survives season switches.
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());

  const loadSeason = async (seasonNumber: number) => {
    requestedSeason.current = seasonNumber;
    setFailed(false);
    if (cache.current[seasonNumber]) {
      setSeasonData(cache.current[seasonNumber]);
      // Another season's request may still be in flight and its `finally`
      // won't clear this (it's no longer the requested one), so clear it here.
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchTVSeason(tvId, seasonNumber);
      cache.current[seasonNumber] = res.data;
      if (requestedSeason.current !== seasonNumber) return;
      setSeasonData(res.data);
    } catch {
      if (requestedSeason.current === seasonNumber) setFailed(true);
    } finally {
      if (requestedSeason.current === seasonNumber) setLoading(false);
    }
  };

  const handleSeasonChange = (value: number) => {
    setSelectedSeason(value);
    loadSeason(value);
  };

  // Pick the first season once progress settles: showing episodes before it
  // is known would flash the spoilers the shield hides. Meanwhile the first
  // regular season is requested alongside the progress request; `sharedGet`
  // joins the load below to it, so most users wait no extra round trip. The
  // ref makes the choice once (StrictMode's replay included), so a later
  // progress change (Next Episode, Edit) never moves the season the user is
  // looking at, and a later progress reload (Retry) never hides the list again.
  const initialChosen = useRef(false);
  const [ready, setReady] = useState(false);
  React.useEffect(() => {
    if (initialChosen.current) return;
    if (progressLoading) {
      fetchTVSeason(tvId, firstSeason)
        .then((res) => { cache.current[firstSeason] = res.data; })
        .catch(() => {});
      return;
    }
    initialChosen.current = true;
    setReady(true);
    const tracked = progress && seasons.some((s) => s.season_number === progress.season)
      ? progress.season
      : firstSeason;
    setSelectedSeason(tracked);
    loadSeason(tracked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressLoading]);

  if (orderedSeasons.length === 0) return null;

  // The switch shows wherever the shield could apply, on or off.
  // The shield needs a position to measure from, and a watched show has
  // nothing left to spoil.
  const canShield = !progressLoading && !progressError && !watched && progress != null;
  const shieldOn = canShield && hideSpoilers;
  const isHidden = (season: number, episode: number, id: number) =>
    shieldOn && !revealed.has(id) && isEpisodeHidden(season, episode, progress);
  const reveal = (id: number) => setRevealed((prev) => new Set(prev).add(id));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Select
          value={selectedSeason}
          onChange={handleSeasonChange}
          disabled={!ready}
          style={{ minWidth: 180 }}
          options={orderedSeasons.map((s) => ({
            value: s.season_number,
            label: `${s.name} (${s.episode_count} eps)`,
          }))}
        />
        {canShield && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto", cursor: "pointer" }}>
            <Switch size="small" checked={hideSpoilers} onChange={setHideSpoilers} />
            <Typography.Text>Hide spoilers</Typography.Text>
          </label>
        )}
      </div>

      {progressError && (
        <Typography.Paragraph type="secondary" style={{ fontSize: FONT_SIZE.caption, marginTop: -8 }}>
          Couldn't load your progress, so spoilers aren't hidden.
        </Typography.Paragraph>
      )}

      {loading || !ready ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <Skeleton active avatar={{ shape: "square", size: 80 }} paragraph={{ rows: 2 }} />
            </motion.div>
          ))}
        </div>
      ) : failed ? (
        <LoadError title="Couldn't load this season" onRetry={() => loadSeason(selectedSeason)} />
      ) : seasonData ? (
        <Collapse
          ghost
          items={[{
            key: "episodes",
            label: (
              <Typography.Text type="secondary">
                {seasonData.episodes.length} episode{seasonData.episodes.length !== 1 ? "s" : ""}
              </Typography.Text>
            ),
            children: (
              <Collapse
                ghost
                items={seasonData.episodes.map((ep) => {
                  // Hidden content is left out of the page, not blurred: a
                  // screen reader can't read it and the still isn't fetched.
                  const hidden = isHidden(seasonData.season_number, ep.episode_number, ep.id);
                  return {
                    key: ep.id,
                    label: (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <Typography.Text type="secondary" style={{ minWidth: 28, fontSize: FONT_SIZE.caption }}>
                          E{ep.episode_number}
                        </Typography.Text>
                        {hidden ? (
                          <Typography.Text type="secondary" style={{ flex: 1 }}>
                            <EyeInvisibleOutlined style={{ marginRight: 6 }} />
                            Hidden to avoid spoilers
                          </Typography.Text>
                        ) : (
                          <Typography.Text strong style={{ flex: 1 }}>
                            {ep.name}
                          </Typography.Text>
                        )}
                        <Space size={8} wrap>
                          {ep.air_date && (
                            <Tag icon={<CalendarOutlined />} color="default" style={{ fontSize: FONT_SIZE.caption }}>
                              {formatDateDMY(ep.air_date)}
                            </Tag>
                          )}
                          {ep.runtime != null && ep.runtime > 0 && (
                            <Tag icon={<ClockCircleOutlined />} color="default" style={{ fontSize: FONT_SIZE.caption }}>
                              {ep.runtime}m
                            </Tag>
                          )}
                          {ep.vote_average > 0 && (
                            <Tag icon={<StarFilled style={{ color: RATING_GOLD }} />} color="default" style={{ fontSize: FONT_SIZE.caption }}>
                              {ep.vote_average.toFixed(1)}
                            </Tag>
                          )}
                        </Space>
                      </div>
                    ),
                    children: hidden ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 40, flexWrap: "wrap" }}>
                        <PosterPlaceholder aria-hidden style={STILL_SIZE}>
                          <EyeInvisibleOutlined style={{ fontSize: 20 }} />
                        </PosterPlaceholder>
                        <Button type="link" style={{ padding: 0 }} onClick={() => reveal(ep.id)}>
                          Show details for episode {ep.episode_number}
                        </Button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12, paddingLeft: 40 }}>
                        {ep.still_path && (
                          <img
                            src={`${STILL_URL}${ep.still_path}`}
                            alt={ep.name}
                            loading="lazy"
                            style={{ ...STILL_SIZE, objectFit: "cover" }}
                          />
                        )}
                        <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.body, lineHeight: 1.6 }}>
                          {ep.overview || "No description available."}
                        </Typography.Text>
                      </div>
                    ),
                  };
                })}
              />
            ),
          }]}
        />
      ) : null}
    </div>
  );
};

export default EpisodeGuide;
