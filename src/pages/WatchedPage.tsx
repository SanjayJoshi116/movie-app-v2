import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Row, Col, Card, Button, Tag, Typography, Empty, Space, Popconfirm, Pagination,
} from "antd";
import { StarFilled, DeleteOutlined, EyeFilled, EyeOutlined, ClearOutlined } from "@ant-design/icons";
import { useAppContext } from "../context/useAppContext";
import { useToast } from "../hooks/useToast";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const IMG_URL = "https://image.tmdb.org/t/p/w500";
const NO_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='%231a1a2e'/%3E%3Ctext x='150' y='225' text-anchor='middle' dominant-baseline='middle' fill='%23555' font-size='14' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E`;

function WatchedPage() {
  const navigate = useNavigate();
  const { watchedList, removeFromWatched, clearAllWatched } = useAppContext();
  const { showSuccess, showError } = useToast();
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 48;

  const sorted = [...watchedList].sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
        <Typography.Title level={2} style={{ margin: 0, flex: 1 }}>
          Watched ({watchedList.length})
        </Typography.Title>
        {watchedList.length > 0 && (
          <Popconfirm
            title="Clear all watched?"
            description="This will permanently remove all watched entries."
            onConfirm={async () => {
              setClearing(true);
              try {
                await clearAllWatched();
                showSuccess("Cleared all watched entries.");
              } catch {
                showError("Failed to clear watched list.");
              } finally {
                setClearing(false);
              }
            }}
            okText="Clear All"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
          >
            <Button danger icon={<ClearOutlined />} loading={clearing}>
              Clear All
            </Button>
          </Popconfirm>
        )}
      </div>

      {watchedList.length > 0 && (
        <Space size={16} style={{ marginBottom: 24 }}>
          <Tag color="blue">{movies.length} movie{movies.length !== 1 ? "s" : ""}</Tag>
          <Tag color="purple">{tvShows.length} TV show{tvShows.length !== 1 ? "s" : ""}</Tag>
        </Space>
      )}

      {watchedList.length === 0 ? (
        <Empty
          image={<EyeOutlined style={{ fontSize: 48, color: "#52c41a" }} />}
          description="Nothing marked as watched yet. Browse movies and TV shows and click the eye icon."
          style={{ padding: "60px 0" }}
        >
          <Button type="primary" onClick={() => navigate("/movies")}>Browse Movies</Button>
        </Empty>
      ) : (
        <>
          <Row gutter={[16, 20]}>
            {paginated.map((item) => (
              <Col key={`${item.type}-${item.id}`} xs={12} sm={8} md={6} lg={4}>
                <Card
                  hoverable
                  cover={
                    <img
                      src={
                        item.posterPath
                          ? `${IMG_URL}${item.posterPath}`
                          : NO_IMAGE
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
                      onConfirm={() => { removeFromWatched(item.id, item.type); showSuccess("Removed from watched"); }}
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

          {watchedList.length > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={watchedList.length}
                onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                showTotal={(total) => `${total} titles`}
              />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

export default WatchedPage;
