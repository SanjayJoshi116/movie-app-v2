import React from "react";
import { Row, Col, Card, Tag, Button, Empty, Tooltip } from "antd";
import { EyeOutlined, EyeFilled, SearchOutlined, FilterOutlined, InboxOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import type { TMDBTVSummary } from "../types";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";

const IMG_URL = "https://image.tmdb.org/t/p/w500";

function getRatingColor(vote: number): string {
  if (vote >= 8) return "#52c41a";
  if (vote >= 5) return "#faad14";
  return "#ff4d4f";
}

interface Props {
  tvShows: TMDBTVSummary[];
  onKnowMore: (id: number) => void;
  searchTerm?: string;
  hasFilters?: boolean;
}

const TVShows = ({ tvShows, onKnowMore, searchTerm, hasFilters }: Props) => {
  const { isWatched, toggleWatched, theme } = useAppContext();
  const { showSuccess } = useToast();

  if (tvShows.length === 0) {
    let icon = <InboxOutlined style={{ fontSize: 48, color: "#aaa" }} />;
    let description = "No TV shows found.";

    if (searchTerm) {
      icon = <SearchOutlined style={{ fontSize: 48, color: "#aaa" }} />;
      description = `No results for "${searchTerm}". Try a different search.`;
    } else if (hasFilters) {
      icon = <FilterOutlined style={{ fontSize: 48, color: "#aaa" }} />;
      description = "No TV shows match your filters. Try adjusting them.";
    }

    return (
      <Empty
        image={icon}
        description={description}
        style={{ padding: "48px 0" }}
      />
    );
  }

  return (
    <main aria-label="TV show results">
      <Row gutter={[16, 20]}>
        {tvShows.map((tvShow) => (
          <Col key={tvShow.id} xs={12} sm={8} md={6} lg={4} xl={4}>
            <motion.div
              role="article"
              whileHover={{ scale: 1.04, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ cursor: "pointer" }}
              onClick={() => onKnowMore(tvShow.id)}
            >
              <Card
                hoverable
                className="glass-card"
                cover={
                  <img
                    src={
                      tvShow.poster_path
                        ? `${IMG_URL}${tvShow.poster_path}`
                        : "https://placehold.co/500x750?text=No+Image"
                    }
                    alt={tvShow.name}
                    loading="lazy"
                    className="movie-poster-img"
                  />
                }
                bodyStyle={{ padding: "10px 12px" }}
                style={{ height: "100%" }}
              >
                <Card.Meta
                  title={
                    <span style={{ fontSize: 13, lineHeight: "1.3", display: "block" }}>
                      {tvShow.name}
                    </span>
                  }
                  description={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <Tag color={getRatingColor(tvShow.vote_average)} style={{ margin: 0 }}>
                        ★ {tvShow.vote_average.toFixed(1)}
                      </Tag>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Tooltip title={isWatched(tvShow.id, "tv") ? "Unmark watched" : "Mark as watched"}>
                          <Button
                            size="small"
                            type="text"
                            icon={isWatched(tvShow.id, "tv") ? <EyeFilled /> : <EyeOutlined />}
                            style={{ color: isWatched(tvShow.id, "tv") ? "#52c41a" : theme === "dark" ? "#f5c518" : "#000000" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const alreadyWatched = isWatched(tvShow.id, "tv");
                              toggleWatched({ id: tvShow.id, type: "tv", title: tvShow.name, posterPath: tvShow.poster_path, voteAverage: tvShow.vote_average });
                              showSuccess(alreadyWatched ? "Removed from watched" : "Marked as watched");
                            }}
                            aria-label={isWatched(tvShow.id, "tv") ? "Unmark watched" : "Mark as watched"}
                          />
                        </Tooltip>
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          onClick={(e) => {
                            e.stopPropagation();
                            onKnowMore(tvShow.id);
                          }}
                          aria-label={`Know more about ${tvShow.name}`}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  }
                />
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>
    </main>
  );
};

export default TVShows;
