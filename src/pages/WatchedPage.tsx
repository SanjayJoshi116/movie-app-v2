import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Card, Button, Tag, Typography, Empty, Space, Popconfirm,
} from "antd";
import { StarFilled, DeleteOutlined, EyeFilled } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const IMG_URL = "https://image.tmdb.org/t/p/w500";

function WatchedPage() {
  const navigate = useNavigate();
  const { watchedList, removeFromWatched } = useAppContext();

  const movies = watchedList.filter((w) => w.type === "movie");
  const tvShows = watchedList.filter((w) => w.type === "tv");

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <EyeFilled style={{ color: "#52c41a", fontSize: 24 }} />
        <Typography.Title level={2} style={{ margin: 0 }}>
          Watched ({watchedList.length})
        </Typography.Title>
      </div>

      {watchedList.length > 0 && (
        <Space size={16} style={{ marginBottom: 24 }}>
          <Tag color="blue">{movies.length} movie{movies.length !== 1 ? "s" : ""}</Tag>
          <Tag color="purple">{tvShows.length} TV show{tvShows.length !== 1 ? "s" : ""}</Tag>
        </Space>
      )}

      {watchedList.length === 0 ? (
        <Empty
          description="Nothing marked as watched yet. Browse movies and TV shows and click the eye icon."
          style={{ padding: "60px 0" }}
        />
      ) : (
        <Row gutter={[16, 20]}>
          {[...watchedList]
            .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
            .map((item) => (
              <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4}>
                <Card
                  hoverable
                  cover={
                    <img
                      src={
                        item.posterPath
                          ? `${IMG_URL}${item.posterPath}`
                          : "https://placehold.co/300x450?text=No+Image"
                      }
                      alt={item.title}
                      className="movie-poster-img"
                      onClick={() =>
                        navigate(item.type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`, { state: { from: '/watched' } })
                      }
                      style={{ cursor: "pointer" }}
                    />
                  }
                  bodyStyle={{ padding: "10px 12px" }}
                  actions={[
                    <Popconfirm
                      key="remove"
                      title="Remove from watched?"
                      onConfirm={() => removeFromWatched(item.id, item.type)}
                      okText="Remove"
                      cancelText="Cancel"
                    >
                      <Button type="link" danger icon={<DeleteOutlined />} size="small">
                        Remove
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <Typography.Text
                    strong
                    style={{ fontSize: 12, display: "block", marginBottom: 4 }}
                    ellipsis={{ tooltip: item.title }}
                  >
                    {item.title}
                  </Typography.Text>

                  <Space size={4} wrap>
                    <Tag color={item.type === "movie" ? "blue" : "purple"} style={{ margin: 0 }}>
                      {item.type === "movie" ? "Movie" : "TV"}
                    </Tag>
                    {item.voteAverage != null && (
                      <Tag color="gold" style={{ margin: 0 }}>
                        <StarFilled /> {item.voteAverage.toFixed(1)}
                      </Tag>
                    )}
                  </Space>

                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 10, display: "block", marginTop: 6 }}
                  >
                    {new Date(item.watchedAt).toLocaleDateString()}
                  </Typography.Text>
                </Card>
              </Col>
            ))}
        </Row>
      )}
    </motion.div>
  );
}

export default WatchedPage;
