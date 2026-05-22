import React, { useState, useEffect } from "react";
import { Modal, Spin, Typography, Empty } from "antd";
import axios from "axios";
import type { TMDBMovieSummary, TMDBTVSummary, TMDBVideo } from "../types";

const PROXY_BASE = `http://${window.location.hostname}:3001/api/tmdb`;

interface Props {
  movie?: TMDBMovieSummary | null;
  tvShow?: TMDBTVSummary | null;
  onClose: () => void;
}

function Overlay({ movie, tvShow, onClose }: Props) {
  const [videos, setVideos] = useState<TMDBVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const item = movie ?? tvShow;

  useEffect(() => {
    if (!item?.id) {
      setLoading(false);
      return;
    }

    const endpoint = movie ? `/movie/${item.id}/videos` : `/tv/${item.id}/videos`;

    axios
      .get<{ results: TMDBVideo[] }>(`${PROXY_BASE}${endpoint}`)
      .then((response) => {
        setVideos(response.data.results.filter((v) => v.type === "Trailer"));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching videos:", err);
        setError("Failed to load videos.");
        setLoading(false);
      });
  }, [movie, tvShow]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const title = "title" in item ? item.title : item.name;

  return (
    <Modal
      open
      title={title}
      onCancel={onClose}
      footer={null}
      width="80vw"
      centered
      styles={{ body: { maxHeight: "75vh", overflowY: "auto", padding: "16px 0" } }}
      aria-label={`Videos for ${title}`}
    >
      <div className="overlay-content" style={{ position: "static", top: "auto", marginTop: 0 }}>
        {loading ? (
          <Spin size="large" style={{ display: "block", margin: "40px auto" }} />
        ) : error ? (
          <Typography.Text type="danger">{error}</Typography.Text>
        ) : videos.length > 0 ? (
          videos.map((video) => (
            <iframe
              key={video.id}
              src={`https://www.youtube.com/embed/${video.key}`}
              title={video.name}
              className="embed-frame"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ))
        ) : (
          <Empty description="No trailers found" />
        )}
      </div>
    </Modal>
  );
}

export default Overlay;
