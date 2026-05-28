import React, { useState, useRef } from "react";
import { Select, Typography, Skeleton, Tag, Space, Collapse } from "antd";
import { StarFilled, CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { fetchTVSeason } from "../api/tmdb";
import type { TMDBTVSeason, TMDBSeasonDetail } from "../types";

const STILL_URL = "https://image.tmdb.org/t/p/w300";

interface Props {
  tvId: number;
  seasons: TMDBTVSeason[];
}

const EpisodeGuide = ({ tvId, seasons }: Props) => {
  const regularSeasons = seasons.filter((s) => s.season_number > 0);
  const specials = seasons.find((s) => s.season_number === 0);
  const orderedSeasons = specials ? [...regularSeasons, specials] : regularSeasons;

  const [selectedSeason, setSelectedSeason] = useState<number>(
    regularSeasons[0]?.season_number ?? 0,
  );
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<number, TMDBSeasonDetail>>({});
  const [seasonData, setSeasonData] = useState<TMDBSeasonDetail | null>(null);

  const loadSeason = async (seasonNumber: number) => {
    if (cache.current[seasonNumber]) {
      setSeasonData(cache.current[seasonNumber]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchTVSeason(tvId, seasonNumber);
      cache.current[seasonNumber] = res.data;
      setSeasonData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonChange = (value: number) => {
    setSelectedSeason(value);
    loadSeason(value);
  };

  // Load initial season on first render
  React.useEffect(() => {
    if (selectedSeason !== null) loadSeason(selectedSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (orderedSeasons.length === 0) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Select
          value={selectedSeason}
          onChange={handleSeasonChange}
          style={{ minWidth: 180 }}
          options={orderedSeasons.map((s) => ({
            value: s.season_number,
            label: `${s.name} (${s.episode_count} eps)`,
          }))}
        />
        {seasonData && !loading && (
          <Typography.Text type="secondary">
            {seasonData.episodes.length} episode{seasonData.episodes.length !== 1 ? "s" : ""}
          </Typography.Text>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} active avatar={{ shape: "square", size: 80 }} paragraph={{ rows: 2 }} />
          ))}
        </div>
      ) : seasonData ? (
        <Collapse
          ghost
          items={seasonData.episodes.map((ep) => ({
            key: ep.id,
            label: (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Typography.Text type="secondary" style={{ minWidth: 28, fontSize: 12 }}>
                  E{ep.episode_number}
                </Typography.Text>
                <Typography.Text strong style={{ flex: 1 }}>
                  {ep.name}
                </Typography.Text>
                <Space size={8} wrap>
                  {ep.air_date && (
                    <Tag icon={<CalendarOutlined />} color="default" style={{ fontSize: 11 }}>
                      {ep.air_date}
                    </Tag>
                  )}
                  {ep.runtime != null && ep.runtime > 0 && (
                    <Tag icon={<ClockCircleOutlined />} color="default" style={{ fontSize: 11 }}>
                      {ep.runtime}m
                    </Tag>
                  )}
                  {ep.vote_average > 0 && (
                    <Tag icon={<StarFilled style={{ color: "#f5c518" }} />} color="default" style={{ fontSize: 11 }}>
                      {ep.vote_average.toFixed(1)}
                    </Tag>
                  )}
                </Space>
              </div>
            ),
            children: (
              <div style={{ display: "flex", gap: 12, paddingLeft: 40 }}>
                {ep.still_path && (
                  <img
                    src={`${STILL_URL}${ep.still_path}`}
                    alt={ep.name}
                    loading="lazy"
                    style={{ width: 140, height: 79, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {ep.overview || "No description available."}
                </Typography.Text>
              </div>
            ),
          }))}
        />
      ) : null}
    </div>
  );
};

export default EpisodeGuide;
